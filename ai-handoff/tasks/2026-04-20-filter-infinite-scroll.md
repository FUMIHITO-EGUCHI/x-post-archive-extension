# Task Packet: Filter Modal Infinite Scroll

## Meta
- status: done
- owner: Codex
- branch: feature/infinite-scroll-modal-scrollbar
- priority: normal
- files_in_scope: src/features/viewer/components/unified-filter-modal.tsx, src/entrypoints/viewer/style.css
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: done
- summary: Replace filter modal user/tag load-more buttons with IntersectionObserver-based infinite scroll.

## Goal

Replace the user and tag filter modal load-more controls with automatic loading when the user scrolls near the end of each option list.

## Result

- Added `useInfiniteOptionList()` in `unified-filter-modal.tsx` to observe a sentinel inside the existing scrollable option list.
- User filter options now load the next chunk automatically when the list is scrolled to the end.
- Tag filter options now load the next chunk automatically when the list is scrolled to the end.
- The old modal load-more footer buttons are not rendered.
- Added `.viewer-option-list-sentinel` styling for the list-end sentinel.
- Fixed a reset bug where tag options briefly loaded past the first 40 items, then reset back to the initial set because `getTagDisplayName` changed identity on each viewer render.

## Acceptance Criteria

- [x] User filter panel load-more button is not displayed
- [x] Tag filter panel load-more button is not displayed
- [x] Scrolling to the end of the user option list loads more users automatically
- [x] Scrolling to the end of the tag option list loads more tags automatically
- [x] Selected filters remain visible outside the initial display count
- [x] `npm run typecheck` passed
- [x] `npm run build` passed

## Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Shared Profile manual verification via CDP Chrome on port 9223 passed.
- User filter modal: initial visible user options were 40, sentinel count was 1, footer button count was 0; after scrolling the option list to the bottom, visible user options increased to 80.
- Tag filter modal: initial visible tag options were 40, sentinel count was 1, footer button count was 0; after scrolling the option list to the bottom, visible tag options increased to 80.
- Regression check after the reset fix: tag filter modal loaded continuously from 40 (`SPY_FAMILY` as the last visible tag) to 80, 120, and 160 items; each count remained stable after the load.

## Changed Files

- `src/features/viewer/components/unified-filter-modal.tsx`
- `src/entrypoints/viewer/style.css`

## Remaining Issues

- none

## Suggested Next Action

- Commit the completed infinite scroll changes together when ready.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
