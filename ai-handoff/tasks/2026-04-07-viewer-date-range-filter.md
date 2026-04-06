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

<!-- Fill after implementation -->

## Changed Files

<!-- Fill after implementation -->

## Verification

<!-- Fill after implementation -->

## Remaining Issues

<!-- Fill after implementation -->

## Suggested Next Action

<!-- Fill after implementation -->
