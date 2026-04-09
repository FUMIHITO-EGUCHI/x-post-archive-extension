# Task Packet: Inactive Refetch Background-only Fix

## Goal

Fix the refetch timeout that occurred when the dedicated X refetch tab stayed
inactive, without falling back to foreground activation.

The target outcome is that single-post refetch succeeds while the X tab remains
inactive, including the known missing-media post `2041068152390598815`.

## Background

The previous missing-media fix stopped `refetch.complete` from firing too early,
but it exposed a second issue: in an inactive X tab, the post page often never
materialized `<img>` nodes for photo media at all.

Confirmed repro before this task:

- `2041068152390598815` timed out in an inactive tab
- the same post succeeded if the refetch tab was brought to the foreground
- DOM inspection showed `/photo/1` anchors but no `tweetPhoto` container and no
  `pbs.twimg.com/media/...` image node, even after waiting

That meant DOM warm-up alone was not sufficient. A background-only solution
needed a second data source for image media.

## Implemented Changes

### 1. Structured `refetch.check` response

Added `RefetchCheckResponse` in `src/types/refetch.ts`.

The content script now returns:

- `found`
- `extracted`
- `waitingForMedia`
- `imageHintCount`
- `videoHintCount`
- `savableMediaCount`
- `warmupApplied`

This replaces the old boolean-style response and gives the coordinator enough
state to distinguish:

- post not found yet
- post found but still waiting for media
- extraction ready

### 2. Progress-aware coordinator waiting

Updated `src/features/refetch/refetch-coordinator.ts`.

Instead of a single fixed 30-second wait, the coordinator now:

- keeps polling while the post is found and progress is still happening
- resets the no-progress timer when:
  - `found` changes to `true`
  - `savableMediaCount` increases
  - media-hint counts change
  - warm-up becomes newly applied
- uses a shorter no-progress timeout plus a longer overall hard cap
- reports a specific timeout error when media never materializes in the inactive tab

### 3. Inactive-tab media warm-up

Updated `src/features/x/bootstrap-x-content-script.ts`.

When media is hinted but not yet extractable, the content script now:

- rescans tweet articles
- scrolls the target article into view
- targets main-post photo anchors / containers only
- applies eager-ish hints where safe
  - `img.loading = "eager"`
  - `img.decoding = "sync"`
  - `video.preload = "auto"`
- calls `decode()` on images with a real source when available
- dispatches minimal pointer / mouse enter events on photo targets

If media is still hinted but not extractable after warm-up, the content script
does not send `refetch.complete`.

### 4. GraphQL-backed image fallback

Added GraphQL image candidate extraction and caching so refetch no longer depends
entirely on DOM image nodes.

New modules:

- `src/features/x/graphql-image-candidates.ts`
- `src/features/x/graphql-image-events.ts`
- `src/features/x/graphql-image-candidate-cache.ts`

Also updated:

- `src/features/x/install-graphql-video-response-observer.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/bootstrap-x-content-script.ts`

Behavior:

- the existing MAIN-world GraphQL observer now also extracts photo media from
  tweet detail responses
- image candidates are cached by `xPostId`
- `extractPostFromArticle()` merges DOM image extraction with cached GraphQL image
  candidates by `source_url`
- if the hidden tab never renders a photo `<img>`, refetch can still recover the
  image from the GraphQL response

## Verification

### Static checks

- `npm run typecheck` passed
- `npm run build` passed

### Shared CDP Chrome

- port: `9223`
- DB: `x-post-archive-posts-v1`

### Main scenario

After reloading the unpacked extension, clearing queue state, and deleting any
existing media rows for `2041068152390598815`, a single-post refetch was run
with the X refetch tab left inactive the entire time.

Observed result:

- queue status became `done`
- `failedCount = 0`
- `mediaCount = 1`
- saved media row:
  - `source_url = "https://pbs.twimg.com/media/HFNUqmvaYAAeHsz.jpg?name=orig"`
  - `storage_status = "ready"`

### Regression checks

- text-only post `1000155876953542656` completed normally while hidden
- rerunning refetch on `2041068152390598815` after media already existed kept
  media count at `1`, confirming no duplicate-media regression

## Result

The inactive-tab refetch issue is fixed for the verified scenario.

Refetch now succeeds in the background for the known broken image post by
combining:

- progress-aware polling
- DOM warm-up
- GraphQL image fallback

## Remaining Caveat

This remains a best-effort background-only solution. If X changes its GraphQL
payloads or stops exposing image media there, inactive-tab recovery may degrade
again. No foreground fallback was added in this task.
