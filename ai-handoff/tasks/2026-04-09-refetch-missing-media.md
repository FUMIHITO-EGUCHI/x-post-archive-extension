# Task Packet: Refetch Missing Media Fix + Verification

## Goal

Fix the refetch flow so that posts whose images were not captured at save time
correctly pick up media when refetched. Verify the fix works end-to-end on the
known broken post `2041068152390598815`.

## Background

### Root cause

`handleRefetchCheck` in `bootstrap-x-content-script.ts` used to send
`refetch.complete` as soon as the tweet article was found in the DOM, without
waiting for images to finish loading. X lazy-loads images, so when the refetch
tab navigated to the post URL and the content script fired, `img.currentSrc`
could still be blank or placeholder-only. `extractPostImages` then returned
`[]`, `input.media` was empty, and `refetchArchivePost` had nothing to save.

The bookmarks / likes import path already handled this with a
`shouldWaitForMedia` retry loop. The refetch path had no equivalent guard.

### DB state before fix

- post `2041068152390598815` existed
- `media` had `0` records for that post
- `refetch_queue` had a previous `done` row for the same post

## Fix applied

**File:** `src/features/x/bootstrap-x-content-script.ts`

Claude updated `handleRefetchCheck` to inspect media hints before sending
`refetch.complete`.

- Added `inspectArticleMediaSignals` import from `./extract-post-from-article`
- Compared `imageHintCount + videoHintCount` against extracted savable media
- If the DOM still hints at media that has not materialized into extractable
  image/video records yet, the handler now returns early and lets the
  coordinator poll again

`npm run typecheck` and `npm run build` passed after the code change.

## Verification

### Shared CDP Chrome

- endpoint: `http://127.0.0.1:9223`
- DB name: `x-post-archive-posts-v1`

### Steps performed

1. Reloaded the unpacked extension from `chrome://extensions/?id=hlaianiimnjkppdbpobpgeidoafbcjhg`
2. Reopened the viewer page
3. Confirmed the pre-state:
   - `mediaCount = 0`
   - `refetch_queue.status = "done"` for `2041068152390598815`
4. Cleared the refetch queue via runtime message
5. Re-enqueued single-post refetch for `2041068152390598815`

### First result

With the refetch tab left inactive, the run ended in:

- `refetch_queue.status = "error"`
- `last_error = "Timed out while waiting for the X page to expose the target post."`

CDP inspection of the X page at that point showed:

- the tweet article existed
- the save button was present
- the post permalink and `/photo/1` link existed
- the actual post image had still not materialized into an extractable `img[src]`

This indicates the new guard correctly avoided a false empty completion, but the
inactive refetch tab still allowed X to starve image lazy-load long enough to
hit the coordinator timeout.

### Second result

Ran the same single-post refetch again, but after enqueueing, brought the X
refetch tab to the foreground via CDP. That run completed successfully.

Observed final state:

- `refetch.status.phase = "idle"`
- `completedCount = 1`
- `failedCount = 0`
- `mediaCount = 1`
- saved media record:
  - `source_url = "https://pbs.twimg.com/media/HFNUqmvaYAAeHsz?format=jpg&name=orig"`
  - `storage_status = "ready"`
- `refetch_queue.status = "done"`
- `last_error = null`

## Result

The missing-media refetch fix is verified for post `2041068152390598815`.

What is fixed:

- refetch no longer completes too early with an empty media set when the article
  exists but media has not loaded yet
- the known broken post can now recover its missing image via refetch

Remaining caveat:

- if the dedicated refetch X tab remains inactive, X may still delay image
  materialization enough for the coordinator to time out
- this is a separate inactive-tab / lazy-load behavior issue, not a failure of
  the missing-media save path once extraction succeeds

## Acceptance Criteria

- `npm run typecheck` passes
- `npm run build` passes
- refetch of `2041068152390598815` adds at least one media record to IndexedDB

All three are satisfied.

## Out of Scope

- the original root cause of why this post's images were not saved during the
  initial bookmark import
- the existing failed video records elsewhere in the DB
- commit / push
