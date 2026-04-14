# Task Packet: Fix Orphaned Tag Creation on Preview Cancel

## Meta
- status: waiting
- owner: Codex
- branch: feature/fix-orphaned-tag-on-preview-cancel
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

- [ ] `bulkAssignTagPreview` does not call `addTag()` or any other DB write
- [ ] `bulkAssignTagApplyBatch` creates new tags before assigning them
- [ ] Cancelling after preview leaves no new tag rows in the DB
- [ ] Confirming after preview still creates all expected tag rows and assignments
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Work Log

## Result

## Verification

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
