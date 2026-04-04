# Current Task

## Active Task
- id: 2026-04-04-settings-page-split
- title: 設定画面のページ分割（基本設定／タグ管理／バックアップ／アプリログ）
- owner: Codex
- status: ready
- task file: `ai-handoff/tasks/2026-04-04-settings-page-split.md`

## Goal

設定画面を 4 つのタブページに分割し、タブナビゲーションで切り替えられるようにする。
設定ボタン押下時は「基本設定」タブを初期表示する。

## Status Summary

要件確定済み。実装待ち。

### 確定済み要件

- 設定ボタン → `settings/basic`（基本設定）を初期タブとして表示
- タブ構成: 基本設定・タグ管理・バックアップ・アプリログ
- `SettingsTab` 型を追加、`ViewerScreen` 型はそのまま
- 基本設定の inline JSX を `settings-basic-panel.tsx` に抽出
- `FontSizeOption` / `StorageEstimateState` を `src/types/viewer.ts` に移動

## Next Action

task packet に従い実装・型チェック・ビルド確認まで行う。

## Related Docs

- `ai-handoff/tasks/2026-04-04-settings-page-split.md`

---

## 前タスク（完了済み）

- id: 2026-04-04-tag-management-feature
- title: タグ管理機能（リネーム・マージ）
- status: codex-done
- task file: `ai-handoff/tasks/2026-04-04-tag-management-feature.md`

- id: 2026-04-02-quoted-post-feature
- title: 引用投稿機能の実装
- status: codex-done
- task file: `ai-handoff/tasks/2026-04-02-quoted-post-feature.md`
- related findings: `ai-handoff/findings/2026-04-02-quoted-post-feature.md`
