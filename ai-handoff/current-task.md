# Current Task

## Active

- id: `2026-04-14-investigate-missing-quoted-post-render`
- title: `Task Packet`
- owner: `Codex`
- status: `active`
- branch: `feature/fix-refetch-quoted-post-id`
- priority: `normal`
- task_file: `ai-handoff/tasks/2026-04-14-investigate-missing-quoted-post-render.md`

## Scope

- 引用投稿カードが表示されないケースの再現条件確認
- 保存済みDB上の `quoted_post_id` と引用元投稿レコード確認
- archive hydrate / viewer 描画条件の切り分け
- 原因が実装不備なら小さく修正

## Coordination

- blocked_by: `none`
- related_findings: `quoted post may be missing from viewer display even when the parent quoting post is saved`
- needs_from_claude: `optional browser reproduction / DOM and stored-data comparison if Codex cannot reproduce locally`
- handoff_to_codex: `引用投稿に引用された投稿が、保存済みビューア上で表示されない場合がある不具合を調査し、必要なら修正する`

## Next Action

- next_action: `対象の保存済み引用投稿を1件特定し、DB上の親投稿 quoted_post_id、引用元投稿レコード、viewer に渡る hydrated post の有無を比較する`

- acceptance_criteria: [ ] 引用された投稿が表示されないケースの原因が説明できる
- acceptance_criteria: [ ] 実装修正が必要な場合、引用カードが期待どおり表示される
- acceptance_criteria: [ ] 既存の通常ソート・ランダム表示仕様に不要な副作用がない
- acceptance_criteria: [ ] `npm run typecheck` pass
- acceptance_criteria: [ ] `npm run build` pass

## Acceptance Criteria

- [ ] 引用された投稿が表示されないケースの原因が説明できる
- [ ] 実装修正が必要な場合、引用カードが期待どおり表示される
- [ ] 既存の通常ソート・ランダム表示仕様に不要な副作用がない
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist

- [ ] investigation finished
- [ ] implementation finished if needed
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated

## Recent Updates

- `2026-04-14 Codex`: added active task `2026-04-14-investigate-missing-quoted-post-render` for cases where a quoted source post is not rendered inside a quoting post
- `2026-04-14 Codex`: `2026-04-14-random-display-exclude-quoted-posts` completed on `feature/random-exclude-quoted-posts`; DB version 13 adds `quoted_post_id` index and random mode now excludes quoted source posts; typecheck/build passed
- `2026-04-14 Codex`: changed quoted source card order in viewer so it appears below the quoting post media and above metrics; typecheck/build/CDP check passed
- `2026-04-13 Claude`: スティッキーツールバー & 統合フィルターモーダルの要件定義・設計完了、タスクパケット作成
- `2026-04-13 Codex`: `2026-04-13-sticky-toolbar-and-unified-filter` completed on `feature/sticky-toolbar-unified-filter`; task packet updated
- `2026-04-13 Codex`: added clear-all × button to the left of collapsed `+N 件の絞り込み中`; typecheck/build/CDP check passed
- `2026-04-13 Codex`: changed active filter chip display to always render as one collapsed `× +N 件の絞り込み中` chip; typecheck/build/CDP check passed
- `2026-04-13 Codex`: moved reset × into the same collapsed filter chip container as `+N 件の絞り込み中`; typecheck/build/CDP check passed

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-10-zero-engagement-refetch-and-image-investigation`: zero-engagement-only refetch was added, GraphQL engagement fallback now reduces false 0-count saves, and visible-page save waits briefly for media before persisting
- `2026-04-10-verify-zero-engagement-refetch-and-visible-save`: shared CDP verification confirmed zero-engagement refetch works from the viewer and visible-page save now waits long enough to persist image media for post `1757243797334094301
- `2026-04-10-enforce-content-safe-boundaries`: ESLint boundary rules and a built content-script guard now prevent Dexie-backed DB code from re-entering content-safe modules or shipping inside content script bundles
- `2026-04-14-random-display-exclude-quoted-posts`: random display now excludes posts referenced as `quoted_post_id` while keeping normal sorts unchanged; quoted source cards render below quoting post media; typecheck, build, and CDP check passed
- `2026-04-13-sticky-toolbar-and-unified-filter`: sticky viewer toolbar and unified user/tag/date filter modal completed, including always-collapsed filter chip display with embedded clear-all ×; typecheck, build, and shared CDP viewer checks passed
- `2026-04-13-viewer-list-ux-improvements`: viewer list P1/P2 UX fixes completed; optional P3 toolbar merge and image pending skeleton also implemented
- `2026-04-11-fix-review-v0-17-1-followups`: implemented all v0.17.1 follow-up fixes including Finding 22 (viewer archive maintenance routed through background runtime); all 22 findings resolved
- `2026-04-10-investigate-bulk-import-duplicate-images`: duplicate image persistence was fixed by canonical Twitter image URL identity, existing duplicate cleanup was verified, the temporary cleanup hook is dev-only, and a fresh bookmarks bulk import produced duplicate-save logs with no new media rows
- `2026-04-10-investigate-bulk-import-missing-posts`: bulk import missing-post loss was fixed by bounded incremental timeline scrolling plus final stop-after-scroll collection, and the target likes post was confirmed saved in real-device verification
- `2026-04-10-investigate-quoted-nesting-display`: quoted nesting now backfills `quoted_post_id` during duplicate save and refetch, with shared-profile runtime and viewer DOM verification