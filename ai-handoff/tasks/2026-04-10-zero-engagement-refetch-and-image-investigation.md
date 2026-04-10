# Task Packet: Zero-engagement Refetch + Image Capture Investigation

## Meta
- status: done
- owner: Codex
- branch: master
- priority: high
- files_in_scope: src/features/refetch/refetch-coordinator.ts, src/features/runtime/client.ts, src/features/runtime/handle-runtime-message.ts, src/features/viewer/components/settings-archive-maintenance-panel.tsx, src/features/viewer/components/viewer-app.tsx, src/features/x/bootstrap-x-content-script.ts, src/features/x/extract-post-from-article.ts, src/features/x/install-graphql-video-response-observer.ts, src/features/x/graphql-engagement-cache.ts, src/features/x/graphql-engagement-events.ts, src/features/x/graphql-engagements.ts
- blocked_by: none
- related_findings: shared CDP Chrome port `9223`, DB name `x-post-archive-posts-v1`
- needs_from_claude: none
- handoff_to_codex: add zero-engagement-only refetch task and investigate zero counts plus intermittent missing-image capture
- summary: zero-engagement-only refetch was added, GraphQL engagement fallback now reduces false 0-count saves, and visible-page save waits briefly for media before persisting

## Work Log
<!-- 作業のたびにタイムスタンプ付きで1行追記する。完了時に Codex Result へ転記。 -->
<!-- 形式: - `YYYY-MM-DD Claude/Codex`: 内容 -->
- `2026-04-10 Claude`: task packet 作成。zero-engagement refetch + image capture 調査を Codex に依頼

- `2026-04-10 Codex`: handoff workflow update を確認し、task packet を起点に refetch 選定・反応数抽出・画像抽出の実装経路を確認開始

- `2026-04-10 Codex`: zero-engagement-only refetch enqueue を viewer settings / runtime / coordinator / repository に追加し、GraphQL engagement counts fallback と visible-page save の短い media wait を実装

## Goal

Add a refetch mode that targets only saved posts whose `reply_count`,
`repost_count`, and `like_count` are all `0`, and investigate why some saved
posts still end up with zero engagement counts or missing images.

## Requested Action

- add a selective refetch entry point for posts where
  `reply_count = 0 && repost_count = 0 && like_count = 0`
- investigate the root cause of zero engagement counts being persisted
- investigate the cases where image capture still fails
- compress findings and leave the task packet ready for implementation and
  follow-up verification

## In Scope

- viewer or settings-side entry point design for zero-engagement-only refetch
- background queue selection logic for the zero-engagement-only filter
- inspection of extraction and persistence paths for engagement counts
- inspection of extraction and persistence paths for images
- compressed handoff notes that distinguish confirmed causes from hypotheses

## Out Of Scope

- full refetch redesign beyond the zero-engagement-only filter
- non-image media regressions unless they directly explain the same failure path
- push

## Constraints

- keep snapshot-first semantics; this is a repair/refetch tool, not automatic
  live syncing
- avoid broadening the feature into "refetch all incomplete posts" without a
  concrete data rule
- separate confirmed facts, likely causes, and unresolved points
- preserve the existing background-only refetch direction unless evidence shows
  a blocker

## Files To Read First

- `docs/tech-index.md`
- `ai-handoff/tasks/2026-04-06-refetch-post.md`
- `ai-handoff/tasks/2026-04-09-refetch-missing-media.md`
- `ai-handoff/tasks/2026-04-09-inactive-refetch-background-only.md`
- `docs/likes-import-handover-2026-04-01.md`
- `src/features/refetch/refetch-coordinator.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/services/archive-service.ts`

## Inputs From Claude

- user requested three additions:
  - zero-engagement-only refetch
  - investigation of why engagement counts become `0`
  - investigation of why images are sometimes not captured

## Acceptance Criteria

- there is a concrete task design for selecting only posts with
  `reply_count = 0 && repost_count = 0 && like_count = 0`
- likely causes for zero engagement persistence are documented with code
  pointers and confidence level
- likely causes for intermittent missing-image persistence are documented with
  code pointers and confidence level
- implementation, verification steps, and unresolved questions are explicit

## Open Questions

- should the new filter be exposed only in viewer settings bulk actions, or
  also alongside per-post refetch controls
- should zero-engagement-only refetch skip posts that already have media, or
  are these concerns intentionally separate
- is the main problematic source likes import, single-save, auto-archive, or a
  mix of multiple save paths

## Codex Plan

1. read the current refetch, save, and extraction task packets plus the
   relevant code paths
2. identify where engagement counts and image media are extracted, normalized,
   and persisted
3. determine whether the zero-count and missing-image failures are caused by the
   same timing/data-source gap or by separate paths
4. implement the zero-engagement-only selection flow and any minimal supporting
   plumbing required by the chosen UI entry point
5. verify with `typecheck`, `build`, and targeted runtime checks
6. record confirmed findings, residual risks, and follow-up tasks

## Codex Result

Implemented the task and closed the main investigation loop.

- Added a new bulk refetch action for saved posts whose
  `reply_count = 0 && repost_count = 0 && like_count = 0`.
  The selector is now wired through repository, runtime, client, coordinator,
  and viewer settings.
- Added GraphQL engagement-count extraction, event dispatch, and cache lookup.
- `extractPostFromArticle()` now falls back to cached GraphQL counts when DOM
  extraction reads `0`, which reduces false zero-count snapshots across save,
  likes import, auto-archive, and refetch.
- `saveArticleSnapshot()` now retries briefly when the article hints at media
  that has not become savable yet, instead of immediately persisting the first
  incomplete extraction. This covers the visible-page save path used by the save
  button and auto-archive.

Investigation findings:

- Zero engagement counts were primarily caused by DOM extraction treating
  "count not readable yet" as `0`.
  Evidence:
  - `extractActionCount()` returns `0` whenever the target action is missing or
    `readCountFromAction()` cannot parse a count.
  - before this task, count extraction had no GraphQL fallback.
  Confidence: high.
- Intermittent missing-image saves on visible pages were primarily caused by
  `saveArticleSnapshot()` extracting once with no media wait, unlike likes
  import and refetch which already had explicit media-delay handling.
  Confidence: high.
- A residual missing-image case can still exist when neither DOM image nodes nor
  GraphQL image candidates are available in time for a given post.
  Confidence: medium.

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

- `npm run typecheck`
- `npm run build`
- Browser/runtime verification was not run in this pass.

## Remaining Issues

- Existing saved posts that already contain false `0` counts or missing media
  still need explicit refetch to be repaired.
- Browser-level verification for the new zero-engagement-only refetch button and
  the visible-page media-wait behavior was not run in this pass.

## Suggested Next Action

Run shared CDP Chrome verification for:

- the new viewer settings action that queues only zero-engagement posts
- a visible-page save or auto-archive case where media previously saved as `0`
  to confirm the new retry path captures the image before persistence

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
