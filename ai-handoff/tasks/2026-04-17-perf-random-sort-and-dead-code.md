# Task Packet: Performance Fix - Random Sort Optimization And Dead Code Removal (P5/P6)

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: medium
- files_in_scope: src/features/archive/archive-service.ts, src/features/runtime/handle-runtime-message.ts, src/features/runtime/client.ts, src/types/runtime.ts, src/db/repositories/posts-repository.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement before P4, P7, and P8/P9
- summary: Replace full random-order shuffle with seeded partial shuffle for the requested page window, and remove the unused `posts/list` endpoint.

## Goal

1. P5: Keep random ordering stable for the current seed, but avoid full Fisher-Yates shuffling when only one page window is needed.
2. P6: Remove the unused `posts/list` runtime endpoint and related dead code.

## In Scope

- `src/features/archive/archive-service.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/features/runtime/client.ts`
- `src/types/runtime.ts`
- `src/db/repositories/posts-repository.ts`

## Out Of Scope

- Keyset pagination for non-random sorts (P4)
- Filtered-query redesign
- Viewer UI changes

## Work Log

- `2026-04-17 Codex`: started P5/P6 implementation on `feature/full-codebase-review-2026-04-14-fixes`.
- `2026-04-17 Codex`: removed the unused `posts/list` runtime path and replaced full random shuffle with seeded partial shuffle through `offset + limit`.

## Result

- `posts/list` runtime endpoint, client helper, response/message types, and `listArchivePosts()` / `listPosts()` dead code were removed.
- Random sort now keeps the existing seeded order semantics but only performs Fisher-Yates swaps through the requested page window (`offset + limit`) before slicing.
- The implementation still uses primary keys rather than full `PostRecord` loads for random ordering.

## Verification

- [x] `rg` confirmed no remaining source references to `ListPostsMessage`, `ListPostsResponse`, `requestPosts`, `listArchivePosts`, `listPosts`, or `shuffleIdsInPlace`.
- [x] `posts/list` message handler was removed from runtime validation and switch handling.
- [x] Random sort uses `primaryKeys()` through `listPostIds()` and seeded partial shuffle through `selectSeededRandomIds()`.
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
