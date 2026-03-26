# Implementation Steps

## Step 0: Initial foundation

目的:
WXT / React / Dexie を前提に、以後の実装が迷子にならない骨格を揃える。

成果物:

- entrypoints の分離
- DB スキーマの初期定義
- runtime messaging の最小実装
- viewer の起動確認用 UI
- 基本文書の整備

## Step 1: Save request contract

目的:
保存機能を入れる前に、content script と background 間のメッセージ契約を固める。

想定作業:

- 保存要求メッセージ型の拡張
- 抽出 DTO と保存 DTO の分離
- 失敗時レスポンス方針の整理

## Step 2: X post extraction MVP

目的:
単体投稿の最小抽出を実装する。

想定作業:

- X 専用抽出モジュール作成
- 不安定な DOM 値の正規化
- ハッシュタグ抽出

## Step 3: Persistence MVP

目的:
単体投稿の保存を成立させる。

想定作業:

- background 側保存サービス
- Dexie transaction 導入
- 重複保存ポリシー整理

## Step 4: Viewer MVP

目的:
保存済み一覧と詳細を読めるようにする。

想定作業:

- 一覧 UI
- 詳細 UI
- 保存時点の反応数表示

## Step 5: Search MVP

目的:
検索性を MVP 水準まで引き上げる。

想定作業:

- 本文検索
- 投稿者検索
- タグ検索

## Step 6: Thread MVP

目的:
投稿者本人の返信連投チェーンを扱えるようにする。

想定作業:

- thread 定義に沿った保存
- スレッド順表示
- 単体投稿とスレッド表示の切り分け

