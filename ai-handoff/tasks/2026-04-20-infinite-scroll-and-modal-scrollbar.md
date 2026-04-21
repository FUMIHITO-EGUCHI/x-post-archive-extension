# Task Packet: Infinite Scroll And Modal Scrollbar

## Meta
- status: done
- owner: Codex
- branch: feature/infinite-scroll-modal-scrollbar
- priority: medium
- files_in_scope: src/features/viewer/components/viewer-app.tsx, src/entrypoints/viewer/style.css
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: done
- summary: Replace the archive list load-more button with IntersectionObserver-based infinite scroll, and hide filter modal scrollbars while keeping scrolling enabled.

## Goal

1. Remove the archive list load-more button and load additional archive posts automatically when the user scrolls near the end of the list.
2. Hide scrollbars in the filter modal and tag option list without disabling scroll behavior.

## Result

- Replaced the archive list load-more button with a hidden `.viewer-list-sentinel` observed by `IntersectionObserver`.
- Kept the incremental loading status text and added an in-flight guard so the observer cannot fire duplicate load requests while one request is pending.
- Kept the sentinel conditional on `hasMorePosts`; once all results are loaded, the observer target is removed and no extra load can be triggered.
- Hid scrollbars for `.viewer-modal` and `.viewer-tag-option-list` with Firefox and WebKit-compatible CSS while preserving `overflow` scrolling.

## Acceptance Criteria

- [x] Scrolling near the bottom of the post list automatically loads the next page
- [x] The old load-more button is not displayed
- [x] Loading indicator is rendered while an incremental load is in progress
- [x] No further load is triggered after all posts are loaded
- [x] Filter modal scrollbars are hidden while scrolling still works
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Shared Profile manual verification via CDP Chrome on port 9223 passed.
- Verified the archive initially rendered 50 posts with 0 `.viewer-list-footer button` elements and 1 `.viewer-list-sentinel`.
- Verified scrolling to the bottom increased rendered posts from 50 to 100 through automatic loading, with no load-more button rendered.
- Verified a DOM observer saw the loading footer appear during incremental loading, then posts increased from 50 to 100.
- Verified filter modal styles in Chrome: `.viewer-modal` and `.viewer-tag-option-list` both computed `scrollbar-width: none` and WebKit scrollbar `display: none`.
- Verified `.viewer-tag-option-list` remained scrollable by setting `scrollTop` to 120.

## Completion Checklist

- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`

## Work Log

- `2026-04-20 Claude`: Prepared the task packet and handed it to Codex.
- `2026-04-20 Codex`: Implemented archive infinite scroll and filter modal scrollbar hiding.
