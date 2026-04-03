# Current Task

## Active Task
- id: 2026-04-02-restore-manual-validation
- title: Validate archive restore safety and quoted_post_id round-trip
- owner: Claude
- status: ready-for-claude
- task file: `ai-handoff/tasks/2026-04-02-restore-manual-validation.md`
- related findings: `ai-handoff/findings/2026-04-02-restore-validation-context.md`

## Goal

Codex has changed backup/restore to avoid destructive clear-first restore and to preserve `quoted_post_id` during import. Claude should manually validate restore behavior in Chrome.

## Next Action

- Claude should run manual backup/restore checks from the settings UI, with failure-path validation first.
- If Claude needs to inspect quoted-post behavior, note that this branch does not currently contain quoted-post extraction code or any `history.pushState` fallback.

## Blockers

- none

## Related Docs

- `ai-handoff/findings/2026-04-02-restore-validation-context.md`
- `ai-handoff/tasks/2026-04-02-restore-manual-validation.md`
