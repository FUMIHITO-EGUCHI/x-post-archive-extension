# Task Packet: Bulk Tagging

## Goal

Allow the user to apply one manual tag to all posts matched by the current viewer filters.

The target filters are:
- tag filter
- author filter
- date filter

## Requested Action

Implement the feature and verify it with `npm run typecheck` and `npm run build`.  
Real-world browser testing is not required for this pass.

## Design Summary

### Flow
1. Viewer opens a bulk-tag modal from the archive screen.
2. Viewer sends `tag.bulk-assign.preview` with the current filter state and the requested tag name.
3. Background resolves matching post IDs, creates the target tag if needed, and removes already-tagged posts from the candidate list.
4. Viewer shows a preview: total matches, how many will be tagged, and how many will be skipped.
5. Viewer applies tags in batches of 100 through `tag.bulk-assign.apply-batch`.

### Runtime additions
- `tag.bulk-assign.preview`
- `tag.bulk-assign.apply-batch`

### Type additions
- `PostFilterInput` in [viewer.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/types/viewer.ts)

### Repository additions
- `listPostIdsByTagId()`
- `bulkAddPostTagRecords()`

### Service additions
- `bulkAssignTagPreview()`
- `bulkAssignTagApplyBatch()`

### Viewer additions
- new [bulk-tag-modal.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/bulk-tag-modal.tsx)
- archive header button in [viewer-app.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/viewer-app.tsx)

## Result

- Implemented `PostFilterInput` so viewer filters can be passed without paging/sort concerns.
- Added runtime request/response types for bulk tag preview and batch apply.
- Added repository helpers to list post IDs by `tag_id` and insert many `post_tags` records idempotently.
- Added archive-service logic that:
  - reuses `resolveFilteredPostIds()`
  - resolves or creates the target tag
  - excludes already-tagged posts from the candidate set
  - applies tags in bulk
- Added viewer client helpers for the new runtime messages.
- Added `BulkTagModal` with:
  - tag input
  - existing tag suggestions
  - preview step
  - progress display while applying
  - done state
- Added an archive-screen `Bulk tag` button that uses the current filtered count.

## Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Real-world browser verification was not run, per user request.

## Files Changed

- [viewer.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/types/viewer.ts)
- [runtime.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/types/runtime.ts)
- [post-tags-repository.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/db/repositories/post-tags-repository.ts)
- [archive-service.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/archive/archive-service.ts)
- [client.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/runtime/client.ts)
- [handle-runtime-message.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/runtime/handle-runtime-message.ts)
- [bulk-tag-modal.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/bulk-tag-modal.tsx)
- [viewer-app.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/viewer-app.tsx)
- [style.css](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/entrypoints/viewer/style.css)

## Remaining Work

- Optional: browser-side verification of the preview text, progress updates, and final tag summary refresh.
- Optional: if needed later, extend the feature to support more filter types or bulk tag removal.
