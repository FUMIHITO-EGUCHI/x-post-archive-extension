# Security Policy

## Supported versions

Only the latest release on the `master` branch receives security fixes. Older versions are not supported.

## Reporting a vulnerability

If you discover a security issue, please report it privately via GitHub Security Advisories:

https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/security/advisories/new

**Do not file public GitHub issues for security problems.**

## What to expect

This is a single-maintainer hobby project, so response is best-effort with no SLA. The intended flow is:

1. Acknowledge receipt within ~7 days
2. Investigate and confirm the issue
3. Develop a fix on a private branch
4. Release a patched version
5. Publish the advisory and credit the reporter (unless anonymity is requested)

## Scope

**In scope:**

- The extension's source code in this repository
- Any data handling in the extension that could leak user data off-device
- Any escape from the extension's local-only storage promise (see `PRIVACY.md`)
- The extension's handling of cookies, host permissions, and the X session it borrows

**Out of scope:**

- Vulnerabilities in `x.com` / `twitter.com` themselves — report to X Corp.
- Vulnerabilities in Chrome itself — report to the Chromium project
- Vulnerabilities in upstream dependencies (WXT, Dexie, React, zip.js, etc.) — please report to those projects directly
- Social engineering, phishing, or attacks that require the user to install a malicious build of the extension
- Issues that require physical access to an unlocked, signed-in device
