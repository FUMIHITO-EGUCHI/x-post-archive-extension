# Task Packet: Fix Path Traversal Filter and Typed Refetch Complete Message

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: normal
- files_in_scope: src/features/runtime/handle-runtime-message.ts, src/features/runtime/client.ts, src/features/x/bootstrap-x-content-script.ts
- blocked_by: none
- related_findings: full-codebase-review-2026-04-14 P1-002, P1-003
- needs_from_claude: none
- handoff_to_codex: Two small consistency/defense fixes: add ".." exclusion to the OPFS path filter, and route refetch.complete through the typed client instead of raw chrome.runtime.sendMessage
- summary: archive/restore path filter missing ".." exclusion; bootstrap sends refetch.complete bypassing the typed runtime client

## Goal

1. Make the `archive/restore` path normalization explicitly reject `".."` segments, matching its obvious intent.
2. Bring `refetch.complete` sending in the content script in line with the rest of the codebase by using the typed client.

## Problem Statement

### P1-002 — Missing `".."` filter in `archive/restore`

`handle-runtime-message.ts` ~line 531 splits the OPFS staging path and filters empty segments:

```typescript
const segments = message.stagingPath.split("/").filter((s) => s.length > 0);
```

The `".."` segment is not empty (length = 2), so it passes the filter. OPFS `getDirectoryHandle("..")` throws a `TypeError` per the WHATWG spec, meaning traversal is blocked at runtime, but the intent of the filter (`segments.every((s) => ...)` is not enforced in code. The fix is a one-character addition.

### P1-003 — `refetch.complete` bypasses typed client

`bootstrap-x-content-script.ts` line 491 sends `refetch.complete` with a raw `chrome.runtime.sendMessage` call:

```typescript
await chrome.runtime.sendMessage({
  type: "refetch.complete",
  xPostId: message.xPostId,
  post: extracted?.post ?? null,
  error: extracted === null ? "Post extraction failed." : null
});
```

Every other outbound message from `bootstrap-x-content-script.ts` routes through the typed client in `src/features/runtime/client.ts`. This one call was left as a raw send. It bypasses TypeScript's discriminated-union checking for the message payload.

## In Scope

### P1-002 fix (handle-runtime-message.ts)

Change the filter from:
```typescript
.filter((s) => s.length > 0)
```
to:
```typescript
.filter((s) => s.length > 0 && s !== "..")
```

### P1-003 fix (client.ts + bootstrap-x-content-script.ts)

1. Add a `requestNotifyRefetchComplete(xPostId: string, post: SavePostInput | null, error: string | null)` function to `client.ts` that sends `{ type: "refetch.complete", xPostId, post, error }` through the existing typed `sendMessage` wrapper.
2. In `bootstrap-x-content-script.ts` ~line 491, replace the raw `chrome.runtime.sendMessage(...)` call with `await requestNotifyRefetchComplete(...)`.

## Out Of Scope

- Changing the OPFS storage layout or any backup/restore logic beyond the filter line
- Adding full Zod payload validation to `isRuntimeMessage()` (tracked separately as P1-001 if pursued)
- Any refetch behavior changes

## Acceptance Criteria

- [x] `archive/restore` path filter rejects `".."` segments explicitly
- [x] `bootstrap-x-content-script.ts` no longer uses a raw `chrome.runtime.sendMessage` for `refetch.complete`
- [x] `client.ts` exports a `requestNotifyRefetchComplete` (or equivalent named) function
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Work Log

- `2026-04-14 Codex`: Added explicit `s !== ".."` filtering for archive restore staging path segments.
- `2026-04-14 Codex`: Added `requestNotifyRefetchComplete()` to the typed runtime client and replaced the raw `chrome.runtime.sendMessage` call in the X content script.

## Result

Done.

- `archive/restore` now explicitly filters out `..` path segments before walking OPFS handles.
- `bootstrap-x-content-script.ts` now sends `refetch.complete` through `requestNotifyRefetchComplete()`.
- `client.ts` exports `requestNotifyRefetchComplete()`.

## Verification

- `rg -n "refetch.complete|chrome.runtime.sendMessage|filter\\(\\(s\\)" src/features/runtime/handle-runtime-message.ts src/features/runtime/client.ts src/features/x/bootstrap-x-content-script.ts`
- `npm run typecheck`
- `npm run build`

## Completion Checklist
- [x] investigation finished
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
