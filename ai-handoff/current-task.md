# Current Task

## Active

- id: `2026-04-17-perf-fix-full-scans`
- title: `パフォーマンス修正 — 全件スキャン排除（High Priority）`
- owner: `Codex`
- status: `active`
- branch: `feature/full-codebase-review-2026-04-14-fixes`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-17-perf-fix-full-scans.md`

## Scope

- Replace `getArchiveSummary()` 3-parallel full scans with count queries (P1)
- Replace `listArchiveUserSummaries()` full scan with indexed query (P2)
- Replace `listPostIdsByAuthorFilter()` full scan with indexed query (P3)
- Add `x_username` index to posts table (required for P2/P3)
- Keep display behavior unchanged

## Coordination

- blocked_by: `none`
- related_findings: `2026-04-17-cia-perf-audit`
- needs_from_claude: `none`
- handoff_to_codex: `design complete (2026-04-17); implement per task packet design section`

## Next Action

- next_action: `Implement P1-P3 performance fixes per task packet design.`

## Acceptance Criteria

- [ ] `getArchiveSummary()` uses count queries instead of `listPosts()` full scan
- [ ] `listArchiveUserSummaries()` uses `x_username` index instead of full scan
- [ ] `listPostIdsByAuthorFilter()` uses indexed query instead of full scan
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist

- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated

## Recent Updates

- `2026-04-17 Codex`: closed `2026-04-14-viewer-app-decompose-and-cap-load`; all planned decomposition slices are complete; typecheck/build/handoff check passed
- `2026-04-14 Codex`: committed `2026-04-14-merge-import-controls` as `a790ca3 Merge timeline import controls`
- `2026-04-14 Codex`: started `2026-04-14-viewer-app-decompose-and-cap-load` on `feature/full-codebase-review-2026-04-14-fixes`
- `2026-04-14 Codex`: added `MAX_SESSION_RESTORE_LIMIT = 200` and capped session restore `initialLimit`; typecheck/build passed; PostCard extraction remains next
- `2026-04-14 Codex`: extracted `PostCard`, `QuotedPostCard`, and `MediaCard` into `post-card.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-14 Codex`: extracted settings page rendering and settings tab state into `settings-screen.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted media lightbox state/effects/dialog rendering into `media-lightbox.tsx`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: committed `be3716d Decompose viewer app sections`
- `2026-04-15 Codex`: extracted refetch status polling and refetch action handlers into `use-refetch-controls.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted viewer preferences, preference persistence, theme side effect, and storage estimate state into `use-viewer-preferences.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: committed `315c8a7 Extract viewer preferences`
- `2026-04-15 Codex`: extracted per-post tag picker/action state and tag add/remove handlers into `use-tag-operations.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-15 Codex`: extracted archive post list/loading state and `loadArchivePage` into `use-archive-loader.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-17 Codex`: extracted sort/filter state, random seed handling, filter request helpers, and sort/filter reload handlers into `use-sort-filter.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-17 Codex`: committed `ba5ee2e refactor: extract viewer sort filter`
- `2026-04-17 Codex`: extracted filter modal state, draft date validation, search state, and incremental tag/user option lists into `use-filter-modal.ts`; typecheck/build passed; task remains active for further decomposition
- `2026-04-17 Codex`: committed `57576d7 refactor: extract viewer filter modal`
- `2026-04-17 Codex`: extracted viewer session persistence, restore effects, scroll-position persistence, and anchor lookup into `use-viewer-session.ts`; typecheck/build passed
- `2026-04-17 Claude`: CIA トライアド・パフォーマンス監査完了 → findings: `2026-04-17-cia-perf-audit`; 全件スキャン修正タスク `2026-04-17-perf-fix-full-scans` をアクティブ化

## Waiting Tasks

- `2026-04-17-investigate-handoff-mojibake`: investigate whether the new 2026-04-17 handoff mojibake is persisted corruption or display-path decoding, then repair or request source text
- `2026-04-17-viewer-app-second-pass`: ViewerApp 二次分解（メタデータ hook + フォーマッター分離）

## Recently Completed

- `2026-04-14-viewer-app-decompose-and-cap-load`: ViewerApp decomposition and capped session restore load are complete; typecheck, build, and handoff check passed
- `2026-04-14-merge-import-controls`: bookmarks/likes import controls now share a single parameterized implementation; typecheck and build passed
- `2026-04-14-fix-path-filter-and-refetch-typing`: archive restore now filters out `..` segments and refetch.complete uses the typed runtime client; typecheck and build passed
- `2026-04-14-remove-dead-code-archive-service`: removed dead archive service and maintenance service helper functions; typecheck and build passed
