---
date: 2026-08-02
related-issue: 119
status: open
---

# viewer パフォーマンス監査（N=5000 件想定）

対象: `src/features/viewer/`、`src/entrypoints/viewer/`、`src/db/`、`src/features/runtime/client.ts`。
全該当ファイル実読済み。追跡 issue: quick wins **#119** / DB 索引化 **#120** / backlog **#121**。

## 重大度: 高

### H1. refetchStatus ポーリングが全カード再レンダーを常時誘発 → #119

- `use-refetch-controls.ts:50` — `setRefetchStatus(nextStatus)` を毎ポーリング無条件実行。レスポンス由来の新規オブジェクトで参照が毎回変わり、内容不変でも ViewerApp 全体が再レンダー
- ポーリング間隔: idle 5s / refetch 実行中 1s（`use-refetch-controls.ts:71-76`）
- 波及: `viewer-app.tsx:732-774` の `posts.map(ThreadCard)` に memo なし、handler を map 内インライン生成（743-772）
- `post-card.tsx:458-474` — `formatCount` / `formatPostedAt` / `formatSavedAt` が呼び出しごとに `new Intl.NumberFormat` / `new Intl.DateTimeFormat` 生成（1 カード 5 個以上）
- N=5000: 5s ごとに 5000 コンポーネント実行 + 約 25,000 回 Intl コンストラクタ（1 回数十 µs）→ 1 パス数百 ms。refetch 中は毎秒 → 恒常ジャンク
- 修正: (a) deep-equal 比較後に setState、(b) `React.memo(ThreadCard)` + `useCallback`、(c) Intl フォーマッタの言語別モジュールレベルキャッシュ。工数 S

### H2. 全ページ要求ごとの posts 全表スキャン（background 側） → #120

- `archive-service.ts:344-346` `listArchivePostsPage` → `resolveFilteredPostIds` → `resolveViewerListPostIds`（1648-1668）→ `listRootOrSinglePostIds`（`posts-repository.ts:83-92`）が無索引 `.filter()` 全表スキャン。全レコードをデシリアライズ
- 初回だけでなく load-more 50 件ごとに毎回。totalCount もこのセット依存（344-346）
- v18 キーセット複合索引（`archive-database.ts:255-272`)でページ切り出しは O(log N) 化済みだが、前段の O(N) が帳消し
- N=5000: load-more 1 回あたり SW 側数百 ms + GC。#112 の SW 応答性とも相性悪い
- 修正: `thread_root_id` 正規化保存（単発 post は自身の ID）+ 索引化、または SW メモリキャッシュ + 書き込み時無効化。工数 M

### H3. filter 適用時、一致 ID 全件の full-record bulkGet → #120

- `archive-service.ts:1655` — thread root マッピング目的だけに `getPostsByIds([...matchingPostIds])` で全レコード本体取得。3000 件ヒットの author filter → ページ表示・load-more のたび 3000 レコード読み
- 修正: H2 と同根。`thread_root_id` 正規化後は index-only で解決。工数 M（H2 と同時）

## 重大度: 中

### M1. 削除 1 件で全リスト再読込 + 250 件キャップ切り詰めバグ → #119

- `viewer-app.tsx:501-521` `handleDelete` → `reloadCurrentArchive(limit = max(posts.length, 50))`（402）
- background の `normalizePageLimit`（`archive-service.ts:1749-1755`）が limit を 250 に上限固定 → 250 件超ロード済みで 1 件削除するとリストが 250 件に切り詰められスクロール位置崩壊
- 既存の `removePostFromCurrentPage`（`use-archive-loader.ts:143-146`）が未使用
- 修正: 削除成功時はローカル除去 + `refreshArchiveMetadata()` のみ。工数 S、バグ修正兼務

### M2. リスト非仮想化 → #121

- `viewer-app.tsx:731-775` — 無限スクロールで DOM 蓄積。5000 件で数十万 DOM ノード、メモリ数百 MB 級、レイアウト/スタイル再計算が恒常的に重い
- 画像は `useDeferredVisibility` + `loading="lazy"`（`post-card.tsx:476-505`）で緩和済みだが DOM は残存
- 修正: virtua / react-window 等。ThreadCard 展開・タグピッカー整合が必要。工数 L

### M3. metadata 更新のたびに user summaries N+1 と post_tags 全読み → #121

- `archive-service.ts:460-471` `listArchiveUserSummaries` — username ごとに `countPostsByUsername` + `getLatestPostByUsername` の 2 クエリ × 全ユーザー。500 authors → 1000 IDB クエリ
- `archive-service.ts:413-414` `listArchiveTagSummaries` — `listAllPostTags()` で post_tags 全行
- 呼び出し元 `refreshArchiveMetadata`（`use-archive-metadata.ts:29-48`）は初期化・タグ操作（`use-tag-operations.ts:60,92`）・削除・rename/merge・refetch 完了ごと
- 修正: `[x_username+saved_at]` 索引の単一 walk で count+latest 一括算出（M）。タグ側は索引集計かキャッシュ（S）

### M4. キーワード検索 = 全表スキャン × ページ要求ごと → #120（キャッシュ項目）

- `posts-repository.ts:115-123` — 無索引 `.filter()` + 行ごと `toLowerCase().includes()`。入力は 300ms debounce 済み（`sticky-toolbar.tsx:110-112`）
- 部分一致仕様上フルスキャン自体は妥当だが、H2 のスキャンと合わせ 1 検索で全表 2 周 + 一致分 bulkGet。load-more でも再スキャン
- 修正: SW 側で直近結果セット短期キャッシュ + load-more 再利用。工数 S-M

### M5. スクロール停止ごとの全カード getBoundingClientRect → #121

- `use-viewer-session.ts:179-199`（300ms debounce）→ `findCurrentAnchorPostId`（243-274）が `querySelectorAll("[data-post-id]")` 全走査 + 各 `getBoundingClientRect()`。sessionRestoreMode=filters-and-position 時のみ
- 修正: viewport 通過後の早期 break か `document.elementFromPoint` 起点。工数 S

## 重大度: 低

- **L1** zip.js + Dexie の viewer 初期バンドル混入（`settings-archive-maintenance-panel.tsx:4-9` の静的 import → `archive-maintenance-service.ts:10`）。dynamic import か `React.lazy`。工数 S → #119
- **L2** ランダムソートの quoted_post 全レコード読み（`archive-service.ts:1670-1680`）。`quoted_post_id` 索引済みなので `.keys()` で足りる。工数 S → #119
- **L3** load-more IntersectionObserver の毎 append 再生成（`viewer-app.tsx:570-596`、deps の `handleLoadMore` が posts.length 依存）。実害小。工数 S → #121
- **L4** idle でも 5s ごとのポーリングが MV3 SW を常時起床（`use-refetch-controls.ts:71-76`）。refetch 非稼働時は停止し push で再開。工数 S → #121

## 健全な点（確認済み・問題なし）

- キーセットページング用複合索引 v18 完備（`archive-database.ts:255-272`、`posts-repository.ts:136-169`）
- 検索入力 300ms debounce、load-more 二重発火ガード（`loadMoreInFlightRef`）、リクエスト ID による stale response 破棄（`use-archive-loader.ts:45,70`）
- list key に `x_post_id` 使用、index key 誤用なし
- 画像 OPFS 遅延ロード + objectURL revoke 適切

## Top 3（効果/工数比）

1. **H1**（#119）: memo 化 + handler 安定化 + Intl キャッシュ + 等価比較 — 工数 S で恒常ジャンク根絶
2. **M1**（#119）: 削除のローカル反映 — 工数 S、250 件切り詰めバグも解消
3. **H2+H3**（#120）: `thread_root_id` 正規化 + 索引化 — 工数 M、全経路の SW コスト O(N)→O(page)
