# X Post Archive Extension

[![ci](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/ci.yml)
[![security](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/actions/workflows/security.yml)

Version `0.20.0`

X の投稿を 1 件ずつ保存して、あとから一覧で見返すための Chrome 拡張です。
保存・検索・閲覧に集中し、X クローンではなく個人用アーカイブ兼検索ツールとして機能します。

## Stack

- WXT 0.20.x + Chrome Extension Manifest V3
- TypeScript 5.9.x (strict)
- React 19.1.x（viewer UI のみ）
- IndexedDB / Dexie 4.2.x
- @zip.js/zip.js（バックアップ・復元）

## Features

### 保存
- X 各投稿に保存ボタンを表示し、本文・著者・投稿日時・添付メディアを保存
- 連投（OP の self-reply chain）をスレッド単位で保存。likes import や通常保存中も自動で続編まで揃える
- 引用元投稿の ID とパーマリンクを保存

### 閲覧（viewer）
- 保存日 / 投稿日 / リプライ・リポスト・いいね数 / ランダム順でソート
- タグ・ユーザー・期間・キーワードでフィルター
- スレッドはルート投稿に集約し、インライン展開で全コマを縦に表示
- ライトボックスで画像・動画を全画面表示（i/N、Xコマ目/全Nコマ表示）
- 設定パネルで表示挙動とアクセシビリティを調整

### バックアップ
- アーカイブ全体を zip でエクスポート
- 復元はマージ型（既存レコードを破壊しない）

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run check:content-script-bundle
```

開発時:

```bash
npm run dev
```

Chrome では `.output/chrome-mv3/` を unpacked extension として読み込みます。

## Content-safe Guardrails

- `src/features/x/*` and `src/features/runtime/client.ts` are treated as content-safe modules
- content-safe modules must not import `src/db/archive-database.ts`, `src/db/repositories/*`, or `dexie`
- shared DB constants, types, and pure helpers must live in Dexie-free modules such as `src/db/constants.ts`
- `npm run lint` enforces the import boundary
- `npm run guard:content-scripts` rebuilds and verifies that built content scripts do not contain `Dexie`, `DexieError`, or `U+FFFF`

## One-off Migration

旧 DB `x-post-archive` から現行 DB `x-post-archive-posts-v1` へ移す必要がある場合は、
[legacy DB migration guide](./docs/legacy-db-migration.md) と
[migration script](./scripts/migrate-legacy-posts.js) を使ってください。

## Docs

- [requirements](./docs/requirements.md)
- [mvp-plan](./docs/mvp-plan.md)
- [data-model](./docs/data-model.md)
- [implementation-steps](./docs/implementation-steps.md)
