# Current Task

## Active

- none

## Scope

- none

## Coordination

- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: `none`

## Next Action

- next_action: `Pick the next waiting full-codebase review task.`

## Acceptance Criteria

- none

## Completion Checklist

- [ ] No active task

## Recent Updates

- `2026-04-14 Codex`: `2026-04-14-fix-orphaned-tag-on-preview-cancel` completed on `feature/full-codebase-review-2026-04-14-fixes`; preview no longer writes new tag rows and apply now creates missing tags before assignments; typecheck/build passed
- `2026-04-14 Codex`: started `2026-04-14-fix-orphaned-tag-on-preview-cancel` on `feature/full-codebase-review-2026-04-14-fixes`; confirmed preview currently writes new tags via `addTag(tag)`
- `2026-04-14 Claude`: full-codebase review phase completed; recorded 8 findings and added 5 prioritized task packets to Waiting Tasks
- `2026-04-14 Codex`: `2026-04-14-investigate-missing-quoted-post-render` completed on `feature/fix-refetch-quoted-post-id`; refetch now preserves existing `quoted_post_id` when extracted input omits it; typecheck/build passed
- `2026-04-14 Codex`: `2026-04-14-random-display-exclude-quoted-posts` completed on `feature/random-exclude-quoted-posts`; DB version 13 adds `quoted_post_id` index and random mode now excludes quoted source posts; typecheck/build passed

## Waiting Tasks

- `2026-04-14-remove-dead-code-archive-service`: [normal] remove dead code around `ensureTagAssignments`, `assignPostTagsDirectly`, and duplicate `createBackupFilename`
- `2026-04-14-fix-path-filter-and-refetch-typing`: [normal] add `..` exclusion to archive/restore path filter and type the `refetch.complete` client result
- `2026-04-14-merge-import-controls`: [low] merge common bookmarks/likes import controls
- `2026-04-14-viewer-app-decompose-and-cap-load`: [low] decompose `ViewerApp` and cap section restore/load behavior

## Recently Completed

- `2026-04-14-fix-orphaned-tag-on-preview-cancel`: bulk tag assignment preview no longer creates orphaned tags when the user cancels; apply creates missing tags before assigning; typecheck and build passed
- `2026-04-14-investigate-missing-quoted-post-render`: refetch no longer clears an existing `quoted_post_id` when the extracted refetch input omits it; typecheck and build passed
- `2026-04-14-random-display-exclude-quoted-posts`: random display now excludes posts referenced as `quoted_post_id` while keeping normal sorts unchanged; quoted source cards render below quoting post media; typecheck, build, and CDP check passed
- `2026-04-13-sticky-toolbar-and-unified-filter`: sticky viewer toolbar and unified user/tag/date filter modal completed
- `2026-04-13-viewer-list-ux-improvements`: viewer list P1/P2 UX fixes completed; optional P3 toolbar merge and image pending skeleton also implemented
- `2026-04-11-fix-review-v0-17-1-followups`: implemented all v0.17.1 follow-up fixes including Finding 22
