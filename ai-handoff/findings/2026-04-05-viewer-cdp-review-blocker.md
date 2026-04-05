# 2026-04-05 Viewer CDP Review Blocker — Findings

## Root Cause (Confirmed)

ERR_FILE_NOT_FOUND was caused by **three compounding problems**, not a single WXT/viewer.html issue:

### Problem 1: Wrong Extension ID (Primary Cause)

`fignfifoniblkonapihmkfakmlgkbkcf` is **Google Network Speech** (a built-in Chrome component extension), not our extension.

The original `start-cdp-chrome.ps1` detected the service worker target with URL pattern `*/service_worker.js`. Google Network Speech registers a `service_worker.js` target. Our extension's MV3 module service worker registers as `*/background.js`. The script was returning Google Network Speech's ID as "our extension ID", so Codex was calling `chrome.runtime.getURL('/viewer.html')` in Google Network Speech's SW context → file not found in its package.

**Fix**: Detection pattern changed to `$_.url -like "chrome-extension://*/background.js"` which uniquely identifies our extension.

### Problem 2: `--load-extension` Silently Ignored on Fresh Profile

Chrome stable requires developer mode to be enabled in the user profile for `--load-extension` to register an unpacked extension. A fresh (new) profile has developer mode OFF. When developer mode is off, `--load-extension` is silently accepted but the extension is not registered.

**Fix**: Two-phase startup for new profiles:
1. Phase 1: Start Chrome without extension, enable developer mode via CDP (`chrome://extensions/` shadow DOM toggle), close Chrome gracefully so preferences flush to disk
2. Phase 2: Start Chrome with `--load-extension`

### Problem 3: `--disable-extensions-except` Not Allowed in Chrome Stable

The original script used `--disable-extensions-except`. This flag is silently ignored in Chrome stable (not allowed, only works in Chromium/Canary). It had no effect but caused confusion.

**Fix**: Removed from the script entirely.

## What Was Verified Working

Using a persistent profile (one that already had developer mode enabled AND our extension pre-registered from prior use), viewer.html loads correctly:

- URL: `chrome-extension://hlaianiimnjkppdbpobpgeidoafbcjhg/viewer.html`
- Title: "X Post Archive Viewer"
- React mounts correctly (`#root` element exists)
- Extension ID: `hlaianiimnjkppdbpobpgeidoafbcjhg`

## Remaining Uncertainty

The two-phase approach in `start-cdp-chrome.ps1` correctly enables developer mode in Phase 1 and saves it to Secure Preferences. However, Phase 2's `--load-extension` on a truly fresh profile (developer mode just enabled, extension not yet registered) may still not register the extension on first run.

This is because Chrome 146 stable appears to require the extension to have been previously loaded into the profile at least once before `--load-extension` can reload it. We were unable to verify this fully before the session ended.

## Updated Scripts

### `scripts/start-cdp-chrome.ps1`

Rewritten with two-phase approach. Key changes:
- Removed `--disable-extensions-except`
- Phase 1 (new profiles only): enables developer mode via `enable-dev-mode.mjs`, then closes Chrome
- Phase 2: starts Chrome with `--load-extension`
- Extension detection: `*/background.js` (was `*/service_worker.js`)
- Reuses an existing CDP browser on the requested port instead of killing Chrome unconditionally
- If the port is occupied by Chrome but CDP is not reachable, the script now stops and asks for an explicit rerun with `-TakeoverPort`
- `-TakeoverPort` uses `taskkill` only as an explicit opt-in takeover path
- PSPossibleIncorrectComparisonWithNull fixed (`$null -ne $x` pattern)

### `scripts/enable-dev-mode.mjs` (new)

Node.js ES module script. Connects to CDP, navigates to `chrome://extensions/`, clicks the developer mode toggle via shadow DOM query, waits for preferences to persist, then closes Chrome gracefully via `Browser.close`.

### `scripts/enable-dev-mode.js` (obsolete)

CJS version that was created first but fails because `package.json` has `"type": "module"`. Superseded by `.mjs` version. Can be deleted.

### `scripts/load-ext.mjs` (debugging artifact)

Attempted `chrome.developerPrivate.loadUnpacked({path: extPath})` — Chrome 146 returns `"Unexpected property: 'path'"`. The `path` option is not supported in Chrome 146's `developerPrivate` API. This file is a debugging artifact and can be deleted.

## Recommended Workflow for Codex

### Option A: Use Persistent Profile (Recommended)

Do NOT use `-ResetProfile` unless you have a specific reason to start fresh. The default profile `.codex-cdp-profile-2` persists between sessions. Once it has the extension registered, subsequent runs just need:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1
```

If Chrome is already listening on that port with CDP enabled, the script will now reuse it and print the extension ID / viewer URL without restarting the browser.

If the port is occupied but CDP is not reachable, the script fails fast instead of killing Chrome. After confirming it is safe to terminate that Chrome instance, rerun with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1 -TakeoverPort
```

### Option B: First-Time Setup from Fresh Profile

If setting up for the first time or after `-ResetProfile`:

1. Run with `-ResetProfile` — Phase 1 enables developer mode
2. If the extension is NOT detected after Phase 2 (script outputs a warning), manually go to `chrome://extensions/` and click "Load unpacked", selecting `.output\chrome-mv3`
3. The extension ID will be printed. On subsequent runs without `-ResetProfile`, `--load-extension` will reload the same extension with the same ID.

### What Extension ID to Use

The script now prints the correct extension ID and viewer URL after startup. Use the printed values — do NOT use `fignfifoniblkonapihmkfakmlgkbkcf` (that is Google Network Speech).

## `chrome.developerPrivate.loadUnpacked` — Not a Viable Automation Path

- Chrome 146: `path` property is not accepted
- The `developerPrivate` API calls the file picker dialog when `path` is omitted
- No programmatic headless extension loading path exists via this API in Chrome stable

## Viewer.html Itself Is Fine

WXT's build output is correct. `/chunks/...` and `/assets/...` root-relative paths work correctly in extension page context. `web_accessible_resources` changes are not needed. The issue was entirely about which extension was being targeted.
