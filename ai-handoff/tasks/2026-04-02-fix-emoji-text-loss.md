# Task Packet

## Goal

Preserve inline emoji in extracted post text so saved `post_text` matches what is visible on X.

## Requested Action

Adjust `normalizePostText` in `src/features/x/extract-post-from-article.ts`.

## In Scope

- Change post-text extraction so it does not lose Twemoji characters when Chrome omits them from `innerText`.
- Keep `extractDisplayName` behavior unchanged unless the same fix is clearly needed there.

## Out Of Scope

- DB schema changes
- Existing saved data migration
- Viewer changes

## Constraints

- `npm run typecheck` and `npm run build` must pass.
- No `git push`.

## Files To Read First

- `src/features/x/extract-post-from-article.ts`

## Inputs From Claude

- Chrome can omit Twemoji `<img alt="...">` from `innerText` on X even when the emoji is visible.
- `extractTextWithEmoji` already preserves those characters via DOM walk.
- The issue matters for post bodies because likes/import flow stores `post_text` from `normalizePostText`.
- `extractDisplayName` should stay on the safer mixed strategy for now.

## Acceptance Criteria

- [x] Post text extraction keeps visible inline emoji in `post_text`.
- [x] Text-only posts still normalize correctly.
- [x] Display-name extraction behavior is unchanged.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.

## Open Questions

- Whether to add a regression test fixture for Twemoji extraction in a follow-up task.

## Codex Plan

- Update `normalizePostText` to always use `extractTextWithEmoji` for post bodies.
- Keep `extractDisplayName` behavior unchanged so display-name fallback still benefits from `innerText`.
- Verify with `npm run typecheck` and `npm run build`.

## Codex Result

- `normalizePostText` now bypasses `innerText` and always uses the DOM walk helper.
- This preserves Twemoji `<img alt>` characters in visible post text instead of dropping them when Chrome omits them from `innerText`.
- `extractDisplayName` was left unchanged.

## Changed Files

- `src/features/x/extract-post-from-article.ts`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-02-fix-emoji-text-loss.md`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome (`.shared-cdp-profile`, port `9223`):
  - Opened `https://x.com/akshitr08310811/status/2041423342696329258`
  - Confirmed X/Chrome still drops inline Twemoji from `tweetText.innerText`
  - Confirmed DOM-walk extraction preserves `😂😂😂`
  - Saved the post through the extension and verified IndexedDB `posts.post_text` preserved the emoji sequence

## Remaining Issues

- No automated regression test was added in this task.
- No remaining browser-side issue was reproduced after the CDP verification; the saved `post_text` preserved the inline emoji as intended.

## Suggested Next Action

- Mark this task complete and move to the next queued implementation task.
