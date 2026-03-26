# X Post Archive Extension

X の投稿を個人用に保存し、あとから検索しやすくする Chrome 拡張の土台です。
このリポジトリでは、X の UI 再現ではなく、保存・検索・閲覧のための構造化データ基盤を重視します。

## 現在の状態

2026-03-26 時点では、本格実装前の最小構成までを作成しています。

- WXT + TypeScript + React の基本構成
- Manifest V3 前提の entrypoints 整理
- IndexedDB + Dexie を使う前提の最小 DB モジュール
- Popup / Viewer / Background / Content Script の最低限テンプレート
- viewer ページの最小 UI
- 要件 / MVP / データモデル / 実装ステップの初期ドキュメント

まだ入っていないもの:

- X 投稿の実保存
- DOM 抽出ロジックの本実装
- 検索 UI の本実装
- タグ管理 UI の本実装
- メディア保存

## ディレクトリ構成

```text
docs/
  data-model.md
  implementation-steps.md
  mvp-plan.md
  requirements.md
src/
  db/
  entrypoints/
  features/
  types/
```

主な責務:

- `src/entrypoints/background.ts`: service worker。拡張アイコンクリック時に viewer を開く
- `src/entrypoints/popup/`: 最小 popup。viewer を開く導線を持つ
- `src/entrypoints/x.content.ts`: X / Twitter 向け content script の最小エントリ
- `src/entrypoints/viewer/`: React ベースの viewer ページ
- `src/db/`: Dexie のスキーマと repository
- `src/features/`: X 固有処理、runtime messaging、viewer 機能
- `src/types/`: 保存データ型、メッセージ型

## セットアップ

Node.js と npm を入れた上で、以下を実行してください。

```bash
npm install
npm run typecheck
npm run build
```

開発時:

```bash
npm run dev
```

ビルド後に Chrome へ読み込むときは、`.output/chrome-mv3/` を「パッケージ化されていない拡張機能を読み込む」で指定します。
アイコン画像はまだ未追加のため、Chrome では既定アイコン表示になります。

## 依存方針

- Package manager: npm
- Extension framework: WXT
- Language: TypeScript
- UI: React
- Main DB: IndexedDB
- IndexedDB wrapper: Dexie

## 参考ドキュメント

- [requirements](./docs/requirements.md)
- [mvp-plan](./docs/mvp-plan.md)
- [data-model](./docs/data-model.md)
- [implementation-steps](./docs/implementation-steps.md)

