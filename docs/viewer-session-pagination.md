# Viewer Paging And Session Restore

## Scope

- Replace the archive viewer's full initial load with incremental page loading.
- Keep tag filtering and sorting available while paging through saved posts.
- Allow the user to choose whether viewer state is restored after the tab is closed.

## Session Restore Modes

- `off`: always open the archive from a fresh state.
- `filters`: restore sort order and the active tag filter.
- `filters-and-position`: restore sort order, active tag filter, loaded item count, and scroll position.

## Implementation Notes

- Runtime messaging now separates paged post loading from tag summary and archive summary loading.
- The archive service hydrates media and tags only for the requested page.
- Viewer session state is stored in `browser.storage.local`.
- The archive list uses `Load more` instead of rendering every saved post at once.

## Verification

- Open the viewer with thousands of saved posts and confirm the first paint only shows the first page.
- Change sort and tag filter, close the tab, and confirm the selected restore mode is respected.
- Load additional pages, close the tab, and confirm position restore returns near the same post when enabled.
