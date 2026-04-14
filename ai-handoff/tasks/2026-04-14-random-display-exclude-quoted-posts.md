# Task Packet

<!-- Keep task packets directly under ai-handoff/tasks/. Track state in current-task.md and this note; do not move files between status folders. -->

## Meta
- status: done
- owner: Codex
- branch: feature/random-exclude-quoted-posts
- priority: normal
- files_in_scope: src/db/archive-database.ts, src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: ランダム表示で引用元ポストを除外する実装
- summary: ランダム表示の候補プールから、他ポストの `quoted_post_id` として参照されている引用元ポストを除外する実装を追加。引用先カード内では引用元カードを引用先メディアの下側に表示するように変更。

## Goal

ランダム表示で引用元ポスト（他ポストの `quoted_post_id` として参照されているポスト）が単独表示されると文脈が不明になる。引用元をランダムプールから除外することで、常に引用ツイート（文脈付き）が表示されるようにする。

## Requested Action

1. `posts` テーブルに `quoted_post_id` インデックスを追加（DB version 13）
2. `getQuotedPostIdSet()` 関数を追加
3. `listRandomPostsPage()` をランダムモード時に引用元を除外するよう修正

## In Scope

- `src/db/archive-database.ts`：version 13 スキーマ追加
- `src/features/archive/archive-service.ts`：`getQuotedPostIdSet` 追加、`listRandomPostsPage` 修正

## Out Of Scope

- 通常ソート（saved_at / posted_at など）での除外は不要
- 型定義の変更は不要

## Constraints

- TypeScript strict を維持する
- Dexie のバージョンアップは既存データへの影響なし（インデックス追加のみ）
- `viewer UI にのみ React を使い、content script / background は素の TypeScript を維持する` ルールに従う

## Files To Read First

- `src/db/archive-database.ts`（現行の version 12 スキーマを確認）
- `src/features/archive/archive-service.ts`（`listRandomPostsPage` 周辺 1314〜1328 行付近）

## Inputs From Claude

### 設計方針

**「ランダムの ID プールから、他ポストの `quoted_post_id` として参照されているものを除外する」**

引用元ポスト（Post B）を引用したポスト（Post A）は、`hydrateArchivePosts` により `quoted_post` として Post B を内包した形で表示される。したがって、ランダムプールから Post B を除外するだけで「Post A + Post B のセット表示」が自然に実現する。表示側の変更は不要。

### DB変更

```typescript
// version 13: posts に quoted_post_id インデックスを追加
this.version(13).stores({
  posts: "&x_post_id, saved_at, posted_at, reply_count, repost_count, like_count, display_name, quoted_post_id",
  media: "&media_id, x_post_id, [x_post_id+position], storage_status, saved_at",
  tags: "&tag_id, &normalized_name, system_key, display_name, created_at",
  tag_redirects:
    "&tag_redirect_id, &source_normalized_name, source_display_name, target_tag_id, created_at",
  post_tags:
    "&post_tag_id, x_post_id, tag_id, normalized_name, [x_post_id+normalized_name], source, system_key, assigned_at",
  logs: "&log_id, created_at, level, [level+created_at], scope, event, request_id",
  refetch_queue: "&x_post_id, status, priority, enqueued_at, completed_at"
});
```

### 新関数 `getQuotedPostIdSet`

```typescript
// 何らかのポストに quoted_post_id として参照されている ID の集合を返す
async function getQuotedPostIdSet(): Promise<Set<string>> {
  const quotingPosts = await archiveDb.posts
    .where("quoted_post_id")
    .above("")   // null/空文字を除外
    .toArray();
  return new Set(
    quotingPosts.flatMap((p) =>
      typeof p.quoted_post_id === "string" ? [p.quoted_post_id] : []
    )
  );
}
```

### `listRandomPostsPage` 修正

```typescript
async function listRandomPostsPage(
  matchingPostIds: Set<string> | null,
  offset: number,
  limit: number,
  randomSeed: number
): Promise<PostRecord[]> {
  const orderedIds = matchingPostIds === null ? await listPostIds() : [...matchingPostIds];

  if (orderedIds.length === 0) {
    return [];
  }

  // 引用元として参照されている ID をランダムプールから除外
  const quotedIds = await getQuotedPostIdSet();
  const filteredIds = orderedIds.filter((id) => !quotedIds.has(id));

  if (filteredIds.length === 0) {
    return [];
  }

  shuffleIdsInPlace(filteredIds, randomSeed);
  return getPostsByIds(filteredIds.slice(offset, offset + limit));
}
```

## Acceptance Criteria

- [x] ランダム表示で、引用元ポストのみが単独表示されなくなる
- [x] 引用ツイート（Post A）はランダムで表示され、その中に Post B が QuotedPostCard として表示される
- [x] 通常ソート（saved_at / posted_at など）の動作に変化がない
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Open Questions

- なし

## Work Log

- `2026-04-14 Claude`: 設計完了、タスクパケット作成

## Codex Plan

1. `feature/random-exclude-quoted-posts` ブランチを作成する
2. `src/db/archive-database.ts` に DB version 13 を追加し、`posts` の `quoted_post_id` インデックスを追加する
3. `src/features/archive/archive-service.ts` に `getQuotedPostIdSet()` を追加する
4. `listRandomPostsPage()` でランダム候補 ID から引用元 ID を除外してから shuffle/paging する
5. `npm run typecheck` と `npm run build` を確認する
6. handoff 記録を更新する

## Codex Result

実装完了。

- `posts` table の Dexie schema を version 13 に上げ、`quoted_post_id` インデックスを追加した
- `getQuotedPostIdSet()` を追加し、何らかの保存済みポストから `quoted_post_id` として参照されている ID を収集するようにした
- `listRandomPostsPage()` でランダム候補 ID から引用元 ID を除外してから shuffle するようにした
- 通常ソートの `listPostsSliceBySort()` 側には手を入れていないため、saved_at / posted_at などの通常ソート動作は変更なし
- 追加要望として、viewer の引用先カード内では引用元カードを引用先メディアの下側、メトリクスの上側に表示するように描画順を変更した

## Changed Files

- `src/db/archive-database.ts`
- `src/features/archive/archive-service.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-14-random-display-exclude-quoted-posts.md`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome port 9223:
  - reloaded unpacked extension
  - opened viewer
  - confirmed a quoted post card renders after `.post-media-grid` and before `.post-metrics` within a quoted destination post

## Remaining Issues

None.

## Suggested Next Action

Review and commit on `feature/random-exclude-quoted-posts`.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
