# AI Handoff — Issue-based Workflow

このリポジトリのタスク管理は **GitHub Issues + Projects v2** を single source of truth とする。
旧 `ai-handoff/` のファイルベース運用は廃止した（`ai-handoff/archive/` に履歴のみ残る）。

- Backend: GitHub Issues（private repo）
- Human view: GitHub Projects v2 **X Archive Handoff**
- AI interface: `gh` CLI（ADR-0002 により MCP から一本化）
- 詳細仕様: `SPEC.md`
- 移行判断の背景: `docs/decisions/0001-task-management-on-github-issues.md`

---

## 1. Labels

| Category | 値 |
|---|---|
| `status:` | `todo` / `in-progress` / `blocked` / `ready-for-close` |
| `owner:` | `claude` / `codex` / `human` |
| `priority:` | `high` / `medium` / `low` |
| `type:` | `feature` / `bug` / `investigation` / `refactor` |
| `area:` | `viewer` / `content` / `background` / `db` / `handoff` / `other` |

- 「done」は **close 状態**で表現する（`status: done` ラベルは存在しない）
- close は**人間のみ**が行う

---

## 2. Issue の種類とテンプレート

GitHub の New Issue から選ぶ:

- **Task** — 実装粒度のタスク（feature / refactor）
- **Investigation** — 調査・再現・原因切り分け。成果物は Secret Gist もしくは Issue コメント
- **Bug** — 既存機能の不具合

blank issue は無効化している。

---

## 3. AI の作業フロー

### 3.0 Issue 作成

作成者は Claude / Codex / human いずれも可。

1. New Issue からテンプレを選ぶ（実装=Task / 調査=Investigation / 不具合=Bug）
2. 初期ラベルを付ける:
   - `status: todo`（テンプレで自動付与）
   - `owner:` 自分で着手するなら自分、他 AI に投げるなら相手
   - `priority:` `high` / `medium` / `low`
   - `type:` `feature` / `bug` / `investigation` / `refactor`
   - `area:` `viewer` / `content` / `background` / `db` / `handoff` / `other`
3. 自分で即着手するなら 3.1 に進み `status: todo` を外し `status: in-progress` に遷移
4. 他 AI に投げるなら `status: todo` + `owner: <相手>` で止める。相手が着手時にラベル操作

タスク分解が必要な大きめ Issue は、子 Issue を複数作り親 Issue 本文 checklist に `- [ ] #<子>` で並べる。

### 3.1 着手

1. ボードか `gh issue list` で自分の担当 Issue を選ぶ
2. **owner ラベルを確認**。他 AI が in-progress 中なら着手しない（handoff コメントがある場合は引き継ぐ）
3. `status: todo` を外し `status: in-progress` を付ける
4. 必要なら `owner:` を自分に付け替える

### 3.2 作業中

- 意味のあるステップごとに **Issue コメントを追記**（本文は編集しない）
  - 先頭フォーマット: `YYYY-MM-DD <自分>:`
  - 例: `2026-04-22 Claude: 調査完了。原因は X。次に Y を試す`
- Issue 本文（body）の編集は **objective / scope / checklist のメンテナンスのみ**。経過はコメントで表現
- ブロックされたら `status: in-progress` を外し `status: blocked` を付け、理由をコメント

### 3.3 完了申請（AI による）

1. `status: in-progress` を外し `status: ready-for-close` を付ける
2. 以下を含む **最終コメントを 1 件** 投稿:

```markdown
## Result
<実装内容の要約を 3〜10 行で>

## Verification
<`npm run typecheck` の出力（末尾 20 行程度）>
<`npm run build` の出力（末尾 20 行程度）>

## Changed files
<`git diff --name-only <base>..HEAD` の結果>
```

3. **AI は close しない**。ここで人間の確認待ちに入る。

### 3.4 Close（人間のみ）

人間が内容を確認し、実機検証が必要なら実施。問題なければ `gh issue close <n>` または UI で close。

---

## 4. AI → AI handoff（引き継ぎ）

Codex が解決できず Claude に渡したい（または逆）の場合:

1. 以下のコメントを投稿する（下の雛形をコピペ）
2. `owner:` を相手に付け替え
3. `status: in-progress` を外し `status: todo` に戻す（相手が着手したら再 in-progress）

### 4.1 Handoff コメント雛形

```markdown
## Handoff

- From: <自分>
- To: <相手>

### Done so far
- <そこまでの到達点を箇条書き>

### Blocker
- <何で詰まったか>
- <出たエラー文・試した手段・仮説>

### Next step suggestion
- <相手に何をしてほしいか>

### Related
- <参照した findings Gist / PR / コミット>
```

handoff 手順を踏めば、相手 AI は割り込みではなく引き継ぎとして自由に着手してよい。

---

## 5. Commit message ルール

すべての commit は Issue を参照する。

### 5.1 形式

```
<type>: <subject> (#<issue>)
```

例:
```
feat: add date-range filter (#42)
fix: restore progress bar update on large backup (#8)
refactor: extract archive-maintenance helper (#13)
```

### 5.2 Escape hatch

雑務コミット（typo 修正、README の微調整など）は `[skip-issue]` を含める:

```
chore: fix typo in docs [skip-issue]
```

許容範囲は **本質的に検証不要なレベルの変更**に限る。

### 5.3 Hook

`scripts/setup-hooks.sh` を実行すると `commit-msg` hook が入り、上記を自動検査する。
`--no-verify` での回避は**しない**（hook が落ちたら根本原因を直す）。

---

## 6. Findings / 長文調査ノート

- 原則 **`docs/findings/` に直置き**（private repo 前提）
- ファイル名: `YYYY-MM-DD-<topic>.md`
- 先頭に frontmatter を付ける:
  ```yaml
  ---
  date: 2026-04-22
  related-issue: 10
  status: open | resolved | superseded
  ---
  ```
- Issue 本文の `## Notes` または該当コメントから `docs/findings/...` をリンク
- 原文が diff に出るが、調査完了時の 1 コミットに収まれば許容
- findings 自体に close 概念はない。調査 Issue を close したら frontmatter の `status` を `resolved` にする

### 例外: Secret Gist

個人情報（他者の DM / username / 投稿 ID など）が混入する場合のみ Gist を使う。Issue からリンクし、ローカルには持たない。

`ai-handoff/findings/` は archive として残っているが、新規の調査ノートはここに作らない。

### 将来の OSS 化に備えて

リポジトリを公開する際は `docs/findings/` 一式に対し sanitization pass を実施する（自分の X username / user ID / Chrome profile path などの置換）。現時点では private 前提のため不要。

---

## 7. Projects v2 ボード

**X Archive Handoff**

- Columns: Todo / In Progress / Blocked / Ready for Close / Done
- Group by: `owner` ラベル
- Filter: `priority` ラベル

Issue を作ると自動でボードに乗る（auto-add ワークフロー）。状態遷移はラベル変更で反映される。

---

## 8. Definition of Done

1. `npm run typecheck` pass
2. `npm run build` pass
3. `status: ready-for-close` ラベルが付いている
4. 最終コメントに `## Result` / `## Verification` / `## Changed files` が揃っている
5. commit message に `#<issue>` が含まれている
6. 人間が Issue を close した

1〜5 を AI が満たし、6 は人間のみ。

---

## 9. よくある質問

**Q. 小さすぎて Issue を立てるほどでもない修正は？**
A. `[skip-issue]` escape を使う。ただし後から「なぜこの変更が？」と聞かれたら答えられる範囲に限る。

**Q. 同じタスクを両 AI で並行できないか？**
A. 原則不可。owner が切り替わる handoff でのみ引き継ぐ。並行作業は衝突コストが高い。

**Q. Issue の body を書き換えていい？**
A. objective / scope / checklist のメンテナンスのみ。経過・考察・結果はコメントで。

**Q. 旧 `ai-handoff/tasks/*.md` を参照したい**
A. `ai-handoff/archive/` に全件残っている。リポジトリ上では読み取り専用とみなす。
