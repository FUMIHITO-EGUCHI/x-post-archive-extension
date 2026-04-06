# Current Task

## Active
- id: `2026-04-06-investigate-auto-archive`
- title: investigate like/bookmark auto-archive not triggering
- owner: `Codex`
- status: `in_progress`
- branch: `master`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-06-investigate-auto-archive.md`

## Scope
- files_in_scope: `src/features/x/bootstrap-x-content-script.ts`
- files_in_scope: `src/features/settings/archive-settings.ts`
- files_in_scope: `src/features/viewer/components/settings-basic-panel.tsx`
- out_of_scope: full refetch-post implementation
- out_of_scope: article-missing fallback implementation unless the investigation proves it is required
- out_of_scope: commit and push

## Coordination
- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: capture browser-side reproduction details if like/bookmark auto-archive still fails after local verification
- handoff_to_codex: keep reproduction notes, root-cause narrowing, and next-step recommendations aligned with the task packet

## Next Action
- next_action: reproduce the like/bookmark auto-archive failure, confirm whether the break is in settings state, article lookup, or background flow, and write the narrowed outcome back to handoff
- acceptance_criteria: reproduce the current failure path for like/bookmark auto-archive
- acceptance_criteria: confirm whether the auto-archive settings are enabled and persisted correctly
- acceptance_criteria: narrow the failure to settings state, article lookup, or background processing
- acceptance_criteria: document findings and the recommended next fix path in handoff notes

## Recent Updates
- `2026-04-06 Codex`: marked `2026-04-04-bookmarks-import` completed because the feature shipped in `v0.16.0`; `v0.16.1` only fixed backup restore compatibility for `bookmarked`.
- `2026-04-06 Codex`: normalized this dashboard into a fixed handoff format with explicit scope, coordination, and next action fields.
- `2026-04-05 Codex`: bookmarks import implementation is in progress; remaining work is runtime-error verification and browser-side confirmation.
- `2026-04-05 Claude`: viewer CDP blocker was reduced to extension-loading workflow issues and documented separately.

## Waiting Tasks
- `2026-04-04-auto-archive-triggers`: auto archive trigger implementation
- `2026-04-04-user-filter`: single-user filter
- `2026-04-06-investigate-handoff-encoding`: investigate Codex / Claude handoff mojibake cause
- `2026-04-06-infinite-scroll-settings-lists`: convert heavy viewer settings lists to incremental loading

## Recently Completed
- `2026-04-04-bookmarks-import`: feature shipped in `v0.16.0`; follow-up `v0.16.1` was a restore compatibility fix for `bookmarked`
- `2026-04-05-viewer-cdp-review-blocker`: resolved, see `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- `2026-04-04-viewer-tag-inline`: codex-done
- `2026-04-04-viewer-theme`: codex-done
- `2026-04-04-settings-page-split`: codex-done
