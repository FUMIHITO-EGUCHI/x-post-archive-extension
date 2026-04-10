# Task Packet: Verify Zero-engagement Refetch + Visible Save Media Wait

## Meta
- status: done
- owner: Codex
- branch: master
- priority: medium
- files_in_scope: scripts/start-cdp-chrome.ps1, scripts/load-unpacked-extension.ps1, src/features/runtime/client.ts, src/features/viewer/components/settings-archive-maintenance-panel.tsx, src/features/viewer/components/viewer-app.tsx, src/features/x/bootstrap-x-content-script.ts
- blocked_by: none
- related_findings: shared CDP Chrome port `9223`, DB name `x-post-archive-posts-v1`
- needs_from_claude: none
- handoff_to_codex: verify the new zero-engagement-only refetch action and visible-page media-wait behavior on shared CDP Chrome
- summary: shared CDP verification confirmed zero-engagement refetch works from the viewer and visible-page save now waits long enough to persist image media for post `1757243797334094301`

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
- `src/features/runtime/client.ts`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
- `src/features/viewer/components/viewer-app.tsx`
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

- whether the service-worker-side `enqueueZeroEngagement` selector bug should
  be fixed now that the viewer flow is using explicit `xPostIds`

## Work Log

- `2026-04-10 Codex`: follow-up verification task created after completing the zero-engagement refetch and image-capture implementation task
- `2026-04-10 Codex`: shared profile raw IndexedDB zero-count query returned `828` while runtime `refetch.enqueue { enqueueZeroEngagement: true }` stayed at `0`, so the broken service-worker-side selector path was reproduced
- `2026-04-10 Codex`: explicit `xPostIds` enqueue worked on shared CDP Chrome, so the viewer flow was switched to enumerate zero-count post IDs locally and enqueue them explicitly
- `2026-04-10 Codex`: shared CDP Chrome viewer settings verification confirmed `反応数 0 の投稿だけ再取得` moved the queue into `running`, then `Stop after current` and `Clear queue` both worked
- `2026-04-10 Codex`: during verification one refetch completed, so the zero-count archive cohort dropped from `827` to `826` and stayed aligned with queue counts
- `2026-04-10 Codex`: investigated Chrome's `content-scripts/x.js` UTF-8 load error and traced it to `src/features/runtime/client.ts` importing `ARCHIVE_DB_NAME` from the Dexie module, which pulled Dexie back into the content script bundle
- `2026-04-10 Codex`: paused this verification task and switched the active task to content-safe boundary enforcement so the Dexie regression could not recur silently
- `2026-04-10 Codex`: resumed this verification task after landing ESLint and build-time content-safe guards
- `2026-04-10 Codex`: user provided reproducible visible-save post `1757243797334094301`; shared CDP verification deleted the existing saved row, re-saved from the live X page, and confirmed that media rows were persisted instead of the prior zero-media state

## Codex Plan

1. reload the extension on shared CDP Chrome
2. inspect candidate posts / queue behavior for zero-engagement-only refetch
3. run a visible-page save timing check for image readiness
4. record outcomes and close or follow up if a blocker remains

## Codex Result

Shared CDP verification is complete.

Confirmed:
- the shared CDP profile contains the real archive again and can enumerate the
  zero-count cohort directly from IndexedDB
- the background queue path itself is healthy on shared CDP Chrome: explicit
  `xPostIds` enqueue works and starts processing immediately
- the viewer settings zero-engagement action works on shared CDP Chrome via the
  viewer-side explicit-enqueue workaround
- browser verification passed for the settings button:
  - clicked `反応数 0 の投稿だけ再取得`
  - queue moved to `running`
  - live status reported `currentPostId = 1166692539539148801`,
    `pendingCount = 827`, `totalCount = 827`
  - `Stop after current` moved the queue to `stopped`
  - `Clear queue` returned it to `idle`
- visible-page save media-wait verification passed on shared CDP Chrome using
  post `1757243797334094301`
  - the previously saved archive row existed with `storedMediaCount = 0`
  - after deleting that row and clicking the live page's `Save` button, the
    button progressed `Save -> Saving... -> Saved`
  - the archive then contained `storedMediaCount = 2` media rows instead of the
    prior zero-media state

## Changed Files

- `.claude/rules/handoff.md`
- `package.json`
- `scripts/check-handoff-consistency.mjs`
- `scripts/start-cdp-chrome.ps1`
- `src/db/archive-database.ts`
- `src/db/repositories/posts-repository.ts`
- `src/features/refetch/refetch-coordinator.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `scripts/log-changes.mjs`
- `scripts/pre-commit`
- `scripts/setup-hooks.sh`
- `scripts/sync-handoff.mjs`
- `src/db/constants.ts`

## Verification

- Shared CDP Chrome on `http://127.0.0.1:9223` was restarted cleanly and the
  unpacked extension was reloaded as `hlaianiimnjkppdbpobpgeidoafbcjhg`
- Direct DB/runtime checks showed:
  - raw IndexedDB zero-count query returned `828`, then `827`, then `826` as
    refetch verification progressed
  - direct runtime `refetch.enqueue { enqueueZeroEngagement: true }` still
    returned `enqueuedCount = 0`
  - direct runtime `refetch.enqueue { xPostIds: [...] }` worked and started the
    queue immediately
- Viewer settings verification on shared CDP Chrome:
  - opened settings from the archive view
  - switched to the `バックアップ` tab
  - clicked `反応数 0 の投稿だけ再取得`
  - after `1.8s`, `refetch.status` returned `phase = "running"`,
    `currentPostId = "1166692539539148801"`, `pendingCount = 827`,
    `completedCount = 0`, `totalCount = 827`
  - `refetch.cancel` then moved the queue to `phase = "stopped"` with
    `pendingCount = 826`, `completedCount = 1`
  - `refetch.clear` returned the queue to `phase = "idle"` with all queue
    counts reset to `0`
- Visible-save media-wait verification on shared CDP Chrome:
  - used the live X page `https://x.com/minmy34866626/status/1757243797334094301`
  - viewer-page IndexedDB inspection showed an existing saved row with
    `storedMediaCount = 0`
  - deleted the archived post via runtime message, reloaded the X page, and
    confirmed the injected save button was back in the `Save` state
  - clicked the save button and observed `Save -> Saving... -> Saved`
  - viewer-page IndexedDB inspection then showed:
    - `exists = true`
    - `storedMediaCount = 2`
    - `postUrl = "https://x.com/minmy34866626/status/1757243797334094301"`
    - media source URLs:
      - `https://pbs.twimg.com/media/GGL73oPasAEnwM0?format=jpg&name=orig`
      - `https://pbs.twimg.com/media/GGL73oPasAEnwM0.jpg?name=orig`

## Remaining Issues

- the service-worker-side `enqueueZeroEngagement` selection path still behaves
  inconsistently on shared CDP Chrome; direct runtime enqueue by flag returns
  `0` even though raw zero-count IndexedDB queries and explicit `xPostIds`
  enqueue both work
- post `1757243797334094301` saved with two image URLs that appear to point to
  the same underlying image asset; this may be related to the separate
  duplicate-image investigation but does not block the visible-save wait fix

## Suggested Next Action

Investigate duplicate-image persistence next, using post `1757243797334094301`
as a possible seed case while keeping the bulk-import scope separate from this
verification task.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
