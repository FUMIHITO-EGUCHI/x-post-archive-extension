# X Post Archive Extension

日本語: [README.md](./README.md)

[![ci](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml)
[![security](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml)

Version `0.20.0`

A Chrome extension that saves X (formerly Twitter) posts one at a time so you can browse them later in a local viewer. The project is not an X clone — it focuses on personal archival and search, optimized for "I want to find that post I saved" rather than scrolling.

All data is kept locally in the browser's IndexedDB. Nothing is sent to the developer or any third party. See [PRIVACY.md](./PRIVACY.md).

## Stack

- WXT 0.20.x + Chrome Extension Manifest V3
- TypeScript 5.9.x (strict)
- React 19.1.x (viewer UI only)
- IndexedDB / Dexie 4.2.x
- @zip.js/zip.js (backup / restore)

## Features

### Save
- A save button is attached to each post on X. Body, author, posted-at, and attached media are saved.
- Self-reply chains by the original author (OP threads) are saved as a thread. Likes-import and ordinary saves automatically fetch the rest of the thread in the background.
- The quoted post's ID and permalink are saved alongside the post.

### View (viewer)
- Sort by saved date / posted date / reply, repost, like counts / random
- Filter by tag, user, period, or keyword
- Threads collapse to a root post and expand inline to show every reply stacked vertically
- Lightbox for full-screen image / video display (with `i / N`, "frame i of N" overlay)
- Settings panel for display behavior and accessibility tweaks

### Backup
- Export the whole archive as a zip
- Restore is merge-mode (existing records are preserved)

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run check:content-script-bundle
```

Development:

```bash
npm run dev
```

In Chrome, load `.output/chrome-mv3/` as an unpacked extension.

## Content-safe Guardrails

- `src/features/x/*` and `src/features/runtime/client.ts` are treated as content-safe modules
- Content-safe modules must not import `src/db/archive-database.ts`, `src/db/repositories/*`, or `dexie`
- Shared DB constants, types, and pure helpers live in Dexie-free modules such as `src/db/constants.ts`
- `npm run lint` enforces the import boundary
- `npm run guard:content-scripts` rebuilds and verifies that the built content scripts do not contain `Dexie`, `DexieError`, or `U+FFFF`

## One-off migration

If you need to migrate from the old DB `x-post-archive` to the current DB `x-post-archive-posts-v1`, see the [legacy DB migration guide](./docs/legacy-db-migration.md) and the [migration script](./scripts/migrate-legacy-posts.js).

## Docs

- [requirements](./docs/requirements.md)
- [mvp-plan](./docs/mvp-plan.md)
- [data-model](./docs/data-model.md)
- [implementation-steps](./docs/implementation-steps.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit-message rules, hooks, and the Issue-first workflow.

## Security

Report vulnerabilities privately via GitHub Security Advisories. See [SECURITY.md](./SECURITY.md).

## License

This project is released under the [MIT License](./LICENSE).

## Privacy

The extension stores data only locally on the user's device and does not transmit any data to the developer or any third party. See [PRIVACY.md](./PRIVACY.md) for details.
