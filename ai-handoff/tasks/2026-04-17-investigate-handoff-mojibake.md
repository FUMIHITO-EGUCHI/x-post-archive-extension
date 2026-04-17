# Task Packet: Investigate 2026-04-17 Handoff Mojibake

## Meta
- status: waiting
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: medium
- files_in_scope: ai-handoff/current-task.md, ai-handoff/tasks/2026-04-17-perf-fix-full-scans.md, ai-handoff/tasks/2026-04-17-viewer-app-second-pass.md, ai-handoff/findings/2026-04-17-cia-perf-audit.md, ai-handoff/tasks/2026-04-06-investigate-handoff-encoding.md
- blocked_by: none
- related_findings: 2026-04-17-cia-perf-audit, 2026-04-07-handoff-encoding
- needs_from_claude: original readable Japanese text for the affected 2026-04-17 task/finding packets if file bytes are already corrupted
- handoff_to_codex: investigate whether the 2026-04-17 handoff mojibake is display-only or persisted file corruption, then repair or request source text
- summary: New 2026-04-17 handoff files contain mojibake in Japanese headings and descriptions; determine the corruption point before editing the technical task content.

## Goal

Determine why the newly added 2026-04-17 handoff task/finding files show mojibake, and recover readable task text where possible without losing the active performance task details.

## Problem Statement

The active performance task and related finding are readable enough to implement, but large Japanese sections are mojibake in:

- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-17-perf-fix-full-scans.md`
- `ai-handoff/tasks/2026-04-17-viewer-app-second-pass.md`
- `ai-handoff/findings/2026-04-17-cia-perf-audit.md`

An older task, `2026-04-06-investigate-handoff-encoding.md`, also appears mojibake in this environment, so the investigation should distinguish old known display-path issues from newly persisted corruption.

## Requested Action

- Inspect raw bytes and Git diff for the affected 2026-04-17 files.
- Determine whether the files are valid UTF-8 containing already-mojibake text, or whether the display path is mis-decoding valid Japanese.
- If the original Japanese can be recovered safely, repair the affected handoff files.
- If not recoverable from local bytes, document that Claude/source text is needed.
- Add or update a short finding with the root cause and recommended write/read path.

## Acceptance Criteria

- The investigation states whether the 2026-04-17 mojibake is persisted in file contents or only display-path related.
- Affected files are repaired when recoverable without guessing.
- If repair is not possible, the task records exactly which original text is needed from Claude/user.
- `npm run handoff:check` passes after any handoff edits.

## Work Log

- `2026-04-17 Codex`: Created as a follow-up before starting `2026-04-17-perf-fix-full-scans`.

## Result

Pending.

## Verification

Pending.

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
