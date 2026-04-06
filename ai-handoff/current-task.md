# Current Task

## Active
- id: `2026-04-06-investigate-auto-archive`
- title: investigate like/bookmark auto-archive not triggering
- owner: `Codex`
- status: `completed`
- branch: `master`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-06-investigate-auto-archive.md`

## Scope
- files_in_scope: `src/features/x/bootstrap-x-content-script.ts`
- files_in_scope: `src/features/x/intercept-like-bookmark-actions.ts`
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
- next_action: await user direction for commit/push or selection of the next active task
- acceptance_criteria: reproduce the current failure path for like/bookmark auto-archive
- acceptance_criteria: confirm whether the auto-archive settings are enabled and persisted correctly
- acceptance_criteria: narrow the failure to settings state, article lookup, or background processing, then fix the confirmed cause
- acceptance_criteria: verify the fix from a real X like/bookmark click path and document findings in handoff notes

## Recent Updates
- `2026-04-06 Codex`: fixed the XHR interceptor bug where `open()` attempted to resolve both action and `tweet_id` before the body existed, so bookmark/like XHR requests never stored the action needed by `send()` to capture `tweet_id`.
- `2026-04-06 Codex`: reloaded the unpacked extension on shared CDP Chrome and verified with a real bookmark click on `https://x.com/azurlane_staff/status/2041108669182476664` that the page dispatches `x-post-archive:like-bookmark-action` and the injected button changes from `Save` to `Saved`.
- `2026-04-06 Codex`: verified on shared CDP profile that with settings enabled, dispatching the same like/bookmark event payload on `x.com/home` changes a visible post from `Save` to `Saved` and flips `posts/has` from `false` to `true`.
- `2026-04-06 Codex`: added short retry handling for auto-archive article lookup in the content script so like/bookmark actions do not fail immediately when the matching tweet article is not yet available in DOM.
- `2026-04-06 Codex`: marked `2026-04-04-bookmarks-import` completed because the feature shipped in `v0.16.0`; `v0.16.1` only fixed backup restore compatibility for `bookmarked`.
- `2026-04-06 Codex`: normalized this dashboard into a fixed handoff format with explicit scope, coordination, and next action fields.
- `2026-04-05 Codex`: bookmarks import implementation is in progress; remaining work is runtime-error verification and browser-side confirmation.
- `2026-04-05 Claude`: viewer CDP blocker was reduced to extension-loading workflow issues and documented separately.

## Waiting Tasks
- `2026-04-04-auto-archive-triggers` (`#1`): auto archive trigger implementation
- `2026-04-04-user-filter` (`#2`): single-user filter
- `2026-04-06-investigate-handoff-encoding` (`#3`): investigate Codex / Claude handoff mojibake cause
- `2026-04-06-infinite-scroll-settings-lists` (`#4`): convert tag filter, user filter, tag management, and auto-tag redirect lists from full render to incremental loading
- `2026-04-07-viewer-date-range-filter` (`#5`): add date-range filtering to the archive list
- `2026-04-07-bulk-import-auto-stop-on-duplicates` (`#6`): stop likes / bookmarks bulk import after repeated duplicates

## Recently Completed
- `2026-04-04-bookmarks-import`: feature shipped in `v0.16.0`; follow-up `v0.16.1` was a restore compatibility fix for `bookmarked`
- `2026-04-05-viewer-cdp-review-blocker`: resolved, see `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- `2026-04-04-viewer-tag-inline`: codex-done
- `2026-04-04-viewer-theme`: codex-done
- `2026-04-04-settings-page-split`: codex-done
