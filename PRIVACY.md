# Privacy Policy

**Last updated:** 2026-05-08

This document describes how the **X Post Archive Extension** ("the Extension") handles user data. This policy applies to the Chrome extension distributed from this repository and the Chrome Web Store.

## Summary

- The Extension stores all data **locally** on the user's device.
- The Extension does **not** transmit any data to the developer or any third party.
- The Extension does **not** include analytics, telemetry, advertising, or tracking.
- There is **no** account, login, or server operated by the developer.

## Data the Extension stores locally

The Extension saves data only when the user explicitly triggers a save action on a post on `x.com` / `twitter.com`. Saved data is stored in the browser's IndexedDB on the user's own device and is never transmitted off-device by the Extension.

The following information may be stored:

- The post identifier (`x_post_id`), author username, post body text, post URL, and timestamp at the moment of saving.
- Media URLs and locally cached media blobs referenced by the saved post (when applicable).
- Thread context required to reproduce the saved post in the viewer.
- Internal application state required to operate the Extension (e.g. queue state, settings, alarms metadata).

The Extension uses the following Chrome APIs to provide its functionality:

| API / Permission | Purpose |
| --- | --- |
| `storage`, `unlimitedStorage` | Local persistence in IndexedDB and `chrome.storage` for user settings and saved posts. |
| `cookies` | Reading the `ct0` CSRF cookie from `x.com` / `twitter.com` is required to fetch the user's own active session's GraphQL endpoint (`TweetDetail`) for capturing the full post and thread context the user is currently viewing. The cookie value is used only on the user's own machine to compose the request to `x.com` and is never transmitted to the developer or any third party. |
| `alarms` | Background service worker scheduling for retrying failed saves and processing queued work. |
| `host_permissions` (`https://x.com/*`, `https://twitter.com/*`, `https://pbs.twimg.com/*`, `https://video.twimg.com/*`) | Required to attach the save UI to the X interface, fetch the post via the user's authenticated session, and locally cache referenced media. |

## Data the Extension does NOT collect

- The Extension does **not** send any usage data, error reports, or telemetry to the developer or to any third party.
- The Extension does **not** include analytics SDKs, advertising identifiers, or trackers.
- The Extension does **not** open any network connection to a server operated by the developer. The developer operates no backend.

## Network activity

The Extension only contacts the following domains, all of which are operated by X Corp.:

- `x.com`, `twitter.com` — to load the user's own session-authenticated post and thread data via the same endpoints the user's browser already uses while signed in.
- `pbs.twimg.com`, `video.twimg.com` — to fetch media referenced by saved posts so that they can be rendered in the local viewer.

No request from the Extension is sent to any domain not listed above.

## Third parties

The Extension does not share data with third parties. The Extension does not embed third-party analytics, advertising, or tracking SDKs.

## User control

- Saved data can be deleted at any time from the in-extension viewer.
- Uninstalling the Extension removes all data the Extension created in the browser's storage area.
- The user's X account credentials are managed entirely by the user's browser; the Extension never reads passwords or tokens other than the `ct0` CSRF cookie described above, and never persists them.

## Children's privacy

The Extension is not directed to children under 13 and does not knowingly collect any data, since it does not collect data at all.

## Changes to this policy

Material changes to this policy will be reflected in this file and the `Last updated` date above. The current version of this policy lives at:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/blob/master/PRIVACY.md`

## Contact

For questions about this policy or the Extension's data handling, open an issue on the GitHub repository:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/issues`
