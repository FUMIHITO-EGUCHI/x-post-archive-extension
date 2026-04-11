# Task Packet: Investigate Bulk Import Duplicate Images

## Meta
- status: active
- owner: Codex
- branch: feature/archive-followups
- priority: high
- files_in_scope: src/features/x/likes-import-controls.ts, src/features/x/bookmarks-import-controls.ts, src/features/x/bootstrap-x-content-script.ts, src/features/archive/archive-service.ts, src/db/repositories/media-repository.ts, src/features/x/extract-post-from-article.ts
- blocked_by: none
- related_findings: `2026-04-09-refetch-missing-media`, `2026-04-10-zero-engagement-refetch-and-image-investigation`, `2026-04-10-investigate-bulk-import-missing-posts`
- needs_from_claude: reproduce at least one concrete duplicate-image case on X and compress the findings if browser-only evidence is needed
- handoff_to_codex: investigate why bulk import can persist duplicate image media records for a single saved post, then implement the narrowest safe fix
- summary:

## Goal

Investigate and fix the issue where likes or bookmarks bulk import can save the
same image more than once for a post.

## Requested Action

- reproduce at least one concrete bulk-import case where duplicate images are
  persisted
- determine whether the duplication comes from extraction, richer-snapshot
  replacement, duplicate-save handling, or media persistence
- implement the narrowest fix that preserves snapshot-first semantics

## In Scope

- likes import and bookmarks import media save flow
- duplicate-save handling in `saveArchivePost`
- image candidate generation and per-post media deduplication
- DB evidence for duplicate media rows or duplicate OPFS writes

## Out Of Scope

- missing-image cases where no duplicate is saved
- video-only duplication unless it shares the same root cause
- broad importer redesign
- push

## Constraints

- preserve existing saved posts unless a replacement is clearly safer than
  additive behavior
- separate true duplicate-media bugs from valid multi-image posts
- confirm whether duplication is in DB rows, OPFS files, or only viewer output

## Files To Read First

- `docs/tech-index.md`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/bookmarks-import-controls.ts`
- `src/features/archive/archive-service.ts`
- `src/db/repositories/media-repository.ts`
- `src/features/x/extract-post-from-article.ts`

## Inputs From Claude

- user reported that bulk import can sometimes save duplicate images

## Acceptance Criteria

- at least one concrete duplicate-image scenario is documented with log, DB, or
  browser evidence
- the investigation states whether the duplicate is introduced during
  extraction, duplicate-save handling, or persistence
- the fix prevents duplicate image persistence for the reproduced case without
  regressing valid multi-image saves

## Open Questions

- does the duplication happen only on likes import, only on bookmarks import,
  or on both
- are duplicates keyed by URL, position, media_id, or a weaker heuristic
- does the duplication happen only when the same post is encountered multiple
  times during one bulk run

## Work Log

- `2026-04-11 Codex`: activated after closing `2026-04-10-investigate-bulk-import-missing-posts`; start from existing duplicate-media cleanup and importer traversal findings before further code changes.

- `2026-04-10 Codex`: created this waiting task from the user report that bulk import can sometimes save duplicate images for a post.
- `2026-04-10 Codex`: while closing the visible-save verification task, shared CDP re-save of post `1757243797334094301` persisted two media rows with URLs `.../GGL73oPasAEnwM0?format=jpg&name=orig` and `.../GGL73oPasAEnwM0.jpg?name=orig`; this may be a useful seed case even though the original report was bulk-import specific.
- `2026-04-10 Codex`: started the duplicate-image investigation by tracing bulk import save flow, extracted media candidates, and media persistence paths from the active follow-up branch.
- `2026-04-10 Codex`: confirmed the importer itself shares one save path for likes and bookmarks; the strongest root-cause candidate is upstream URL identity, because `extractPostFromArticle()` and `mergeImageCandidates()` dedupe only by exact `source_url`, while `saveArchivePost()` / `prepareDuplicateMediaWork()` also treat media identity as exact `media_type + source_url`.
- `2026-04-10 Codex`: identified a concrete collision pattern already seen in the seed case: `https://pbs.twimg.com/media/<id>?format=jpg&name=orig` and `https://pbs.twimg.com/media/<id>.jpg?name=orig` survive as distinct images because neither DOM nor GraphQL image normalization canonicalizes them to one shared key.
- `2026-04-10 Codex`: started implementing a shared Twitter image URL canonicalizer so both extraction and archive media identity collapse `.jpg` path variants and `?format=` variants to one canonical URL.
- `2026-04-10 Codex`: implemented shared canonicalization in DOM extraction, GraphQL fallback extraction, pending image record creation, and archive media identity keys; verified that the two seed-case URL variants now normalize to the same canonical URL.
- `2026-04-10 Codex`: started implementing a temporary viewer-side cleanup script for already-saved duplicate image rows, with dry-run default and explicit apply mode.
- `2026-04-11 Codex`: verified the temporary cleanup script on shared profile via viewer CDP for post `1757243797334094301`; dry-run reported one removable duplicate image row, apply removed it and deleted one unreferenced OPFS file, and a second dry-run returned zero duplicate groups.

## Codex Plan

1. reproduce one concrete duplicate-image case
2. compare extracted media candidates, duplicate-save behavior, and stored
   media rows
3. identify the narrowest safe deduplication point
4. implement and verify the fix

## Codex Result

The investigation confirmed a shared media-identity bug rather than a
bulk-import-only queue bug.

- likes import and bookmarks import both collect visible posts, wait for media
  hints, then call the same `requestSavePost()` path
- `extractPostFromArticle()` and GraphQL image fallback extraction previously
  deduped only by exact `source_url`
- `saveArchivePost()`, duplicate-save handling, and refetch media replacement
  also treated image identity as exact `media_type + source_url`
- because of that, two URL variants that refer to the same underlying
  `pbs.twimg.com/media/<asset>` image could be persisted as two rows

The reproduced collision pattern was:

- `.../media/<asset>?format=jpg&name=orig`
- `.../media/<asset>.jpg?name=orig`

The fix adds a shared `canonicalizeTwitterImageUrl()` helper and uses it in
all image-entry points that participate in deduplication:

- DOM extraction now canonicalizes image URLs before per-post dedupe
- GraphQL image fallback extraction now canonicalizes image URLs before merge
- pending image records now persist canonical image URLs
- archive media identity keys now canonicalize image URLs before duplicate
  checks, so preexisting `.jpg`-path rows and `?format=` rows collapse to the
  same identity during duplicate-save and refetch flows

To clean up already-saved duplicate rows, the branch now also includes a
temporary viewer-side script entry point:

- `cleanupDuplicateImageMedia()` in archive maintenance scans image rows by
  `x_post_id + canonical image URL`
- dry-run is the default mode
- `apply: true` updates the kept row to the canonical URL, deletes duplicate
  media rows, and best-effort removes unreferenced OPFS files
- the function is temporarily exposed in the viewer tab as
  `window.__xPostArchiveCleanupDuplicateImages`

## Changed Files

- `src/entrypoints/viewer/main.tsx`
- `src/features/archive/archive-maintenance-service.ts`
- `src/features/archive/archive-service.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/graphql-image-candidates.ts`
- `src/features/x/twitter-image-url.ts`

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- one-off helper verification compiled `src/features/x/twitter-image-url.ts`
  and confirmed both seed-case URLs normalize to
  `https://pbs.twimg.com/media/GGL73oPasAEnwM0?format=jpg&name=orig`
- cleanup script wiring verified by successful typecheck/build after exposing
  `window.__xPostArchiveCleanupDuplicateImages`
- shared profile viewer CDP run against `1757243797334094301`
- dry-run result: `scannedImageCount=2`, `duplicateGroupCount=1`,
  `removableRecordCount=1`, `updatedRecordCount=1`
- apply result: `removableRecordCount=1`, `updatedRecordCount=1`,
  `deletedFileCount=1`
- post-apply dry-run result: `scannedImageCount=1`, `duplicateGroupCount=0`

## Remaining Issues

- end-to-end browser verification for a full bulk-import run is still pending
- cleanup script is still a temporary viewer-exposed entry point and has not
  been promoted to a supported maintenance UI

## Suggested Next Action

Use the viewer console to run `window.__xPostArchiveCleanupDuplicateImages({
  xPostIds: ["1757243797334094301"]
})`, inspect the dry-run report, then rerun with `apply: true` on the same
post before testing a fresh bulk import.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] `task packet \`Verification\` updated`
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
