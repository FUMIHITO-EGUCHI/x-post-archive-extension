# Task Packet: Integrity Fix - Media Checksum And OPFS Quota Handling (P8/P9)

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/types/archive.ts, src/db/archive-database.ts, src/db/repositories/media-repository.ts, src/features/media-storage/opfs-media-storage.ts, src/features/archive/archive-service.ts, src/features/archive/archive-maintenance-service.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement after P5/P6, P4, and P7
- summary: Add nullable media SHA-256 checksums and distinguish OPFS quota failures in media persistence logs/state.

## Goal

1. P8: Add nullable `MediaRecord.checksum` and store a SHA-256 hex checksum when media blobs are written to OPFS.
2. P9: Detect quota exceeded failures and record/log them distinctly instead of treating them as opaque persistence failures.

## In Scope

- `MediaRecord.checksum`
- OPFS write checksum calculation
- media persistence update fields
- backup restore parsing compatibility
- quota exceeded error classification and warn logging

## Out Of Scope

- New viewer quota warning UI
- Backfilling checksums for existing media
- Export/import validation by checksum

## Work Log

- `2026-04-17 Codex`: started P8/P9 after completing P7.
- `2026-04-17 Codex`: added nullable `checksum` to `MediaRecord`, pending media creation, media normalization, backup restore parsing, and media write updates.
- `2026-04-17 Codex`: changed `writeBlobToOpfs()` to calculate SHA-256 over the written bytes and return the checksum.
- `2026-04-17 Codex`: added OPFS quota error detection and changed media persistence quota failures to warn-level logs with quota-specific `last_error` text.

## Result

- Newly persisted media stores `checksum` as a SHA-256 hex string after successful OPFS write.
- Existing media and restored older backups remain compatible because checksum is nullable and defaults to `null` when absent.
- Failed or re-pending media clears stale checksum values.
- OPFS quota exceeded failures are detected via `isQuotaExceededError()` and logged at warn level with `quotaExceeded: true`.

## Verification

- [x] `MediaRecord.checksum` exists and is nullable.
- [x] new pending media records initialize `checksum: null`.
- [x] successful `persistMedia()` writes `checksum: writeResult.checksum`.
- [x] failed and re-pending media clear `checksum`.
- [x] backup restore parsing accepts missing `checksum` as `null`.
- [x] OPFS quota exceeded errors use warn-level media persistence logging.
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
