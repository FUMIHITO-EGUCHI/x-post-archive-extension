# Current Task

## Active
- id: `2026-04-04-bookmarks-import`
- title: bookmarks import investigation and implementation
- owner: `Codex`
- status: `in_progress`
- branch: `master`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-04-bookmarks-import.md`

## Scope
- files_in_scope: `src/features/x/bookmarks-import-controls.ts`
- files_in_scope: `src/features/x/bootstrap-x-content-script.ts`
- files_in_scope: `src/features/settings/archive-language.ts`
- files_in_scope: `src/types/archive.ts`
- files_in_scope: `src/features/x/extract-post-from-article.ts`
- out_of_scope: full bookmarks spec expansion
- out_of_scope: URL support outside `/i/bookmarks`
- out_of_scope: commit and push

## Coordination
- blocked_by: `none`
- related_findings: `ai-handoff/findings/2026-04-05-bookmarks-import-runtime-error.md`
- related_findings: `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- needs_from_claude: capture browser-side console, message, and stack details on `/i/bookmarks` if the runtime error still reproduces
- handoff_to_codex: keep implementation, verification, and root-cause notes aligned with the task packet and findings

## Next Action
- next_action: verify the remaining runtime error path around bookmarks import and finish end-to-end validation on `/i/bookmarks`
- acceptance_criteria: import overlay renders on `x.com/i/bookmarks`
- acceptance_criteria: save flow processes visible posts without crashing
- acceptance_criteria: saved posts receive the `bookmarked` built-in tag
- acceptance_criteria: `npm run typecheck`
- acceptance_criteria: `npm run build`

## Recent Updates
- `2026-04-06 Codex`: normalized this dashboard into a fixed handoff format with explicit scope, coordination, and next action fields.
- `2026-04-05 Codex`: bookmarks import implementation is in progress; remaining work is runtime-error verification and browser-side confirmation.
- `2026-04-05 Claude`: viewer CDP blocker was reduced to extension-loading workflow issues and documented separately.

## Waiting Tasks
- `2026-04-04-auto-archive-triggers`: auto archive trigger implementation
- `2026-04-04-user-filter`: single-user filter
- `2026-04-06-investigate-handoff-encoding`: investigate Codex / Claude handoff mojibake cause
- `2026-04-06-infinite-scroll-settings-lists`: convert heavy viewer settings lists to incremental loading

## Recently Completed
- `2026-04-05-viewer-cdp-review-blocker`: resolved, see `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- `2026-04-04-viewer-tag-inline`: codex-done
- `2026-04-04-viewer-theme`: codex-done
- `2026-04-04-settings-page-split`: codex-done
