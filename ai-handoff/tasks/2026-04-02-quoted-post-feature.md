# Task Packet — 引用投稿機能の実装

## Goal

引用投稿（quote tweet）を主投稿・引用元の 2 件に分けて DB に保存し、ビューアでネスト表示する。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない（ユーザーが確認後にマージ）。

## In Scope

- `extract-post-from-article.ts` の引用コンテナ分離ロジック
- `SavePostInput` / `PostRecord` への `quoted_post_id` フィールド追加
- DB バージョン v10 バンプ（スキーマ定義変更なし）
- `bootstrap-x-content-script.ts` の 2 ステップ保存フロー
- `likes-import-controls.ts` の同 2 ステップ保存フロー対応
- `archive-service.ts` への `quoted_post_id` 書き込み
- ビューア: `ArchivePostRecord` に `quoted_post?` 付与 + ネスト表示 UI

## Out Of Scope

- 引用元に動画がある場合の video_candidates（既存の graphql キャッシュは postId で引けるため将来対応可）
- likes import バッチでの引用元抽出（DOM に article がない場合があるため別タスク）
- 引用元のさらに引用元（X は 1 段しか表示しない）

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- 引用元保存失敗は **non-fatal**: 主投稿は `quoted_post_id = null` のまま保存を続ける
- `history.pushState` の monkey-patch は必ず元に戻す（try/finally）
- `.click()` シミュレートで発火するのは React の合成イベントのみ; `stopPropagation` 不要
- 引用コンテナは `article.querySelector('div[role="link"][tabindex="0"]')` で取得（`data-testid` なし）
- `extractPostFromArticle` の返り値型を変えると呼び出し箇所が複数あるため全て更新すること

## Files To Read First

- `src/features/x/extract-post-from-article.ts` — 変更の主体
- `src/features/x/bootstrap-x-content-script.ts:79-97` — `attachSaveButton` の onSave ロジック
- `src/features/x/likes-import-controls.ts:421` 付近 — extractPostFromArticle の呼び出し
- `src/types/archive.ts` — PostRecord / SavePostInput / ArchivePostRecord
- `src/db/archive-database.ts` — v9 → v10 バンプ対象
- `src/features/archive/archive-service.ts` — saveArchivePost: PostRecord 書き込み箇所
- `src/features/viewer/components/viewer-app.tsx` — 投稿カード表示部分

## Inputs From Claude

### DOM調査結果

**引用コンテナセレクタ（確定）:**
```
article.querySelector('div[role="link"][tabindex="0"]')
```
`data-testid` は存在しない。非引用記事では 0 件ヒット（フォールスポジティブなし）。

**引用元 status ID の取得（2 段階）:**

```typescript
// Step 1: コンテナ内にアンカーがある場合（画像ありの引用）
for (const anchor of container.querySelectorAll('a[href*="/status/"]')) {
  const url = new URL(anchor.href, location.origin);
  const m = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);  // $なし
  if (m) return { xUsername: m[1], xPostId: m[2], postUrl: `${url.origin}/${m[1]}/status/${m[2]}` };
}

// Step 2: アンカーなし（テキストのみの引用）— pushState 傍受
const captured: string[] = [];
const orig = history.pushState.bind(history);
history.pushState = (_: unknown, __: string, url: string) => { captured.push(url); };
try {
  container.click();
} finally {
  history.pushState = orig;
}
for (const url of captured) {
  const m = url.match(/^\/([^/]+)\/status\/(\d+)/);
  if (m) return { xUsername: m[1], xPostId: m[2], postUrl: `https://x.com/${m[1]}/status/${m[2]}` };
}
return null;
```

**画像分離:**
```typescript
// extractPostImages に exclude?: Element 引数を追加
// collectMediaImageCandidates 内で exclude?.contains(img) または exclude?.contains(anchor) を除外
```

**inspectArticleMediaSignals も同様に除外が必要:**
引用元に画像がある場合、主投稿の save ボタン判定が false positive になるため。

### 新しい extractPostFromArticle の返り値

```typescript
export function extractPostFromArticle(article: HTMLElement): {
  post: SavePostInput;
  quotedPost: SavePostInput | null;
} | null
```

### 保存フロー（bootstrap-x-content-script.ts）

```typescript
const result = extractPostFromArticle(article);
if (result === null) throw new Error("Post extraction failed.");

const { post, quotedPost } = result;
// 引用元を先に保存（失敗しても続行）
let quotedPostId: string | null = null;
if (quotedPost !== null) {
  try {
    const qr = await requestSavePost(quotedPost);
    if (qr.status === "saved" || qr.status === "duplicate") {
      quotedPostId = quotedPost.x_post_id;
    }
  } catch {
    // non-fatal
  }
}
post.quoted_post_id = quotedPostId;
const response = await requestSavePost(post);
```

likes-import-controls.ts の L421 付近も同じ変更が必要。

### DB モデル変更

**`src/types/archive.ts`:**
```typescript
// PostRecord に追加
quoted_post_id?: string | null;

// SavePostInput に追加
quoted_post_id?: string | null;

// ArchivePostRecord に追加
quoted_post?: ArchivePostRecord;
```

**`src/db/archive-database.ts`:**
```typescript
this.version(10).stores({
  posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name",
  // 他テーブルは v9 と同じ
  media: "...",
  tags: "...",
  post_tags: "...",
  logs: "..."
});
// upgrade 不要（新フィールドは undefined で既存レコードに自然に存在しない扱い）
```

**`src/features/archive/archive-service.ts` の `saveArchivePost`:**
```typescript
const record: PostRecord = {
  ...
  quoted_post_id: input.quoted_post_id ?? null,
  // (undefined のままでもOKだが明示的に null にする)
};
```

### ビューア側

`hydrateArchivePosts` または `archive-service` の list 系関数で `quoted_post_id` を一括 DB 参照:

```typescript
// 疑似コード
const quotedIds = posts.flatMap(p => p.quoted_post_id ? [p.quoted_post_id] : []);
const quotedMap = await getPostsByIds(quotedIds);  // posts-repository に追加
for (const post of posts) {
  if (post.quoted_post_id) {
    post.quoted_post = quotedMap.get(post.quoted_post_id);
  }
}
```

ビューア UI: 投稿カードの本文下に小さめの枠で `QuotedPostCard` コンポーネントを表示。
`ArchivePostRecord` の `quoted_post` が存在する場合のみレンダリング。

## Acceptance Criteria

1. `extractPostFromArticle` が `{ post, quotedPost }` を返す（引用なしなら `quotedPost: null`）
2. 引用ありの投稿を保存すると DB に 2 件保存され、主投稿の `quoted_post_id` が引用元の `x_post_id` と一致する
3. 引用元保存が例外を投げても主投稿は `quoted_post_id: null` で保存成功する
4. 引用元の画像が主投稿の media として保存されない
5. `npm run typecheck` が通る
6. `npm run build` が通る

## Open Questions

1. `getPostsByIds` が posts-repository に存在しないなら追加が必要 — 実装前に確認
2. viewer-app.tsx は大きいファイル（約 1000 行）— `QuotedPostCard` は別コンポーネントファイルに分離してよい
3. `inspectArticleMediaSignals` の exclude 対応が save ボタン表示の正確さに影響するが、機能的には optional（見た目だけの問題）— 実装するかどうか Codex 判断で可

## Codex Plan

- 型・DB・repository を先に更新して `quoted_post_id` と hydration の受け皿を作る
- X 抽出ロジックを `{ post, quotedPost }` 返却へ変更し、引用コンテナ除外と permalink 取得を実装する
- save button / likes import を 2 ステップ保存へ変更し、引用元失敗時は主投稿のみ保存する
- viewer に引用カードを追加し、最後に typecheck/build を通す

## Codex Result

- `extractPostFromArticle` を `{ post, quotedPost }` 返却へ変更
- 主投稿側では引用コンテナ `div[role="link"][tabindex="0"]` を除外して本文・表示名・permalink・画像ヒントを抽出
- 引用元はコンテナ内アンカー優先、なければ `history.pushState` 傍受 + `.click()` で status URL を取得
- `quoted_post_id` を `SavePostInput` / `PostRecord` に追加し、Dexie を v10 に更新
- 保存時は引用元を先に保存し、成功時のみ主投稿へ `quoted_post_id` を付与
- likes import も batch API 依存を外し、各投稿ごとに同じ 2 ステップ保存へ変更
- viewer で引用元をネストカード表示するようにした
- `ai-handoff/current-task.md` を完了状態に更新

## Changed Files

- `src/types/archive.ts`
- `src/db/archive-database.ts`
- `src/db/repositories/posts-repository.ts`
- `src/features/archive/archive-service.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/likes-import-controls.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/entrypoints/viewer/style.css`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-02-quoted-post-feature.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Remaining Issues

- 実ブラウザ上での引用投稿保存と viewer 表示は未確認
- 引用元動画の `video_candidates` 抽出は今回未対応
- likes import の統計は主投稿ベースで維持しているため、引用元保存件数は overlay に含めていない
- 引用元の `reply_count` / `repost_count` / `like_count` はコード上は取得するようにしたが、実データでは未取得
- 一部の引用投稿で Save 押下時に引用元またはプロフィールへ遷移する
- 一部の引用投稿で引用がネスト表示されず、保存結果が崩れる

### Repro To Investigate

- URL 1: `https://x.com/jack_s_daniel/status/2039017934933368904`
- URL 2: `https://x.com/Link_2011A/status/2038919309360275653`
- Success reference: `https://x.com/sashimi0725/status/2039343655929217224`
- 観測:
  - どちらも引用投稿
  - 主投稿で Save を押すと引用元へ遷移する
  - 遷移先の引用元で Save を押すとさらに引用元プロフィールへ遷移する
  - 保存結果が引用ネスト形状にならない
- 調査観点:
  - 失敗 2 URL と成功 1 URL で DOM 構造や引用コンテナ内部の clickable 要素がどう違うか比較する
  - `findQuotedPermalink(container)` の `container.click()` が本当に必要か
  - `click()` の代わりに event capture / href discovery / DOM walk で permalink を取れないか
  - どの条件で profile URL へ遷移するのか
  - このケースで `quotedPost` が `null` になっていないか
  - `quoted_post_id` が主投稿に設定されているか
  - viewer hydration まで含めてどこで崩れているか

## Suggested Next Action

- 引用あり投稿を 2 パターン（画像あり / テキストのみ）で保存し、IndexedDB と viewer 表示を確認する
- Claude に引用コンテナ内の反応数 DOM を調査してもらい、必要なら selector 抽出を分岐実装する
- 上記 repro URL で Save 時の遷移原因を調査し、`container.click()` 依存を外せるか検討する
