# Current Task

## Active
- id: `2026-04-06-random-display`
- title: add random ordering to the viewer archive list
- owner: `Codex`
- status: `completed`
- branch: `feature/archive-viewer-improvements`
- priority: `high`
- task_file: `ai-handoff/tasks/2026-04-06-random-display.md`

## Scope
- files_in_scope: `src/features/viewer/components/viewer-app.tsx`
- files_in_scope: `src/features/archive/archive-service.ts`
- files_in_scope: `src/db/repositories/posts-repository.ts`
- files_in_scope: `src/types/viewer.ts`
- files_in_scope: `src/features/viewer/viewer-session-storage.ts`
- out_of_scope: cross-session random-order persistence
- out_of_scope: background / content script changes
- out_of_scope: database-level true random SQL ordering
- out_of_scope: commit and push

## Coordination
- blocked_by: `none`
- related_findings: `none`
- needs_from_claude: `none`
- handoff_to_codex: keep random ordering stable within one viewer session while allowing explicit reshuffle from the archive UI

## Next Action
- next_action: choose the next active task and update this dashboard before starting implementation
- acceptance_criteria: viewer sort options include a random mode
- acceptance_criteria: random mode remains stable across `Load more` within one viewer session
- acceptance_criteria: reshuffle changes the visible order without closing the viewer
- acceptance_criteria: random mode does not persist its shuffled order across viewer reopen
- acceptance_criteria: `npm run typecheck` and `npm run build` pass

## Recent Updates
- `2026-04-07 Codex`: completed `2026-04-06-random-display` by adding a random sort mode backed by a viewer-session seed, deterministic archive-side shuffling, and a `再シャッフル` / `Reshuffle` control; `npm run typecheck` and `npm run build` passed, and shared CDP Chrome confirmed that random ordering stays stable across `Load more` and changes after reshuffle.
- `2026-04-07 Codex`: completed `2026-04-06-fix-post-card-layout` by constraining `.viewer-list` to a fixed single grid column, forcing `.post-card` to shrink within the column, and adding wrap/min-width protections to post header and text elements; `npm run typecheck` and `npm run build` passed, and shared CDP Chrome confirmed the 390px-width viewer no longer overflows horizontally.
- `2026-04-07 Codex`: verified `2026-04-02-fix-emoji-text-loss` on shared CDP Chrome with a real Twemoji post; X/Chrome still drops emoji from `innerText`, but the extension now preserves the inline emoji in saved `post_text`, so the task can be treated as complete.
- `2026-04-07 Codex`: reloaded the unpacked extension on shared CDP Chrome, temporarily set the duplicate threshold to `1`, and verified that likes import and bookmarks import both stop automatically with the duplicate-threshold overlay reason; the verification pass also exposed a pending-media-wait queue bug, which was fixed before the final re-test.
- `2026-04-07 Codex`: implemented issue `#6` on `feature/archive-viewer-improvements` with a shared bulk-import duplicate-only batch threshold setting, duplicate-stop streak tracking for likes / bookmarks import, and stop-reason-aware overlay messaging; `npm run typecheck` and `npm run build` passed.
- `2026-04-07 Codex`: verified on shared CDP Chrome that the date filter works after extension reload; archive list updates for date-range conditions and the issue can be committed.
- `2026-04-07 Codex`: implemented issue `#5` on `feature/archive-viewer-improvements` with a dedicated date-filter modal, `saved_at` / `posted_at` target toggle, query-level filtering, session persistence, and active filter banners; `npm run typecheck` and `npm run build` passed.
- `2026-04-07 Codex`: verified on shared CDP Chrome (`.shared-cdp-profile`, port `9223`) that user filter modal and tag filter modal expand from `40 -> 80`, tag management expands from `50 -> 100`, and the redirect list renders normally with 20 items and no `Load more` button.
- `2026-04-07 Codex`: verified on shared CDP Chrome that selecting `堀出井靖水／新作漫画毎日投稿 (@horideiyasumi)` in the user filter changes the archive list to `50 / 64件` and the first visible handle to `@horideiyasumi`.
- `2026-04-07 Codex`: completed `2026-04-06-infinite-scroll-settings-lists` by switching tag filter, user filter, tag management, and auto-tag redirect lists to shared `Load more` incremental rendering in the viewer.
- `2026-04-07 Codex`: verified `2026-04-04-user-filter` is already implemented in code and passes `npm run typecheck` / `npm run build`; no additional code changes were required for that task.
- `2026-04-07 Codex`: documented the confirmed cause and mitigations in the handoff note, then prepared GitHub issue `#3` for closure.
- `2026-04-07 Codex`: confirmed the handoff Markdown files themselves are stored as valid UTF-8 Japanese text; raw bytes decode correctly when forced through UTF-8.
- `2026-04-07 Codex`: reproduced mojibake from Windows PowerShell `Get-Content` without `-Encoding utf8`, which reads UTF-8 no-BOM handoff files as the local ANSI code page and garbles Japanese.
- `2026-04-07 Codex`: reproduced a separate `?` collapse on Node stdout in this Windows CLI path, so Japanese text is unsafe to trust when passed through ad hoc Node / shell output without explicit encoding handling.
- `2026-04-06 Codex`: fixed the XHR interceptor bug where `open()` attempted to resolve both action and `tweet_id` before the body existed, so bookmark/like XHR requests never stored the action needed by `send()` to capture `tweet_id`.
- `2026-04-06 Codex`: reloaded the unpacked extension on shared CDP Chrome and verified with a real bookmark click on `https://x.com/azurlane_staff/status/2041108669182476664` that the page dispatches `x-post-archive:like-bookmark-action` and the injected button changes from `Save` to `Saved`.
- `2026-04-06 Codex`: verified on shared CDP profile that with settings enabled, dispatching the same like/bookmark event payload on `x.com/home` changes a visible post from `Save` to `Saved` and flips `posts/has` from `false` to `true`.
- `2026-04-06 Codex`: added short retry handling for auto-archive article lookup in the content script so like/bookmark actions do not fail immediately when the matching tweet article is not yet available in DOM.
- `2026-04-06 Codex`: marked `2026-04-04-bookmarks-import` completed because the feature shipped in `v0.16.0`; `v0.16.1` only fixed backup restore compatibility for `bookmarked`.
- `2026-04-06 Codex`: normalized this dashboard into a fixed handoff format with explicit scope, coordination, and next action fields.
- `2026-04-05 Codex`: bookmarks import implementation is in progress; remaining work is runtime-error verification and browser-side confirmation.
- `2026-04-05 Claude`: viewer CDP blocker was reduced to extension-loading workflow issues and documented separately.

## Waiting Tasks
- `none`

## Recently Completed
- `2026-04-06-random-display`: added viewer-side random ordering with a stable per-session seed and explicit reshuffle control
- `2026-04-06-fix-post-card-layout`: fixed viewer-side post-card horizontal overflow on narrow widths by constraining the grid column and card shrink behavior
- `2026-04-02-fix-emoji-text-loss`: browser-side Twemoji loss still reproduces in X/Chrome `innerText`, but saved `post_text` now preserves inline emoji correctly
- `2026-04-07-bulk-import-auto-stop-on-duplicates`: likes / bookmarks bulk import now auto-stops on repeated duplicate-only batches, with shared threshold settings and verified overlay messaging
- `2026-04-07-viewer-date-range-filter`: archive date-range filtering added with `saved_at` / `posted_at` target toggle and session restore support
- `2026-04-06-infinite-scroll-settings-lists`: viewer-side incremental `Load more` rendering added for filter and settings lists
- `2026-04-04-user-filter`: verified implemented and build-clean; user filter works alongside tag filter
- `2026-04-06-investigate-handoff-encoding`: files were intact UTF-8; main causes were PowerShell default decoding and unsafe Node/stdout Japanese handling
- `2026-04-06-investigate-auto-archive`: fixed in `v0.16.2` and verified from a real bookmark click path
- `2026-04-04-bookmarks-import`: feature shipped in `v0.16.0`; follow-up `v0.16.1` was a restore compatibility fix for `bookmarked`
- `2026-04-05-viewer-cdp-review-blocker`: resolved, see `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`
- `2026-04-04-viewer-tag-inline`: codex-done
- `2026-04-04-viewer-theme`: codex-done
- `2026-04-04-settings-page-split`: codex-done
