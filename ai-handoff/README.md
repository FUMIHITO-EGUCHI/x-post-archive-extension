# AI Handoff

`ai-handoff/` is the short-lived working area for Claude/Codex coordination.
Long-term specs and decisions belong in `docs/`.

## Structure

- `current-task.md`
  - dashboard for exactly one active task
  - the source of truth for what is currently active
- `tasks/`
  - one markdown file per task packet
  - kept flat; do not split into `todo/`, `in-progress/`, or `done/`
- `findings/`
  - compressed investigation notes
- `templates/`
  - templates for `current-task.md` and task packets
- `archive/`
  - older handoff files that no longer need to stay active

## Workflow

1. Create a task packet in `ai-handoff/tasks/` using the template.
   Fill in `## Meta` (status: active, owner, branch, priority, files_in_scope …).
2. Point `ai-handoff/current-task.md` at that packet, then run:
   ```
   npm run handoff:sync
   ```
   This syncs Meta fields, Checklist, and status into `current-task.md`.
3. Implement the work. **After each meaningful step**, append one line to
   `## Work Log` in the task packet:
   ```
   - `YYYY-MM-DD Codex`: 何をしたか
   ```
4. Track changed files at any point:
   ```
   npm run handoff:log-changes
   ```
   This rewrites `## Changed Files` from `git status`.
5. When the task is complete:
   - Fill in `## Codex Result` and `## Verification`
   - Change `## Meta - status` from `active` → `done`
   - Fill in `## Meta - summary` (one-line description for Recently Completed)
   - Run `npm run handoff:sync` to propagate status and checklist
   - Run `npm run handoff:check` to validate
6. Leave task packets in `tasks/`; do not move files just to reflect status.

## Scripts

| コマンド | 用途 |
|---|---|
| `npm run handoff:sync` | task packet → current-task.md を同期（Active, Checklist, Recently Completed, Waiting Tasks） |
| `npm run handoff:log-changes` | git status → task packet の ## Changed Files を更新 |
| `npm run handoff:check` | 整合性検証（pre-commit hook でも実行される） |

## Definition Of Done

A task is not complete until all of the following are true:

- code changes are finished
- `npm run typecheck` passed
- `npm run build` passed
- the task packet has a non-empty `## Codex Result` or `## Result` section
- the task packet has a non-empty `## Verification` section
- `## Meta - status` is `done`
- `## Meta - summary` is filled in
- `npm run handoff:sync` was run
- `npm run handoff:check` passed

If code is done but handoff is not updated, the task is still incomplete.

## Operational Rules

- Keep `ai-handoff/tasks/` flat
- Prefer UTF-8 reads and writes when touching handoff markdown on Windows
- Do not move task files just to reflect status
- **Edit task packets, not `current-task.md` directly** — run `handoff:sync` to propagate
- Append to `## Work Log` while working, not just at the end
- When a task is already implemented in code but its packet is stale, update the packet before closing it

## Boundary With `docs/`

- `ai-handoff/`
  - short-term coordination
  - investigation notes
  - active implementation context
- `docs/`
  - requirements
  - MVP planning
  - stable design and architecture
  - long-lived implementation guidance
