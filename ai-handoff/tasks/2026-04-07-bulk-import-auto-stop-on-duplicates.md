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

<!-- Fill after implementation -->

## Changed Files

<!-- Fill after implementation -->

## Verification

<!-- Fill after implementation -->

## Remaining Issues

<!-- Fill after implementation -->

## Suggested Next Action

<!-- Fill after implementation -->
