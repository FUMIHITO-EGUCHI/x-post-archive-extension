---
date: 2026-08-02
related-issue: 117
status: open
---

# Adversarial review — #114 restart recovery（PR #116, merged）+ #113 logger 抑制（PR #115, merged）

対象: `feature/114-viewer-restart-recovery` の master 差分（review 時点で PR #116 は merge 済み）。
判定: BLOCKER なし / HIGH 1 / MEDIUM 2 / LOW 8。HIGH と MEDIUM は #117 / #118 で追跡。

## HIGH — SW 多忙時にも再起動が提示され、クリックで進行中書き込みを破壊

- `src/features/viewer/components/viewer-app.tsx:699-712`、`src/features/runtime/client.ts:42,138`
- `posts/list-page` は `DEFAULT_RUNTIME_TIMEOUT_MS = 30000`。同一コードベースが正当な長時間処理を認めている（`SAVE_RUNTIME_TIMEOUT_MS = 180000`、`SAVE_BATCH_RUNTIME_TIMEOUT_MS = 300000`）。batch save 中や大規模アーカイブの重い filter クエリ中は健全な SW でも 30s 超過 → `RuntimeTimeoutError` → 「拡張機能が応答していない可能性」+ 再起動ボタン。`browser.runtime.reload()` は SW を batch write の途中で破棄 → 部分保存 + viewer タブ消失。タイムアウトは「wedged SW（#112）」と「busy SW」を区別できない。
- 修正案: 軽量 ping（短タイムアウト）による liveness probe で判別してから `isRuntimeUnresponsive` を立てる。最低限でも警告文に保存中断リスクを明記。→ **#117**

## MEDIUM — stale な `isRuntimeUnresponsive` が無関係通知に再起動ボタンを付ける

- `use-archive-loader.ts:107`、`use-refetch-controls.ts:103-106`、表示条件 `viewer-app.tsx:699`
- フラグは `loadArchivePage` の成功/catch でしかリセットされない。タイムアウト後に SW が自然復旧し、その後 refetch enqueue が通常理由で失敗して `setLoadNotice(...)` されると、古い `true` のまま再起動ボタンが refetch エラーに付いて表示される。表示条件がフラグを「任意の notice テキスト」に結合しているのが根因。
- 修正案: notice を `{ text, cause: "timeout" | "error" }` の単一 state に統合、または外部向け setter（`setLoadNotice` / `setInitialLoadError`）で必ずフラグをクリア。→ **#117**

## MEDIUM — 抑制キーが distinct-context の debug レコードを潰す

- `src/features/logging/logger.ts:88-89`、`src/features/runtime/handle-runtime-message.ts:707-719`
- キーは `scope|event|context.type`。content script から転送される debug ログ（`writeDebugLog`）の context に `type` は無く、同一 event 名の転送ログは post ID / trace ID が違っても 30s に 1 件へ collapse。burst save 中の `media.persist.enqueued` / `media.preview.persisted`（`archive-service.ts:1028,1193`）も同様。SW 死亡後は console mirror が消えるため、永続ログが唯一の forensic（#112 の失敗形態）。
- 修正案: 抑制カウンタを保持し、窓再開時に `{ suppressedCount }` rollup を付与して永続化。→ **#118**

## LOW 群

1. **200 キー満杯時の `clear()` バースト**（`logger.ts:106-108`）: 全キーが窓内だと clear → hot キーが一斉に即再永続化、最大 ~200 IDB write。`persistedAt` 昇順で半分 evict に変更（3 行）。→ #118
2. **時計逆行で抑制延長**（`logger.ts:53,94`）: delta 負 → `lastPersistedAt + 30s` まで抑制継続。`delta < 0` も窓満了扱いに。→ #118
3. **persist 失敗でも窓消費**（`logger.ts:111` が `addLogRecord` 解決前に mark）: #112 の IDB 凍結ケースで 30s 分の記録が完全消失。`.catch` で rollback。→ #118
4. **`"|"` 区切り無曖昧というコメントは誤り**: `a|b`+`c` と `a`+`b|c` が衝突、数値 `type` は `""` に落ちる。現 scope/event に `|` は無く実害ゼロ。コメント修正か `JSON.stringify([scope, event, type])`。→ #118
5. **復旧導線が posts-page 経路のみ**: `requestThread` / `requestTagSummaries` / `requestRefetchStatus` / `requestArchiveSummary` も同じ `RuntimeTimeoutError` を投げるが再起動提示に未接続。`setInitialLoadError`（`use-archive-loader.ts:121-125`）もエラー型を見ない。incremental scope として許容、#117 の Notes に記載。
6. **a11y**: 動的出現する error/restart ブロックに `role="alert"` / `aria-live` なし。→ #117
7. **i18n 不整合**: 再起動文言は ja/en 対応だが、直上の `loadNotice`（`use-archive-loader.ts:109-113`）はハードコード英語。既存問題だが並ぶと目立つ。

## Verified clean（攻撃して落ちなかった項目）

- `RuntimeTimeoutError` は唯一のタイムアウトパスで throw され、全 `request*` が単一 `sendMessage` に集約。途中で re-wrap する層はなく `instanceof` 判定は成立（同一モジュールインスタンス・単一 viewer バンドル）
- `loadArchivePage` の stale-request 競合: success / catch とも state 書き込み前に `requestId` ガードあり。旧リクエストはフラグを set も clear もできない
- `runtime/error` レスポンスは plain `Error` 化（`client.ts:492-493`）→ 正しく非タイムアウト分類
- 抑制は永続化のみバイパス。console mirror（`logger.ts:56`）は先に実行、info/warn/error 無影響、抑制レコードは `writesSinceLastPrune` を進めない
- Map は 200 上限で有界。単一スレッド文脈で mark-check は同期、実行コンテキスト（SW / content / viewer）ごとに独立インスタンス
- タイムアウトタイマーは `finally` で解放。遅延 reject は unhandledrejection にならない
- `browser` グローバルは WXT の確立パターン。`viewer-action-button` クラスは committed `style.css` に存在（dark theme 込み）。`<button>` in `<p>` は valid
- `npm run typecheck` pass（review 時点の branch）

## 良かった点

- `// Why:` コメント（`logger.ts:6-9`、`client.ts:463-464`）が #112 の incident 文脈をコードに残している
- 「このタブは閉じます」の帰結をボタン文言で両言語開示
- 抑制 Map の stale-prune は窓満了キーのみ削除で挙動中立（構成上正しい）
