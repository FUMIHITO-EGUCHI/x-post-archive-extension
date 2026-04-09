# Task Packet: Saved Post Refetch

## Goal

Allow already-saved posts to be fetched again from `x.com` so mutable snapshot fields can be refreshed later.

The feature covers:
- per-post refetch from the viewer
- bulk refetch of saved posts from viewer settings
- a persisted queue with progress, stop, and clear controls

## Background

- Saved posts are snapshot-first, but some fields still benefit from manual refresh.
- This task is intentionally manual, not auto-refresh.
- The refetch flow should reuse existing DOM extraction on X rather than introducing API dependencies.

## Requested Action

Implement the refetch feature end-to-end, verify it with `typecheck`, `build`, and shared CDP Chrome, and keep `saved_at` plus existing `quoted_post_id` stable during updates.

## Design Summary

### Queue / background flow
1. Viewer enqueues one or many `x_post_id` values.
2. Background persists queue state in IndexedDB.
3. Background opens or reuses an inactive X tab.
4. Background navigates that tab to the target post URL.
5. Content script detects when the target post is visible and extracts it.
6. Background applies the updated snapshot fields to the saved post.

### Queue model

```ts
refetch_queue: {
  x_post_id: string;
  status: "pending" | "done" | "error";
  priority: number;
  enqueued_at: number;
  attempts: number;
  completed_at: number | null;
  last_error: string | null;
}
```

- `x_post_id` is the primary key.
- `priority: 1` is used for single-post refetch.
- `priority: 0` is used for bulk refetch.
- `pending` items remain until completed, failed, or cleared.

### Mutable fields

These fields may be updated by refetch:
- `post_text`
- `display_name`
- `x_username`
- `reply_count`
- `repost_count`
- `like_count`
- media metadata

These fields must stay stable:
- `saved_at`
- existing `quoted_post_id`
- tag assignments

### Runtime messages

- `refetch.enqueue`
- `refetch.status`
- `refetch.cancel`
- `refetch.clear`
- `refetch.check`
- `refetch.complete`

## Files Involved

- `src/db/archive-database.ts`
- `src/db/repositories/refetch-queue-repository.ts`
- `src/db/repositories/posts-repository.ts`
- `src/types/refetch.ts`
- `src/types/runtime.ts`
- `src/features/refetch/refetch-coordinator.ts`
- `src/entrypoints/background.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/archive/archive-service.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
- `src/features/viewer/components/viewer-app.tsx`
- `src/entrypoints/viewer/style.css`

## Result

- Implemented the refetch flow end-to-end.
- Added Dexie `refetch_queue` storage and a dedicated queue repository.
- Added `refetchArchivePost()` so mutable post fields and media metadata can be refreshed while preserving `saved_at` and the existing `quoted_post_id`.
- Added a background `refetch-coordinator.ts` that reuses a dedicated inactive X tab, waits for the target URL to finish loading, polls the content script with `refetch.check`, and records done/error state per post.
- Added runtime messages for enqueue/status/cancel/clear/complete and viewer-side client helpers.
- Added content-script handling for `refetch.check`.
- Added viewer UI for:
  - per-post `Refetch`
  - bulk `Refetch saved posts`
  - queue progress / pending / failed counts
  - `Stop after current`
  - `Clear queue`

## Verification

- `npm run typecheck` passed.
- `npm run build` passed.

### Shared CDP Chrome verification on 2026-04-09

- Reloaded the unpacked extension from `chrome://extensions/?id=hlaianiimnjkppdbpobpgeidoafbcjhg`.
- Confirmed a fresh X tab accepts `refetch.check` and returns `{ found: true }` for saved post `2041068152390598815`.
- Confirmed single refetch completes for `2041068152390598815`; `refetch.status` moved `idle -> running -> idle`, `completedCount` became `1`, and the saved post kept its previous `saved_at`.
- Found and fixed a viewer/runtime regression where `handleRuntimeMessage()` awaited `resumeRefetchProcessing()`, which stalled ordinary viewer requests such as `posts/list-page`.
- After that fix and extension reload, the viewer archive list returned to normal loading.

### Claude bulk-fix verification on 2026-04-09

- Claude replaced the old one-by-one bulk enqueue path with `bulkUpsertPendingRefetchQueueRecords` and moved stop-flag resets ahead of the DB operation.
- Shared CDP Chrome re-verification after that fix showed:
  - `refetch.enqueue { enqueueAll: true, priority: 0 }` returned in about `1.3s`
  - `enqueuedCount = 12,743`
  - returned status was already `phase = "running"`
  - `pendingCount` stopped growing gradually and instead stayed stable, then began decrementing as work completed
  - `refetch.cancel` moved the queue to `phase = "stopped"` with pending items intact
  - `refetch.clear` from stopped state emptied the queue immediately and returned `phase = "idle"`
- Follow-up single-post refetch still completed successfully after the bulk fix.

## Remaining Work for Codex

- Commit the refetch implementation and handoff updates.
- Optionally add release-note copy if this feature is intended for the next release.
