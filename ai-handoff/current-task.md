# Current Task

## Active Task
- id: `2026-04-04-bookmarks-import`
- title: bookmarks import の調査継続
- owner: Codex
- status: in_progress
- task file: `ai-handoff/tasks/2026-04-04-bookmarks-import.md`

---

## Recently Completed: `2026-04-05-viewer-cdp-review-blocker`

**status: resolved**  
findings: `ai-handoff/findings/2026-04-05-viewer-cdp-review-blocker.md`

### Summary

ERR_FILE_NOT_FOUND の根本原因は3つの複合問題。viewer.html 自体や WXT ビルドに問題はなし。

1. **Wrong extension ID**: `fignfifoniblkonapihmkfakmlgkbkcf` は Google Network Speech（Chrome 組み込み）。`start-cdp-chrome.ps1` が `*/service_worker.js` パターンで誤検知していた。正しくは `*/background.js` で検出。

2. **`--load-extension` がサイレント無視**: Chrome stable は developer mode が OFF のプロファイルでは `--load-extension` を無視する。新規プロファイルはデフォルト OFF。

3. **`--disable-extensions-except` は Chrome stable で無効**: サイレント無視されるフラグ。スクリプトから削除済み。

### What Changed

- `scripts/start-cdp-chrome.ps1`: 2フェーズ起動（Phase 1: dev mode 有効化、Phase 2: extension ロード）、検出パターン修正、不正なフラグ削除
- `scripts/enable-dev-mode.mjs`: 新規作成。CDP 経由で developer mode を有効化して Chrome を graceful close
- `scripts/enable-dev-mode.js`: 廃止。`scripts/load-ext.mjs`: デバッグ用途のみ（削除可）

### CDP 起動手順（Codex 用）

```powershell
# 通常起動（プロファイル再利用）— extension ID が出力される
powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1

# 初回 or プロファイルリセット
powershell -ExecutionPolicy Bypass -File scripts\start-cdp-chrome.ps1 -ResetProfile
# → extension が検出されない場合は chrome://extensions/ から手動 Load unpacked (.output\chrome-mv3)
```

Extension ID は起動時に出力される。`fignfifoniblkonapihmkfakmlgkbkcf` は使用禁止（Google Network Speech）。

---

## Waiting Tasks
| Order | ID | Title |
|---|---|---|
| 1 | `2026-04-04-bookmarks-import` | bookmarks import の調査継続 |
| 2 | `2026-04-04-auto-archive-triggers` | いいね / ブックマーク時の自動保存 |
| 3 | `2026-04-04-user-filter` | 一覧のユーザー絞り込み |

---

## Recently Completed
- id: `2026-04-04-viewer-tag-inline`
- title: 投稿タグの inline UI 改善
- status: codex-done

- id: `2026-04-04-viewer-theme`
- title: viewer / settings の UI 調整
- status: codex-done

- id: `2026-04-04-settings-page-split`
- title: 設定ページ分割
- status: codex-done
