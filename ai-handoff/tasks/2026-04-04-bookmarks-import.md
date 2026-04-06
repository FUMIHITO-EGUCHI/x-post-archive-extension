# Task Packet - bookmarks import

## Goal

Add a bulk import UI on `x.com/i/bookmarks` similar to likes import, save visible bookmarked posts while auto-scrolling, and assign the `bookmarked` built-in tag when posts are saved.

## Requested Action

Implement the bookmarks import flow, wire it into the content script, and capture any remaining browser-side runtime-error findings in compressed handoff form.

## In Scope

- Add `"bookmarked"` to `BuiltInTagKey` in `src/types/archive.ts`
- Add `bookmarked` labels and normalization support in `src/features/settings/archive-language.ts`
- Implement `src/features/x/bookmarks-import-controls.ts`
- Mount and unmount bookmarks import controls from `src/features/x/bootstrap-x-content-script.ts`
- Ensure saved posts receive the `bookmarked` built-in tag

## Out Of Scope

- Full bookmarks product expansion beyond the MVP import flow
- URL support outside `/i/bookmarks`
- Commit and push

## Constraints

- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- Content script work should stay in plain TypeScript rather than React
- Verification must include `npm run typecheck` and `npm run build`

## Compressed Findings

### 1. bookmarks import itself was implemented

`src/features/x/bookmarks-import-controls.ts` was added to mirror the likes import flow, including overlay UI, save queue handling, and import progress behavior for `/i/bookmarks`.

### 2. saved posts explicitly receive the `bookmarked` tag

Unlike likes import, bookmarks import explicitly appends `getDefaultAutoTagLabel(language, "bookmarked")` so saved posts can be filtered back to bookmark-origin content.

### 3. content script wiring was added

`src/features/x/bootstrap-x-content-script.ts` mounts bookmarks import controls on `/i/bookmarks` and removes them outside that route.

### 4. runtime-error investigation existed as follow-up work

At the time of implementation there were still unresolved runtime-error notes, including an IndexedDB `NotFoundError` seen in background logs and uncertainty around whether a quoted-post extraction path was involved.

### 5. feature delivery is complete

This task is complete as a feature-delivery task. The bookmarks import feature shipped in `v0.16.0`.

## Files To Read First

- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/extract-post-from-article.ts`
- `ai-handoff/findings/2026-04-05-bookmarks-import-runtime-error.md`

## Acceptance Criteria

1. Import overlay renders on `x.com/i/bookmarks`.
2. Visible bookmarked posts can be processed by the save flow without crashing.
3. Saved posts receive the `bookmarked` built-in tag.
4. `npm run typecheck` passes.
5. `npm run build` passes.
6. Any remaining runtime-error findings are written back as compressed handoff notes.

## Open Questions

- Was the reported runtime error caused by bookmarks import itself or by surrounding background/database state?
- Was quoted-post `video_candidates` extraction involved in the failure path?
- Was the failure caused by an old tab, old service worker, or old DB schema mismatch?

## Codex Plan

- Reuse the likes import structure to build bookmarks import.
- Add the built-in tag and archive-language support for `bookmarked`.
- Record any unresolved runtime-error investigation in handoff findings.

## Codex Result

- `src/features/x/bookmarks-import-controls.ts` was implemented.
- `src/features/x/bootstrap-x-content-script.ts` was updated to mount and unmount the bookmarks import UI.
- `src/features/settings/archive-language.ts` was updated for `bookmarked`.
- `src/types/archive.ts` was updated to add `"bookmarked"` to `BuiltInTagKey`.
- The runtime-error investigation state was written to `ai-handoff/findings/2026-04-05-bookmarks-import-runtime-error.md`.
- Completion note: this task is complete as a feature-delivery task.
- `v0.16.1` only fixed backup restore compatibility for the new `bookmarked` tag. It did not represent unfinished bookmarks-import scope.

## Changed Files

- `src/features/x/bookmarks-import-controls.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/settings/archive-language.ts`
- `src/types/archive.ts`
- `src/features/x/extract-post-from-article.ts`

## Verification

- `npm run typecheck`
- `npm run build`
- Browser-side `/i/bookmarks` confirmation was still pending at the time the runtime-error follow-up was documented.

## Remaining Issues

Historical note: the items below are retained as follow-up investigation context only. They are not active blockers for this completed task.

- The user-facing runtime error was not captured as a clean exception message with full stack details.
- Background logs showed an IndexedDB `NotFoundError` involving a missing object store.
- There was still uncertainty about whether `src/features/x/extract-post-from-article.ts` quoted-post handling contributed to the failure.
- Browser console details on `/i/bookmarks` were still missing from the handoff record.

## Suggested Next Action

Historical follow-up only: if bookmarks import needs more investigation in the future, open a new task instead of reactivating this completed packet.

1. Reproduce the issue on `/i/bookmarks` and capture console error, message, and stack.
2. Correlate the browser-side failure with the background runtime message and transaction store usage.
3. Narrow whether the break belongs to `bookmarks-import-controls.ts` or `extract-post-from-article.ts`.
4. If a fresh defect is confirmed, continue in a new investigation task rather than reopening this one.
