# Task Packet: Claude Manual Verification for Keyword Search

## Meta
- status: superseded
- owner: Claude
- branch: feature/keyword-search
- priority: medium
- files_in_scope: src/features/viewer/components/sticky-toolbar.tsx, src/features/viewer/components/viewer-app.tsx, src/features/viewer/components/use-sort-filter.ts, src/db/repositories/posts-repository.ts, src/features/archive/archive-service.ts, ai-handoff/tasks/2026-04-21-verify-keyword-search.md
- blocked_by: none
- related_findings: search mode UI/spec mismatch was partially fixed by Codex on 2026-04-21
- needs_from_claude: shared-profile manual verification and final pass/fail judgment for remaining keyword-search cases
- handoff_to_codex: expected after manual verification if code changes are still needed
- summary: Codex already fixed the search-mode settings button and focus-restore behavior. This helper packet is superseded by the finalized verification record in `ai-handoff/tasks/2026-04-21-verify-keyword-search.md`.

## Goal

Finish the human-in-the-loop verification for keyword search on `feature/keyword-search` using the configured Shared Profile Chrome/CDP flow.

This is a verification-only handoff unless Claude finds a new bug that requires implementation follow-up.

## Compressed Findings

- Codex confirmed `npm run typecheck`, `npm run build`, and `npm run handoff:check` all pass on `feature/keyword-search`.
- Codex updated search mode so the settings button remains visible on the right in search mode.
- Codex also fixed focus restore so returning from settings while search mode is active puts focus back into the search input.
- Shared Profile verification already confirmed:
  - D-1 pass: settings button is visible in search mode and opens settings.
  - D-2 pass: returning from settings restores focus to the search input.
  - A-1 pass for the updated UI: search mode opens with input autofocus, and the toolbar now shows `close + settings`.
- CDP key automation was inconsistent for actual keyword typing. Codex saw cases where synthetic input changed the field value but did not reliably trigger the same filtering behavior as true manual typing.
- There is still a spec mismatch to resolve at judgment time:
  - Original design packet said search mode should be full-width input + close only.
  - Verification packet now expects settings to remain visible.
  - A-10 around sort changes during search may still need a product decision because the UI expectations changed over time.

## Files To Read First

- `ai-handoff/tasks/2026-04-21-verify-keyword-search.md`
- `ai-handoff/tasks/2026-04-21-keyword-search.md`
- `src/features/viewer/components/sticky-toolbar.tsx`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/components/use-sort-filter.ts`

## Constraints

- Use the configured Shared Profile Chrome only. Do not switch to Playwright Chromium, a temporary Chrome profile, or another isolated profile without explicit user approval.
- Treat this as manual verification first, not implementation.
- If a behavior fails, record the exact UI behavior and whether it is a true regression or a task/spec mismatch.

## Requested Action

1. Open the viewer in Shared Profile Chrome / CDP (`127.0.0.1:9223`).
2. Verify the remaining keyword-search cases manually.
3. Update `ai-handoff/tasks/2026-04-21-verify-keyword-search.md` with final pass/fail notes.
4. If all remaining cases pass, mark the verification task complete.
5. If any case fails and needs code changes, hand back to Codex with a compressed bug report.

## Remaining Test Cases To Verify Manually

### Functional

- A-2: typing `hello` filters to posts whose `post_text` contains `hello`
- A-3: clearing the input restores the unfiltered results
- A-4: close button clears keyword filter and exits search mode
- A-5: `Escape` does the same as close
- A-6: tag filter + keyword filter combine with AND semantics
- A-7: author filter + keyword filter combine with AND semantics
- A-8: clear-all while search mode is active clears keyword and exits search mode
- A-9: mixed-case search such as `Hello` still matches case-insensitively
- A-10: decide and record actual behavior for sort changes during search mode

### Edge Cases

- C-1: spaces-only input behaves like `null` / no keyword filter
- C-2: zero-result state does not break the screen
- C-3: keyword search with random sort behaves correctly
- C-4: decide whether filter modal access during search mode is expected behavior or a spec artifact

## Acceptance Criteria

- [ ] Remaining functional cases A-2 to A-10 are manually judged and recorded
- [ ] Remaining edge cases C-1 to C-4 are manually judged and recorded
- [ ] Existing D-1 / D-2 pass state is preserved
- [ ] `ai-handoff/tasks/2026-04-21-verify-keyword-search.md` is updated with final manual-verification notes
- [ ] If failures remain, Codex receives a compressed implementation-ready handoff

## Open Questions

- Is the intended search-mode UI now `input + close + settings`, or should it still be `input + close` only?
- Should A-10 be considered valid acceptance if sort controls are intentionally hidden in search mode, or should the UI keep sort controls visible while searching?

## Claude Result

Superseded by the finalized verification packet. No separate follow-up implementation handoff is required.

## Verification

Manual verification results were consolidated into `ai-handoff/tasks/2026-04-21-verify-keyword-search.md`.

## Completion Checklist

- [x] remaining manual verification completed
- [x] task packet `Claude Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
