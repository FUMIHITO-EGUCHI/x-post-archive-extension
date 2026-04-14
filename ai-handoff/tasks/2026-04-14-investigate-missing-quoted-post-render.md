# Task Packet

<!-- Keep task packets directly under ai-handoff/tasks/. Track state in current-task.md and this note; do not move files between status folders. -->

## Meta
- status: active
- owner: Codex
- branch: feature/fix-refetch-quoted-post-id
- priority: normal
- files_in_scope: src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: quoted post may be missing from viewer display even when the parent quoting post is saved
- needs_from_claude: none
- handoff_to_codex: 引用投稿に引用された投稿が、保存済みビューア上で表示されない場合がある不具合を調査し、必要なら修正する
- summary: 引用投稿カードが表示されるべきケースで、引用元投稿が表示されない場合がある。保存データ、hydrate処理、viewer描画条件のどこで欠落しているかを切り分ける。

## Goal

引用投稿を保存・閲覧したときに、引用された投稿が期待どおり引用カードとして表示されるようにする。

## Problem Statement

`refetchArchivePost` が常に `quoted_post_id` を null で上書きしている。

`extractPostFromArticle` は `post.quoted_post_id` フィールドをセットしないため、refetch 時の `input.quoted_post_id` は常に `undefined` になる。これが `normalizeQuotedPostId(undefined) → null` を経て、既存の `quoted_post_id` を null で消してしまう。

refetch 後は `hydrateArchivePosts` が `quoted_post_id === null` の投稿を引用元なしと判定し、`QuotedPostCard` が描画されなくなる。

## In Scope

- `src/features/archive/archive-service.ts` の `refetchArchivePost` のみ修正

## Out Of Scope

- 引用元レコードが最初から存在しない 14 件の dangling reference（表示できないのは正しい挙動）
- 会話全体の完全保存
- X UI の完全再現
- 保存済み投稿の自動更新機能の追加
- 引用元投稿が未保存の場合に X から完全自動クロールする仕組みの追加

## Root Cause

`src/features/archive/archive-service.ts` の `refetchArchivePost` 関数（行 1240 付近）：

```typescript
// 現状（バグあり）
const normalizedQuotedPostId = normalizeQuotedPostId(input.quoted_post_id);
// → input.quoted_post_id は undefined → null → 既存の quoted_post_id を消す
```

## Fix

```typescript
// 修正後
const normalizedQuotedPostId =
  normalizeQuotedPostId(input.quoted_post_id) ?? existingPost.quoted_post_id ?? null;
```

`input.quoted_post_id` が null/undefined の場合は既存値 `existingPost.quoted_post_id` を使う。既存値もない場合は null。

`updatePostFields` の呼び出しでは `quoted_post_id: normalizedQuotedPostId` を渡しているが、これは修正後の値がそのまま伝播するため変更不要。

## Files To Read First

- `src/features/archive/archive-service.ts` の `refetchArchivePost` 関数（行 1218〜1300 付近）

## Inputs From Claude

### DB 調査結果

- `quoted_post_id` を持つ投稿: 406 件
- 引用元レコードが存在（正常）: 392 件
- 引用元レコードが存在しない（dangling）: 14 件

dangling 14 件は保存時の失敗またはユーザーによる削除であり、表示できない挙動は正しい。

### 修正コード

`refetchArchivePost` 内の以下の行を変更する：

```typescript
// before（行 1240 付近）
const normalizedQuotedPostId = normalizeQuotedPostId(input.quoted_post_id);

// after
const normalizedQuotedPostId =
  normalizeQuotedPostId(input.quoted_post_id) ?? existingPost.quoted_post_id ?? null;
```

変更対象は 1 行のみ。

## Acceptance Criteria

- [ ] 引用された投稿が表示されないケースの原因が説明できる
- [ ] 実装修正が必要な場合、引用カードが期待どおり表示される
- [ ] 既存の通常ソート・ランダム表示仕様に不要な副作用がない
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Open Questions

- なし（CDP 調査で根本原因を特定済み）

## Codex Plan

1. `feature/fix-refetch-quoted-post-id` ブランチを作成する
2. `src/features/archive/archive-service.ts` の `refetchArchivePost` 内の行 1240 付近を修正する
3. `npm run typecheck` と `npm run build` を確認する
4. handoff 記録を更新する

## Work Log

- `2026-04-14 Claude`: CDP調査で `refetchArchivePost` が `quoted_post_id` を null で上書きするバグを特定。修正設計完了。

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished if needed
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
