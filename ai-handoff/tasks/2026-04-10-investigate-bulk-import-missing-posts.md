# Task Packet: Investigate Bulk Import Missing Posts

## Meta
- status: waiting
- owner: Claude
- branch: master
- priority: high
- files_in_scope: src/features/x/likes-import-controls.ts, src/features/x/bookmarks-import-controls.ts, src/features/x/bootstrap-x-content-script.ts, src/features/x/find-tweet-articles.ts, src/features/x/extract-post-from-article.ts, src/features/archive/archive-service.ts, src/db/repositories/posts-repository.ts
- blocked_by: active task `2026-04-10-verify-zero-engagement-refetch-and-visible-save`
- related_findings: `docs/likes-import-handover-2026-04-01.md`, duplicate-threshold auto-stop added in `2026-04-07-bulk-import-auto-stop-on-duplicates`, visible-save media wait improved in `2026-04-10-zero-engagement-refetch-and-image-investigation`
- needs_from_claude: reproduce a concrete missing-post case on X and compress the findings
- handoff_to_codex: implement the selected fix after root cause and acceptance criteria are clarified
- summary:

## Goal

Investigate the bug where likes or bookmarks bulk import finishes without
saving some posts that should have been included in the run.

## Requested Action

- reproduce at least one concrete case where bulk import misses a post
- determine whether the miss happens in collection, extraction, save
  deduplication, queue waiting, or stop-condition logic
- identify whether the problem is limited to likes import, bookmarks import, or
  shared code
- leave compressed findings plus a fix direction that is narrow enough for
  implementation

## In Scope

- likes import and bookmarks import collection loops
- visible article discovery and `x_post_id` deduplication behavior
- interaction between pending-media wait, richer-snapshot replacement, and
  save attempts
- interaction between duplicate-threshold auto-stop and not-yet-saved posts
- concrete evidence from logs, DB state, and X page observation for missed
  posts

## Out Of Scope

- broad importer redesign without a confirmed cause
- unrelated media-only failures when the post itself is still saved
- refetch repair work
- push

## Constraints

- keep the investigation focused on why posts are missed, not on general import
  speed or UI polish
- separate confirmed causes from hypotheses
- when using a sample post ID, confirm whether it is a true miss or a control
  case before treating it as evidence
- preserve snapshot-first semantics; this is about capture reliability, not
  post-save syncing

## Files To Read First

- `docs/tech-index.md`
- `docs/likes-import-handover-2026-04-01.md`
- `ai-handoff/tasks/2026-04-07-bulk-import-auto-stop-on-duplicates.md`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/find-tweet-articles.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/archive/archive-service.ts`

## Inputs From Claude

- user reported that there are posts missing after bulk import
- user currently has a log artifact open at
  `C:\Users\kurah\Downloads\x-post-archive-logs-2026-04-10T03-37-10.734Z.json`
- the selected `x_post_id` `1892093150115790966` appears in save logs, so it
  should be treated as a comparison/control case unless a separate missing case
  is confirmed

## Acceptance Criteria

- at least one concrete missed-post scenario is documented with reproduction
  notes or log/DB evidence
- the investigation states where the post was lost:
  collector, extractor, dedupe, pending wait, auto-stop, or persistence
- the findings distinguish shared code from likes-only or bookmarks-only logic
- the packet ends with a narrow fix direction or a smaller follow-up task list

## Open Questions

- is the miss caused by posts never entering the candidate set, or by
  candidates being dropped before save
- does the bug correlate with media posts, quoted posts, timeline virtualization,
  or duplicate-threshold stopping
- does the same miss happen on bookmarks import, or only on likes import

## Work Log

- `2026-04-10 Codex`: created this waiting investigation task from the user
  report that bulk import can miss posts that should have been saved.

## Codex Plan

1. wait for the active verification task to clear
2. reproduce a concrete missed-post case in shared CDP Chrome
3. compare DOM-visible posts, importer candidate tracking, save logs, and DB
   records for the same run
4. compress the confirmed failure point and fix direction

## Codex Result

Pending investigation.

## Changed Files

- `ai-handoff/tasks/2026-04-10-investigate-bulk-import-missing-posts.md`

## Verification

- pending

## Remaining Issues

- root cause not yet investigated

## Suggested Next Action

After the active verification task is closed, reproduce a bulk import run with
at least one confirmed missed `x_post_id` and compare collector logs against the
saved `posts` table.

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
