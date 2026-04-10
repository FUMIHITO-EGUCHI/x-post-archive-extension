# Task Packet: Verify Zero-engagement Refetch + Visible Save Media Wait

## Meta
- status: active
- owner: Codex
- branch: master
- priority: medium
- files_in_scope: scripts/start-cdp-chrome.ps1, scripts/load-unpacked-extension.ps1, src/features/viewer/components/settings-archive-maintenance-panel.tsx, src/features/x/bootstrap-x-content-script.ts
- blocked_by: none
- related_findings: shared CDP Chrome port `9223`, DB name `x-post-archive-posts-v1`
- needs_from_claude: none
- handoff_to_codex: verify the new zero-engagement-only refetch action and visible-page media-wait behavior on shared CDP Chrome
- summary:

## Work Log
- `2026-04-10 Codex`: follow-up verification task created after completing the zero-engagement refetch and image-capture implementation task

## Goal

Verify the newly added zero-engagement-only refetch flow and the visible-page
save media-wait path on shared CDP Chrome.

## Requested Action

- reload the unpacked extension on the shared CDP Chrome profile
- verify the viewer settings action that queues only posts with
  `reply_count = repost_count = like_count = 0`
- verify a visible-page save or auto-archive case where media previously saved
  too early can now capture the image before persistence

## In Scope

- shared CDP Chrome verification
- IndexedDB / queue-state checks needed to confirm the new behavior
- compressed findings and evidence capture

## Out Of Scope

- new product changes unless verification exposes a concrete blocker
- push

## Constraints

- prefer verification against the existing shared CDP Chrome setup on port
  `9223`
- preserve the just-completed implementation task as `done`

## Files To Read First

- `ai-handoff/tasks/2026-04-10-zero-engagement-refetch-and-image-investigation.md`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
- `src/features/x/bootstrap-x-content-script.ts`
- `scripts/start-cdp-chrome.ps1`
- `scripts/load-unpacked-extension.ps1`

## Inputs From Claude

- none

## Acceptance Criteria

- shared CDP Chrome verification confirms the zero-engagement-only refetch
  action enqueues only posts with all three engagement counts at `0`
- shared CDP Chrome verification confirms the visible save path no longer
  immediately persists a media-hinted post before image extraction is ready, or
  the remaining failure mode is documented with evidence
- findings are recorded in `Codex Result` and `Verification`

## Open Questions

- which concrete saved post IDs are best suited for zero-engagement-only queue
  verification on the shared profile
- which concrete visible-page post should be used to re-check missing-image
  timing

## Codex Plan

1. reload the extension on shared CDP Chrome
2. inspect candidate posts / queue behavior for zero-engagement-only refetch
3. run a visible-page save timing check for image readiness
4. record outcomes and close or follow up if a blocker remains

## Codex Result

Pending verification.

## Changed Files

- `.claude/rules/handoff.md`
- `package.json`
- `scripts/check-handoff-consistency.mjs`
- `src/db/repositories/posts-repository.ts`
- `src/features/refetch/refetch-coordinator.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/install-graphql-video-response-observer.ts`
- `src/types/runtime.ts`
- `scripts/log-changes.mjs`
- `scripts/pre-commit`
- `scripts/setup-hooks.sh`
- `scripts/sync-handoff.mjs`
- `src/features/x/graphql-engagement-cache.ts`
- `src/features/x/graphql-engagement-events.ts`
- `src/features/x/graphql-engagements.ts`

## Verification

- not run yet

## Remaining Issues

- verification has not started yet

## Suggested Next Action

Run shared CDP Chrome verification.

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
