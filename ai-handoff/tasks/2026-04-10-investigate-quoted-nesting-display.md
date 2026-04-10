# Task Packet: Investigate Quoted Nesting Display

## Meta
- status: waiting
- owner: Codex
- branch: feature/archive-followups
- priority: medium
- files_in_scope: src/features/archive/archive-service.ts, src/db/repositories/posts-repository.ts, src/features/viewer/components/viewer-app.tsx, src/types/archive.ts
- blocked_by: active task `2026-04-10-verify-zero-engagement-refetch-and-visible-save`
- related_findings: `2026-04-02-quoted-post-feature`
- needs_from_claude: none
- handoff_to_codex: investigate why quoted nesting is not rendered even though both the main post and quoted post are saved, then restore the nested quoted-post display
- summary:

## Goal

Restore quoted-post nested rendering in the viewer when both the main post and
the quoted post already exist in the archive.

## Requested Action

- verify whether the failure is in `quoted_post_id` persistence, archive
  hydration, or viewer rendering
- identify at least one concrete saved-post case where both posts exist but the
  nested quote card is not shown
- implement the narrowest fix and verify that the nested quote card renders

## In Scope

- `quoted_post_id` storage and hydration
- `ArchivePostRecord.quoted_post` wiring
- viewer-side quoted card rendering
- any regression between the original quoted-post feature and the current
  archive list rendering

## Out Of Scope

- new quoted-post extraction behavior unless the display bug proves the saved
  linkage is missing
- quoted video improvements
- full viewer redesign
- push

## Constraints

- preserve snapshot-first semantics
- distinguish between "quoted post was not saved" and "quoted post was saved but
  not rendered"
- confirm the bug with a real saved pair before changing hydration logic

## Files To Read First

- `docs/tech-index.md`
- `ai-handoff/tasks/2026-04-02-quoted-post-feature.md`
- `src/features/archive/archive-service.ts`
- `src/db/repositories/posts-repository.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/types/archive.ts`

## Inputs From Claude

- user reported that quoted nesting is not displayed even though both the main
  post and quoted post have been fetched

## Acceptance Criteria

- a concrete saved pair is identified where both posts exist but the nested
  quote card is missing
- the investigation states whether the regression is in persistence, hydration,
  or rendering
- the viewer renders the nested quoted post correctly for the reproduced case

## Open Questions

- is `quoted_post_id` missing on the main post, or is `quoted_post` failing to
  hydrate
- is the problem limited to list view, detail-like rendering, or both
- did a later refactor break quoted hydration without breaking quoted saving

## Work Log

- `2026-04-10 Codex`: created this waiting task from the user report that quoted nesting is not displayed even though both posts were fetched.

## Codex Plan

1. wait for the active refetch verification task to clear
2. inspect one concrete saved main/quoted pair in IndexedDB
3. trace `quoted_post_id` through archive hydration into viewer rendering
4. implement the narrowest fix and verify the quote card is shown again

## Codex Result

Pending investigation.

## Changed Files

- `ai-handoff/tasks/2026-04-10-investigate-quoted-nesting-display.md`

## Verification

- pending

## Remaining Issues

- root cause not yet investigated

## Suggested Next Action

After the active verification task is closed, inspect a concrete saved main
post plus quoted post pair and trace whether `quoted_post_id` survives into
`ArchivePostRecord.quoted_post` and the viewer quote card.

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
