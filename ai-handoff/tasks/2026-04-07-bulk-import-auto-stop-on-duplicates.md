# Task Packet

- GitHub Issue: `#6`

## Goal

Stop likes / bookmarks bulk import automatically when the run hits a sustained duplicate-only pattern, so the importer does not keep scrolling pointlessly after it has effectively reached already-saved content.

## Requested Action

Investigate the current likes / bookmarks bulk import loops and add an automatic stop rule based on repeated duplicates, with the threshold and stop reason made visible in compressed handoff notes.

## In Scope

- Define what "duplicate threshold" means for likes import and bookmarks import
- Add duplicate-streak or duplicate-threshold tracking during bulk import runs
- Stop the run automatically when the threshold is reached
- Show an understandable stop reason in the overlay status
- Apply the same rule coherently to likes import and bookmarks import

## Out Of Scope

- Full rewrite of likes / bookmarks import flow
- New archive deduplication semantics
- Changes to single-post save behavior
- Push

## Constraints

- Do not stop too early when new posts are still being discovered between duplicates
- Keep the rule simple enough to explain in the overlay and handoff
- Prefer a threshold based on repeated duplicate-heavy batches or scans rather than vague heuristics
- Run `npm run typecheck` and `npm run build`

## Files To Read First

- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/runtime/handle-runtime-message.ts`

## Inputs From Claude

- The user wants likes / bookmarks bulk import to auto-stop after a certain amount of duplicate-only progress
- The stop condition should reduce pointless scrolling and lighten long runs

## Acceptance Criteria

- Likes import stops automatically after the configured repeated-duplicate condition is hit
- Bookmarks import stops automatically under the same or clearly documented equivalent rule
- The overlay shows that the run stopped because of repeated duplicates
- Partial stats remain visible after the automatic stop
- `npm run typecheck`
- `npm run build`

## Open Questions

- Should the stop rule be based on consecutive duplicate saves, consecutive duplicate-only batches, or consecutive scans with no new saves?
- Should the threshold be fixed in code first, or exposed as a setting later?
- Should the automatic stop still allow manual restart from the same page state without reset?

## Codex Plan

- Inspect likes / bookmarks import progress accounting
- Choose a duplicate-stop rule that fits both flows
- Implement overlay messaging and stop behavior
- Verify build and expected importer behavior

## Codex Result

Implemented a shared bulk-import auto-stop rule for likes and bookmarks import based on consecutive duplicate-only save batches. The threshold is now a shared archive setting, defaults to `3`, is clamped to `1..20`, and the overlay keeps the stop reason explicit so duplicate-threshold stops are distinguishable from manual stops and page-leave stops. During browser verification, a separate pending-media-wait queue bug surfaced on bookmarks pages; that logic was fixed in both likes and bookmarks import so repeated non-richer scans still age toward queueing instead of dropping out silently.

## Changed Files

- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/settings/archive-settings.ts`
- `src/features/viewer/components/settings-basic-panel.tsx`
- `src/types/archive.ts`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-07-bulk-import-auto-stop-on-duplicates.md`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome (`.shared-cdp-profile`, port `9223`):
  - Reloaded the unpacked extension after rebuilding
  - Temporarily changed `bulkImportDuplicateBatchThreshold` from `10` to `1` for faster verification, then restored it
  - On `https://x.com/anifumi_dev/likes`, verified the overlay returns to `停止済み` with the duplicate-threshold message after duplicate-only processing
  - Created three X bookmarks from post detail pages, then verified `https://x.com/i/bookmarks` also returns to `停止済み` with the duplicate-threshold message after duplicate-only processing
  - Confirmed the bookmarks flow started counting duplicates after the pending-media-wait fix, instead of finishing with `collected > 0` and `saved/duplicates/failed = 0`

## Remaining Issues

- None for this issue.

## Suggested Next Action

Select the next active task on `feature/archive-viewer-improvements`.
