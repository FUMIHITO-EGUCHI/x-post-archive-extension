# AGENTS.md

## Project
X投稿保存・検索用の Chrome 拡張を作る。

## Goal
このプロジェクトの目的は、X の投稿を保存して後から見返しやすくすること。
X の UI を再現することではなく、以下を改善することを重視する。

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

### Snapshot-first
保存済み投稿は「保存時点のスナップショット」として扱う。
原則として、保存後に本文・表示名・ユーザー名・メディア情報・反応数を自動更新しない。

### Thread definition
このプロジェクトでいう「スレッド」は、会話全体ではなく以下を指す。

- 起点投稿に対して
- 投稿者本人が
- 返信で接続している
- 連続投稿チェーン

他人の返信を会話全体として完全保存することは、初期スコープに含めない。

### Search-first
このツールの価値は検索性にある。
保存処理だけでなく、後から探しやすいデータ構造を優先する。

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
- 保存時点の反応数保存
  - reply count
  - like count
  - repost count
  - quote count

### Out of scope for MVP
- X UI の完全再現
- 会話全体の完全保存
- 保存済み投稿の自動更新
- 共有機能
- 高度な推薦機能
- 複雑な自動分類
- 完全自動クローリング

## Future Scope
将来的には以下を検討可能。
- 画像保存
- 動画保存
- 文脈として有用な返信の選択的保存（スレッド本体とは別扱い）
- メディアのローカル保存最適化
- スレッド補完取得
- エクスポート / バックアップ改善

ただし、MVPの完成を優先し、先走って実装しないこと。

## Expected Architecture Direction
技術選定を進める際は、次の方向性を優先的に検討すること。

- Chrome Extension (Manifest V3)
- 投稿やタグや検索用データは構造化して保持する
- 投稿は最小単位として保存する
- スレッドは投稿群のまとまりとして保持する
- 「表示単位」と「保存単位」を混同しない

## Tech Stack
現時点の採用方針は以下とする。

### Core
- Chrome Extension: Manifest V3
- Extension framework: WXT
- Language: TypeScript

### UI
- UI framework: React
- Main UI style: Xの完全再現は行わず、Xライクな情報の見やすさを参考にする
- Main viewer: 拡張ボタン押下で開く別タブの閲覧ページを主画面とする
- Popup: MVPでは主画面としない
- Options page: 必要になった段階で追加する

### Storage
- Main database: IndexedDB
- IndexedDB wrapper: Dexie
- Future media storage: OPFS
- `chrome.storage.local` は主に軽量な設定や一時的な補助用途に限定し、メインDBとしては使わない

### Extension Runtime Roles
- content script:
  - X画面上で動作する
  - 投稿DOMの取得
  - いいね / ブックマーク押下検知
  - 保存対象データの抽出
- service worker:
  - 保存処理の受付
  - メッセージ受信
  - DB操作の起点
- viewer UI:
  - 保存済み投稿一覧
  - 検索
  - 詳細表示
  - スレッド表示
  - タグ管理

### Implementation Policy
- content script と service worker は素の TypeScript を基本とする
- React は閲覧UIに限定して使用する
- 投稿・スレッド・タグ・反応数は IndexedDB で構造化して保持する
- 画像・動画本体は将来的に OPFS で保持できるよう拡張性を持たせる
- 最初からメディア本体保存を前提に複雑化しすぎないこと

### Out of Scope For Initial Setup
初期段階では以下を必須にしない。
- 高度な状態管理ライブラリ
- CSSフレームワークの導入
- 画像・動画本体保存の本実装
- 投稿の自動更新追従
- 会話全体保存

## Data Modeling Principles
データモデルを考える際は以下を守ること。

1. 投稿を最小単位として扱う
2. スレッドは投稿の集合として扱う
3. 単体投稿とスレッドの両方を扱えるようにする
4. タグは自動タグと手動タグを分ける
5. 保存時点の反応数はスナップショットとして保持する
6. 後から検索しやすいことを優先する
7. 将来的な画像・動画対応を見越して拡張しやすくする

## UX Principles
UI 実装時は以下を優先する。

- 見つけやすいこと
- 読みやすいこと
- スレッド順が分かりやすいこと
- 保存時点の文脈が崩れないこと

X 風デザインを模倣する必要はない。

## Implementation Rules
作業時は以下を守ること。

1. いきなり大規模実装を始めない
2. 先に要件整理、MVP定義、データモデル整理を行う
3. 実装は小さい単位に分ける
4. 1ステップごとに目的を明確にする
5. 曖昧なことは推測で埋め切らず、未確定事項として残す
6. MVPに不要な機能は後回しにする
7. 破壊的な変更を避ける
8. ドキュメントを更新しながら進める

## Workflow
作業は原則として次の順で進めること。

1. 現状確認
2. 要件整理
3. MVP定義
4. データモデル整理
5. 画面責務整理
6. 実装ステップ分解
7. 小さく実装
8. 動作確認
9. 必要なら調整

## Deliverables Expected From Agent
新規機能追加、大きめの設計変更、データモデル変更、または実装方針が未確定な作業に入るときは、必要に応じて以下を先に作成・更新すること。

- `docs/requirements.md`
- `docs/mvp-plan.md`
- `docs/data-model.md`
- `docs/implementation-steps.md`

軽微な修正や局所的な変更では、毎回すべてのドキュメント更新を必須にしない。
コード変更前に、少なくとも要求内容と実装順が分かる状態を作ること。

## Decision Priorities
判断に迷ったら、以下の順に優先すること。

1. 検索性
2. 保存時点の再現性
3. データ構造の自然さ
4. 実装の単純さ
5. 見た目の美しさ

## Things To Avoid
- 最初から全部入りにすること
- UI再現に工数を使いすぎること
- 保存済みデータの更新追従を前提に複雑化すること
- 会話全体保存をMVPに含めること
- データモデルを決めずに画面から作り始めること
- 投稿単位とスレッド単位を曖昧にすること

## Notes For The Agent
このプロジェクトでは、実装力だけでなく整理力を重視する。
まず「何を作るか」「何を今は作らないか」を明確にした上で進めること。
大量実装よりも、後戻りしにくい骨格作りを優先すること。

## Git Rules
- このプロジェクトは Git 管理を前提とする
- 作業開始前に現在の Git 状態を確認すること
  - `git status`
  - `git branch --show-current`
- デフォルトブランチへの直接コミットは避け、基本は feature branch で作業すること
- feature branch は 1タスク1ブランチ を基本とし、目的が分かる名前を付けること
  - 例: `feature/viewer-search`, `fix/save-thread-parser`, `docs/mvp-scope`
- 大きめの変更やレビューが必要な変更は pull request / merge request 前提で進めること
- pull request / merge request には目的、変更点、確認方法、未解決事項を簡潔に書くこと
- デフォルトブランチは常にデプロイ可能な状態を保ち、壊れた状態を入れないこと
- 可能ならデフォルトブランチには branch protection を設定し、直接 push・force push・安易な削除を防ぐこと
- このリポジトリでは、agent は `git push` を実行しないこと
- 各タスクの前後で Git チェックポイントを意識すること
- 作業ブランチは長期間放置せず、必要に応じてデフォルトブランチの最新を取り込んで差分を小さく保つこと
- 変更は必ず小さな論理単位に分けること
- 無関係な変更を同じコミットに混ぜないこと
- 1コミット1目的を基本とすること
- コミットメッセージは何を変えたかが一読で分かる件名にすること
- agent が Git 作業を扱うときは、コミット案・コミットメッセージ案・ブランチ作業・マージ作業・バージョン更新作業の説明に `(likes-import)` のような補助ラベルを付けて、対象タスクが識別できるようにすること
- push 済みの共有ブランチで履歴を書き換える操作は慎重に扱い、やむを得ず `--force` を使う場合は `--force-with-lease` を使うこと
- 生成物や依存物をコミットしないこと
  - `node_modules`
  - `.output`
  - `dist`
- ロックファイルは1種類に統一し、複数の package manager のロックファイルを混在させないこと
- コミット前に最低限の確認を行うこと
  - 型エラーがないこと
  - ビルドが通ること
  - 影響範囲が説明できること
- pull request / merge request をマージする前に、レビュー指摘と CI 失敗を解消すること
- ドキュメント変更と実装変更は、可能ならコミットを分けること
- 破壊的変更は避けること
- 迷ったら、先に安全な小変更を行うこと
- release 用の version bump は feature branch 上では行わず、`master` にマージした後に行うこと
- release tag は `master` 上の version bump commit にのみ付けること
- feature branch 上の version bump commit や merge 前の commit に release tag を付けないこと
- version bump を行ったときは、対応する release tag を付けること
- version bump を行ったときは、対応する日本語のリリースノートを `docs/release-notes/` に作成または更新すること
- リリースノートは GitHub Release にそのまま転用できる粒度で、ユーザー向けの変更点を簡潔にまとめること

## Tooling Rules
- 新規セットアップ時は package manager を早い段階で固定し、以後は混在させないこと
- 既存のスクリプトがある場合は、それを優先して使うこと
- 新規セットアップ時は少なくとも以下の scripts を用意することを検討する
  - `dev`
  - `build`
  - `typecheck`
  - `lint`
- lint / format / typecheck の責務を混同しないこと
- 既存設定がない場合でも、勝手に過剰なツールを追加しすぎないこと

## TypeScript Rules
- 実装言語は TypeScript を使用する
- `tsconfig.json` は WXT が生成するベース設定を前提にする
- `strict` を有効前提で進める
- `any` は原則禁止とし、やむを得ない場合のみ理由が説明できる箇所に限定する
- `unknown` を優先し、利用時に明示的に絞り込む
- boxed type を使わないこと
  - `String` ではなく `string`
  - `Number` ではなく `number`
  - `Boolean` ではなく `boolean`
- 型定義を後回しにしないこと
- 保存データ、メッセージ、UI表示用データの型を分けること
- DOM から取得した不安定な値は、そのままアプリ内部型に流し込まず、変換関数を通すこと
- 型アサーションは最小限にとどめること

## WXT / Extension Structure Rules
- WXT を拡張全体の土台として使用する
- file-based entrypoints を前提に構成する
- entrypoint の責務を混在させないこと
- 主な責務は次のように分けること
  - content script: X画面上のDOM取得、イベント検知、抽出
  - service worker: 保存要求の受付、メッセージ処理、DB処理の起点
  - viewer page: 一覧、検索、詳細、スレッド表示
  - options page: 設定（必要時のみ）
- manifest 相当の設定は WXT の流儀に寄せる
- 無理に独自構成へ崩さないこと

## Chrome Extension Rules
- Chrome Extension は Manifest V3 前提で実装する
- background page ではなく service worker を前提にする
- content script はページDOMの読取と最小限の補助UIに責務を絞る
- content script と service worker / viewer 間の通信は messaging を使う
- remote hosted code を使わないこと
- 実行される JavaScript / WASM は必ず拡張パッケージ内に含めること
- 権限は最小限に保つこと
- Xページ固有の取得ロジックは専用モジュールに隔離すること
- DOM セレクタや抽出ルールをアプリ全体に散らさないこと

## React Rules
- React は viewer UI に限定して使用する
- content script と service worker では React を使わない
- Hooks はトップレベルでのみ呼ぶこと
- Hooks を条件分岐、ループ、ネスト内で呼ばないこと
- Hooks は React コンポーネントまたは custom hook からのみ呼ぶこと
- Components and Hooks must be pure を守ること
- コンポーネントに重いデータ整形ロジックを直接書きすぎないこと
- 取得済みデータの整形は selector / mapper / utility に分離すること
- UIコンポーネントと永続化処理を密結合にしないこと
- viewer UI は検索性と可読性を優先すること

## IndexedDB / Dexie Rules
- メインDBは IndexedDB とし、Dexie を利用する
- Dexie のインスタンスは単一モジュールで定義し、アプリ全体で共有する
- DBスキーマ定義は1か所に集約する
- テーブルやインデックスは検索要件を優先して設計する
- 投稿、スレッド、タグ、メディア参照、保存時点の反応数を分けて持つこと
- DBアクセスをUIコンポーネントへ直接散らさないこと
- DB操作は repository / service 層へ寄せること
- Promise を正しく扱うこと
- 複数テーブル更新が意味的に一体なら transaction を検討すること
- 保存時のスナップショット方針を崩さないこと
- 保存済みデータは原則自動更新しない前提で設計すること

## Data / Domain Rules
- 投稿を最小単位として保存する
- スレッドは投稿群のまとまりとして扱う
- スレッドは「投稿者本人の返信連投チェーン」を基本定義とする
- 文脈として有用な返信を将来扱う場合でも、スレッド本体とは別概念として扱うこと
- 自動タグと手動タグを分離する
- 保存時点の反応数はスナップショットとして保持する
- 保存データと表示用データを分離する
- 将来の画像・動画保存を見越して、メディア参照情報を独立して持てるようにする

## Naming / File Organization Rules
- 型定義は `types/` または責務ごとの `*.types.ts` に整理する
- DB 定義は `db/` 配下に集約する
- X固有の取得処理は `features/x/` のような専用領域に閉じ込める
- viewer UI は `features/viewer/` のように機能単位で整理する
- 汎用 utility と X依存処理を混在させないこと
- 「投稿抽出」「保存」「検索」「表示」の責務を分離すること

## Validation Rules
- 実装変更時は、少なくとも次を確認すること
  - TypeScript の型チェック
  - ビルド
  - 影響した画面や処理の動作確認
- 可能なら、確認に使ったコマンドや観点を作業結果に簡潔に残すこと
- 失敗時は、まず小さな原因切り分けを行うこと
- 一度に広範囲を直そうとしないこと
- 実装後は必要に応じて関連ドキュメントも更新すること
