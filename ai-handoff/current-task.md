# Current Task

## Active

- id: `2026-04-11-investigate-quoted-container-annotation-coverage`
- title: `Investigate Quoted Container Annotation Coverage`
- owner: `Codex`
- status: `active`
- branch: `feature/full-codebase-review-2026-04-14-fixes`
- priority: `medium`
- task_file: `ai-handoff/tasks/2026-04-11-investigate-quoted-container-annotation-coverage.md`

## Scope

- Inspect at least one current live X article that contains a quoted-post-like container
- Distinguish false-positive link containers from real quoted-post cards
- If a real quote card is missed, implement the narrowest annotation or extraction fallback
- Verify that `extractPostFromArticle()` receives `quotedPost` for the reproduced real quote-card case

## Coordination

- blocked_by: `none`
- related_findings: `2026-04-10-investigate-quoted-nesting-display`, `2026-04-02-quoted-post-feature`
- needs_from_claude: `optional live X DOM reproduction details if current shared-profile feed no longer shows the issue`
- handoff_to_codex: `investigate partial quoted-container annotation coverage on current X DOM and fix extraction only if a real quoted-post card is missed`

## Next Action

- next_action: `Read the quote annotation/extraction code, then reproduce or inspect a quote-like container in current X DOM.`

## Acceptance Criteria

- [ ] At least one current live X article with a quoted-post-like container is inspected
- [ ] The task states whether unannotated containers are false positives or missed real quoted-post cards
- [ ] If a real quote card is missed, a narrow annotation or extraction fix is implemented
- [ ] `extractPostFromArticle()` is verified to return `quotedPost` for the reproduced real quote-card case

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Codex Result` or `Result` updated
- [ ] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Recent Updates

- `2026-04-17 Codex`: closed `2026-04-17-viewer-app-second-pass` and started `2026-04-11-investigate-quoted-container-annotation-coverage`.
- `2026-04-17 Codex`: extracted viewer formatters/date helpers to `viewer-formatters.ts` and archive metadata state/refresh to `use-archive-metadata.ts`; typecheck/build passed.
- `2026-04-17 Codex`: completed `2026-04-17-investigate-handoff-mojibake`; 2026-04-17 handoff files are valid UTF-8 and the mojibake is display-path related.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-17-viewer-app-second-pass`: ViewerApp second-pass decomposition is complete; typecheck, build, and handoff check passed
- `2026-04-17-investigate-handoff-mojibake`: 2026-04-17 handoff mojibake was confirmed as display-path related; no source-text recovery needed; finding added
- `2026-04-17-perf-fix-full-scans`: P1-P3 archive full-scan performance fixes are complete; typecheck, build, and handoff check passed
- `2026-04-14-viewer-app-decompose-and-cap-load`: ViewerApp decomposition and capped session restore load are complete; typecheck, build, and handoff check passed
