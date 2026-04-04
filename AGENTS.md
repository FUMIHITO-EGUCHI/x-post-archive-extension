# AGENTS.md

## Project
X投稿保存・検索用の Chrome 拡張を作る。

## Goal
X の投稿を保存して後から見返しやすくすることが目的。X の UI 再現ではなく、次を改善する。

- 過去のいいねをたどりにくい
- 保存済み投稿の検索性が低い
- スクリーンショットでは本文検索ができない
- スクリーンショットでは動画を見返せない
- スクリーンショットではスレッドや文脈を追いにくい

## Product Direction
このツールは「Xクローン」ではなく、個人用の投稿アーカイブ兼検索ツールとする。

重視する点:
1. 保存できること
2. 後から探せること
3. 読みやすいこと

重視しない点:
- X の見た目の完全再現
- 細かな SNS 的 UI 表現
- 保存後の最新状態への厳密追従

## Core Concepts
- Snapshot-first: 保存済み投稿は保存時点のスナップショットとして扱い、本文・表示名・ユーザー名・メディア情報・反応数を原則自動更新しない
- Thread definition: このプロジェクトでいうスレッドは、起点投稿に対して投稿者本人が返信で接続している連続投稿チェーンを指す。会話全体の完全保存は初期スコープに含めない
- Search-first: 保存処理だけでなく、後から探しやすいデータ構造を優先する

## Current Scope
### In scope
- 投稿保存
- スレッド保存（投稿者本人の連投チェーン）
- 保存済み一覧
- 詳細表示
- 本文検索
- 投稿者検索
- タグ検索
- ハッシュタグ自動タグ化
- 手動タグ
- 保存時点の反応数保存（reply / like / repost / quote）

### Out of scope for MVP
- X UI の完全再現
- 会話全体の完全保存
- 保存済み投稿の自動更新
- 共有機能
- 高度な推薦機能
- 複雑な自動分類
- 完全自動クローリング

## Architecture Direction
- Chrome Extension は Manifest V3 を前提にし、WXT を土台にする
- 実装言語は TypeScript を使う
- React は閲覧 UI に限定し、content script と service worker は素の TypeScript を基本とする
- Main viewer は拡張ボタン押下で開く別タブの閲覧ページとする。Popup は MVP の主画面にしない
- Main database は IndexedDB + Dexie とし、`chrome.storage.local` は軽量設定や補助用途に限定する
- 将来的なメディア保存は OPFS を前提に拡張できるようにする
- 投稿を最小単位として保存し、スレッドは投稿群のまとまりとして扱う
- X 固有の DOM 取得や抽出ルールは専用領域に隔離し、表示単位と保存単位を混同しない

## Working Rules
- 大きな変更に入る前に、現状確認、要件整理、MVP 定義、データモデル整理、画面責務整理、実装ステップ分解を行う
- 実装は小さな単位に分け、曖昧なことは推測で埋め切らず未確定事項として残す
- 要件、設計、データモデル、実装手順が大きく変わる場合は `docs/requirements.md`、`docs/mvp-plan.md`、`docs/data-model.md`、`docs/implementation-steps.md` を更新する
- 検索性と保存時点の再現性を優先し、保存済みデータの自動更新前提で複雑化しない
- feature branch 前提で作業し、開始前に `git status` と `git branch --show-current` を確認する
- `git push` はユーザーから明示的な指示がある場合にのみ行う
- 実装変更時は少なくとも `npm run typecheck`、`npm run build`、影響した画面や処理の動作確認を行う

## AI Collaboration
- Claude の主担当は計画立案、要件整理、Chrome / X 上の調査、ブラウザ上のデバッグ、DOM / selector / network / event の切り分け
- Codex の主担当は実装、リファクタ、テスト、レビュー、ドキュメント作成、Git 関連作業
- Claude から Codex へ渡す調査結果は、生ログではなく圧縮した結論・根拠・未解決点だけにする
- handoff 前には Goal、In scope、Out of scope、Constraints、Compressed findings、Files to read first、Acceptance criteria、Open questions が分かる状態を目指す
- `ai-handoff/current-task.md` は常に 1 件のアクティブタスクだけを指すダッシュボードとして使う
- `ai-handoff/` は短期的な受け渡しに使い、長期的に残すべき要件・設計・仕様判断は `docs/` に残す

## Decision Priorities
1. 検索性
2. 保存時点の再現性
3. データ構造の自然さ
4. 実装の単純さ
5. 見た目の美しさ

## Things To Avoid
- 最初から全部入りにすること
- UI再現に工数を使いすぎること
- 保存済みデータの更新追従を前提に複雑化すること
- 会話全体保存を MVP に含めること
- データモデルを決めずに画面から作り始めること
- 投稿単位とスレッド単位を曖昧にすること
