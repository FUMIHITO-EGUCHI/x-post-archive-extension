# Task Packet: Investigate Quoted Container Annotation Coverage

## Meta
- status: done
- owner: Codex
- branch: feature/full-codebase-review-2026-04-14-fixes
- priority: medium
- files_in_scope: src/features/x/annotate-quoted-post-containers.ts, src/features/x/extract-post-from-article.ts, src/entrypoints/x-main.content.ts, src/features/x/bootstrap-x-content-script.ts
- blocked_by: none
- related_findings: `2026-04-10-investigate-quoted-nesting-display`, `2026-04-02-quoted-post-feature`
- needs_from_claude: optional live X DOM reproduction details if current shared-profile feed no longer shows the issue
- handoff_to_codex: investigate partial quoted-container annotation coverage on current X DOM and fix extraction only if a real quoted-post card is missed
- summary:

## Goal

Determine whether current X DOM contains real quoted-post cards that are not
annotated with `data-xpa-quoted-permalink`, or whether the observed
unannotated `div[role="link"][tabindex="0"]` containers are false positives.

## Requested Action

- inspect at least one current live X article that contains a quoted-post-like
  container
- distinguish false-positive link containers from real quoted-post cards
- if a real quoted-post card is missed, implement the narrowest annotation or
  extraction fallback
- verify that `extractPostFromArticle()` receives `quotedPost` for the
  reproduced real quoted-post card

## In Scope

- quoted container annotation in content-safe X code
- `data-xpa-quoted-permalink` coverage
- `extractPostFromArticle()` quoted-post extraction
- current X DOM selector drift investigation

## Out Of Scope

- persistence fixes for already-saved quoted linkage
- viewer rendering and hydration fixes
- quoted video improvements
- full X UI reproduction
- push

## Constraints

- keep content script code content-safe and Dexie-free
- avoid broad selectors that misclassify unrelated link cards as quoted posts
- preserve snapshot-first archive semantics
- treat live X DOM as unstable and document the inspected DOM shape

## Files To Read First

- `src/features/x/annotate-quoted-post-containers.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/entrypoints/x-main.content.ts`
- `ai-handoff/tasks/2026-04-10-investigate-quoted-nesting-display.md`

## Inputs From Codex

During the quoted nesting persistence investigation, shared-profile live DOM
inspection on `https://x.com/home` showed partial annotation coverage:

- `articleCount = 10`
- `quotedContainerCount = 2`
- `annotatedCount = 1`

One unannotated quote-like container had empty visible text, so it may be a
false positive rather than a missed real quote card. This was split out because
the quoted nesting display bug was traced to missing `quoted_post_id`
persistence on duplicate save and refetch paths.

## Acceptance Criteria

- at least one current live X article with a quoted-post-like container is
  inspected
- the task states whether unannotated containers are false positives or missed
  real quoted-post cards
- if a real quote card is missed, a narrow annotation or extraction fix is
  implemented
- `extractPostFromArticle()` is verified to return `quotedPost` for the
  reproduced real quote-card case

## Open Questions

- are the unannotated containers real quote cards, empty/virtualized quote
  cards, or unrelated X link containers
- did X change the quoted-card permalink DOM shape
- does the annotation failure appear only on timeline pages or also on direct
  post pages

## Work Log

- `2026-04-11 Codex`: created this follow-up from the quoted nesting display task so annotation coverage can be investigated separately from the persistence fix.
- `2026-04-17 Codex`: inspected current live X DOM via shared CDP Chrome. On `https://x.com/home`, the only unannotated `div[role="link"][tabindex="0"]` candidate was an empty 16x16 link/icon container with no tweet text, time, username, media, direct status anchor, or React fiber permalink.
- `2026-04-17 Codex`: inspected real quote-card examples on `https://x.com/jack_s_daniel/status/2039017934933368904` and `https://x.com/Link_2011A/status/2038919309360275653`. Real quote cards had tweet text, user/time metadata, normal card-sized rects, and `data-xpa-quoted-permalink` from the MAIN-world fiber annotator.
- `2026-04-17 Codex`: verified the save/runtime path using the extension origin. IndexedDB contains main post `2038919309360275653` with `quoted_post_id = 2038625286254997621`, and `posts/list-page` with `authorFilter = "Link_2011A"` hydrates `quoted_post.x_post_id = 2038625286254997621`.

## Codex Plan

1. reproduce the partial annotation case in shared-profile CDP Chrome
2. inspect the DOM shape of annotated and unannotated quote-like containers
3. decide whether the unannotated case is a false positive or a missed real
   quote card
4. implement a narrow content-safe fix only if a real quote card is missed
5. verify extraction and run typecheck/build if code changes

## Codex Result

- Current X DOM still exposes false-positive `div[role="link"][tabindex="0"]` elements inside articles, but the reproduced unannotated cases were not real quoted-post cards.
- The real quoted-post cards inspected in current live DOM were annotated correctly with `data-xpa-quoted-permalink`.
- No narrow annotation or extraction code fix was needed for this task.
- The real saved quote-card case confirms the extraction/save path produced a non-null quote relationship: main post `2038919309360275653` stores `quoted_post_id = 2038625286254997621`, and runtime hydration returns the quoted post.

## Changed Files

- `ai-handoff/tasks/2026-04-11-investigate-quoted-container-annotation-coverage.md`
- `ai-handoff/current-task.md`

## Verification

- CDP live DOM scan, `https://x.com/home`:
  - `articleCount = 6`
  - `quoteLikeArticleCount = 1`
  - `containerCount = 1`
  - `annotatedCount = 0`
  - unannotated candidate had empty text, no direct permalink, no fiber permalink, no tweet text/time/username/media, and a 16x16 rect; treated as a false-positive link/icon container.
- CDP live DOM scan, `https://x.com/jack_s_daniel/status/2039017934933368904`:
  - `articleCount = 15`
  - `containerCount = 2`
  - `annotatedCount = 1`
  - real quote card on main article annotated as `/YahooNewsTopics/status/2038898845472731157`; second unannotated container was an empty 16x16 false positive.
- CDP live DOM scan, `https://x.com/Link_2011A/status/2038919309360275653`:
  - `articleCount = 14`
  - `containerCount = 2`
  - `annotatedCount = 2`
  - real quote card on main article annotated as `/k50_8/status/2038625286254997621`.
- Extension IndexedDB check:
  - main post `2038919309360275653` has `quoted_post_id = 2038625286254997621`.
  - quoted post `2038625286254997621` exists.
- Extension runtime `posts/list-page` check with `authorFilter = "Link_2011A"`:
  - returned post `2038919309360275653`.
  - `has_quoted_post = true`.
  - `quoted_post.x_post_id = 2038625286254997621`.

## Remaining Issues

- None for current annotation coverage. If a future live DOM sample shows a real quote card without tweet text/time/username markers or without a fiber permalink, capture that specific DOM shape before widening selectors.

## Suggested Next Action

No active handoff task remains. Pick the next review finding or product task before opening a new branch/task.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
