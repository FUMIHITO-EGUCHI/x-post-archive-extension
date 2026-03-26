# Requirements

## 背景

X の過去投稿、いいね、保存済み投稿は後から探しにくい。
スクリーンショット保存では本文検索やスレッド追跡が弱く、動画も扱いづらい。

## プロダクト目的

この拡張は、X 投稿の個人用アーカイブ兼検索ツールを作るためのものとする。
目的は以下の 3 点。

1. 保存できること
2. 後から探せること
3. 読みやすいこと

## 今回の作業スコープ

今回は本格実装ではなく、以下の初期土台のみを対象とする。

- WXT + TypeScript + React の最小構成
- Manifest V3 前提の entrypoints 整理
- IndexedDB + Dexie を使う前提の DB 骨格
- viewer ページの最小表示
- 実装前提を揃えるドキュメント作成

## 今回やらないこと

- X 投稿の保存処理本実装
- X DOM 抽出の本実装
- 検索機能の本実装
- タグ付け UI の本実装
- メディア保存
- 自動更新追従

## 非機能要件

- Chrome Extension Manifest V3 前提
- TypeScript `strict` 前提
- React は viewer UI に限定
- content script と service worker は素の TypeScript を基本とする
- メイン DB は IndexedDB、ラッパーは Dexie
- データモデルは検索性優先で構造化する

## 初期成果物

- `package.json` / `wxt.config.ts` / `tsconfig.json`
- `src/entrypoints/` 配下の最小 entrypoints
- `src/db/` の Dexie ベーススキーマ
- `src/types/` の保存データ型とメッセージ型
- `docs/` 配下の初期整理ドキュメント

## 制約

- 大量実装を避ける
- 後戻りしにくい骨格を優先する
- まだ未確定な仕様は docs 上で明示する
- package manager は npm を前提とする

