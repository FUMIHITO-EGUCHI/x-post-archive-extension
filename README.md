# X Post Archive Extension

[🇺🇸 English](./README.md) | [🇯🇵 日本語](./README.ja.md)

[![ci](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml)
[![security](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml)

> Local, offline archive for your X (Twitter) posts. Privacy-first. No third-party servers.

![Screenshot](docs/screenshot.png) <!-- [SCREENSHOT_PLACEHOLDER] — replace with actual screenshot -->

## Why this exists

X's built-in export is slow, limited, and routes through their servers. Your likes and bookmarks are hard to search after the fact. This extension saves posts locally in your browser so they stay yours — searchable, offline, and private.

## Features

- **One-click save** — a save button on each X post captures text, author, timestamp, and attached media
- **Thread-aware** — OP self-reply chains are saved as a thread; likes import and regular saves automatically fetch the full thread
- **Quoted posts** — the quoted post's ID and permalink are preserved
- **Viewer with search** — sort by saved/posted date, reply/repost/like counts, or random; filter by tag, user, date range, or keyword
- **Thread expansion** — threads collapse to a root post and expand inline
- **Media lightbox** — full-screen image/video display with frame counter
- **Zip backup & restore** — export the whole archive; restore merges without overwriting existing records
- **Settings panel** — display behavior and accessibility tweaks

## Installation

### Chrome / Edge (manual sideload)

1. Clone or download this repo
2. `npm install && npm run build`
3. Open `chrome://extensions`, enable Developer Mode
4. Click "Load unpacked" and select `.output/chrome-mv3/`

<!-- ### Chrome Web Store
[PLACEHOLDER — CWS link when published] -->

### Firefox

[TBD — Firefox support is planned]

## Usage

1. Navigate to X (x.com)
2. Click the save button on any post you want to archive
3. Click the extension icon to open the viewer
4. Search, filter, and browse your saved posts

## Privacy & Data Handling

All data stays on your machine. No analytics, no telemetry, no remote servers.

**Permissions:**

| Permission | Reason |
|---|---|
| `storage` | Store saved posts and settings in browser local storage |
| `unlimitedStorage` | Allow archive to grow beyond default quota |
| `cookies` | Read `ct0` CSRF token for TweetDetail GraphQL API calls |
| `alarms` | Schedule background tasks (thread completion, cleanup) |
| `host_permissions: x.com, twitter.com` | Access X pages to inject save buttons and fetch post data |
| `host_permissions: pbs.twimg.com, video.twimg.com` | Download attached images and videos for local storage |

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

## Tech Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000)
![Chrome Extension](https://img.shields.io/badge/Manifest%20V3-4285F4?logo=googlechrome&logoColor=fff)

- **WXT 0.20.x** — Chrome Extension framework (Manifest V3)
- **TypeScript 5.9.x** (strict)
- **React 19.1.x** — viewer UI only
- **IndexedDB / Dexie 4.2.x** — local database
- **@zip.js/zip.js** — backup / restore

## Development

```bash
npm install
npm run dev          # WXT dev server + hot reload
npm run build        # production build
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint
npm run guard:content-scripts  # verify content script isolation
```

In Chrome, load `.output/chrome-mv3/` as an unpacked extension.

## Roadmap

- [ ] Chrome Web Store submission
- [ ] Firefox Add-ons support
- [ ] Bulk export to JSON / CSV / Markdown
- [ ] Likes import improvement

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit-message rules, hooks, and the Issue-first workflow.

## Security

Report vulnerabilities privately via GitHub Security Advisories. See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
