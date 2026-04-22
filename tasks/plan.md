# Plan: AI 間タスク管理の GitHub Issues 化

- Status: Draft (plan mode, read-only so far)
- Based on: `SPEC.md`
- Date: 2026-04-22

---

## 1. 対象範囲の事実確認（plan mode 調査結果）

| 項目 | 現状 |
|---|---|
| `ai-handoff/tasks/` 総数 | 57 ファイル |
| うち active / waiting | **1 ファイルのみ** |
| 削除対象 scripts | `scripts/sync-handoff.mjs`, `scripts/check-handoff-consistency.mjs`, `scripts/log-changes.mjs` |
| hook 実体 | `scripts/pre-commit` → `npm run precommit:check` を起動 |
| `precommit:check` の合成 | `handoff:check && lint && guard:content-scripts` |
| `.github/` ディレクトリ | **未存在**（新規作成） |
| `husky` | **未導入**（素の git hook 運用） |
| 既存の MCP 接続 | chrome-devtools-mcp のみ（github-mcp-server は未接続） |
| Codex MCP 対応 | 利用可能（ユーザー確認済） |

### 含意

- 移行対象は実質 1 タスクなので、migration スクリプトを大掛かりに書く価値は低い。**手動移行 + 最小スクリプト**で十分。
- `precommit:check` から `handoff:check &&` を外し、`#<issue>` チェックを合成する形で hook を差し替えるのが最短。
- `.github/ISSUE_TEMPLATE/*.yml`, labels, Projects v2 は人間が一度作れば済む。

---

## 2. 依存グラフ

```
          ┌───────────────────────┐
          │ A. GitHub 側準備      │  (human only)
          │  - labels             │
          │  - Projects v2 board  │
          │  - ISSUE_TEMPLATE     │
          └─────────┬─────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────────┐
│ B. MCP 設定      │  │ C. pre-commit 改修    │
│  - github-mcp    │  │  - #<issue> 検査      │
│  - Claude+Codex  │  │  - handoff:check 撤去 │
└────────┬─────────┘  └──────────┬────────────┘
         │                        │
         └──────────┬─────────────┘
                    ▼
          ┌───────────────────────┐
          │ D. 最小移行           │
          │  - 1 件を Issue 化    │
          │  - 原本を archive へ  │
          │  - Gist は必要に応じて│
          └─────────┬─────────────┘
                    ▼
          ┌───────────────────────┐
          │ E. ドキュメント差替   │
          │  - docs/handoff/...   │
          │  - CLAUDE.md          │
          │  - .claude/rules/...  │
          └─────────┬─────────────┘
                    ▼
          ┌───────────────────────┐
          │ F. 運用試験 2 件      │  (checkpoint)
          │  - 正常完走 1         │
          │  - blocked 経由 1     │
          │  - handoff 経由 1(可) │
          └─────────┬─────────────┘
                    ▼
          ┌───────────────────────┐
          │ G. 旧資産の削除       │
          │  - scripts 3 本       │
          │  - ai-handoff/配下    │
          └───────────────────────┘
```

---

## 3. Vertical Slice 方針

各タスクは「end-to-end に 1 機能分が通る」粒度で切る。横断リファクタ（例: scripts を一括削除）は最後の G に集約し、それまでは **旧系統と新系統を並走させる**。

- Slice A〜C 完了時点: GitHub 側で 1 件の Issue を手で作り、commit message に `#<issue>` を入れてコミットが通る状態。
- Slice D 完了時点: 旧 active packet が Issue 化されており、ボードで見える。
- Slice E 完了時点: ドキュメントが Issue 運用版になっており、新規タスクから運用できる。
- Slice F 完了時点: 試験が通り、人間が close の手順まで体感済み。
- Slice G 完了時点: 旧仕組みが完全撤去。

---

## 4. タスクリスト

### Task A1: GitHub ラベル作成（human 単独）

- **Owner**: human
- **Depends on**: なし
- **Scope**:
  - ラベル `status: todo`, `status: in-progress`, `status: blocked`, `status: ready-for-close`
  - `owner: claude`, `owner: codex`, `owner: human`
  - `priority: high/medium/low`
  - `type: feature/bug/investigation/refactor`
  - `area: viewer/content/background/db/handoff/other`
- **Acceptance**:
  - [ ] `gh label list` で上記全ラベルが見える
- **Verification**: `gh label list --limit 30` の出力を保存
- **Est**: 10 分

### Task A2: GitHub Projects v2 ボード作成（human 単独）

- **Owner**: human
- **Depends on**: A1
- **Scope**:
  - Project 名: `X Archive Handoff`
  - Columns: `Todo` / `In Progress` / `Blocked` / `Ready for Close` / `Done`
  - Auto-add workflow: リポジトリの Issue を自動追加
  - Status カラムの mapping を `status:` ラベルに連動（可能な範囲で）
- **Acceptance**:
  - [ ] Project URL が `SPEC.md §7 Open Question 1` に記入される
  - [ ] 任意の Issue を 1 件作ると自動でボードに乗る
- **Est**: 15 分

### Task A3: ISSUE_TEMPLATE 配置（Claude or Codex）

- **Owner**: claude or codex
- **Depends on**: A1
- **Files**:
  - `.github/ISSUE_TEMPLATE/task.yml`
  - `.github/ISSUE_TEMPLATE/investigation.yml`
  - `.github/ISSUE_TEMPLATE/bug.yml`
  - `.github/ISSUE_TEMPLATE/config.yml` (optional, blank-issue 無効化)
- **Acceptance**:
  - [ ] GitHub UI で New Issue 押下時にフォームが 3 種表示される
  - [ ] `task.yml` の各フィールドが SPEC §3 の定義に一致
- **Verification**: GitHub の New Issue 画面スクリーンショット
- **Est**: 30 分

### Task B1: github-mcp-server を Claude / Codex 両方に接続

- **Owner**: human（MCP 設定は手元のみ）
- **Depends on**: なし（A と並行可）
- **Scope**:
  - 個人 PAT を作成（repo, project スコープ）
  - Claude Code の MCP 設定に `github-mcp-server` 追加
  - Codex の MCP 設定に同サーバー追加
- **Acceptance**:
  - [ ] Claude から `create_issue` tool が呼べ、test issue が作れる
  - [ ] 作った test issue を close まで持っていける
  - [ ] Codex 側でも同じ動作確認
- **Verification**: 両エージェントで test issue を 1 件作って close、その Issue URL を記録
- **Est**: 30 分

### Task C1: pre-commit hook を `#<issue>` 必須に差し替え

- **Owner**: claude or codex
- **Depends on**: なし（A, B と並行可だが、動作確認には B1 が必要）
- **Files**:
  - `scripts/pre-commit`（本体を書き換え）
  - `package.json` (`precommit:check` の中身変更)
- **変更内容**:
  - `handoff:check` を `precommit:check` から除去
  - 新規 `scripts/check-commit-message.mjs` を追加し、`.git/COMMIT_EDITMSG` を読んで `#\d+` または `[skip-issue]` の存在を検査
  - `pre-commit` ではなく `commit-msg` hook の方が適切 → `scripts/commit-msg` を新設し、`setup-hooks.sh` を更新
- **Acceptance**:
  - [ ] `#42` を含む commit message はコミット成功
  - [ ] `[skip-issue]` を含む commit message はコミット成功
  - [ ] どちらも無い commit message はコミット失敗、エラー文が表示される
  - [ ] 既存の lint / guard:content-scripts は引き続き走る
- **Verification**:
  - 3 パターンの commit を試行し、結果を記録
  - `npm run precommit:check` 単独でも成功する
- **Est**: 1 時間

### Task D1: 残 active/waiting packet を手動で Issue 化（1 件）

- **Owner**: claude or codex（人間確認）
- **Depends on**: A1, A3, B1
- **Scope**:
  - `grep -l "status: active\|status: waiting" ai-handoff/tasks/*.md` で特定
  - 内容を読み、対応する Issue を新規作成（title, body, labels）
  - 原本を `ai-handoff/archive/migrated/` へ移動
  - 該当 findings があれば Secret Gist 化し Issue 本文にリンク追記
- **Acceptance**:
  - [ ] active/waiting packet ゼロ件
  - [ ] 対応 Issue がボードの適切なカラムに表示
  - [ ] `ai-handoff/archive/migrated/` に原本が 1 件残る
- **Verification**: `grep -c "status: active\|status: waiting" ai-handoff/tasks/*.md` が 0
- **Est**: 30 分

### Checkpoint α（D1 後）

- **Gate**: ここで人間が SPEC・ボード・hook 動作を確認し、**新運用に正式切替する承認**を与える。
- 承認が出るまで E 以降に進まない。

### Task E1: 運用ガイド docs/handoff/README.md を新規作成

- **Owner**: claude
- **Depends on**: Checkpoint α
- **Files**:
  - `docs/handoff/README.md` (新規)
  - 内容: SPEC §2, §4, §6 を運用者向けに要約 + handoff コメント雛形
- **Acceptance**:
  - [ ] 新しい AI が README だけ読めば作業開始→完了申請→handoff まで行える
  - [ ] handoff コメント雛形が貼り付けて使える形で載っている
- **Est**: 45 分

### Task E2: CLAUDE.md と .claude/rules/handoff.md を Issue 運用に更新

- **Owner**: claude
- **Depends on**: E1
- **Files**:
  - `CLAUDE.md`（handoff 関連段落を書き換え、旧 `ai-handoff/` 記述を削除/置換）
  - `.claude/rules/handoff.md`（全面書き換え）
- **Acceptance**:
  - [ ] CLAUDE.md に旧 `handoff:sync/check` への言及が残っていない
  - [ ] `.claude/rules/handoff.md` が Issue・ラベル・commit message ルールを記述
- **Verification**: `grep -n "handoff:sync\|handoff:check\|current-task.md" CLAUDE.md .claude/rules/` が 0 件
- **Est**: 30 分

### Task F1: 運用試験 #1 — 正常完走

- **Owner**: claude → codex or claude 単独
- **Depends on**: E2
- **Scope**: 小さな実在タスク（例: README の typo 修正、既存 TODO コメント 1 件の解消）を Issue 化し、フル運用で close まで持っていく
- **Acceptance**:
  - [ ] Issue 作成 → in-progress → ready-for-close → human close が一巡
  - [ ] commit message が `#<issue>` を含む
  - [ ] ready-for-close コメントに typecheck/build 出力が含まれる
- **Est**: 1 時間

### Task F2: 運用試験 #2 — blocked → handoff → 完走

- **Owner**: codex 開始 → claude 引継ぎ
- **Depends on**: F1
- **Scope**: あえて詰まりそうな軽い実タスク（例: 既存 findings の 1 本を読んで要約 Issue を立て、調査 → レポート）
- **Acceptance**:
  - [ ] blocked 遷移が記録される
  - [ ] handoff コメントが SPEC §4 ルール 8 の形式で残る
  - [ ] owner ラベル付け替えが行われる
  - [ ] ready-for-close → close で完走
- **Est**: 1 時間

### Checkpoint β（F2 後）

- **Gate**: 2 試験の Issue URL を人間が確認。問題なければ G 実行を承認。

### Task G1: 旧 scripts / ai-handoff ファイルの削除

- **Owner**: claude or codex
- **Depends on**: Checkpoint β
- **Files**:
  - 削除: `scripts/sync-handoff.mjs`, `scripts/check-handoff-consistency.mjs`, `scripts/log-changes.mjs`
  - 削除: `ai-handoff/current-task.md`, `ai-handoff/tasks/*.md`（archive へ退避後）, `ai-handoff/findings/*.md`, `ai-handoff/templates/`
  - 保持: `ai-handoff/archive/`（履歴として）
  - `package.json`: `handoff:sync`, `handoff:check`, `handoff:log-changes` スクリプト行を削除
- **Acceptance**:
  - [ ] `npm run` 一覧に handoff:* が残っていない
  - [ ] `npm run typecheck && npm run build` 成功
  - [ ] 1 commit にまとめる（`chore: remove legacy ai-handoff system (#<self-issue>)`）
- **Verification**:
  - `git ls-files | grep -E "^scripts/(sync-handoff|check-handoff-consistency|log-changes)" ` が空
  - `git ls-files ai-handoff/ | grep -v "^ai-handoff/archive/"` が空
- **Est**: 30 分

---

## 5. 並列性と Critical Path

- 並列可能: A1/A2（human） ∥ A3（AI） ∥ B1（human） ∥ C1（AI）
- Critical path: A1 → A3 → D1 → Checkpoint α → E1 → E2 → F1 → F2 → Checkpoint β → G1
- B1 は D1 までに完了必須。C1 は F1 までに完了必須。

---

## 6. Risks

| Risk | 影響 | 軽減策 |
|---|---|---|
| github-mcp-server の PAT 権限不足 | Issue 作成失敗 | 初回に test issue で権限検証（B1） |
| commit-msg hook が Windows の改行で誤判定 | 全コミットが拒否される | Node.js 実装にし CRLF 正規化 |
| Projects v2 の auto-label mapping が期待通り動かない | ボードの状態が手動同期になる | F1 で動作確認、駄目なら手動でカラム移動ルールに切替 |
| 旧 packet の findings リンクが Gist 化で切れる | 過去参照が困難 | D1 では archive に原本を残す。Gist 化は必要になったときだけ行う |
| `[skip-issue]` 濫用 | トレーサビリティ低下 | E1 の README で許容範囲を明記（typo / doc 微修正のみ）|

---

## 7. Out of scope（この plan では触らない）

- 57 件中 56 件の done packet の Issue 化（archive に残すのみ）
- 過去 findings の Gist 一括移行
- Projects v2 の高度なカスタムフィールド
- CI（GitHub Actions）連携

---

## 8. 承認依頼

この plan 通りで進める場合、まず **A1 + A2 + B1（人間側セットアップ）** を開始してください。その間に A3 / C1 を AI 側で走らせます。
