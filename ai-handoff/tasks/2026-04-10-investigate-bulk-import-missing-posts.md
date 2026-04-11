# Task Packet: Investigate Bulk Import Missing Posts

## Meta
- status: active
- owner: Codex
- branch: feature/archive-followups
- priority: high
- files_in_scope: src/features/x/likes-import-controls.ts, src/features/x/bookmarks-import-controls.ts, src/features/x/bootstrap-x-content-script.ts, src/features/x/find-tweet-articles.ts, src/features/x/extract-post-from-article.ts, src/features/archive/archive-service.ts, src/db/repositories/posts-repository.ts
- blocked_by: none
- related_findings: `docs/likes-import-handover-2026-04-01.md`, duplicate-threshold auto-stop added in `2026-04-07-bulk-import-auto-stop-on-duplicates`, visible-save media wait improved in `2026-04-10-zero-engagement-refetch-and-image-investigation`
- needs_from_claude: none
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
- `2026-04-11 Codex`: activated this task after closing `2026-04-10-investigate-quoted-nesting-display`; starting from log artifact review and importer control-flow inspection before any code changes.
- `2026-04-11 Codex`: resumed with the user account CDP profile on port `9223`; confirmed bookmarks import saved all 15 independently observed visible posts in that run, then patched the shared likes/bookmarks collector loop to do one final visible-post collection when duplicate-threshold or another stop is observed immediately after an importer-driven scroll.
- `2026-04-11 Codex`: after reloading the built extension, reproduced a concrete bookmarks miss: stopped run showed visible post IDs `2016731193367285915` and `2014688978965037378` still unsaved and absent from `post.save` / `bookmarks.import.inspect`, so the loss point is collector coverage after stop; added a short render-grace collect after the immediate final collect.
- `2026-04-11 Codex`: ran additional likes verification with `bulkImportDuplicateBatchThreshold` temporarily raised from `10` to `20` and restored afterward; likes run completed with `7 / 7` independently observed posts saved, but X did not render more than 7 articles even after a 15s reload wait and repeated bottom scrolls.
- `2026-04-11 Codex`: investigated the user-provided likes case where `2042731877069656563` below `2042639420353056839` was not imported; before reload, the post was visible and extractable in the likes DOM but had no `likes.import.inspect` or `post.save` logs, confirming a collector traversal miss; after extension reload, X lost the reproduced DOM state and only rendered 1-7 earlier articles, so exact post-level verification needs the page repositioned again.
- `2026-04-11 Codex`: updated likes/bookmarks traversal to use bounded incremental viewport scrolling instead of jumping to `scrollHeight`, and expanded the final stop-after-scroll collection into repeated short collect passes.

## Codex Plan

1. wait for the active verification task to clear
2. reproduce a concrete missed-post case in shared CDP Chrome
3. compare DOM-visible posts, importer candidate tracking, save logs, and DB
   records for the same run
4. compress the confirmed failure point and fix direction

## Codex Result

Root cause narrowed to collector coverage and timeline traversal, not
persistence.

Findings:

- the log artifact
  `C:\Users\kurah\Downloads\x-post-archive-logs-2026-04-10T03-37-10.734Z.json`
  contains archive/runtime save logs, but not importer collector traces
- the sample `x_post_id` `1892093150115790966` is a control case, not a miss:
  it has `post.save.succeeded`, `post.save.persisted`, tag assignment, and
  `media.persist.succeeded` logs
- shared CDP bookmarks import first reproduced no miss: independently observed
  visible posts were all saved
- after reloading the built extension, a later bookmarks duplicate-threshold
  run reproduced the failure:
  - stopped run showed visible post IDs `2016731193367285915` and
    `2014688978965037378`
  - both were absent from the `posts` table
  - both had no `post.save` logs
  - both had no `bookmarks.import.inspect` logs

That means the posts were lost before save/persistence: they were visible in
the X page after the importer stopped, but never reached the importer
collector/queue.

The later likes case with `2042731877069656563` confirmed the same class of
loss:

- `2042639420353056839` was already saved
- `2042731877069656563` was visible on the likes page before reload and had a
  normal `/status/2042731877069656563` permalink extractable from the article
- `2042731877069656563` was absent from the `posts` table
- logs had repeated `post.has.completed` with `exists: false`, but no
  `likes.import.inspect` or `post.save` for that ID

Additional cause found during this reproduction: the importer scrolled directly
to `document.scrollHeight`. On X's virtualized timeline this can jump past the
currently rendered list into bottom spacer/blank area, leaving the same earlier
articles in the DOM and never exposing the next posts below them.

Implemented fix:

- in both likes and bookmarks import loops, track whether the current pass
  performed an importer-driven scroll
- if `run.stopRequested` is observed immediately after that scroll wait, do
  repeated short final `collectVisiblePosts()` passes before breaking, because
  X can render the bottom of the current viewport slightly after the stop
  condition is detected
- change likes and bookmarks timeline scrolling from a direct
  `scrollHeight` jump to bounded incremental viewport scrolling, so the importer
  walks the virtualized timeline instead of skipping past the next rendered
  articles

This keeps the duplicate-threshold heuristic intact while preventing the
importer from dropping posts already exposed by its own final scroll or
skipping posts by jumping past X's render window.

## Changed Files

- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/likes-import-controls.ts`

## Verification

- code inspection of:
  - `src/features/x/likes-import-controls.ts`
  - `src/features/x/bookmarks-import-controls.ts`
  - `src/features/x/extract-post-from-article.ts`
  - `src/features/x/find-tweet-articles.ts`
- log artifact review:
  - confirmed `1892093150115790966` was saved and persisted, so it is a control
    case
- shared CDP Chrome, port `9223`, user account profile:
  - passive scan found bookmarks and likes contain interleaved saved/unsaved
    posts, so duplicate-threshold can encounter saved regions before all
    unsaved posts are exhausted
  - pre-fix bookmarks check: `15 / 15` independently observed visible posts
    were saved
  - reproduced concrete miss after extension reload:
    - visible unsaved post IDs after stopped bookmarks run:
      `2016731193367285915`, `2014688978965037378`
    - DB: both absent from `posts`
    - logs: no `post.save` or `bookmarks.import.inspect` entries for those IDs
  - after final-scroll render-grace fix and extension reload:
    - bookmarks run stopped by duplicate threshold
    - independently observed visible posts: `15`
    - DB saved count for those visible posts: `15`
    - missing count: `0`
  - additional likes verification:
    - temporarily changed `bulkImportDuplicateBatchThreshold` from `10` to
      `20`, then restored it to `10`
    - run completed normally with `collected = 7`, `saved = 2`,
      `duplicates = 5`, `failed = 0`
    - independently observed visible posts: `7`
    - DB saved count for those visible posts: `7`
    - missing count: `0`
    - deeper long-run likes verification could not be completed because the X
      page stayed at `articleCount = 7` / `scrollHeight = 7055` after a 15s
      reload wait and repeated bottom scrolls
  - user-provided likes case:
    - before extension reload, `2042731877069656563` was visible and
      extractable below `2042639420353056839`
    - DB: `2042639420353056839` saved, `2042731877069656563` absent
    - logs: no `likes.import.inspect` or `post.save` for
      `2042731877069656563`
    - after reloading the extension/page to test the fix, X no longer restored
      the same DOM state and only rendered 1-7 earlier articles, so exact
      verification of `2042731877069656563` is still pending page
      repositioning
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm run check:content-script-bundle`

## Remaining Issues

- duplicate-threshold remains a heuristic: it can still intentionally stop
  before scanning the entire bookmarks or likes history. This fix improves
  traversal and final visible collection, but it is not an exhaustive
  full-history crawl.
- exact verification for `2042731877069656563` remains blocked until the live X
  page is repositioned to the same likes timeline area again.

## Suggested Next Action

Ask the user to reposition the shared CDP likes page around
`2042639420353056839` / `2042731877069656563`, then rerun likes bulk import
with the incremental scroll build loaded and confirm `2042731877069656563`
enters `likes.import.inspect` and/or `post.save`.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
