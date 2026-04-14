# Task Packet

<!-- Keep task packets directly under ai-handoff/tasks/. Track state in current-task.md and this note; do not move files between status folders. -->

## Meta
- status: done
- owner: Codex
- branch: feature/fix-refetch-quoted-post-id
- priority: normal
- files_in_scope: src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: quoted post may be missing from viewer display after refetch
- needs_from_claude: none
- handoff_to_codex: none
- summary: Refetch was clearing `quoted_post_id` when the extracted refetch input omitted it. Preserve the existing quoted post link in that case.

## Goal

Keep quoted post cards renderable after a saved post is refetched.

## Problem Statement

`refetchArchivePost` normalized `input.quoted_post_id` directly. Refetch input can omit `quoted_post_id`, because `extractPostFromArticle` does not set it on the main post during refetch. That made `normalizeQuotedPostId(undefined)` return `null`, and the refetch update persisted `quoted_post_id: null`.

After that, `hydrateArchivePosts` treated the post as having no quoted source, so `QuotedPostCard` could not render even when the quoted source post record still existed.

## In Scope

- `src/features/archive/archive-service.ts`
- Preserve an existing `quoted_post_id` during refetch when input omits it

## Out Of Scope

- Fixing dangling quote references where the quoted source post record does not exist
- Conversation-wide archive behavior
- X UI recreation
- Automatic re-crawling of missing quoted source posts

## Root Cause

`refetchArchivePost` used:

```typescript
const normalizedQuotedPostId = normalizeQuotedPostId(input.quoted_post_id);
```

When `input.quoted_post_id` was `undefined`, this became `null` and cleared the existing quote relationship.

## Fix

`refetchArchivePost` now uses the existing persisted value as a fallback:

```typescript
const normalizedQuotedPostId =
  normalizeQuotedPostId(input.quoted_post_id) ?? existingPost.quoted_post_id ?? null;
```

## Files Read

- `src/features/archive/archive-service.ts`
- `ai-handoff/tasks/2026-04-14-investigate-missing-quoted-post-render.md`

## Acceptance Criteria

- [x] Cause of missing quoted post rendering is explained
- [x] Implementation preserves the quoted post relationship after refetch
- [x] Existing sort and random display behavior are not intentionally changed
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Work Log

- `2026-04-14 Claude`: Identified that `refetchArchivePost` clears `quoted_post_id` to null during refetch.
- `2026-04-14 Codex`: Implemented the refetch fallback so missing `input.quoted_post_id` preserves the existing `quoted_post_id`.

## Result

Done.

- Root cause: refetch input can omit `quoted_post_id`, and the old code persisted that as `null`.
- Fix: refetch now falls back to `existingPost.quoted_post_id` before using `null`.
- Scope: only `src/features/archive/archive-service.ts` changed.

## Verification

- `npm run typecheck`
- `npm run build`

## Remaining Issues

Dangling quote references where the quoted source post record is missing remain out of scope.

## Completion Checklist
- [x] investigation finished
- [x] implementation finished if needed
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
