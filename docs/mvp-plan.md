# MVP Plan

## MVP の対象

このプロジェクトの MVP では、以下を目指す。

- X 投稿を保存できる
- 保存済み投稿を一覧できる
- 本文・投稿者・タグで検索できる
- 保存時点のスナップショットを読める
- 投稿者本人の返信連投チェーンをスレッドとして見られる

## MVP に含める主要機能

1. 投稿保存
2. スレッド保存
3. 保存済み一覧
4. 詳細表示
5. 本文検索
6. 投稿者検索
7. 自動タグと手動タグ
8. 保存時点の反応数保存

## MVP 以前の初期セットアップ段階

今回完了させるのは、MVP 実装前の準備段階。

- WXT の土台
- entrypoints の責務分離
- Dexie スキーマの初期定義
- runtime messaging の最小配線
- viewer ページの最小起動確認用 UI

## MVP 到達までの段階案

### Phase 0: Foundation

- プロジェクト初期化
- ドキュメント整理
- DB スキーマの素案確定

### Phase 1: Save pipeline

- X 画面から保存対象の最小抽出
- content script から background への保存要求
- background から Dexie への保存

### Phase 2: Viewer baseline

- 保存済み一覧
- 詳細表示
- 保存時点のメタ情報表示

### Phase 3: Search baseline

- 本文検索
- 投稿者検索
- タグ検索

### Phase 4: Thread handling

- 投稿者本人の返信連投チェーンの保存
- スレッド単位表示

## 未確定事項

- 保存トリガーの初期 UX
  - いいね検知
  - ブックマーク検知
  - 手動保存 UI
- X DOM の抽出戦略
- 検索 UI の優先順位

