# Current Task

## Active

- id: `2026-04-17-viewer-app-second-pass`
- title: `ViewerApp Second-pass Decomposition`
- owner: `Codex`
- status: `active`
- branch: `feature/full-codebase-review-2026-04-14-fixes`
- priority: `low`
- task_file: `ai-handoff/tasks/2026-04-17-viewer-app-second-pass.md`

## Scope

- Extract `useArchiveMetadata` from `viewer-app.tsx`
- Move pure viewer formatting/date helper functions to `viewer-formatters.ts`
- Keep viewer data loading, filtering, sorting, and UI behavior unchanged
- Avoid DB query changes in this task

## Coordination

- blocked_by: `none`
- related_findings: `2026-04-17-cia-perf-audit`
- needs_from_claude: `none`
- handoff_to_codex: `design complete (2026-04-17); implement per design section`

## Next Action

- next_action: `Extract viewer formatters first, then archive metadata hook.`

## Acceptance Criteria

- [ ] Pure formatter/date helpers are moved out of `viewer-app.tsx`
- [ ] Archive metadata state and refresh function are moved to `use-archive-metadata.ts`
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated

## Recent Updates

- `2026-04-17 Codex`: completed `2026-04-17-investigate-handoff-mojibake`; 2026-04-17 handoff files are valid UTF-8 and the mojibake is display-path related.
- `2026-04-17 Codex`: started `2026-04-17-viewer-app-second-pass`.
- `2026-04-17 Codex`: closed `2026-04-17-perf-fix-full-scans`; P1-P3 archive full-scan performance fixes are complete.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-17-investigate-handoff-mojibake`: 2026-04-17 handoff mojibake was confirmed as display-path related; no source-text recovery needed; finding added
- `2026-04-17-perf-fix-full-scans`: P1-P3 archive full-scan performance fixes are complete; typecheck, build, and handoff check passed
- `2026-04-14-viewer-app-decompose-and-cap-load`: ViewerApp decomposition and capped session restore load are complete; typecheck, build, and handoff check passed
- `2026-04-14-merge-import-controls`: bookmarks/likes import controls now share a single parameterized implementation; typecheck and build passed
