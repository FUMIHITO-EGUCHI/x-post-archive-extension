# Current Task

## Active

- id: `2026-04-17-investigate-handoff-mojibake`
- title: `Investigate 2026-04-17 Handoff Mojibake`
- owner: `Codex`
- status: `active`
- branch: `feature/full-codebase-review-2026-04-14-fixes`
- priority: `medium`
- task_file: `ai-handoff/tasks/2026-04-17-investigate-handoff-mojibake.md`

## Scope

- Inspect newly added 2026-04-17 handoff files that contain mojibake
- Determine whether the mojibake is persisted file corruption or display-path decoding
- Repair affected files only if the original text can be recovered safely
- Document the root cause and remaining source-text needs

## Coordination

- blocked_by: `none`
- related_findings: `2026-04-17-cia-perf-audit`, `2026-04-07-handoff-encoding`
- needs_from_claude: `original readable Japanese text if local bytes are already corrupted`
- handoff_to_codex: `investigate 2026-04-17 handoff mojibake and repair or document source-text needs`

## Next Action

- next_action: `Inspect raw bytes and decode paths for the affected 2026-04-17 handoff files.`

## Acceptance Criteria

- [ ] The investigation states whether the 2026-04-17 mojibake is persisted in file contents or only display-path related.
- [ ] Affected files are repaired when recoverable without guessing.
- [ ] If repair is not possible, the task records exactly which original text is needed from Claude/user.
- [ ] `npm run handoff:check` passes after any handoff edits.

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Recent Updates

- `2026-04-17 Codex`: closed `2026-04-17-perf-fix-full-scans` and started `2026-04-17-investigate-handoff-mojibake`.
- `2026-04-17 Codex`: implemented P1-P3 full-scan performance fixes; added Dexie v14 indexes for `x_username`, `[x_username+saved_at]`, and `media_type`; typecheck/build passed.
- `2026-04-17 Codex`: closed `2026-04-14-viewer-app-decompose-and-cap-load`; all planned decomposition slices are complete; typecheck/build/handoff check passed.

## Waiting Tasks

- `2026-04-17-viewer-app-second-pass`: ViewerApp second-pass decomposition for archive metadata hook and formatter extraction

## Recently Completed

- `2026-04-17-perf-fix-full-scans`: P1-P3 archive full-scan performance fixes are complete; typecheck, build, and handoff check passed
- `2026-04-14-viewer-app-decompose-and-cap-load`: ViewerApp decomposition and capped session restore load are complete; typecheck, build, and handoff check passed
- `2026-04-14-merge-import-controls`: bookmarks/likes import controls now share a single parameterized implementation; typecheck and build passed
- `2026-04-14-fix-path-filter-and-refetch-typing`: archive restore now filters out `..` segments and refetch.complete uses the typed runtime client; typecheck and build passed
- `2026-04-14-remove-dead-code-archive-service`: removed dead archive service and maintenance service helper functions; typecheck and build passed
