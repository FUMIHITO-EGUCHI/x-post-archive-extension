# Task Packet: Enforce Content-safe Boundaries

## Meta
- status: done
- owner: Codex
- branch: master
- priority: high
- files_in_scope: package.json, package-lock.json, eslint.config.js, scripts/check-content-script-bundle.mjs, scripts/pre-commit, README.md, docs/tech-index.md, src/db/constants.ts, src/db/archive-database.ts
- blocked_by: none
- related_findings: 2026-04-05-dexie-bundled-into-content-script
- needs_from_claude: none
- handoff_to_codex: implement lint and build-time guardrails so content-safe modules cannot re-import Dexie-backed DB code
- summary: ESLint boundary rules and a built content-script guard now prevent Dexie-backed DB code from re-entering content-safe modules or shipping inside content script bundles

## Goal

Prevent future `content-scripts/x.js` manifest-load failures by formalizing the
content-safe boundary in code, lint, and commit-time checks.

## Requested Action

- treat `src/features/x/*` and `src/features/runtime/client.ts` as content-safe
- forbid content-safe imports of `src/db/archive-database.ts`,
  `src/db/repositories/*`, and `dexie`
- keep shared DB constants in Dexie-free modules
- add a build-artifact guard that fails when built content scripts contain
  `Dexie`, `DexieError`, or `U+FFFF`
- set up ESLint and wire the checks into the existing pre-commit flow

## In Scope

- ESLint setup
- content-safe import restrictions
- build artifact guard script
- pre-commit integration
- short repo docs for the new boundary

## Out Of Scope

- broader lint style rollout unrelated to the boundary
- CI service setup outside the local pre-commit flow
- visible-save verification work

## Constraints

- keep the lint setup minimal and focused on boundary enforcement
- do not break current viewer/background/runtime behavior
- preserve the existing handoff workflow in the hook

## Files To Read First
- `docs/tech-index.md`
- `src/features/runtime/client.ts`
- `src/features/x/bootstrap-x-content-script.ts`
- `src/db/archive-database.ts`
- `ai-handoff/findings/2026-04-05-dexie-bundled-into-content-script.md`

## Inputs From Claude

- none

## Acceptance Criteria

- `npm run lint` exists and passes
- ESLint rejects imports of Dexie, `src/db/archive-database.ts`, and
  `src/db/repositories/*` from content-safe modules
- `npm run check:content-script-bundle` fails when built content scripts contain
  Dexie markers and passes on the clean build
- pre-commit runs the new guardrails
- docs explain the content-safe boundary and where shared DB constants belong

## Open Questions

- none

## Work Log
- `2026-04-10 Codex`: created follow-up task to enforce the content-safe boundary in code and tooling after the Dexie-in-content-script regression recurred
- `2026-04-10 Codex`: added a minimal ESLint flat config that treats `src/features/x/*`, `src/entrypoints/x*.content.ts`, and `src/features/runtime/client.ts` as content-safe and forbids imports of `dexie`, `src/db/archive-database.ts`, and `src/db/repositories/*`
- `2026-04-10 Codex`: tightened the ESLint restriction from glob patterns to regex-based matching after a synthetic relative import check showed the initial pattern form did not reliably catch `../../db/archive-database`
- `2026-04-10 Codex`: added a build-artifact guard script that scans `.output/chrome-mv3/content-scripts/*.js` for `Dexie`, `DexieError`, `U+FFFF`, and raw `0xEFBFBF` bytes, then wired it into new npm scripts and the pre-commit hook
- `2026-04-10 Codex`: verified the lint boundary with temporary real fixture files, confirmed Dexie-free constants remain allowed, and confirmed the bundle guard fails when a synthetic Dexie marker is injected into built `content-scripts/x.js`

## Codex Plan

1. add ESLint with focused content-safe import restrictions
2. add a build-artifact guard for built content scripts
3. wire the checks into the pre-commit flow and docs
4. verify lint, build, and bundle guard behavior

## Codex Result

Implemented the content-safe boundary as an enforced repo rule instead of a
convention.

- added `eslint.config.js` with `no-restricted-imports` rules for content-safe
  modules
- kept shared DB constants in Dexie-free modules and documented that boundary
- added `scripts/check-content-script-bundle.mjs` plus npm scripts to scan built
  content scripts for Dexie regression markers
- updated `scripts/pre-commit` so commits now rerun handoff validation, lint,
  and the content-script build guard
- documented the boundary in `README.md` and `docs/tech-index.md`

## Changed Files

- `.claude/rules/handoff.md`
- `README.md`
- `docs/tech-index.md`
- `package-lock.json`
- `package.json`
- `scripts/check-handoff-consistency.mjs`
- `scripts/start-cdp-chrome.ps1`
- `src/db/archive-database.ts`
- `src/db/repositories/posts-repository.ts`
- `src/features/refetch/refetch-coordinator.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `eslint.config.js`
- `scripts/check-content-script-bundle.mjs`
- `scripts/log-changes.mjs`
- `scripts/pre-commit`
- `scripts/setup-hooks.sh`
- `scripts/sync-handoff.mjs`
- `src/db/constants.ts`

## Verification

- `npm run lint`
  - passed
- `npm run typecheck`
  - passed
- `npm run build`
  - passed
- `npm run check:content-script-bundle`
  - passed on the clean build with `2` built content script files scanned
- real fixture verification:
  - a temporary `src/features/x/__lint-fixture-invalid__.ts` importing
    `../../db/archive-database` failed with `no-restricted-imports`
  - a temporary `src/features/x/__lint-fixture-valid__.ts` importing
    `../../db/constants` passed
- failure-path verification:
  - appended a synthetic `Dexie` marker to
    `.output/chrome-mv3/content-scripts/x.js`
  - `npm run check:content-script-bundle` failed as expected
  - restored the original built file immediately afterward

## Remaining Issues

- none for the boundary enforcement task itself

## Suggested Next Action

Resume the paused shared-CDP verification task for visible-save media wait and
the remaining refetch behavior checks.

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
