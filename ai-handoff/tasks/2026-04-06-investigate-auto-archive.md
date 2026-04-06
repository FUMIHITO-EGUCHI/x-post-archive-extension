# Task Packet — いいね・ブックマーク時の自動保存が動作しない調査

## Goal

「いいね・ブックマーク時に自動アーカイブ」設定を有効にしても保存が行われない、
または期待どおりに動作しない事例を調査し、原因と対策を明確にする。

## Background

`2026-04-04-auto-archive-triggers.md` で実装済み。
設定は `src/types/archive.ts` の `ArchiveSettings` で管理され、デフォルトは `false`。
インターセプターは `x-main.content.ts` (MAIN world) で正しく起動している。

## Known Potential Issues

### 1. 設定が未有効化
- `autoArchiveOnLike` / `autoArchiveOnBookmark` のデフォルトは `false`
- 設定画面から有効にする必要があるが、UI が分かりにくい可能性

### 2. article が DOM に存在しない
- `autoArchivePost()` は `findArticleByPostId(xPostId)` で DOM を検索する
- いいね/ブックマーク時点でその投稿の `article` 要素が DOM に存在しない場合がある
  （例: 通知ページ、プロフィールページ以外からのいいね）
- このケースは `console.warn("[auto-archive] auto-archive-article-not-found", ...)` でログに記録される
- **ユーザー確認**: 普段はタイムラインからいいね/ブックマークしている。タイムラインでは article は
  通常 DOM に存在するため、このケースは発生しにくいはず。別の原因の可能性が高い。

### 3. 設定の読み書きに失敗している
- `loadArchiveSettings()` が例外を投げた場合、ログに記録されて処理が止まる

## Requested Action

1. 実際に設定を有効にして動作確認（CDPデバッグ環境または手動）
2. コンソールログを確認し、上記 3 点のどれが原因かを特定
3. 原因に応じて以下のいずれかを実施:
   - 設定 UI の改善（分かりにくい場合）
   - article が見つからない場合のフォールバック実装（詳細は下記）
   - バグ修正

## Proposed Fix（article が見つからない場合）

article が DOM に存在しない場合のフォールバック案:

**Option A**: 投稿 URL を一時的に開いて再取得する（再取得機能 `2026-04-06-refetch-post.md` と共通化）

**Option B**: like/bookmark 検知時点で article がなければ「保留キュー」に入れる。
その後ユーザーが当該投稿ページに遷移した際に自動保存する。

**Option C**: 現状維持。article がある場合のみ動作し、ない場合はスキップをログに記録する。
ユーザーに「投稿ページを開いた状態でいいねしてください」という制限を明示する。

→ **提案**: まず Option C で動作確認し、制限の許容度を判断する。

## In Scope

- 動作確認と原因特定
- 設定 UI の改善（原因がここにある場合）
- 軽微なバグ修正
- 調査結果の `ai-handoff/findings/` への記録

## Out Of Scope

- article 不在時の完全なフォールバック実装（別タスク化）
- `2026-04-06-refetch-post.md` との統合

## Files to Inspect

- `src/features/x/bootstrap-x-content-script.ts:182-233` — `autoArchivePost` のロジック
- `src/features/settings/archive-settings.ts` — 設定の読み書き
- `src/features/viewer/components/settings-basic-panel.tsx` — 設定 UI

## Result

<!-- 完了後に記入 -->
