# Task Packet: Investigate Quoted Container Annotation Coverage

## Meta
- status: waiting
- owner: Codex
- branch: feature/archive-followups
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

## Codex Plan

1. reproduce the partial annotation case in shared-profile CDP Chrome
2. inspect the DOM shape of annotated and unannotated quote-like containers
3. decide whether the unannotated case is a false positive or a missed real
   quote card
4. implement a narrow content-safe fix only if a real quote card is missed
5. verify extraction and run typecheck/build if code changes

## Codex Result

Pending.

## Changed Files

- `ai-handoff/tasks/2026-04-11-investigate-quoted-container-annotation-coverage.md`

## Verification

Pending.

## Remaining Issues

- Pending investigation.

## Suggested Next Action

Pick up this task after closing the quoted nesting persistence fix.

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Codex Result` or `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
