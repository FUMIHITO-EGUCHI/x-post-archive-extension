# Task Packet — 投稿の再取得機能（単体 + 一括）

## Goal

保存済み投稿のデータを X.com から再取得して更新できるようにする。
1件の単体再取得から全件（想定最大 1 万件）の一括再取得まで対応する。
将来のアーカイブ拡張（新フィールド追加など）にも対応できる。
サーバーへの過負荷を避けるため、一括再取得はレート制限付きで行う。

## Background

- 投稿保存は DOM スナップショット方式のため、保存時点のページ状態に依存する
- いいね一覧・検索結果など一部ページでは `data-testid="reply"` 等が DOM に存在せず、
  エンゲージメントカウントが全て 0 で保存される問題が発生している
- 将来フィールドが増えた際、過去保存済みレコードにも適用したい
- ユーザーの保存件数は最大 1 万件規模。30件/分で全件処理すると約 5.5 時間かかる

## Requested Action

設計を確認・確定してから実装に進む。実装後は typecheck と build を確認すること。

## Approach

### 再取得モードの判定方法: background メモリ管理方式を採用（確定）

1. viewer が再取得をリクエストすると、background が再取得キュー（IndexedDB に永続化）に投稿IDを追加する
2. background がバックグラウンドタブ（1枚を使い回す）を開く
3. content script が起動後、background に「この投稿IDが再取得待ちか」を問い合わせる
4. background が一致を確認したら content script に強制上書き保存を指示する
5. 保存完了後、background がタブを次の URL にナビゲートする（タブは閉じずに再利用）

URLパラメータ方式は X.com のルーティングを壊す可能性があるため不採用。

### 単体再取得フロー

1. viewer の投稿カードに「再取得」ボタンを追加
2. ボタン押下 → background に単体再取得リクエスト
3. background がキューに1件追加 → バックグラウンドタブで処理 → 完了後タブを閉じる
4. viewer 側に完了を通知してボタン状態を更新

### 一括再取得フロー

1. viewer（設定画面または一覧画面）に「一括再取得」パネルを追加
2. 対象スコープを選択:
   - 全件（最大 1 万件）
   - エンゲージメント値が全て 0 の投稿のみ
   - 現在のタグ/アカウントフィルタに一致する投稿
3. 対象件数と推定所要時間を表示してから実行確認
4. background がキュー全体を IndexedDB に永続化して処理開始
5. バックグラウンドタブ 1 枚を使い回し、投稿ページ間をナビゲートして順次処理
6. レート制限: **各投稿間に最低 2 秒の遅延**（= 最大 30 件/分）
7. 進捗を viewer に通知（処理済み件数 / 全件数 + 推定残り時間）
8. 途中でキャンセル可能。キャンセル後に再開も可能

### キュー永続化が必要な理由

Chrome は Manifest V3 の service worker をアイドル時に停止する（通常 30 秒〜数分）。
1 万件の処理には数時間かかるため、メモリのみの保持では中断が避けられない。
IndexedDB にキューを保存することで、ブラウザ再起動後も処理を再開できる。

### タブ使い回しが必要な理由

タブの開閉を 1 万回行うと Chrome のリソース（メモリ・プロセス）に負荷がかかる。
1 枚のタブを `chrome.tabs.update` でナビゲートすることで開閉コストを削減する。

## In Scope

- viewer 投稿カードへの単体「再取得」ボタン追加
- 一括再取得 UI（スコープ選択 + 対象件数と推定時間の表示 + 進捗表示 + キャンセル）
- background での再取得コーディネーション
  - IndexedDB への再取得キュー永続化
  - バックグラウンドタブ 1 枚の管理（開く・ナビゲート・閉じる）
  - レート制限（2 秒間隔）
  - service worker 再起動後の処理再開
- content script での「再取得モード」検知と強制上書き保存
- runtime message 型の追加
- エラー時のスキップと失敗件数の記録・表示

## Out Of Scope

- X API（REST/GraphQL）を直接呼び出した非 DOM ベースの取得
- 再取得結果の差分表示（何が変わったかの表示）
- スケジュール実行（定期的な自動再取得）
- メディア（画像・動画）の再ダウンロード（テキスト・エンゲージメント等のフィールド更新のみ）
- 並列タブによる高速化

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
- content script / background は React なし。素の TypeScript を維持する
- 拡張の外部 API 呼び出しは行わない
- 一括再取得中に X.com の通常操作を妨げないようにする（バックグラウンドタブ利用）
- レート制限 2 秒間隔は最低値。処理中の X.com の応答が遅い場合はさらに待つ

## Open Questions

1. ~~URL パラメータ方式か background メモリ管理方式か~~ → background メモリ管理方式に決定
2. ~~件数規模~~ → 1 件〜最大 1 万件対応、キュー IndexedDB 永続化が必須
3. 再取得で上書き更新するフィールドの範囲（確定）:
   - 上書きする: テキスト、表示名、エンゲージメントカウント、メディアの追加分
   - 上書きしない: タグ（手動付与分を保護）、saved_at、quoted_post_id

## DB 設計への影響

- `archive-database.ts` に再取得キュー用のテーブル（`refetch_queue`）を追加する
  ```
  refetch_queue: { x_post_id, status: "pending"|"done"|"error", enqueued_at, attempts }
  ```
- `posts-repository.ts` に `updatePostFields` 関数を追加（タグ・saved_at を除く部分更新）

## Files Likely Involved

- `src/db/archive-database.ts` — `refetch_queue` テーブル追加（DBバージョンアップ）
- `src/db/repositories/refetch-queue-repository.ts` — キュー操作（新規作成）
- `src/db/repositories/posts-repository.ts` — `updatePostFields` 追加
- `src/types/runtime.ts` — 新 message 型の追加
- `src/entrypoints/background.ts` — 再取得コーディネーション・タブ管理
- `src/features/x/bootstrap-x-content-script.ts` — 再取得モード検知
- `src/features/x/extract-post-from-article.ts` — 既存の抽出ロジックを再利用
- `src/features/viewer/components/viewer-app.tsx` — 単体再取得ボタン・一括再取得 UI
- `src/features/runtime/client.ts` — 新クライアント関数

## Result

<!-- 完了後に記入 -->
