# Task Packet: Performance Fix - Keyset Pagination (P4)

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: medium
- files_in_scope: src/types/viewer.ts, src/types/runtime.ts, src/db/repositories/posts-repository.ts, src/features/archive/archive-service.ts, src/features/runtime/handle-runtime-message.ts, src/features/viewer/components/use-archive-loader.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement after P5/P6
- summary: Add cursor-based pagination for unfiltered `saved_at` and `posted_at` page loads, while preserving offset fallback for random, count sorts, and filtered cases.

## Goal

Move the primary viewer load-more path for `saved_at` / `posted_at` away from IndexedDB `offset(N)` scans by carrying a cursor from each response to the next request.

## In Scope

- `PostPageCursor` type
- `ListPostsPageInput.cursor`
- `ListPostsPageResponse.nextCursor`
- repository keyset path for unfiltered `saved_at` / `posted_at`
- viewer loader cursor state

## Out Of Scope

- random keyset pagination
- count-sort keyset pagination
- filtered query keyset pagination
- changing session persistence schema

## Work Log

- `2026-04-17 Codex`: started P4 after completing P5/P6.
- `2026-04-17 Codex`: added `PostPageCursor`, propagated it through runtime response/input types, and wired viewer load-more to pass the latest cursor only for append requests.
- `2026-04-17 Codex`: updated `listPostsSliceBySort()` so unfiltered `saved_at` / `posted_at` requests with a valid cursor use `where(field).below(cursor.value).reverse()` or `where(field).above(cursor.value)` instead of offset.

## Result

- Unfiltered `saved_at` / `posted_at` load-more can now use cursor pagination.
- Initial loads, reloads, sort/filter changes, filtered cases, random sort, and engagement-count sorts keep the existing offset-compatible behavior.
- `nextOffset` remains in the runtime response for compatibility; `nextCursor` is added alongside it.

## Verification

- [x] `saved_at` / `posted_at` unfiltered append requests pass `cursor` from the previous response.
- [x] non-append loads pass `cursor: null`, so sort/filter changes reload from the first page.
- [x] random, filtered, and engagement-count sort paths still use offset fallback.
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Remaining Issues

- The first keyset implementation follows the scoped design and uses the single sort-field value as the cursor boundary. Posts with exactly equal `saved_at` or `posted_at` values can still be a precision edge case; a compound `[sortField+x_post_id]` index would be needed for fully stable tie handling.

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
