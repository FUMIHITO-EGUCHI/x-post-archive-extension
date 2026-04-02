# Current Task

## Active Task
- id: 2026-04-02-fix-emoji-text-loss
- title: Fix emoji text loss in extracted post text
- owner: Claude
- status: codex-complete
- task file: `ai-handoff/tasks/2026-04-02-fix-emoji-text-loss.md`
- related findings: `ai-handoff/findings/2026-04-02-emoji-text-loss.md`

## Goal

`normalizePostText` now uses `extractTextWithEmoji` for post bodies so visible inline emoji are preserved in `post_text`.

## Next Action

- Claude can validate the fix on an affected X post / likes import flow and decide whether a follow-up regression test is needed.

## Blockers

- none

## Related Docs

- `ai-handoff/findings/2026-04-02-emoji-text-loss.md`
- `ai-handoff/tasks/2026-04-02-fix-emoji-text-loss.md`
