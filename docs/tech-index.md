# Tech Index

この文書は、このリポジトリの技術情報を毎回広く読み直さずに済むようにするための正式な索引です。
詳細仕様を書き直す場ではなく、「どの話題ならどのファイルを先に読むか」を短く示すために使います。

## Usage Rules
- まず `ai-handoff/current-task.md` と task packet があればそちらを優先する
- task packet に `Files To Read First` がない、または広すぎる場合はこの文書から入る
- ここに載っているファイルを毎回全部読む前提にしない。今のタスクに関係する行だけを開く
- 長期的な仕様判断は `docs/requirements.md` や `docs/data-model.md` を参照する
- 実装ルールと AI 協業ルールは `AGENTS.md` を正とする

## Core Rules And Workflow
- 全体方針: `AGENTS.md`
- Claude 専用運用: `CLAUDE.md`
- handoff の使い方: `ai-handoff/README.md`
- 現在の作業起点: `ai-handoff/current-task.md`

## Tooling And Build
- パッケージと scripts: `package.json`
- WXT 設定: `wxt.config.ts`
- TypeScript 設定: `tsconfig.json`

主要コマンド:
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run zip`

## Runtime Map

### Extension entrypoints
- `src/entrypoints/x.content.ts`
  - X / Twitter ページで動く isolated world 側 entrypoint
- `src/entrypoints/x-main.content.ts`
  - X ページの main world 側 entrypoint
  - fetch / XHR 傍受系の動画候補取得はこちら
- `src/entrypoints/background.ts`
  - service worker entrypoint
  - runtime message の受付と再開処理の起点
- `src/entrypoints/viewer/main.tsx`
  - viewer UI の React entrypoint
- `src/entrypoints/viewer/index.html`
  - viewer ページ本体
- `src/entrypoints/viewer/style.css`
  - viewer スタイル

### Runtime messaging
- `src/types/runtime.ts`
  - runtime message / response の型
- `src/features/runtime/client.ts`
  - content script / viewer から background へ送るクライアント
- `src/features/runtime/handle-runtime-message.ts`
  - background 側の message dispatcher

### Content-safe boundary
- `src/features/x/*`
  - content-safe 螻暮幕
  - Dexie / `src/db/archive-database.ts` / `src/db/repositories/*` 繧貞性縺溘↑縺・
- `src/features/runtime/client.ts`
  - content-safe 螻暮幕
  - runtime message client 縺ｨ Dexie-free helper 縺ｮ縺ｿ繧剃ｽｿ縺・
- `src/db/constants.ts`
  - content-safe 側縺九ｉ蜿ｯ逕ｨ縺励※繧医＞ DB 螳夂ｾｩ / 縺昴・莉倥・ Dexie-free 螳壽焚
- `src/db/archive-database.ts`
  - Dexie schema / singleton
  - content-safe 螻暮幕縺九ｉ import 禁豁｣

## Domain And Storage

### Core types
- `src/types/archive.ts`
  - 投稿、メディア、タグ、保存入力の主要型
- `src/types/viewer.ts`
  - viewer の一覧 / 集計 / ページング型
- `src/types/logger.ts`
  - ログ型

### Database
- `src/db/archive-database.ts`
  - Dexie インスタンスと schema version 定義
  - `posts`, `media`, `tags`, `post_tags`, `logs` の起点
- `src/db/repositories/posts-repository.ts`
  - 投稿テーブル操作
- `src/db/repositories/media-repository.ts`
  - メディアテーブル操作
- `src/db/repositories/tags-repository.ts`
  - タグ本体操作
- `src/db/repositories/post-tags-repository.ts`
  - 投稿とタグの関連操作
- `src/db/repositories/logs-repository.ts`
  - ログ保存 / 参照 / クリア

### Archive services
- `src/features/archive/archive-service.ts`
  - 保存、一覧、タグ更新、削除、media persistence の中核
- `src/features/archive/archive-maintenance-service.ts`
  - export / import / reset などの保守系処理
- `src/features/media-storage/opfs-media-storage.ts`
  - OPFS の read / write / delete

## X Integration

### Content bootstrap and save flow
- `src/features/x/bootstrap-x-content-script.ts`
  - X ページ側初期化
- `src/features/x/find-tweet-articles.ts`
  - 投稿 article の列挙
- `src/features/x/inject-save-button.ts`
  - 保存 UI 注入
- `src/features/x/extract-post-from-article.ts`
  - article から保存用データを抽出
  - 本文、表示名、絵文字、画像、反応数の抽出を見るときはまずここ

### Likes import and media hints
- `src/features/x/likes-import-controls.ts`
  - likes 一括取得 UI と収集フロー
- `src/features/x/graphql-video-candidates.ts`
  - GraphQL 由来の動画候補整形
- `src/features/x/graphql-video-candidate-cache.ts`
  - 動画候補キャッシュ
- `src/features/x/install-graphql-video-response-observer.ts`
  - main world からの動画レスポンス観測
- `src/features/x/graphql-video-events.ts`
  - 動画候補イベント連携

## Viewer UI
- `src/features/viewer/components/viewer-app.tsx`
  - 一覧、詳細、タグ絞り込み、設定画面の中心
- `src/features/viewer/viewer-session-storage.ts`
  - viewer のページング / フィルタ復元
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
  - バックアップ、復元、全削除 UI
- `src/features/viewer/components/settings-log-panel.tsx`
  - ログの確認 / クリア UI

## Settings And Logging
- `src/features/settings/archive-language.ts`
  - 言語設定と built-in tag 名の解決
- `src/features/debug/debug-settings.ts`
  - inspect post IDs などの debug 設定取得
- `src/features/logging/logger.ts`
  - アプリ内 logger

## Scripts And Diagnostics
- `scripts/debug-likes-dom-scan.js`
  - likes ページの DOM 断面を確認する
- `scripts/debug-archive-db-summary.js`
  - IndexedDB / media 状態の要約を見る
- `scripts/debug-archive-log-report.js`
  - 保存ログの要約を見る
- `scripts/migrate-legacy-posts.js`
  - 旧データ移行用スクリプト

## Long-Lived Docs
- `docs/requirements.md`
  - 何を作るか / 作らないか
- `docs/mvp-plan.md`
  - MVP スコープ
- `docs/data-model.md`
  - データモデルの判断
- `docs/implementation-steps.md`
  - 実装ステップの履歴と方針
- `docs/future-features.md`
  - 将来スコープ
- `docs/logger-granularity.md`
  - ログ粒度の整理
- `docs/viewer-session-pagination.md`
  - viewer の復元 / ページング方針
- `docs/legacy-db-migration.md`
  - 旧 DB 移行
- `docs/like-import-requirements.md`
  - likes import の要件
- `docs/likes-import-handover-2026-04-01.md`
  - likes import 不具合の継続調査メモ

## Read-First Matrix

### 1. 保存フロー全体を追いたい
- `src/features/x/bootstrap-x-content-script.ts`
- `src/features/x/inject-save-button.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/runtime/client.ts`
- `src/features/runtime/handle-runtime-message.ts`
- `src/features/archive/archive-service.ts`

### 2. 絵文字や本文が欠ける
- `src/features/x/extract-post-from-article.ts`
- `src/types/archive.ts`
- `src/features/archive/archive-service.ts`
- `src/features/viewer/components/viewer-app.tsx`

見る観点:
- X DOM から抽出時点で欠けているか
- `SavePostInput` に残っているか
- DB 保存後に変質していないか
- viewer 表示だけの問題か

### 3. likes import が壊れている
- `docs/likes-import-handover-2026-04-01.md`
- `src/features/x/likes-import-controls.ts`
- `src/features/x/extract-post-from-article.ts`
- `src/features/archive/archive-service.ts`
- `scripts/debug-likes-dom-scan.js`
- `scripts/debug-archive-db-summary.js`
- `scripts/debug-archive-log-report.js`

### 4. 画像や動画が保存されない
- `src/features/x/extract-post-from-article.ts`
- `src/features/x/graphql-video-candidates.ts`
- `src/features/archive/archive-service.ts`
- `src/db/repositories/media-repository.ts`
- `src/features/media-storage/opfs-media-storage.ts`

### 5. タグ付けや絞り込みが壊れている
- `src/features/archive/archive-service.ts`
- `src/db/repositories/tags-repository.ts`
- `src/db/repositories/post-tags-repository.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/settings/archive-language.ts`

### 6. viewer の一覧、ページング、復元がおかしい
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/viewer-session-storage.ts`
- `src/types/viewer.ts`
- `docs/viewer-session-pagination.md`

### 7. バックアップ / 復元 / 全削除まわり
- `src/features/archive/archive-maintenance-service.ts`
- `src/features/viewer/components/settings-archive-maintenance-panel.tsx`
- `src/types/archive-backup.ts`

### 8. DB schema や migration の影響を見たい
- `src/db/archive-database.ts`
- `src/types/archive.ts`
- `docs/data-model.md`
- `docs/legacy-db-migration.md`

### 9. ログや debug の使い方を見たい
- `src/features/logging/logger.ts`
- `src/db/repositories/logs-repository.ts`
- `src/features/debug/debug-settings.ts`
- `docs/logger-granularity.md`

## Keep This File Small
- この文書にロジック詳細や schema 詳細を増やしすぎない
- 新しい主要モジュールを足したときだけ索引を更新する
- 詳細説明を増やしたくなったら、まず既存の `docs/` に寄せる
