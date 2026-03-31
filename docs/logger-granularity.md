# Logger Granularity

## 目的

ロガー実装時に「どの粒度で何を残すか」を先に固定し、過剰ログと情報不足の両方を避ける。

このプロジェクトでは特に以下を重視する。

- 保存処理の成否を追えること
- 保存失敗時に切り分けできること
- Chrome Extension MV3 の service worker 再起動に耐えること
- 検索・保存対象の本文や URL を不用意にログへ出しすぎないこと

## 調査結果の要点

### 1. 粒度は「処理の境界」で切る

OWASP は、ログ量は多すぎても少なすぎても問題で、要件・設計段階で何を残すか決めるべきだとしている。  
特に blind checklist にすると "alarm fog" が起きるため、イベント単位を明確にした方がよい。

このプロジェクトでは、関数の入口ごとではなく、次のような処理境界で打つのが妥当。

- 保存リクエスト受信
- 抽出成功 / 失敗
- DB 書き込み成功 / 重複判定 / 失敗
- メディア保存開始 / 成功 / 失敗 / 再開
- タグ更新成功 / 失敗
- viewer 読み込み失敗などの UI 異常

### 2. 構造化ログ前提にした方が後で使いやすい

Google Cloud の structured logging では、JSON payload にすると JSON path で検索・絞り込みできる。  
このプロジェクトでも、文字列連結中心ではなくオブジェクト付きログを前提にした方がよい。

最低限、各ログに揃えたい属性:

- `event`
- `scope`
- `level`
- `xPostId`
- `mediaId`
- `requestId`
- `status`
- `durationMs`
- `count`
- `reason`

### 3. レベル定義は少数に絞る

OpenTelemetry の severity 定義では、`DEBUG` はデバッグ用、`INFO` はイベント発生、`WARN` は異常だが処理継続可能、`ERROR` は失敗、と整理されている。  
このプロジェクトの MVP では `trace` は不要で、`debug/info/warn/error` の 4 段階で十分。

### 4. Chrome Extension MV3 では service worker の寿命を前提にする

Chrome 拡張の service worker は 30 秒の非アクティブで停止しうる。  
そのため「前にどこまで進んだか」をメモリ上の前提にせず、再開可能なログ文脈を残す方がよい。

つまり、長い処理では次をログに含める。

- 再開対象件数
- 対象 ID
- 実行理由 (`onInstalled`, `onStartup`, message handler など)
- 開始 / 完了 / 失敗

### 5. ログに出してはいけない情報を最初に決める

OWASP はトークン、セッション ID、個人情報、秘密情報などの直接記録を避けるべきとしている。  
この拡張では X 投稿本文やメディア URL も、常時フルで出す設計にはしない方がよい。

特に常時ログしないもの:

- `post_text` の全文
- `post_url` の全文
- `source_url` の全文
- 将来入る可能性のある cookie, token, auth 系情報
- 例外オブジェクトに含まれる生のレスポンス全文

必要な場合は以下に留める。

- 本文長
- URL のドメインや種別
- `xPostId`
- 失敗理由の要約

## このリポジトリ向けの推奨粒度

## `debug`

開発中の切り分け用。デフォルトでは無効推奨。

出す対象:

- DOM scan の件数サマリ
- save button attach 件数
- runtime message の受信種別
- 重複保存時の分岐
- pending media resume の取得件数
- バッチ処理の途中経過

出しすぎない対象:

- `MutationObserver` の発火ごと
- article ごとの細かい走査ログ
- 投稿本文や URL の生データ

方針:

- 高頻度箇所は 1 件ずつではなく集計して出す
- ループ内で毎回打たない

## `info`

ユーザー操作や状態遷移の記録。通常運用で最も重要。

出す対象:

- 拡張初期化
- viewer オープン
- 投稿保存開始
- 投稿保存成功
- 重複判定
- メディア保存開始
- メディア保存完了
- pending media resume 開始 / 完了
- タグ追加 / 削除成功
- 一括保存の集計結果

このレベルでは「何が起きたか」が分かればよく、詳細内部状態は持ち込まない。

## `warn`

異常だが処理継続可能なもの。

出す対象:

- `xPostId` を article から取れず保存ボタン状態を確定できない
- 保存済み判定の取得失敗時に UI をフォールバック
- 一部メディアのみ失敗して本体保存は継続
- OPFS 削除失敗
- unsupported / skipped な動画候補
- 自動回復対象があるため再試行へ回した

`warn` は「後で直したいが、即クラッシュではない」ものに限定する。

## `error`

処理失敗。ユーザー影響またはデータ不整合の恐れがあるもの。

出す対象:

- runtime message handler の未捕捉例外
- 投稿抽出失敗で保存不可
- IndexedDB transaction 失敗
- OPFS 書き込み失敗
- fetch 失敗でメディア保存失敗
- タグ更新失敗
- resume 処理全体の失敗

`error` では例外 message に加えて、対象 ID と処理名を必ず付ける。

## 実装単位ごとの推奨ポイント

### `content script`

薄く保つ。高頻度なので `debug` 多用禁止。

推奨:

- 初期化完了: `info`
- scan 結果サマリ: `debug`
- 抽出失敗: `warn` または `error`
- 保存リクエスト送信: `info`
- 保存済み判定取得失敗: `warn`

### `background` / runtime handler

この層がログの中心。

推奨:

- message type 受信: `debug`
- message ごとの request 開始 / 完了: `info`
- 想定外 message / 例外: `error`
- resume 処理開始 / 件数 / 完了: `info`

### archive service

保存・再試行・失敗の切り分けに必要なログを置く。

推奨:

- 新規保存 / duplicate 判定: `info`
- 追加 media 件数 / retry 件数: `debug`
- media persist 成功 / 失敗: `info` / `error`
- tag 付与の上書き分岐: `debug`
- 削除時の OPFS 失敗: `warn`

### viewer

MVP では最小限でよい。

推奨:

- 初回ロード失敗: `error`
- データ取得失敗のリトライ不能ケース: `error`
- ユーザー操作起点の失敗通知: `warn`

## 実装ポリシー案

### デフォルトレベル

- 開発: `debug`
- 本番相当: `info`

### ログ API

最低限この形に揃える。

```ts
logger.info("post.save.succeeded", {
  scope: "archive-service",
  xPostId,
  mediaCount,
  requestId,
  durationMs,
});
```

メッセージ文字列を主にせず、`event` 名を安定キーとして扱う。

### event 命名

`<domain>.<action>.<result>` を基本形にする。

例:

- `runtime.message.received`
- `post.save.started`
- `post.save.duplicate`
- `media.persist.failed`
- `media.resume.started`
- `tags.add.succeeded`

### requestId

1 回の保存操作単位で `requestId` を採番して、`content script` -> `background` -> `archive service` で引き回せると追跡しやすい。  
これは OWASP の interaction identifier の考え方とも整合する。

## 結論

このプロジェクトのロガー粒度は、「関数単位」ではなく「保存・再開・失敗の処理境界単位」にするのが適切。  
特に `MutationObserver` や DOM 走査のような高頻度箇所は集計 `debug` のみに留め、通常運用では `info/warn/error` を中心に残すのがよい。

最初の実装としては次で十分。

- レベルは `debug/info/warn/error`
- 構造化ログ
- `requestId` を付与
- 本文全文や URL 全文は常時ログしない
- background と archive service を主な出力点にする

## Sources

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Chrome Extensions service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- OpenTelemetry Logs Data Model: https://opentelemetry.io/docs/specs/otel/logs/data-model/
- Google Cloud Structured Logging: https://cloud.google.com/logging/docs/structured-logging
