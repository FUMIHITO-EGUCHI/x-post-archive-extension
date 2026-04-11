# Current Task

## Active

- none

## Scope
- files_in_scope: `src/features/archive/archive-service.ts`, `src/features/archive/archive-maintenance-service.ts`, `src/features/x/likes-import-controls.ts`, `src/features/x/bookmarks-import-controls.ts`, `src/features/x/bootstrap-x-content-script.ts`, `src/db/archive-database.ts`, `src/db/repositories/posts-repository.ts`, `src/db/repositories/post-tags-repository.ts`, `src/types/archive.ts`
- out_of_scope: broad importer redesign
- out_of_scope: broad quote extraction selector changes
- out_of_scope: full backup or restore redesign
- out_of_scope: changing snapshot-first refetch semantics beyond the quoted-link distinction
- out_of_scope: push

## Coordination
- blocked_by: `none`
- related_findings: `2026-04-10-investigate-bulk-import-duplicate-images`, `2026-04-10-investigate-quoted-nesting-display`
- needs_from_claude: `none`
- handoff_to_codex: fix two review findings from the v0.17.1 follow-up review without broad redesign

## Next Action
- next_action: decide whether to split Finding 22 into a dedicated maintenance coordination task or continue with background runtime routing


- acceptance_criteria: duplicate save with `input.quoted_post_id === null` does not clear an existing non-null `quoted_post_id`
- acceptance_criteria: duplicate save with a non-null quoted post id still backfills a missing `quoted_post_id`
- acceptance_criteria: `refetchArchivePost()` behavior is explicitly considered and documented
- acceptance_criteria: duplicate image cleanup apply handles duplicate pending or failed image rows without failing because OPFS files are absent
- acceptance_criteria: `npm run typecheck` passes
- acceptance_criteria: `npm run build` passes
- acceptance_criteria: task packet is updated with result and verification notes

## Completion Checklist

- [x] Finding 9: backup restore parsePostRecord preserves `quoted_post_id`
- [x] Finding 1: duplicate-save quoted-link backfill prevents null overwrite
- [x] Finding 2: maintenance cleanup OPFS partial-failure hardening
- [x] Finding 3: saveArchivePost post+media write transaction
- [x] Finding 4: bulkAssignTagApplyBatch carries `system_key` from TagRecord
- [x] Finding 5: getArchiveObjectStoreNames cache invalidation
- [x] Finding 6: listPostIdsByDateFilter uses IndexedDB index
- [x] Finding 7: assignPostTagsDirectly calls deleteOrphanedTag
- [x] Finding 8: listPostIdsWithZeroEngagementCounts uses Dexie API
- [x] Finding 9: backup restore parsePostRecord preserves `quoted_post_id`
- [x] Finding 10: extractQuotedPostFromContainer merges GraphQL image candidates
- [x] Finding 11: import collection catches per-article extraction failures
- [x] Finding 12: quote-tweet-only outer posts are not treated as null
- [x] Finding 13: GraphQL caches have an entry cap
- [x] Finding 14: processedArticles article DOM reuse risk fixed
- [x] Finding 15: deleteBlobFromOpfs parent NotFoundError handled in maintenance cleanup
- [x] Finding 16: buildRetainedRecordUpdate resets failed keepRecord to pending
- [x] Finding 17: refetch waits for in-flight media persistence before deletion
- [x] Finding 18: requestSavePost keeps auto_tags in the main save payload
- [x] Finding 19: runtime client clears settled request timeout timer
- [x] Finding 20: viewer ignores stale `requestPostsPage` responses
- [x] Finding 21: video lightbox OPFS-read cancellation revokes object URL
- [x] Finding 22: route viewer archive maintenance through background coordination
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`

## Recent Updates
- `2026-04-11 Codex`: completed `2026-04-10-investigate-bulk-import-duplicate-images` after fresh bookmarks bulk import verification on shared CDP Chrome showed `collected=4`, `saved=0`, `duplicates=4`, `failed=0`, with all duplicate-save log entries reporting `newMediaCount=0` and `retryMediaCount=0`; the temporary cleanup hook remains dev-only behind `import.meta.env.DEV`.
- `2026-04-11 Codex`: added waiting review-fix task `2026-04-11-fix-review-v0-17-1-followups` for two v0.17.1 review findings: duplicate save must not clear existing `quoted_post_id`, and duplicate image cleanup must not partially fail after DB deletion when OPFS files are missing.
- `2026-04-11 Codex`: closed `2026-04-10-investigate-bulk-import-missing-posts` after user confirmed real-device save for `2042731877069656563`, then activated `2026-04-10-investigate-bulk-import-duplicate-images` as the next high-priority follow-up.
- `2026-04-11 Codex`: investigated the user-provided likes miss around `2042639420353056839` / `2042731877069656563`; confirmed `2042731877069656563` was visible and extractable before reload but absent from DB/importer/save logs, then changed likes/bookmarks traversal from `scrollHeight` jumps to bounded incremental scrolling. Exact post-level verification is pending because reload lost the reproduced X DOM position.
- `2026-04-11 Codex`: reproduced a bookmarks missing-post case where visible IDs `2016731193367285915` and `2014688978965037378` were absent from both DB and importer/save logs, then fixed likes/bookmarks final-scroll stop handling and verified a post-fix bookmarks run with `15 / 15` independently observed visible posts saved.
- `2026-04-11 Codex`: closed `2026-04-10-investigate-quoted-nesting-display` and activated `2026-04-10-investigate-bulk-import-missing-posts` as the next investigation task.
- `2026-04-11 Codex`: split quoted-container annotation coverage into waiting follow-up task `2026-04-11-investigate-quoted-container-annotation-coverage`; current quoted nesting task now remains focused on the fixed `quoted_post_id` persistence and viewer rendering path.
- `2026-04-10 Codex`: shared CDP Chrome で viewer settings の `反応数 0 の投稿だけ再取得` を実行し、queue が `running` に入り `pendingCount = 827`, `totalCount = 827` となること、`Stop after current` -> `stopped` -> `Clear queue` が通ることを確認した
- `2026-04-10 Codex`: direct runtime `enqueueZeroEngagement` は shared profile 上で引き続き `0` 件のままだったため、viewer 側で zero-count post IDs を列挙して explicit enqueue する workaround に切り替え、shared profile 上で実動確認した
- `2026-04-10 Codex`: shared CDP verification seeded 3 archive posts for reproducible testing and confirmed that regular archive runtime requests still work, but the real `refetch.status` / `refetch.enqueue` path currently resolves to `null` and leaves `refetch_queue` empty even after a full Chrome restart.
- `2026-04-10 Codex`: opened `2026-04-10-zero-engagement-refetch-and-image-investigation` as the active task. Scope covers a new zero-engagement-only refetch path plus investigation of why some saved posts still persist `reply_count = repost_count = like_count = 0` and why image capture sometimes fails.
- `2026-04-09 Codex`: merged `feature/archive-viewer-improvements` into `master`, reran `npm run typecheck`, `npm run build`, and reloaded the unpacked extension on shared CDP Chrome via `scripts/load-unpacked-extension.ps1 -Port 9223`.
- `2026-04-09 Codex`: added handoff workflow safeguards. `ai-handoff/README.md` now defines a concrete Definition of Done, both handoff templates include a completion checklist, `npm run handoff:check` validates active and recently-completed task consistency, and previously implemented but unclosed task packets `2026-04-04-viewer-theme` and `2026-04-04-viewer-tag-inline` were updated with result and verification notes.
- `2026-04-09 Codex`: implemented `2026-04-09-inactive-refetch-background-only`. Added a structured `refetch.check` response, progress-aware waiting in the coordinator, inactive-tab media warm-up, and GraphQL-backed image candidate caching so refetch can recover image media even when X never materializes `<img>` nodes in a hidden tab. Shared CDP Chrome verification passed: post `2041068152390598815` refetched successfully with the X tab left inactive, media count became `1`, queue status became `done`, a text-only post still completed normally, and rerunning refetch on an already-populated media post did not create duplicate media rows.
- `2026-04-09 Codex`: implemented `2026-04-06-bulk-tagging` end-to-end. Added `PostFilterInput`, runtime messages for preview/apply-batch, repository helpers for bulk tag insertion, archive-service preview/apply logic, and a viewer-side `BulkTagModal` that previews matches and applies tags in batches of 100. `npm run typecheck` and `npm run build` passed. Real-world browser verification was not run per request.
- `2026-04-09 Codex`: reloaded the unpacked extension on shared CDP Chrome and verified Claude's bulk refetch fix end-to-end. `refetch.enqueue { enqueueAll: true }` returned `enqueuedCount = 12,743` in about `1.3s`, status moved to `running`, pending counts stayed stable instead of gradually growing, `Stop after current` moved the queue to `stopped` with pending items intact, and `Clear queue` from stopped state emptied the queue immediately. A follow-up single-post refetch still completed `running -> idle` for `2041068152390598815`.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-11-fix-review-v0-17-1-followups`: implemented all v0.17.1 follow-up fixes including Finding 22 (viewer archive maintenance routed through background runtime); all 22 findings resolved
- `2026-04-10-investigate-bulk-import-duplicate-images`: duplicate image persistence was fixed by canonical Twitter image URL identity, existing duplicate cleanup was verified, the temporary cleanup hook is dev-only, and a fresh bookmarks bulk import produced duplicate-save logs with no new media rows
- `2026-04-10-investigate-bulk-import-missing-posts`: bulk import missing-post loss was fixed by bounded incremental timeline scrolling plus final stop-after-scroll collection, and the target likes post was confirmed saved in real-device verification
- `2026-04-10-investigate-quoted-nesting-display`: quoted nesting now backfills `quoted_post_id` during duplicate save and refetch, with shared-profile runtime and viewer DOM verification
- `2026-04-10-verify-zero-engagement-refetch-and-visible-save`: shared CDP verification confirmed zero-engagement refetch works from the viewer and visible-page save now waits long enough to persist image media for post `1757243797334094301
- `2026-04-10-enforce-content-safe-boundaries`: ESLint boundary rules and a built content-script guard now prevent Dexie-backed DB code from re-entering content-safe modules or shipping inside content script bundles
- `2026-04-10-zero-engagement-refetch-and-image-investigation`: zero-engagement-only refetch was added, GraphQL engagement fallback now reduces false 0-count saves, and visible-page save waits briefly for media before persisting
- `2026-04-09-inactive-refetch-background-only`: refetch now succeeds in an inactive X tab by combining progress-aware waiting, DOM warm-up, and GraphQL image fallback
- `2026-04-09-refetch-missing-media`: verified that refetch restores the missing image record for post `2041068152390598815`
- `2026-04-06-bulk-tagging`: bulk tag preview and batch assignment flow implemented in the viewer
- `2026-04-06-refetch-post`: saved posts can now be re-fetched individually or in bulk through a persisted queue, with verified stop and clear controls
- `2026-04-06-random-display`: viewer-side random ordering with a stable per-session seed and explicit reshuffle control
- `2026-04-04-viewer-theme`: viewer light and dark theme support implemented and persisted
- `2026-04-04-viewer-tag-inline`: inline per-post tag editing implemented in the viewer
- `2026-04-04-tag-management-feature`: tag rename and merge support implemented across archive service, runtime messaging, and viewer settings UI
- `2026-04-04-auto-archive-triggers`: auto-archive settings and like and bookmark trigger flow verified
- `2026-04-06-fix-post-card-layout`: fixed viewer-side post-card horizontal overflow on narrow widths
- `2026-04-02-fix-emoji-text-loss`: saved `post_text` now preserves inline emoji correctly