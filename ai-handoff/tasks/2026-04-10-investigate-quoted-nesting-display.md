# Task Packet: Investigate Quoted Nesting Display

## Meta
- status: done
- owner: Codex
- branch: feature/archive-followups
- priority: medium
- files_in_scope: src/features/archive/archive-service.ts, src/db/repositories/posts-repository.ts, src/features/viewer/components/viewer-app.tsx, src/types/archive.ts
- blocked_by: none
- related_findings: `2026-04-02-quoted-post-feature`
- needs_from_claude: none
- handoff_to_codex: investigate why quoted nesting is not rendered even though both the main post and quoted post are saved, then restore the nested quoted-post display
- summary: quoted nesting now backfills `quoted_post_id` during duplicate save and refetch, with shared-profile runtime and viewer DOM verification

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
- `2026-04-11 Codex`: started investigation by tracing `quoted_post_id` persistence, archive hydration, and viewer rendering, then moving to shared-profile DB/runtime checks for a real saved main-post plus quoted-post pair.
- `2026-04-11 Codex`: started implementing the persistence fix so duplicate saves and refetch can backfill `quoted_post_id` onto already-saved main posts.
- `2026-04-11 Codex`: implemented `quoted_post_id` backfill in duplicate-save and refetch persistence, then verified on shared profile that a synthetic main/quoted pair now stores the linkage and hydrates `quoted_post` through `posts/list-page`.
- `2026-04-11 Codex`: continued shared-profile verification. Runtime `posts/list-page` now returns the synthetic main post with hydrated `quoted_post`, while a fresh viewer tab still did not surface the synthetic pair in the rendered top cards, so viewer-side real-DOM verification remains partially unresolved.
- `2026-04-11 Codex`: identified the viewer-side verification blocker as restored random session state, cleared `viewer.sessionState`, reran the shared-profile synthetic pair check, and confirmed the viewer DOM now renders `.quoted-post-card` inside the main post card.
- `2026-04-11 Codex`: split the secondary quoted-container annotation coverage concern into follow-up task `2026-04-11-investigate-quoted-container-annotation-coverage` so this task can stay focused on saved-linkage persistence and nested viewer rendering.

## Codex Plan

1. wait for the active refetch verification task to clear
2. inspect one concrete saved main/quoted pair in IndexedDB
3. trace `quoted_post_id` through archive hydration into viewer rendering
4. implement the narrowest fix and verify the quote card is shown again

## Codex Result

The root cause was in persistence, not viewer rendering.

- shared profile archive inspection found `0` saved posts with a non-empty
  `quoted_post_id`
- `hydrateArchivePosts()` and the viewer rendering path are still wired
  correctly: if a main post has `quoted_post_id` and the quoted post exists,
  the archive service hydrates `quoted_post` and the viewer renders
  `QuotedPostCard`
- the save paths do attempt to persist quoted linkage:
  `bootstrap-x-content-script.ts`, `likes-import-controls.ts`, and
  `bookmarks-import-controls.ts` all save the quoted post first and then call
  `requestSavePost(post)` with `post.quoted_post_id = quotedPostId`
- `saveArchivePost()` did not update `quoted_post_id` in its duplicate-save
  branch
- `refetchArchivePost()` refreshed text, counts, and media without updating
  `quoted_post_id`

That created a stable failure mode:

- main post is saved once without linkage
- quoted post is later saved successfully
- re-saving the main post returns `duplicate`
- the existing row keeps `quoted_post_id = null`
- both posts exist in the archive, but no nested quote can hydrate or render

Concrete reproduction on shared profile before the fix:

- synthetic quoted-post pair was created through runtime messages
- first main save stored `quoted_post_id = null`
- quoted post save succeeded
- second main save with `quoted_post_id = quotedId` returned `duplicate`
- IndexedDB still showed the main post with `quoted_post_id = null`

Implemented fix:

- `saveArchivePost()` now normalizes `input.quoted_post_id` and updates the
  existing row during duplicate-save handling when the linkage changed
- duplicate-save responses now return the updated `quoted_post_id`
- `refetchArchivePost()` now also persists normalized `quoted_post_id`

Shared-profile verification after the fix:

- synthetic main save still begins with `quoted_post_id = null`
- quoted post save succeeds
- second main save returns `duplicate` with `quoted_post_id = quotedId`
- IndexedDB now stores the main post with `quoted_post_id = quotedId`
- `posts/list-page` hydrates the same main post with
  `quoted_post.x_post_id = quotedId`
- after clearing `viewer.sessionState`, a fresh viewer tab renders the
  synthetic main post at the top of the list and includes a nested
  `.quoted-post-card`

Live DOM checks on `https://x.com/home` also showed that quoted-container
annotation is only partially present right now:

- `10` tweet articles were visible
- `2` `div[role="link"][tabindex="0"]` containers were found
- only `1` had `data-xpa-quoted-permalink`

That may still be a secondary extraction risk, but it does not explain the
shared-profile archive state by itself as strongly as the now-fixed
duplicate-save linkage bug. The annotation coverage concern was split into
follow-up task `2026-04-11-investigate-quoted-container-annotation-coverage`.

## Changed Files

- `src/features/archive/archive-service.ts`

## Verification

- code inspection of:
  - `src/features/archive/archive-service.ts`
  - `src/features/x/bootstrap-x-content-script.ts`
  - `src/features/x/likes-import-controls.ts`
  - `src/features/x/bookmarks-import-controls.ts`
  - `src/features/x/extract-post-from-article.ts`
  - `src/features/viewer/components/viewer-app.tsx`
- shared profile viewer IndexedDB inspection:
  - quoted-link post count in `posts` store: `0`
- shared profile synthetic reproduction via runtime messages:
  - before fix:
    - first main save: `status = "saved"`, `quoted_post_id = null`
    - quoted save: `status = "saved"`
    - second main save with linkage: `status = "duplicate"`
    - stored main post remained `quoted_post_id = null`
  - after fix:
    - first main save: `status = "saved"`, `quoted_post_id = null`
    - quoted save: `status = "saved"`
    - second main save with linkage: `status = "duplicate"`,
      `quoted_post_id = quotedId`
    - stored main post had `quoted_post_id = quotedId`
    - `posts/list-page` returned the same post with
      `quoted_post.x_post_id = quotedId`
    - after clearing `viewer.sessionState`, fresh viewer DOM check showed:
      - synthetic main post as the top rendered card
      - nested `.quoted-post-card`
      - quoted card text containing the quoted account and body
- shared profile live DOM inspection on `https://x.com/home`:
  - `articleCount = 10`
  - `quotedContainerCount = 2`
  - `annotatedCount = 1`
- `npm run typecheck`
- `npm run build`

## Remaining Issues

- quoted-container annotation may have an additional false-positive / coverage
  issue on current X DOM, tracked separately in
  `2026-04-11-investigate-quoted-container-annotation-coverage`
- viewer verification requires clearing restored random session state if the
  saved `viewer.sessionState` uses `sortField = "random"`

## Suggested Next Action

Close this task with the persistence fix and synthetic viewer verification.
Handle partial quoted-container annotation coverage in follow-up task
`2026-04-11-investigate-quoted-container-annotation-coverage`.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
