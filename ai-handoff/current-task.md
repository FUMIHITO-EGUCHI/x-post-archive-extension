# Current Task

## Active

- `2026-04-20-infinite-scroll-and-modal-scrollbar`: 無限スクロールとフィルターモーダルのスクロールバー非表示

## Scope

- 投稿一覧の「さらに読み込む」ボタンを廃止し IntersectionObserver で無限スクロール化。フィルターモーダルのスクロールバーを CSS で非表示に。

## Coordination

- task_file: `ai-handoff/tasks/2026-04-20-infinite-scroll-and-modal-scrollbar.md`
- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: `ai-handoff/tasks/2026-04-20-infinite-scroll-and-modal-scrollbar.md`

## Next Action

- next_action: `Codex が task packet の Design に従い実装する。`

## Acceptance Criteria

- [x] Tag rows show include and exclude controls
- [x] Excluding a tag removes posts with that tag from the result set
- [x] `bookmarked` can be excluded to show non-bookmarked matching posts
- [x] Include and exclude cannot hold the same tag at the same time
- [x] Clear all filters also clears exclude
- [x] Tag tab badge is active when exclude is applied
- [x] Session persistence restores exclude filters
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Completion Checklist

- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Recent Updates

- `2026-04-20 Codex`: manually verified `2026-04-20-tag-exclude-filter` in the Shared Profile viewer: include/exclude controls, bookmark exclude/include counts, mutual exclusion, clear-all, tag tab badge, and session restore all passed.
- `2026-04-20 Codex`: completed `2026-04-20-tag-exclude-filter`; added excludeTagFilter through archive queries, viewer state, modal UI, session persistence, and local tag updates. `npm run typecheck` / `npm run build` passed.
- `2026-04-18 Codex`: completed v0.17.6 tasks: duplicate threshold max 999, video lightbox loop, backup restore replace/merge modes, and local tag operation updates. `npm run typecheck` / `npm run build` passed.
- `2026-04-17 Codex`: implemented `2026-04-17-fix-large-backup-restore-timeout`; Viewer restore now calls `importArchiveBackupZip` directly and `archive/restore` runtime staging path was removed. `npm run typecheck` / `npm run build` passed. Manual large-backup verification remains.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-media-checksum-and-quota`; media writes now store SHA-256 checksums and quota failures are logged distinctly.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-post-tag-atomicity`; new post save now assigns auto-tags inside the create transaction.
- `2026-04-17 Codex`: completed `2026-04-17-perf-keyset-pagination`; added cursor pagination for unfiltered `saved_at` / `posted_at` load-more while preserving offset fallback.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-20-tag-exclude-filter`: Tag exclude filter implemented; typecheck/build passed
- `2026-04-18-duplicate-threshold-max-999`: Bulk import duplicate stop threshold max is now 999; typecheck/build passed
- `2026-04-18-video-loop`: Video lightbox playback now loops; typecheck/build passed
- `2026-04-18-restore-merge-or-replace`: Backup restore now supports replace and merge modes; typecheck/build passed
- `2026-04-18-perf-tagging-speed`: Post tag add/remove now updates displayed state locally; typecheck/build passed
- `2026-04-17-integrity-media-checksum-and-quota`: Media writes now store SHA-256 checksums and quota failures are logged distinctly; typecheck/build passed
- `2026-04-17-integrity-post-tag-atomicity`: New post save now assigns auto-tags inside the create transaction; typecheck/build passed
- `2026-04-17-perf-keyset-pagination`: Added cursor pagination for unfiltered `saved_at` / `posted_at` load-more; typecheck/build passed
- `2026-04-17-perf-random-sort-and-dead-code`: Removed `posts/list` dead code and replaced full random shuffle with seeded partial shuffle through the requested page window; typecheck/build passed
- `2026-04-11-investigate-quoted-container-annotation-coverage`: Current live X real quote cards are annotated correctly; unannotated candidates observed were empty false-positive link/icon containers; no code fix required
