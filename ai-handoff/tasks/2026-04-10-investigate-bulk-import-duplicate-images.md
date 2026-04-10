# Task Packet: Investigate Bulk Import Duplicate Images

## Meta
- status: active
- owner: Codex
- branch: master
- priority: high
- files_in_scope: src/features/x/likes-import-controls.ts, src/features/x/bookmarks-import-controls.ts, src/features/x/bootstrap-x-content-script.ts, src/features/archive/archive-service.ts, src/db/repositories/media-repository.ts, src/features/x/extract-post-from-article.ts
- blocked_by: none
- related_findings: `2026-04-09-refetch-missing-media`, `2026-04-10-zero-engagement-refetch-and-image-investigation`, `2026-04-10-investigate-bulk-import-missing-posts`
- needs_from_claude: reproduce at least one concrete duplicate-image case on X and compress the findings if browser-only evidence is needed
- handoff_to_codex: investigate why bulk import can persist duplicate image media records for a single saved post, then implement the narrowest safe fix
- summary:

## Goal

Investigate and fix the issue where likes or bookmarks bulk import can save the
same image more than once for a post.

## Requested Action

- reproduce at least one concrete bulk-import case where duplicate images are
  persisted
- determine whether the duplication comes from extraction, richer-snapshot
  replacement, duplicate-save handling, or media persistence
- implement the narrowest fix that preserves snapshot-first semantics

## In Scope

- likes import and bookmarks import media save flow
- duplicate-save handling in `saveArchivePost`
- image candidate generation and per-post media deduplication
- DB evidence for duplicate media rows or duplicate OPFS writes

## Out Of Scope

- missing-image cases where no duplicate is saved
- video-only duplication unless it shares the same root cause
- broad importer redesign
- push

## Constraints

- preserve existing saved posts unless a replacement is clearly safer than
  additive behavior
- separate true duplicate-media bugs from valid multi-image posts
- confirm whether duplication is in DB rows, OPFS files, or only viewer output

## Files To Read First

- `docs/tech-index.md`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/archive/archive-service.ts`
- `src/db/repositories/media-repository.ts`
- `src/features/x/extract-post-from-article.ts`

## Inputs From Claude

- user reported that bulk import can sometimes save duplicate images

## Acceptance Criteria

- at least one concrete duplicate-image scenario is documented with log, DB, or
  browser evidence
- the investigation states whether the duplicate is introduced during
  extraction, duplicate-save handling, or persistence
- the fix prevents duplicate image persistence for the reproduced case without
  regressing valid multi-image saves

## Open Questions

- does the duplication happen only on likes import, only on bookmarks import,
  or on both
- are duplicates keyed by URL, position, media_id, or a weaker heuristic
- does the duplication happen only when the same post is encountered multiple
  times during one bulk run

## Work Log

- `2026-04-10 Codex`: created this waiting task from the user report that bulk import can sometimes save duplicate images for a post.
- `2026-04-10 Codex`: while closing the visible-save verification task, shared CDP re-save of post `1757243797334094301` persisted two media rows with URLs `.../GGL73oPasAEnwM0?format=jpg&name=orig` and `.../GGL73oPasAEnwM0.jpg?name=orig`; this may be a useful seed case even though the original report was bulk-import specific.

## Codex Plan

1. reproduce one concrete duplicate-image case
2. compare extracted media candidates, duplicate-save behavior, and stored
   media rows
3. identify the narrowest safe deduplication point
4. implement and verify the fix

## Codex Result

Pending investigation.

## Changed Files

- `scripts/start-cdp-chrome.ps1`
- `src/db/repositories/posts-repository.ts`
- `src/features/refetch/refetch-coordinator.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`

## Verification

- pending

## Remaining Issues

- root cause not yet investigated

## Suggested Next Action

Reproduce a concrete bulk-import run that stores duplicate images and compare
the saved `media` rows against the extracted candidates for the same
`x_post_id`.

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] `task packet \`Verification\` updated`
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
