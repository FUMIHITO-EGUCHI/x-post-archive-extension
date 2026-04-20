# Current Task

## Active

- `2026-04-20-tag-exclude-filter`: タグ除外フィルター実装

## Scope

- フィルターモーダルのタグ一覧に include/exclude 2 択を追加。exclude は差集合でクエリ層に実装。

## Coordination

- task_file: `ai-handoff/tasks/2026-04-20-tag-exclude-filter.md`
- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: `ai-handoff/tasks/2026-04-20-tag-exclude-filter.md`

## Next Action

- next_action: `Codex が task packet の Design に従い実装する。`

## Acceptance Criteria

- [x] duplicate batch threshold max is 999
- [x] video lightbox loops playback
- [x] backup restore supports replace and merge modes
- [x] tag add/remove updates displayed post tags without full archive reload
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

- `2026-04-18 Codex`: completed v0.17.6 tasks: duplicate threshold max 999, video lightbox loop, backup restore replace/merge modes, and local tag operation updates. `npm run typecheck` / `npm run build` passed.
- `2026-04-17 Codex`: implemented `2026-04-17-fix-large-backup-restore-timeout`; Viewer restore now calls `importArchiveBackupZip` directly and `archive/restore` runtime staging path was removed. `npm run typecheck` / `npm run build` passed. Manual large-backup verification remains.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-media-checksum-and-quota`; media writes now store SHA-256 checksums and quota failures are logged distinctly.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-post-tag-atomicity`; new post save now assigns auto-tags inside the create transaction.
- `2026-04-17 Codex`: completed `2026-04-17-perf-keyset-pagination`; added cursor pagination for unfiltered `saved_at` / `posted_at` load-more while preserving offset fallback.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-18-duplicate-threshold-max-999`: Bulk import duplicate stop threshold max is now 999; typecheck/build passed
- `2026-04-18-video-loop`: Video lightbox playback now loops; typecheck/build passed
- `2026-04-18-restore-merge-or-replace`: Backup restore now supports replace and merge modes; typecheck/build passed
- `2026-04-18-perf-tagging-speed`: Post tag add/remove now updates displayed state locally; typecheck/build passed
- `2026-04-17-integrity-media-checksum-and-quota`: Media writes now store SHA-256 checksums and quota failures are logged distinctly; typecheck/build passed
- `2026-04-17-integrity-post-tag-atomicity`: New post save now assigns auto-tags inside the create transaction; typecheck/build passed
- `2026-04-17-perf-keyset-pagination`: Added cursor pagination for unfiltered `saved_at` / `posted_at` load-more; typecheck/build passed
- `2026-04-17-perf-random-sort-and-dead-code`: Removed `posts/list` dead code and replaced full random shuffle with seeded partial shuffle through the requested page window; typecheck/build passed
- `2026-04-11-investigate-quoted-container-annotation-coverage`: Current live X real quote cards are annotated correctly; unannotated candidates observed were empty false-positive link/icon containers; no code fix required
