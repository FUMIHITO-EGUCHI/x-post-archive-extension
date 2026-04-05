# 2026-04-05 Viewer CDP Review Blocker

## Goal

CDP で起動した Chrome の unpacked extension から viewer page を正常に開けるようにし、実ブラウザでのダークモード UI / 配色レビューを再開できる状態にする。

## In Scope

- `scripts/start-cdp-chrome.ps1` を使った fresh profile での再現
- unpacked extension の service worker / viewer page / build artifact の整合確認
- `viewer.html` の path 解決または WXT 側設定の調査

## Out of Scope

- ダークモード配色自体の最終修正
- bookmarks import の継続調査
- unrelated な UI リファクタ

## What Codex Already Confirmed

### CDP

- `scripts/start-cdp-chrome.ps1` で Chrome は安定起動する
- `http://127.0.0.1:<port>/json/version` は応答する
- fresh profile では service worker target も見える

### Extension

- `.output/chrome-mv3/viewer.html` は存在
- `.output/chrome-mv3/manifest.json` も build される
- extension ID は `fignfifoniblkonapihmkfakmlgkbkcf`

### Failure Mode

- service worker から `chrome.tabs.create({ url: chrome.runtime.getURL('/viewer.html') })` は成功
- しかし viewer tab は最終的に `chrome-error://chromewebdata/`
- page body text は `ERR_FILE_NOT_FOUND`
- Playwright の `page.goto('chrome-extension://.../viewer.html')` でも同じ

### Ruled Out

- `chrome.runtime.getURL('/viewer.html')` と `chrome.runtime.getURL('viewer.html')` の差
- temporary `web_accessible_resources` 追加

## Repro Commands

### Launch browser

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1 -Port 9228 -ProfileDirName .codex-cdp-profile-review-3 -ResetProfile
```

### Inspect targets

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9228/json/list | Select-Object -ExpandProperty Content
```

### Open viewer from service worker

Codex used a CDP WebSocket to evaluate:

```js
chrome.tabs.create({ url: chrome.runtime.getURL('/viewer.html') })
```

### Observe failure

- created tab URL label: `chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/viewer.html`
- actual loaded page: `chrome-error://chromewebdata/`
- visible error: `ERR_FILE_NOT_FOUND`

## Files To Read First

- `scripts/start-cdp-chrome.ps1`
- `src/entrypoints/background.ts`
- `src/entrypoints/viewer/index.html`
- `wxt.config.ts`
- `.output/chrome-mv3/viewer.html`
- `.output/chrome-mv3/manifest.json`

## Hypotheses To Check

1. WXT の unlisted page 出力が extension page として読める形になっていない
2. `viewer.html` 内の `/chunks/...` `/assets/...` 参照が extension context で壊れている
3. `chrome.runtime.getURL("/viewer.html")` を使う背景側起動導線に問題がある
4. Chrome / WXT / MV3 の組み合わせで、別の page registration が必要

## Acceptance Criteria

- viewer page が fresh profile の unpacked extension で開く
- Codex が CDP 経由で viewer DOM を操作できる
- その後に実ブラウザダークモード配色レビューへ戻れる
