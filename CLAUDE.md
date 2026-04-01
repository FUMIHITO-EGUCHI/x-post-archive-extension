# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

X（旧Twitter）投稿を1件ずつ保存・検索するための Chrome 拡張（Manifest V3）。「X クローン」ではなく、個人用アーカイブ兼検索ツール。スナップショット保存が基本方針で、保存後の自動更新は行わない。

## コマンド

```bash
npm install          # 依存インストール
npm run dev          # 開発用（WXT dev server）
npm run build        # ビルド → .output/chrome-mv3/
npm run typecheck    # 型チェック（コミット前に必ず実行）
npm run zip          # リリース用 zip 作成
```

Chrome では `.output/chrome-mv3/` を unpacked extension として読み込む。テストコマンドは未設定（手動確認）。

## アーキテクチャ

3層構成で、各層間は chrome.runtime.sendMessage で通信する。

```
content script (X.com DOM)
    ↓ chrome.runtime.sendMessage
service worker (background)
    ↓ Dexie / OPFS
IndexedDB + OPFS
    ↑
viewer UI (React, 別タブ)
```

### 各エントリポイントの役割

| ファイル | 役割 |
|---|---|
| `src/entrypoints/x.content.ts` | X.com で動作（isolated world）。DOM 監視・ボタン注入・メッセージ送信 |
| `src/entrypoints/x-main.content.ts` | X.com で動作（main world）。fetch/XHR を傍受して動画 GraphQL レスポンスを取得 |
| `src/entrypoints/background.ts` | Service worker。メッセージ受付・DB 操作の起点。拡張アイコンクリックでビューワーを開く |
| `src/entrypoints/viewer/main.tsx` | 閲覧UI（React）。一覧・検索・タグ管理・設定 |

2つのコンテンツスクリプトが必要な理由: isolated world からはページの `fetch` を傍受できないため、main world 側で XHR/fetch monkey-patch を行い、カスタムイベント経由で isolated world に動画候補を渡す。

### データフロー（投稿保存）

1. `bootstrap-x-content-script.ts` が DOM を監視し、投稿ごとに保存ボタンを注入
2. ボタンクリック → `extract-post-from-article.ts` で DOM から投稿データを抽出
3. `client.ts` が `posts/save` メッセージを送信（タイムアウト 180秒）
4. `handle-runtime-message.ts` が受け取り → `archive-service.ts` で保存処理
5. `archive-service.ts` が DB に PostRecord を書き込み、バックグラウンドでメディアを OPFS に保存

### データフロー（動画取得）

1. `x-main.content.ts` が `window.fetch` と `XMLHttpRequest` を monkey-patch
2. `/i/api/graphql/` レスポンスを傍受し `graphql-video-candidates.ts` で動画候補を抽出
3. カスタムイベント経由で isolated world のコンテンツスクリプトに通知
4. 保存時に動画候補（direct_mp4 優先、HLS フォールバック）を PostRecord に含める

### ストレージ構成

- **IndexedDB（Dexie）**: `src/db/archive-database.ts` に単一インスタンスで定義（v1〜v9）
- **OPFS**: 画像・動画バイナリ。パス構成: `/media/images|videos/{x_post_id}/{media_id}.bin`、動画サムネイル: `/media/video-previews/{x_post_id}/{media_id}.jpg`
- **chrome.storage.local**: 言語設定・セッション状態など軽量設定のみ

DB テーブル: `posts`, `media`, `tags`, `post_tags`, `logs`

DB アクセスは `src/db/repositories/` のリポジトリ層に集約し、UI コンポーネントから直接触らない。

### DB スキーマ（主要インデックス）

| テーブル | 主キー | インデックス |
|---|---|---|
| posts | `&x_post_id` | `saved_at`, `posted_at`, `reply_count`, `repost_count`, `like_count`, `display_name` |
| media | `&media_id` | `x_post_id`, `[x_post_id+position]`, `storage_status`, `saved_at` |
| tags | `&tag_id` | `&normalized_name`, `display_name`, `created_at`, `system_key` |
| post_tags | `&post_tag_id` | `x_post_id`, `tag_id`, `[x_post_id+normalized_name]`, `source`, `system_key` |
| logs | `&log_id` | `created_at`, `level`, `[level+created_at]`, `scope`, `event`, `request_id` |

### メッセージプロトコル

型定義は `src/types/runtime.ts`。送信は `features/runtime/client.ts`、受信は `features/runtime/handle-runtime-message.ts`。

対応メッセージ: `posts/save`, `posts/save-batch`, `posts/has`, `posts/list`, `posts/list-page`, `posts/delete`, `posts/tags/add`, `posts/tags/remove`, `posts/summary`, `logs/clear`, `debug/log`

### タグの種類

- **システムタグ** (`system_key` あり): `liked`（いいね）、`image`（画像あり）、`video`（動画あり）。ビルトインで多言語ラベルを持つ
- **自動タグ** (`source: "auto"`): ハッシュタグ等を自動抽出。後から手動タグに変更可
- **手動タグ** (`source: "manual"`): ユーザーが明示的に付与

### feature モジュール一覧

| パス | 役割 |
|---|---|
| `features/archive/archive-service.ts` | 保存・取得・削除・タグ管理のコアロジック |
| `features/archive/archive-maintenance-service.ts` | バックアップ/リストア（ZIP ストリーミング）・クリア・リセット |
| `features/x/bootstrap-x-content-script.ts` | コンテンツスクリプトのメイン処理（DOM 監視・ボタン注入） |
| `features/x/extract-post-from-article.ts` | DOM から SavePostInput を生成 |
| `features/x/graphql-video-candidates.ts` | GraphQL レスポンスから動画候補を抽出・スコアリング |
| `features/x/install-graphql-video-response-observer.ts` | fetch/XHR monkey-patch でレスポンス傍受 |
| `features/x/inject-save-button.ts` | 保存ボタンの生成・状態管理（idle/saving/saved/error） |
| `features/x/likes-import-controls.ts` | いいね一括取得 UI（自動スクロール・バッチ保存） |
| `features/media-storage/opfs-media-storage.ts` | OPFS ファイル I/O 抽象化 |
| `features/logging/logger.ts` | 構造化ロガー。Dexie に保存、最大 2000 件、自動 prune |
| `features/runtime/client.ts` | Service Worker へのメッセージ送信ラッパー（タイムアウト付き） |
| `features/runtime/handle-runtime-message.ts` | メッセージ受信・ルーティング |
| `features/settings/archive-language.ts` | 言語設定の保存・読み込み・デフォルト検出 |
| `features/viewer/viewer-session-storage.ts` | ビューワーのフィルタ・ソート・スクロール位置の永続化 |
| `features/debug/debug-settings.ts` | デバッグ用ポスト ID 読み込み（storage/localStorage/URL） |

## 実装ルール（重要）

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- `any` は原則禁止（`unknown` + 型ガードを使う）
- Boxed type 禁止（`String` ではなく `string`）
- DOM から取得した値は変換関数を通してから内部型に流す

### React
- **viewer UI にのみ使用**。content script と service worker では使わない
- データ整形ロジックをコンポーネントに直接書かず、mapper/utility に分離する

### 設計方針
- 「表示単位」と「保存単位」を混同しない
- 自動タグ（ハッシュタグ等）と手動タグを分離する
- X 固有の DOM 取得ロジックは `features/x/` に閉じ込め、他に散らさない
- 複数テーブルへの意味的に一体の更新は Dexie のトランザクションを使う
- メディアの OPFS 書き込みは非同期バックグラウンド処理。保存完了を待たずに PostRecord を DB に書く
- Service Worker 再起動時に `resumePendingMediaPersistence()` で未完了メディアを最大 24 件リトライ

## Git ルール

- `master` への直接コミットは避ける。feature branch で作業する（例: `feature/viewer-search`）
- コミット前に `npm run typecheck` と `npm run build` が通ることを確認する
- `git push` はユーザーから明示的な指示がある場合にのみ行う
- Git 作業のコミット件名や提案では `docs(likes-import): ...` や `feat(likes-import): ...` のように、種別の直後に補助ラベルを付ける
- ドキュメント変更と実装変更はコミットを分ける
- version bump は `master` マージ後に行い、対応するリリースノートを `docs/release-notes/` に作成する
- `git push` を行う場合は、対応する release tag の作成とリリースノート更新まで同じ作業で完了させる

## 大きな変更前の作業順

新機能・データモデル変更・設計変更に入る前は以下のドキュメントを先に整理する:
- `docs/requirements.md`
- `docs/mvp-plan.md`
- `docs/data-model.md`
- `docs/implementation-steps.md`

軽微な修正では毎回全ドキュメント更新は不要。

## 判断優先順位

迷ったら: 検索性 → 保存時点の再現性 → データ構造の自然さ → 実装の単純さ → 見た目
