# Current Task

## Active

- id: `2026-04-14-viewer-app-decompose-and-cap-load`
- title: `Decompose ViewerApp and Cap Session Restore Load`
- owner: `Codex`
- status: `active`
- branch: `feature/full-codebase-review-2026-04-14-fixes`
- priority: `low`
- task_file: `ai-handoff/tasks/2026-04-14-viewer-app-decompose-and-cap-load.md`

## Scope

- Start with `MAX_SESSION_RESTORE_LIMIT = 200` cap for session restore `initialLimit`
- Continue safe decomposition steps; `PostCard`, `SettingsScreen`, media lightbox, refetch controls, viewer preferences, tag operations, and archive loader extraction are now done
- Keep data loading, filter/sort behavior, and viewer UI behavior unchanged

## Coordination

- blocked_by: `none`
- related_findings: `full-codebase-review-2026-04-14 P4-001, P4-002`
- needs_from_claude: `none`
- handoff_to_codex: `design complete (2026-04-14); implement decomposition per design section; start with initialLimit cap, then PostCard extraction`

## Next Action

- next_action: `Continue decomposition with the next safe slice, likely sort/filter extraction.`

## Acceptance Criteria

- [x] `initialLimit` session restore is capped at `MAX_SESSION_RESTORE_LIMIT = 200`
- [x] Viewer decomposition is advanced without behavior changes
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Completion Checklist

- [x] investigation finished
- [ ] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated

## Recent Updates

- `2026-04-14 Codex`: committed `2026-04-14-merge-import-controls` as `a790ca3 Merge timeline import controls`
- `2026-04-14 Codex`: started `2026-04-14-viewer-app-decompose-and-cap-load` on `feature/full-codebase-review-2026-04-14-fixes`
- `2026-04-14 Codex`: added `MAX_SESSION_RESTORE_LIMIT = 200` and capped session restore `initialLimit`; typecheck/build passed; PostCard extraction remains next
- `2026-04-14 Codex`: extracted `PostCard`, `QuotedPostCard`, and `MediaCard` into `post-card.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-14 Codex`: extracted settings page rendering and settings tab state into `settings-screen.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted media lightbox state/effects/dialog rendering into `media-lightbox.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: committed `be3716d Decompose viewer app sections`
- `2026-04-15 Codex`: extracted refetch status polling and refetch action handlers into `use-refetch-controls.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted viewer preferences, preference persistence, theme side effect, and storage estimate state into `use-viewer-preferences.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: committed `315c8a7 Extract viewer preferences`
- `2026-04-15 Codex`: extracted per-post tag picker/action state and tag add/remove handlers into `use-tag-operations.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted archive post list/loading state and `loadArchivePage` into `use-archive-loader.ts`; typecheck/build passed; task remains active for further decomposition

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-14-merge-import-controls`: bookmarks/likes import controls now share a single parameterized implementation; typecheck and build passed
- `2026-04-14-fix-path-filter-and-refetch-typing`: archive restore now filters out `..` segments and refetch.complete uses the typed runtime client; typecheck and build passed
- `2026-04-14-remove-dead-code-archive-service`: removed dead archive service and maintenance service helper functions; typecheck and build passed
