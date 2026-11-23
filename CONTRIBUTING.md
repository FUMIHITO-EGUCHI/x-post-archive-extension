# Contributing

Thanks for considering a contribution to this project.

This is a small, single-maintainer extension. Contributions are welcome, but please read this page first — the workflow is opinionated to keep history clean and reviewable.

## TL;DR

- **Open an Issue first** for anything non-trivial
- **One Issue ⇒ one PR**
- Issue references in commits and branches are optional; use `Refs #N` in the PR when related
- **branch naming**: `<type>/<short-topic> or <type>/<issue-number>-<short-topic>` (e.g. `feature/42-add-import-button`)
- Don't bypass git hooks with `--no-verify`

## Setup

```bash
npm install
npm run dev       # WXT dev server (Chrome MV3)
```

Load `.output/chrome-mv3/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Branch naming

Pattern: `<type>/<short-topic> or <type>/<issue-number>-<short-topic>`

| `<type>` | Use for |
|---|---|
| `feature` | New user-visible behavior |
| `fix` | Bug fix |
| `refactor` | Internal change, no behavior change |
| `docs` | Documentation only |
| `chore` | Everything else (release prep, dependency bump, etc.) |

Use `sh scripts/start-issue.sh <type> <number|-> <topic>`; pass `-` when no Issue number is needed.

## Commit messages

Use a clear subject describing the change. Issue references are optional.

## Required checks before commit

A `pre-commit` hook runs `npm run precommit:check`, which executes:

- `npm run lint` — ESLint, including the content-safe import boundary rule
- `npm run guard:content-scripts` — rebuilds and verifies that built content scripts do not contain Dexie or other non-content-safe symbols

Additionally, run this locally before opening a PR — it is not covered by the hook:

```bash
npm run typecheck   # tsc --noEmit
```

(`npm run build` is already part of `guard:content-scripts` above, so it is implicitly run by the precommit hook.)

CI (GitHub Actions, `.github/workflows/ci.yml`) re-runs lint + typecheck + build + the bundle guard on every PR.

## Content-safe boundary

Content scripts (`src/features/x/*`, `src/features/runtime/client.ts`) **must not import Dexie or anything that pulls Dexie in**. Shared DB constants and types live in Dexie-free modules such as `src/db/constants.ts`. See [`README.md` → Content-safe Guardrails](./README.md#content-safe-guardrails).

`npm run lint` enforces this on source. `npm run guard:content-scripts` re-verifies on the built bundle.

## Issue workflow

This repo tracks tasks in GitHub Issues. Open or closed state and related PRs show progress; labels are not used.

- The maintainer decides when to close Issues; an AI may close one only on explicit user instruction.
- For external contributions, file an Issue first (or comment on an existing one) before sending a PR.

## AI collaboration

The project is maintained by 1 human + Claude + Codex. The shared workflow is documented in [`docs/handoff/README.md`](./docs/handoff/README.md). External contributors do not need to follow the AI handoff rules — submit Issues and PRs normally. PR review comments may come from a Claude bot (`claude[bot]`).

## Security

Do not file security issues as public GitHub issues. See [`SECURITY.md`](./SECURITY.md) for the private reporting path.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
