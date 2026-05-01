# x-post-archive-extension

X（旧Twitter）投稿を1件ずつ保存・検索する Chrome 拡張（Manifest V3）。X クローンではなく、個人用アーカイブ兼検索ツールとして、検索性と保存時点の再現性を優先する。

## 技術スタック
- WXT 0.20.11 + Chrome Extension Manifest V3 + React 19.1.1
- TypeScript 5.9.2 (strict)
- Dexie 4.2.0, React DOM 19.1.1, @wxt-dev/module-react 1.1.5, @zip.js/zip.js 2.8.23

## コマンド
| コマンド | 用途 |
|---|---|
| `npm run dev` | WXT 開発サーバー |
| `npm run build` | 拡張ビルド |
| `npm run typecheck` | 型チェック |
| `npm run zip` | 配布用 zip 作成 |

テストと lint は未設定。完了報告前は `npm run typecheck` と `npm run build`、必要な手動確認を行う。

## タスク管理（AI handoff）

タスクは **GitHub Issues + Projects v2** で管理する。旧 `ai-handoff/tasks/` のファイル運用は廃止した。

- 作業開始時: Issue を選んで `status: in-progress` ラベルを付ける
- 作業中: Issue コメントに逐次追記。本文は objective / scope / checklist のみ編集
- 完了申請: `status: ready-for-close` ラベル + `## Result` / `## Verification` / `## Changed files` を含むコメント
- **close は人間のみ**。AI は close しない
- commit message は `#<issue>` を必須（雑務は `[skip-issue]`）。`commit-msg` hook が強制
- AI 間 handoff は `docs/handoff/README.md` の雛形に従う

詳細は `docs/handoff/README.md` を参照。AI 実行制御（GitHub Actions ルーティング、`model:` ラベル運用、コスト管理）は `docs/handoff/ai-execution.md`。移行判断の背景は `docs/decisions/0001-task-management-on-github-issues.md`。

- Issue 作成時に `model:` ラベル（`cheap-ok` / `standard` / `strong-required`）を1つ付与。判断材料は `task.yml` の "強いモデルを要する兆候" チェックボックス（Dexie スキーマ変更・認可・state管理 等）

## ディレクトリ構造
| パス | 役割 |
|---|---|
| `src/entrypoints/` | background、content script、viewer のエントリ |
| `src/features/x/` | X 固有の DOM 取得、抽出、保存導線 |
| `src/features/viewer/` | 閲覧 UI |
| `src/db/` | Dexie スキーマ、repository |
| `src/types/` | ドメイン型、メッセージ型 |
| `docs/handoff/` | AI handoff（Issue ベース）の運用ガイド |
| `ai-handoff/archive/` | 旧 handoff 運用の履歴アーカイブ（read-only） |

## 行動原則
- 3ステップ以上のタスクは、実装前に目的・手順・未確定事項を整理する
- 関連ファイルと既存実装を読まずにコードを書かない
- 変更は小さく保ち、保存単位と表示単位を混同しない
- viewer UI にのみ React を使い、content script / background は素の TypeScript を維持する
- X UI の再現より、保存・検索・可読性を優先する
- 不確実な情報は未確認と明示し、公式ドキュメントかソースコードで裏取りする
- Claude の主担当は要件整理、調査、ブラウザデバッグ。大きな実装は Codex へ渡しやすい形に整理する

詳細な path-scoped ルールは `.claude/rules/` を参照。
