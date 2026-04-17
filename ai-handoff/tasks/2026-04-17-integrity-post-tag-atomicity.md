# Task Packet: Integrity Fix - Post Tag Save Atomicity (P7)

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: low
- files_in_scope: src/features/archive/archive-service.ts
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit
- needs_from_claude: none
- handoff_to_codex: design complete (2026-04-17); implement after P5/P6 and P4
- summary: Ensure new-post persistence and auto-tag assignment are atomic by including `tags` and `post_tags` in the create transaction.

## Goal

Move auto-tag assignment for new post saves into the same Dexie transaction as the new `posts` and `media` writes.

## In Scope

- New post save transaction scope
- Internal auto-tag assignment helper

## Out Of Scope

- Manual tag add/remove behavior
- Duplicate-save behavior redesign
- Media blob persistence

## Work Log

- `2026-04-17 Codex`: started P7 after completing P4.
- `2026-04-17 Codex`: expanded the new-post create transaction to include `archiveDb.tags` and `archiveDb.post_tags`.
- `2026-04-17 Codex`: changed `assignAutoTags()` to use internal tag/post-tag repository helpers directly instead of routing through the manual tag runtime helper.

## Result

- New post saves now write the post, media records, tag records, and auto-tag links inside one transaction.
- If auto-tag assignment fails during a new save, the post and media rows are rolled back with the transaction.
- Existing duplicate-save behavior is preserved.

## Verification

- [x] New post save transaction includes `posts`, `media`, `tags`, and `post_tags`.
- [x] `assignAutoTags()` is called inside the new post save transaction.
- [x] `assignAutoTags()` only touches `tags` and `post_tags` via repository helpers.
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
