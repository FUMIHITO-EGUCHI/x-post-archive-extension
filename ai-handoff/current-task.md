# Current Task

## Active

- task_file: `ai-handoff/tasks/2026-04-17-fix-large-backup-restore-timeout.md`

## Scope

- Viewer で `importArchiveBackupZip` を直接呼び、Background 経由の staging / sendMessage を廃止

## Coordination

- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: 設計完了 (2026-04-17)

## Next Action

- next_action: `Manual verify: 大容量バックアップ復元と progress 表示を実機確認`

## Acceptance Criteria

- [ ] 大容量バックアップ（例: 15GB超）が Viewer で直接復元できる
- [ ] 復元中に progress バーが更新される
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Completion Checklist

- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated

## Recent Updates

- `2026-04-17 Claude`: started `2026-04-17-fix-large-backup-restore-timeout`; 15.6GB バックアップが 10分タイムアウトで失敗する問題を調査。Viewer で直接復元するよう設計完了。
- `2026-04-17 Codex`: implemented `2026-04-17-fix-large-backup-restore-timeout`; Viewer restore now calls `importArchiveBackupZip` directly and `archive/restore` runtime staging path was removed. `npm run typecheck` / `npm run build` passed. Manual large-backup verification remains.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-media-checksum-and-quota`; media writes now store SHA-256 checksums and quota failures are logged distinctly.
- `2026-04-17 Codex`: completed `2026-04-17-integrity-post-tag-atomicity`; new post save now assigns auto-tags inside the create transaction.
- `2026-04-17 Codex`: completed `2026-04-17-perf-keyset-pagination`; added cursor pagination for unfiltered `saved_at` / `posted_at` load-more while preserving offset fallback.

## Waiting Tasks

- `none`

## Recently Completed

- `2026-04-17-integrity-media-checksum-and-quota`: Media writes now store SHA-256 checksums and quota failures are logged distinctly; typecheck/build passed
- `2026-04-17-integrity-post-tag-atomicity`: New post save now assigns auto-tags inside the create transaction; typecheck/build passed
- `2026-04-17-perf-keyset-pagination`: Added cursor pagination for unfiltered `saved_at` / `posted_at` load-more; typecheck/build passed
- `2026-04-17-perf-random-sort-and-dead-code`: Removed `posts/list` dead code and replaced full random shuffle with seeded partial shuffle through the requested page window; typecheck/build passed
- `2026-04-11-investigate-quoted-container-annotation-coverage`: Current live X real quote cards are annotated correctly; unannotated candidates observed were empty false-positive link/icon containers; no code fix required
