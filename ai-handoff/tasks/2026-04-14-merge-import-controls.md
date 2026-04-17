# Task Packet: Merge Duplicate Bookmarks/Likes Import Controls

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/features/x/bookmarks-import-controls.ts, src/features/x/likes-import-controls.ts
- blocked_by: none
- related_findings: full-codebase-review-2026-04-14 P3-001
- needs_from_claude: none
- handoff_to_codex: bookmarks-import-controls.ts and likes-import-controls.ts are ~90% identical; merge into a single parameterized module
- summary: two ~500-line files share identical logic and differ only in root element IDs, auto-tag type, and function name prefixes

## Goal

Replace the two near-identical import controls modules with a single parameterized implementation to eliminate duplicated logic and reduce the maintenance burden when the import flow needs to change.

## Problem Statement

`bookmarks-import-controls.ts` and `likes-import-controls.ts` are both ~500 lines. Diffing them shows:

- Root element ID: `BOOKMARKS_ROOT_ID` vs `LIKES_ROOT_ID`
- Overlay ID: `BOOKMARKS_OVERLAY_ID` vs `LIKES_OVERLAY_ID`
- Auto-tag type: `"bookmarked"` vs `"liked"`
- Function name prefixes: `startBookmarksImport` / `stopBookmarksImport` vs `startLikesImport` / `stopLikesImport`
- All control flow, DOM construction, messaging, scroll handling, and state management are identical

Any bug fix or feature addition currently requires the same change in two places. The sticky-toolbar and filter work in earlier sprints already required parallel edits to both files.

## In Scope

- Extract a shared `create-import-controls.ts` (or similar name) that accepts a config object and returns the `start`/`stop` functions
- Config shape should cover at minimum: `rootId`, `overlayId`, `autoTagType: "bookmarked" | "liked"`, display label string
- `bookmarks-import-controls.ts` and `likes-import-controls.ts` become thin wrappers that call the shared factory with their config — or are deleted in favor of direct factory calls from their call sites
- All existing exported function names and signatures must be preserved (or their call sites updated in the same PR)

## Out Of Scope

- Changes to the messaging protocol (`import.start`, `import.stop`, etc.)
- Changes to the scroll/stop logic behavior
- UI changes

## Acceptance Criteria

- [x] No logic is duplicated between bookmarks and likes import controls
- [x] Both bookmarks and likes import flows behave identically to before
- [x] Exported function names callable from content script entry point are unchanged (or updated in-scope)
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Work Log

- `2026-04-14 Codex`: Extracted shared import overlay and scroll/save logic into `timeline-import-controls.ts`.
- `2026-04-14 Codex`: Reduced bookmarks/likes import modules to thin wrappers that pass root ids, page matcher, auto tag options, event prefix, and labels into the shared factory.

## Result

- Added `src/features/x/timeline-import-controls.ts` with the shared parameterized implementation.
- Preserved the public wrapper exports in `bookmarks-import-controls.ts` and `likes-import-controls.ts`.
- Preserved bookmarks/likes page matching, root/overlay ids, debug event prefixes, and auto tag options through config.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run handoff:check`

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
