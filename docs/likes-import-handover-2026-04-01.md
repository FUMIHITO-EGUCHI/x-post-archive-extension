# Likes Import Handover (2026-04-01)

## Summary
- 対象不具合: X のいいね欄一括取得で、画像付き投稿でもメディアが保存されないことがある。
- 現状判断: 主因は保存後の media fetch 失敗ではなく、保存前の抽出段の問題。
- 特徴:
  - 手動保存では取れる投稿がある。
  - likes 一括取得では同じ投稿でも取れる時と取れない時がある。
  - 毎回データを全削除してから再取得しても再現する。

## Current Findings
1. DB / log 調査では `media.persist.failed = 0` のケースが多い。
2. `postsWithoutMedia` が一定数あり、`post.save.persisted` 時点で `mediaCount: 0` の投稿が存在する。
3. つまり「media レコードを作る前」に落ちている。
4. manual save では画像取得できるため、selector 不足だけでなく、likes タイムライン特有の描画タイミング問題が濃厚。
5. DOM スキャンでは `/photo/` アンカーがなくても直接メディア画像が出ている投稿が確認された。

## Concrete Evidence
- 以前の DB 集計では `media` はすべて `ready` で `failed = 0` なのに、`postsWithoutMedia` が残っていた。
- ログでは `post.save.persisted` の `mediaCount: 0` が複数あり、保存後の media fetch 側には失敗が出ていない。
- DOM スキャンでは `directMediaImageCount > 0` なのに `photoAnchorCount = 0` の投稿があった。
- `2039076744494535026` は「本来画像があるのに読み取れていない」例として継続調査中。

## Changes Already Implemented

### 1. likes import / extract 側の修正
- `src/features/x/extract-post-from-article.ts`
  - `/photo/` アンカー配下だけでなく、`pbs.twimg.com/media/` の直接画像も拾うように変更。
  - `inspectArticleMediaSignals(article)` を追加。
- `src/features/x/likes-import-controls.ts`
  - 一括保存キューを `Map` 化し、同一 `x_post_id` でも richer snapshot を再キューできるように変更。
  - media hint があるのに `media` / `video_candidates` が空の投稿を一時待機させるロジックを追加。
  - `waiting` 件数を overlay に表示。
  - 中断時も overlay の最終値を保持。

### 2. 調査用ログ / trace
- `traceId` を likes import run ごとに付与。
- `debug.inspectPostIds` で対象 `xPostId` の詳細ログを出せるようにした。
- `likes.import.inspect` と `likes.import.trace_started` を追加。
- `logs/clear` runtime message を追加。

### 3. ページ側からのデバッグ指定
- `src/features/debug/debug-settings.ts`
  - 次の 3 経路から inspect 対象投稿 ID を読める。
    - `browser.storage.local["debug.inspectPostIds"]`
    - X ページの `localStorage["xpa.debug.inspectPostIds"]`
    - URL query `xpa-debug-posts`

### 4. 調査スクリプト
- `scripts/debug-likes-dom-scan.js`
- `scripts/debug-archive-db-summary.js`
- `scripts/debug-archive-log-report.js`

これらは AI に渡しやすい JSON を自動出力する。

### 5. 完全初期化
- `src/features/archive/archive-maintenance-service.ts`
  - `resetExtensionState()` を追加。
  - OPFS media, IndexedDB records, logs, `browser.storage.local` をまとめて初期化。
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
  - 削除操作は `clearArchiveData()` ではなく `resetExtensionState()` を呼ぶ。
  - 完了後に viewer を再読み込みして既定状態へ戻す。

## Known Gaps
1. likes import の根本不具合は未解決。
2. `waiting` が出ないケースがあり、待機判定に乗っていない投稿がある。
3. settings panel の初期化文言は一部旧ラベルが残っている可能性があるので、UI 文言の整理が必要。
4. `CLAUDE.md` は文字化けして見える環境がある。Claude に読ませるならこの文書を優先した方が安全。

## Recommended Next Investigation
1. `2039076744494535026` を対象にピンポイント追跡する。
2. X の likes ページで以下を実行:

```js
localStorage.setItem(
  "xpa.debug.inspectPostIds",
  JSON.stringify(["2039076744494535026"])
);
location.reload();
```

3. 対象投稿が見える位置までスクロールして likes 一括取得を実行する。
4. 実行直後にログ export と DOM スキャンを取る。
5. 次を確認する。
   - `likes.import.inspect` が出ているか
   - `media.length`
   - `video_candidates.length`
   - `inspectArticleMediaSignals` の値
   - 同じ `xPostId` が複数パスで観測されているか

## Recommended Next Fix Direction
1. 「media hint が出ていない投稿」も再評価対象に残す。
2. likes 画面の特定 DOM パターンを追加で採取し、selector を広げる。
3. 必要なら `xPostId` ごとの観測回数と最終抽出結果を overlay/debug log で見えるようにする。
4. manual save と likes import で通る抽出経路の差を比較する。

## Useful Commands
```bash
cmd /c npm run typecheck
cmd /c npm run build
```

## Files To Read First
- `src/features/x/likes-import-controls.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/archive/archive-service.ts`
- `src/features/debug/debug-settings.ts`
- `scripts/debug-likes-dom-scan.js`
- `scripts/debug-archive-db-summary.js`
- `scripts/debug-archive-log-report.js`
