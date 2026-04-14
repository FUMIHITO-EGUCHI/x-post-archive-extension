# Task Packet: Fix Orphaned Tag Creation on Preview Cancel

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: high
- files_in_scope: src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: full-codebase-review-2026-04-14 P2-001
- needs_from_claude: none
- handoff_to_codex: Move new tag creation from bulkAssignTagPreview into bulkAssignTagApplyBatch so tags are only persisted after the user confirms
- summary: bulkAssignTagPreview creates new tag records before user confirmation, orphaning them if the user cancels

## Goal

Prevent new tags from being written to the DB during the preview phase of bulk tag assignment. Tags should only be created when the user actually confirms the operation.

## Problem Statement

`bulkAssignTagPreview` (archive-service.ts ~line 812) calls `await addTag(tag)` for any tag name not already in the DB, before the user confirms the bulk assignment. If the user sees the preview and cancels, those tag rows remain in the DB as orphans (no `post_tags` rows reference them, no UI exposes them, but they exist in the `tags` table and consume storage).

```typescript
// archive-service.ts ~line 812-823
let tag = await getTagByNormalizedName(normalizedName);
if (tag === undefined) {
  tag = { tag_id: crypto.randomUUID(), ... };
  await addTag(tag);  // ← written to DB before user confirms
}
```

## In Scope

- `src/features/archive/archive-service.ts`
- `bulkAssignTagPreview`: stop calling `addTag()` — instead return a "would create" flag or provisional tag object without persisting
- `bulkAssignTagApplyBatch`: ensure any new tags needed are created here, before creating `post_tags` rows

## Out Of Scope

- Retroactively cleaning up already-orphaned tags
- Changes to the viewer UI calling these functions
- Any other tag management paths

## Root Cause

The preview function was designed to return an accurate count of "new" tags, which required resolving tag identity — but resolving identity was conflated with persisting the tag.

## Fix / Approach

In `bulkAssignTagPreview`, instead of calling `addTag(tag)`, construct the `tag` object (with a new UUID) and include it in the returned preview result as a `tagsToCreate: TagRecord[]` field, without writing to the DB.

In `bulkAssignTagApplyBatch`, receive or re-derive those provisional tags and call `addTag()` for each before creating the `post_tags` assignments.

Alternative: `bulkAssignTagPreview` returns only a plain `{ tagName: string; isNew: boolean }[]` list, and `bulkAssignTagApplyBatch` uses `getTagByNormalizedName` + `addTag` independently (simpler, no shared state required).

Prefer the simpler alternative unless it requires more code.

## Files Read

- `src/features/archive/archive-service.ts` (lines ~800–900 for preview/apply functions)

## Acceptance Criteria

- [x] `bulkAssignTagPreview` does not call `addTag()` or any other DB write
- [x] `bulkAssignTagApplyBatch` creates new tags before assigning them
- [x] Cancelling after preview leaves no new tag rows in the DB
- [x] Confirming after preview still creates all expected tag rows and assignments
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Work Log

- `2026-04-14 Codex`: Removed `addTag()` from `bulkAssignTagPreview`. Preview now returns either the existing tag or a provisional tag object without persisting it.
- `2026-04-14 Codex`: Updated `bulkAssignTagApplyBatch` to resolve the target tag by id/name and create it in the apply transaction before adding `post_tags`.

## Result

Done.

- `bulkAssignTagPreview` no longer writes a new tag row when the user opens a preview for a new tag name.
- `bulkAssignTagApplyBatch` now creates the missing tag inside the write transaction before creating assignment rows.
- The runtime/UI request and response shape did not change.

## Verification

- `npm run typecheck`
- `npm run build`

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
