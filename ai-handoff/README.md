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

1. Create or update the task packet in `ai-handoff/tasks/`
2. Point `ai-handoff/current-task.md` at that packet
3. Implement the work
4. Before marking the task completed, update both:
   - the task packet
   - `current-task.md`
5. Leave task packets in `tasks/`; do not move files just to reflect status

## Definition Of Done

A task is not complete until all of the following are true:

- code changes are finished
- `npm run typecheck` passed
- `npm run build` passed
- the task packet has a non-empty `Codex Result` or `Result` section
- the task packet has a non-empty `Verification` section
- `current-task.md` was updated
  - `Recent Updates`
  - `Recently Completed`
  - `Next Action`
- `npm run handoff:check` passed

If code is done but handoff is not updated, the task is still incomplete.

## Operational Rules

- Keep `ai-handoff/tasks/` flat
- Prefer UTF-8 reads and writes when touching handoff markdown on Windows
- Do not move task files just to reflect status
- Use `current-task.md` and the task packet body as the status source of truth
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
