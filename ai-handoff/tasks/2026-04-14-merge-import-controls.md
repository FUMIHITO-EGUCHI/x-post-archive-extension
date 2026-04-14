# Task Packet: Merge Duplicate Bookmarks/Likes Import Controls

## Meta
- status: waiting
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

- [ ] No logic is duplicated between bookmarks and likes import controls
- [ ] Both bookmarks and likes import flows behave identically to before
- [ ] Exported function names callable from content script entry point are unchanged (or updated in-scope)
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Work Log

## Result

## Verification

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
