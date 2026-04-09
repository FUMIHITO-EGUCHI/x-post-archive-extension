# AI Handoff

`ai-handoff/` is the short-lived working area for Claude/Codex coordination.
Long-term specs and decisions belong in `docs/`.

## Structure

- `current-task.md`
  - Dashboard for exactly one active task
  - Tracks the current owner, scope, next action, and recently completed work
- `tasks/`
  - One task packet per file
  - Keep this directory flat
  - Do not split into `todo/`, `in-progress/`, or `done/`
- `findings/`
  - Investigation notes and compressed debugging results
- `templates/`
  - Templates for `current-task`, task packets, and finding notes
- `archive/`
  - Old handoff files that are no longer active

## Task State Policy

- Task state is tracked in `current-task.md` and inside each task note
- Do not move task files to represent status changes
- Keep task packets at `ai-handoff/tasks/*.md`
- This avoids breaking:
  - `task_file:` links in `current-task.md`
  - direct references inside task notes and findings
  - grep/search workflows and git history continuity

## Workflow

1. Create or update a task packet in `ai-handoff/tasks/`
2. Record investigation details in `ai-handoff/findings/` when needed
3. Point `current-task.md` at the active task and related findings
4. During implementation, update the task note with `Codex Result`, `Changed Files`, `Verification`, and `Remaining Issues`
5. When the task is done, update `current-task.md` instead of moving the task file
6. Archive only when the handoff document itself is no longer useful in `tasks/` or `findings/`

## Boundary With `docs/`

- Keep in `ai-handoff/`:
  - short-term implementation coordination
  - compressed findings for current work
  - temporary handoff context
- Keep in `docs/`:
  - durable requirements
  - MVP scope decisions
  - data model and architecture decisions
  - long-lived implementation guidance

## Writing Rules

- Keep logs compressed, not raw
- Separate scope and non-scope clearly
- List concrete files to read first
- Write explicit acceptance criteria
- Fill in `Codex Result / Verification / Remaining Issues` when closing a task
- Read Markdown with explicit UTF-8 handling on Windows when needed
