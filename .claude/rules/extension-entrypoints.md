---
paths:
  - src/entrypoints/**/*.ts
  - src/entrypoints/**/*.tsx
  - src/features/runtime/**/*.ts
  - src/features/x/**/*.ts
  - wxt.config.ts
---

# WXT / EntryPoint Rules

- WXT を拡張全体の土台として使い、file-based entrypoints を前提に構成する
- entrypoint の責務を混在させない
- `x.content` は X 画面上の DOM 取得、イベント検知、最小限の補助 UI に絞る
- `background` は Manifest V3 の service worker として、保存要求の受付、メッセージ処理、DB 操作の起点を担う
- viewer page は保存済み投稿の一覧、検索、詳細、スレッド表示を担う
- content script と background / viewer 間の通信は messaging を使う
- X 固有の DOM セレクタや抽出ルールは `src/features/x/` に閉じ込め、他レイヤーへ散らさない
- manifest 相当の設定は WXT の流儀に寄せ、独自構成へ崩しすぎない
- remote hosted code は使わない。実行コードは拡張パッケージ内に含める
- 権限は最小限に保つ
