# Task Packet

- GitHub Issue: `#5`

## Goal

Add date-range filtering to the archive list in the viewer so users can narrow saved posts by saved date or posted date without manually scanning long lists.

## Requested Action

Design and implement a lightweight date filter for the main archive list, define which timestamp it filters on, and document the decision in the task result.

## In Scope

- Add viewer-side filter state for date-based narrowing
- Decide whether the filter uses `saved_at`, `posted_at`, or supports both
- Update the archive list query / filtering flow so the selected date range affects the visible posts
- Add the UI needed to set and clear the date range
- Keep session restore behavior aligned if the viewer currently persists filter state

## Out Of Scope

- Full advanced search syntax
- Calendar-heavy UI or third-party date picker adoption unless clearly needed
- Refetching or rewriting archived post timestamps
- Push

## Constraints

- Keep the filtering model understandable and consistent with existing tag / user filter behavior
- Prefer lightweight native inputs unless the current viewer design strongly requires more
- Avoid making the archive list significantly slower for large datasets
- Run `npm run typecheck` and `npm run build`

## Files To Read First

- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/viewer-session-storage.ts`
- `src/types/viewer.ts`
- `src/features/runtime/handle-runtime-message.ts`

## Inputs From Claude

- The user wants date filtering in the archive list
- The UX should stay lightweight and not regress viewer performance

## Acceptance Criteria

- Users can set a date range from the viewer and the archive list updates accordingly
- The chosen filter target (`saved_at`, `posted_at`, or both) is explicitly documented
- Clearing the date range returns the list to its unfiltered state
- Existing list loading and session restore behavior remain coherent
- `npm run typecheck`
- `npm run build`

## Open Questions

- Should the first version filter by `saved_at`, `posted_at`, or provide a toggle between them?
- Should the date filter live in the main archive controls row or inside a secondary filter panel?
- Does the current paged / incremental list API need query-level support, or is local filtering sufficient?

## Codex Plan

- Inspect current viewer filter state and list loading flow
- Choose the smallest coherent date-filter model
- Implement UI and state plumbing
- Verify build and behavior

## Codex Result

Implemented a dedicated archive date filter modal with explicit `Apply` / `Clear` actions. The filter supports both `saved_at` and `posted_at` via a target selector, persists in viewer session restore state, and applies at query time so pagination stays coherent for large archives.

## Changed Files

- `src/features/viewer/components/viewer-app.tsx`
- `src/features/archive/archive-service.ts`
- `src/features/viewer/viewer-session-storage.ts`
- `src/types/viewer.ts`
- `src/entrypoints/viewer/style.css`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-07-viewer-date-range-filter.md`

## Verification

- `npm run typecheck`
- `npm run build`
- shared CDP Chrome verification after extension reload confirmed that date-range filtering updates the archive list as expected

## Remaining Issues

- none for this issue

## Suggested Next Action

Commit this issue, then continue to the next waiting viewer/archive task on `feature/archive-viewer-improvements`.
