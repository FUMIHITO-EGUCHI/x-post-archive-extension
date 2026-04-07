# Current Task

## Active
- id: `2026-04-06-investigate-handoff-encoding`
- title: investigate Codex / Claude handoff mojibake cause
- owner: `Codex`
- status: `completed`
- branch: `master`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-06-investigate-handoff-encoding.md`

## Scope
- files_in_scope: `ai-handoff/README.md`
- files_in_scope: `ai-handoff/current-task.md`
- files_in_scope: `ai-handoff/tasks/2026-04-06-investigate-handoff-encoding.md`
- files_in_scope: `ai-handoff/findings/2026-04-07-handoff-encoding.md`
- out_of_scope: broad handoff workflow redesign
- out_of_scope: mass conversion of existing Markdown files
- out_of_scope: commit and push

## Coordination
- blocked_by: `none`
- related_findings: `ai-handoff/findings/2026-04-07-handoff-encoding.md`
- needs_from_claude: provide any additional mojibake examples outside PowerShell / CLI if they appear again
- handoff_to_codex: keep the distinction between file corruption and display-path mojibake explicit

## Next Action
- next_action: await user direction for commit/push or selection of the next active task
- acceptance_criteria: identify whether the mojibake is in stored files or only in CLI / handoff display paths
- acceptance_criteria: reproduce the main failure conditions with concrete commands
- acceptance_criteria: document the likely causes in priority order and propose safe operational mitigations
- acceptance_criteria: leave the investigation in a handoff-ready state under `ai-handoff/findings/`

## Recent Updates
- `2026-04-07 Codex`: documented the confirmed cause and mitigations in the handoff note, then prepared GitHub issue `#3` for closure.
- `2026-04-07 Codex`: confirmed the handoff Markdown files themselves are stored as valid UTF-8 Japanese text; raw bytes decode correctly when forced through UTF-8.
- `2026-04-07 Codex`: reproduced mojibake from Windows PowerShell `Get-Content` without `-Encoding utf8`, which reads UTF-8 no-BOM handoff files as the local ANSI code page and garbles Japanese.
- `2026-04-07 Codex`: reproduced a separate `?` collapse on Node stdout in this Windows CLI path, so Japanese text is unsafe to trust when passed through ad hoc Node / shell output without explicit encoding handling.
- `2026-04-06 Codex`: fixed the XHR interceptor bug where `open()` attempted to resolve both action and `tweet_id` before the body existed, so bookmark/like XHR requests never stored the action needed by `send()` to capture `tweet_id`.
- `2026-04-06 Codex`: reloaded the unpacked extension on shared CDP Chrome and verified with a real bookmark click on `https://x.com/azurlane_staff/status/2041108669182476664` that the page dispatches `x-post-archive:like-bookmark-action` and the injected button changes from `Save` to `Saved`.
- `2026-04-06 Codex`: verified on shared CDP profile that with settings enabled, dispatching the same like/bookmark event payload on `x.com/home` changes a visible post from `Save` to `Saved` and flips `posts/has` from `false` to `true`.
- `2026-04-06 Codex`: added short retry handling for auto-archive article lookup in the content script so like/bookmark actions do not fail immediately when the matching tweet article is not yet available in DOM.
- `2026-04-06 Codex`: marked `2026-04-04-bookmarks-import` completed because the feature shipped in `v0.16.0`; `v0.16.1` only fixed backup restore compatibility for `bookmarked`.
- `2026-04-06 Codex`: normalized this dashboard into a fixed handoff format with explicit scope, coordination, and next action fields.
- `2026-04-05 Codex`: bookmarks import implementation is in progress; remaining work is runtime-error verification and browser-side confirmation.
- `2026-04-05 Claude`: viewer CDP blocker was reduced to extension-loading workflow issues and documented separately.

## Waiting Tasks
- `2026-04-04-user-filter` (`#2`): single-user filter
- `2026-04-06-infinite-scroll-settings-lists` (`#4`): convert tag filter, user filter, tag management, and auto-tag redirect lists from full render to incremental loading
- `2026-04-07-viewer-date-range-filter` (`#5`): add date-range filtering to the archive list
- `2026-04-07-bulk-import-auto-stop-on-duplicates` (`#6`): stop likes / bookmarks bulk import after repeated duplicates

## Recently Completed
- `2026-04-06-investigate-handoff-encoding`: files were intact UTF-8; main causes were PowerShell default decoding and unsafe Node/stdout Japanese handling
- `2026-04-06-investigate-auto-archive`: fixed in `v0.16.2` and verified from a real bookmark click path
- `2026-04-04-bookmarks-import`: feature shipped in `v0.16.0`; follow-up `v0.16.1` was a restore compatibility fix for `bookmarked`
- `2026-04-05-viewer-cdp-review-blocker`: resolved, see `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- `2026-04-04-viewer-tag-inline`: codex-done
- `2026-04-04-viewer-theme`: codex-done
- `2026-04-04-settings-page-split`: codex-done
