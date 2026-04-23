# SPEC: AI 間タスク管理（GitHub Issues ベース）

- Status: Draft (awaiting human approval)
- Author: Claude
- Date: 2026-04-22
- Supersedes: `ai-handoff/` のタスクファイル運用（`ai-handoff/README.md`, `.claude/rules/handoff.md`）

---

## 1. Objective

### 背景と課題

現行の `ai-handoff/` 運用には以下の構造的問題がある。

1. **ブランチ差分の汚染** — `ai-handoff/tasks/*.md` の編集が feature ブランチに混ざり、マージ順でタスクの更新内容が取りこぼされる。
2. **状態遷移が見えにくい** — `current-task.md` は 1 件しか指さず、todo / in-progress / blocked / done の複数タスク横断ビューがない。
3. **同時編集の衝突** — Claude と Codex が同一 task packet を編集すると上書きが起きる。
4. **タスクの見失い** — 作成した packet 自体を忘れる／見失う。
5. **現物 UI の欠如** — 人間が「今何が進行中で何が詰まっているか」を一目で把握する手段がない。

### ゴール

- タスク管理を**リポジトリのファイルから切り離し**、GitHub Issues を single source of truth にする。
- AI（Claude / Codex）は MCP 経由で Issue を CRUD する。
- 人間は **GitHub Projects（v2）ボード**で状態を一目で把握する。
- 完了の証跡（typecheck / build の出力）は Issue コメントに残す。
- commit と Issue を相互リンクし、コード変更とタスクのトレーサビリティを保つ。

### Non-goals

- Issue と code の自動同期（AI の運用規律で十分）
- 過去 done タスクの全件移行（`ai-handoff/archive/` に残す）
- 有料 SaaS の利用

### Target users

- AI agents: Claude Code, Codex（どちらも task CRUD を行う）
- 人間: リポジトリオーナー 1 名（承認・close 権限を持つ）

---

## 2. Commands / Interfaces

### AI → GitHub Issues（`gh` CLI）

AI の GitHub 操作は `gh` CLI に一本化する（ADR-0002）。トークン消費と設定管理コストを抑えるため MCP サーバーは使わない。

AI が使う代表的オペレーション:

| 操作 | gh CLI |
|---|---|
| タスク作成 | `gh issue create --title ... --body ... --label ...` |
| ステータス変更 | `gh issue edit <n> --add-label ... --remove-label ...` |
| Work Log 追記 | `gh issue comment <n> --body ...` |
| 担当変更 | `gh issue edit <n> --add-label 'owner: <name>'` |
| 完了（AI による完了申請） | `gh issue edit <n> --add-label 'status: ready-for-close'` + `gh issue comment ...` |
| close（人間のみ） | `gh issue close <n>` |
| 検索 | `gh issue list --search ... --json number,title,labels` |
| Projects v2 の細部 | `gh api graphql -f query=...` |

### 人間向けビュー

- GitHub Projects v2 ボード「X Archive Handoff」
  - Columns: `Todo` / `In Progress` / `Blocked` / `Ready for Close` / `Done`
  - Group by: `owner` ラベル
  - Filter: `priority` ラベル

### Git hook

`pre-commit` hook を以下に書き換える:

- commit message に `#\d+` が含まれることを強制
- escape: `[skip-issue]` または `#0` で回避可能

### npm scripts（残すもの・消すもの）

| コマンド | 扱い |
|---|---|
| `npm run handoff:sync` | **削除** |
| `npm run handoff:log-changes` | **削除** |
| `npm run handoff:check` | **削除** |
| `npm run handoff:migrate` | **新規**: `ai-handoff/tasks/*.md` のうち status が active/waiting のものを一括で Issue 化 |

### 移行スクリプト詳細（`scripts/handoff-migrate.ts`）

- 入力: `ai-handoff/tasks/*.md` のうち Meta.status が `active` または `waiting` のもの
- 処理:
  1. packet を Issue 化（title = packet の H1、body = packet 全文、labels = Meta から自動マップ）
  2. 成功した packet は `ai-handoff/archive/migrated/` へ移動
  3. findings のうち active タスクから参照されているものを Gist 化し、Issue 本文にリンクを差し込む
- 出力: 移行結果レポート `ai-handoff/archive/migration-report.md`

---

## 3. Project Structure

### 変更後のディレクトリ

```
x-post-archive-extension/
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── task.yml            # 新規: タスク用フォーム
│       ├── investigation.yml   # 新規: 調査タスク用フォーム
│       └── bug.yml             # 新規
├── .husky/ or .git/hooks/
│   └── pre-commit              # 書き換え: commit message #<issue> 強制
├── scripts/
│   └── handoff-migrate.ts      # 新規: 一度きりの移行スクリプト
├── ai-handoff/                 # 縮小（移行後）
│   └── archive/
│       ├── tasks/              # 旧 tasks/ の done 分を移動
│       ├── migrated/           # 移行済み active/waiting の原本
│       └── migration-report.md
├── docs/
│   └── handoff/
│       └── README.md           # 新規: Issue ベース運用ガイド（旧 ai-handoff/README.md を置換）
└── CLAUDE.md                   # 更新: handoff セクション書き換え
```

### 削除対象

- `ai-handoff/current-task.md`
- `ai-handoff/tasks/`（archive へ退避後、本体は空に）
- `ai-handoff/findings/`（Gist へ移行後、ローカルは archive へ）
- `ai-handoff/templates/`
- `.claude/rules/handoff.md`（Issue 運用版に書き換え）
- `scripts/handoff-sync.*`, `scripts/handoff-check.*`, `scripts/handoff-log-changes.*`（存在するもの）

### Labels 体系

| Category | 値 |
|---|---|
| `status:` | `todo`, `in-progress`, `blocked`, `ready-for-close` |
| `owner:` | `claude`, `codex`, `human` |
| `priority:` | `high`, `medium`, `low` |
| `type:` | `feature`, `bug`, `investigation`, `refactor` |
| `area:` | `viewer`, `content`, `background`, `db`, `handoff`, `other` |

`status: done` ラベルは使わず、close 状態を「done」とみなす（`ready-for-close` からの close は人間のみ）。

### Issue body テンプレート（task.yml）

```yaml
name: Task
description: AI 向けタスク packet
labels: ["status: todo"]
body:
  - type: textarea
    id: objective
    attributes: { label: Objective, description: このタスクで達成したいこと }
    validations: { required: true }
  - type: textarea
    id: scope
    attributes: { label: Scope / Files in scope }
  - type: textarea
    id: checklist
    attributes: { label: Checklist, value: "- [ ] " }
  - type: textarea
    id: acceptance
    attributes: { label: Acceptance criteria }
  - type: textarea
    id: notes
    attributes: { label: Notes / Links }
```

---

## 4. Code Style / Operational Rules

### AI の Issue 操作ルール

1. **作業開始時**: 担当 Issue に `status: in-progress` を付与し、owner を自分に set。
2. **作業中の追記**: 意味のあるステップごとに `add_issue_comment`。コメント先頭に `YYYY-MM-DD <AI名>:` を付ける。
3. **ブロック時**: `status: in-progress` を外し `status: blocked` を付け、ブロック理由をコメント。
4. **完了申請**: `status: in-progress` を外し `status: ready-for-close` を付け、以下を含む 1 コメントを投稿:
   - `## Result` — 実装内容の要約
   - `## Verification` — `npm run typecheck` と `npm run build` の出力（全文 or 末尾 20 行）
   - `## Changed Files` — `git diff --name-only <base>..HEAD` の結果
5. **close は人間のみ**。AI は絶対に close しない。
6. **Issue の直接編集は最小限**。本文（body）は objective / scope / checklist のメンテナンスのみ。それ以外の経過は comment で表現。
7. **同時編集防止**: 作業前に owner ラベルを確認し、他 AI が in-progress 中なら着手しない。
8. **AI 間の中継（handoff）**: 自分が詰まって続行不能と判断した場合、以下の手順で相手 AI に渡す。
   - `## Handoff` セクションを含むコメントを投稿する
     - `From: <自分>` / `To: <相手>`
     - `Done so far`: そこまでの到達点
     - `Blocker`: 何で詰まったか（エラー文・試した手段・仮説）
     - `Next step suggestion`: 相手に何をしてほしいか
   - `owner:` ラベルを相手に付け替える
   - `status: in-progress` は**外し**、`status: todo` に戻す（相手が着手したら再度 in-progress）
   - 割り込みではなく handoff 時は、受け手の AI は自由に着手してよい

### commit message

- 原則: `<type>: <subject> (#<issue>)`
  - 例: `feat: add date-range filter (#42)`
- 雑務例外: `[skip-issue]` を含める（typo 修正、README 微修正など）

### findings / 長文調査ノート

- 原則 Gist で管理し、関連 Issue からリンク
- Gist タイトル: `YYYY-MM-DD <topic>.md`
- Secret Gist を default（リポジトリが private のため）

---

## 5. Testing / Verification Strategy

### この仕組み自体の検証

本リポジトリには自動テスト基盤がない（CLAUDE.md 記載）。以下の手動検証で代替する。

**Phase 1: 移行前の dry-run**

- `handoff-migrate.ts` に `--dry-run` フラグを実装し、実際に Issue を作らず「何件を何ラベルで作るか」を出力。
- オーナーが目視確認し、ラベル mapping の妥当性を承認してから実行。

**Phase 2: 移行の検証**

- 移行後、以下を確認:
  - [ ] active だった packet の数 = 新規 Issue 数
  - [ ] 各 Issue に適切な labels が付いている
  - [ ] `ai-handoff/archive/migrated/` に原本が残っている
  - [ ] `ai-handoff/archive/migration-report.md` に全件のマッピングが載っている

**Phase 3: 運用試験（最低 2 タスク）**

- 1 タスクは Claude が Issue 作成 → Codex が in-progress → Codex が ready-for-close → 人間が close まで完走。
- 1 タスクは途中で blocked → 再開 → close まで完走。
- 確認項目:
  - [ ] MCP 経由で全操作が完結する
  - [ ] commit message の `#<issue>` 強制 hook が動作する
  - [ ] Projects ボードで状態が一目で判別できる
  - [ ] 既存 feature ブランチに `ai-handoff/` 関連の diff が混ざらない

**Phase 4: 旧ファイル削除**

- Phase 3 の試験が完走した後に限り、`ai-handoff/` 内の該当ファイル群と scripts を削除。

### Definition of Done（この SPEC の実装タスク）

1. `npm run typecheck` pass
2. `npm run build` pass
3. Phase 1–4 の手動検証を全件完了
4. `docs/handoff/README.md` が書かれている
5. `CLAUDE.md` と `.claude/rules/handoff.md` が Issue 運用に更新されている
6. 旧 `ai-handoff/tasks/`, `current-task.md`, `findings/`, `templates/` が削除（または archive へ移動）されている

---

## 6. Boundaries

### Always do

- AI は作業開始前に Issue を必ず確認し、owner が空または自分である場合のみ着手する
- AI は作業完了時に `ready-for-close` を付け、検証ログをコメントに残す
- AI は commit message に `#<issue>` を含める（例外は `[skip-issue]`）
- 長文の調査ノートは Gist に作り、Issue 本文からリンクする
- Issue の本文編集は objective / scope / checklist に限り、経過は comment で表現

### Ask first

- Issue を close すること（close は人間専権）
- ラベル体系の追加・変更
- GitHub Project のカラム構成変更
- 移行スクリプトの実行（`--dry-run` なしでの本番実行）
- `ai-handoff/` 以下の既存ファイル削除

### Never do

- AI が自発的に Issue を close する
- 他 AI が `status: in-progress` を付けている Issue に、handoff コメントなしで割り込んで作業を開始する（handoff 手順を踏めば引き継ぎ可）
- Issue のコメントを編集／削除する（追記のみ）
- Gist や Issue に `.env` 的な秘匿情報を載せる
- commit message から `#<issue>` を省いて push する（hook で防ぐが、hook を `--no-verify` で回避しない）
- 有料 SaaS / 外部サービスを導入する

---

## 7. Open Questions（SPEC 承認時に確定する項目）

1. GitHub Projects v2 の名称・URL は誰が最初に作るか（人間が一度作成すればよい）
2. 既存の `ai-handoff/archive/` 配下のファイルは将来的に `git rm` するか、残すか
3. `[skip-issue]` escape を許容する範囲（どこまで雑務とみなすか）
4. handoff コメントの形式を Issue template ではなく comment template（`.github/DISCUSSION_TEMPLATE` は Issue comment には効かないため、テキスト雛形を `docs/handoff/README.md` に置く方針）で提供する方式で良いか

---

## 8. Implementation Phases（承認後に planning-and-task-breakdown へ）

1. **Phase A**: GitHub 側準備（人間 1 名）
   - Projects v2 作成、Labels 作成、ISSUE_TEMPLATE 配置
2. **Phase B**: MCP / hook 整備
   - github-mcp-server 設定、pre-commit hook 書き換え
3. **Phase C**: 移行スクリプト
   - `handoff-migrate.ts` 実装 → dry-run → 本番実行
4. **Phase D**: ドキュメント差し替え
   - `docs/handoff/README.md`, `CLAUDE.md`, `.claude/rules/handoff.md` 更新
5. **Phase E**: 運用試験（2 タスク）
6. **Phase F**: 旧 scripts / ファイル削除
