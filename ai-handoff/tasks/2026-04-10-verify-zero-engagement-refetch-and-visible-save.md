# Task Packet: Verify Zero-engagement Refetch + Visible Save Media Wait

## Meta
- status: active
- owner: Codex
- branch: master
- priority: medium
- files_in_scope: scripts/start-cdp-chrome.ps1, scripts/load-unpacked-extension.ps1, src/features/runtime/client.ts, src/features/viewer/components/settings-archive-maintenance-panel.tsx, src/features/viewer/components/viewer-app.tsx, src/features/x/bootstrap-x-content-script.ts
- blocked_by: none
- related_findings: shared CDP Chrome port `9223`, DB name `x-post-archive-posts-v1`
- needs_from_claude: none
- handoff_to_codex: verify the new zero-engagement-only refetch action and visible-page media-wait behavior on shared CDP Chrome
- summary: shared CDP verification now confirms the viewer settings zero-engagement refetch flow works via viewer-side explicit enqueue on the shared profile; visible-save media-wait verification is still pending

## Work Log
- `2026-04-10 Codex`: follow-up verification task created after completing the zero-engagement refetch and image-capture implementation task
- `2026-04-10 Codex`: shared profile 上で raw IndexedDB zero-count query は `828` 件を返す一方、runtime の `refetch.enqueue { enqueueZeroEngagement: true }` は `0` 件のまま動かないことを再現した
- `2026-04-10 Codex`: explicit `xPostIds` enqueue は shared CDP Chrome 上で正常に動くことを確認し、viewer 側で zero-count post IDs を列挙して explicit enqueue する workaround に切り替えた
- `2026-04-10 Codex`: shared CDP Chrome の viewer settings から `反応数 0 の投稿だけ再取得` を実行し、queue が `running` に入り `pendingCount = 827`, `totalCount = 827` になったことを確認後、`Stop after current` -> `stopped` -> `Clear queue` まで確認した
- `2026-04-10 Codex`: verification 中に 1 件 refetch が完了したため、archive 上の zero-count 件数は `827 -> 826` に減少し、queue 件数と整合することを確認した
- `2026-04-10 Codex`: visible-save media wait のブラウザ検証は未着手。再現に使う X post 候補がまだ必要

- `2026-04-10 Codex`: investigated Chrome's `content-scripts/x.js` UTF-8 load error and traced it to `src/features/runtime/client.ts` importing `ARCHIVE_DB_NAME` from the Dexie module, which pulled Dexie back into the content script bundle
- `2026-04-10 Codex`: paused this verification task and switched the active task to content-safe boundary enforcement so the Dexie regression cannot recur silently
- `2026-04-10 Codex`: resumed this verification task after landing ESLint and build-time content-safe guards to prevent the Dexie regression from recurring

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

- which concrete visible-page post should be used to re-check missing-image
  timing
- whether the service-worker-side `enqueueZeroEngagement` selector bug should
  be fixed now that the viewer flow is using explicit `xPostIds`

## Codex Plan

1. reload the extension on shared CDP Chrome
2. inspect candidate posts / queue behavior for zero-engagement-only refetch
3. run a visible-page save timing check for image readiness
4. record outcomes and close or follow up if a blocker remains

## Codex Result

Shared CDP verification is partially complete.

Confirmed:
- the shared CDP profile contains the real archive again and can enumerate the
  zero-count cohort directly from IndexedDB
- the background queue path itself is healthy on shared CDP Chrome: explicit
  `xPostIds` enqueue works and starts processing immediately
- the viewer settings zero-engagement action now works on shared CDP Chrome via
  the viewer-side explicit-enqueue workaround
- browser verification passed for the settings button:
  - clicked `反応数 0 の投稿だけ再取得`
  - queue moved to `running`
  - live status reported `currentPostId = 1166692539539148801`,
    `pendingCount = 827`, `totalCount = 827`
  - `Stop after current` moved the queue to `stopped`
  - `Clear queue` returned it to `idle`

Not yet confirmed:
- visible-page save media-wait behavior on shared CDP Chrome

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
- Visible-save media-wait verification is still pending

## Remaining Issues

- the service-worker-side `enqueueZeroEngagement` selection path still behaves
  inconsistently on shared CDP Chrome; direct runtime enqueue by flag returns
  `0` even though raw zero-count IndexedDB queries and explicit `xPostIds`
  enqueue both work
- visible-save media-wait behavior still needs a separate browser pass

## Suggested Next Action

Run the remaining shared-CDP visible-save media-wait verification against a
reproducible X post with image media, and either confirm the wait fixes the
race or document the remaining failure mode.

## Completion Checklist
- [ ] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
