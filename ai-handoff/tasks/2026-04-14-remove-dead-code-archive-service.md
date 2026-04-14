# Task Packet: Remove Dead Code from Archive Service and Maintenance Service

## Meta
- status: waiting
- owner: Codex
- branch: feature/remove-dead-code-archive
- priority: normal
- files_in_scope: src/features/archive/archive-service.ts, src/features/archive/archive-maintenance-service.ts
- blocked_by: none
- related_findings: full-codebase-review-2026-04-14 P2-002, P2-003
- needs_from_claude: none
- handoff_to_codex: Delete three functions that have no call sites anywhere in the codebase
- summary: ensureTagAssignments, assignPostTagsDirectly, and a duplicate createBackupFilename are defined but never called

## Goal

Remove three dead functions to reduce noise and prevent future maintainers from thinking they are part of an active code path.

## Problem Statement

Grep for all three symbols across the entire `src/` tree confirms they are defined once and called nowhere:

**`src/features/archive/archive-service.ts`**
- `ensureTagAssignments` (~line 1471): private function, 0 call sites
- `assignPostTagsDirectly` (~line 1528): private function, 0 call sites. A bug in this function was noted and fixed in `2026-04-11-fix-review-v0-17-1-followups` (Finding 7), but the fix was applied to a different live path; this function remains unreachable.

**`src/features/archive/archive-maintenance-service.ts`**
- `createBackupFilename` (~line 902): defined here but never called from this file. The same function is defined again (and used) inside `src/features/viewer/components/settings-archive-maintenance-panel.tsx`. The copy in maintenance-service.ts is a dead duplicate.

## In Scope

- Delete `ensureTagAssignments` and `assignPostTagsDirectly` from `archive-service.ts`
- Delete the `createBackupFilename` function from `archive-maintenance-service.ts` only (do NOT touch `settings-archive-maintenance-panel.tsx`)
- Remove any import or local type that becomes unused as a direct result of these deletions

## Out Of Scope

- Consolidating the two `createBackupFilename` copies (the panel's copy is active; leave it alone)
- Any refactoring of surrounding code
- Any behavior changes

## Acceptance Criteria

- [ ] `ensureTagAssignments` is gone from `archive-service.ts`
- [ ] `assignPostTagsDirectly` is gone from `archive-service.ts`
- [ ] `createBackupFilename` is gone from `archive-maintenance-service.ts`
- [ ] `settings-archive-maintenance-panel.tsx` is unchanged
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Work Log

## Result

## Verification

## Completion Checklist
- [ ] investigation finished
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
