---
paths: ai-handoff/**/*.md
---

# AI Handoff Rules

## ファイル構造
- `ai-handoff/current-task.md` は常に 1 件のアクティブタスクだけを指すダッシュボード
- `ai-handoff/tasks/` には 1 タスク 1 ファイルで task packet を置く（フラットに保つ）
- `ai-handoff/findings/` には圧縮済みの調査結果だけを置き、生ログは置かない
- **`current-task.md` を直接編集しない** — task packet を編集して `npm run handoff:sync` で同期する

## task packet の記録ルール
- 新規タスク開始時: `## Meta` の `status: active`, `owner`, `branch`, `priority`, `files_in_scope` を埋める
- **作業中は `## Work Log` に逐次追記する**（完了後まとめて書くのではなく、何かするたびに1行）
  - 形式: `- \`YYYY-MM-DD Codex\`: 内容`
- 変更ファイルは `npm run handoff:log-changes` で自動更新する
- タスク完了時: `## Codex Result`, `## Verification` を埋め、`## Meta - status: done` と `## Meta - summary` を設定する

## current-task.md の同期
- `npm run handoff:sync` を実行すると以下が自動同期される:
  - `## Active` フィールド（Meta から）
  - `## Completion Checklist`（task packet から）
  - `## Recently Completed`（status: done の packet を先頭追加）
  - `## Waiting Tasks`（status: waiting の packet を列挙）
- `## Recent Updates`, `## Scope`, `## Coordination` は引き続き手動で更新する

## コミット前の検証
- `npm run handoff:check` は pre-commit hook でも自動実行される
- チェック項目: task_file の存在、Result/Verification の記入、Meta.status の整合性、Checklist の同期
- チェックが通らないとコミットがブロックされる → `handoff:sync` を実行して解消する

## タスク完了の Definition of Done
1. `npm run typecheck` pass
2. `npm run build` pass
3. `## Codex Result` または `## Result` が記入済み
4. `## Verification` が記入済み
5. `## Meta - status: done`、`## Meta - summary` が記入済み
6. `npm run handoff:sync` 実行済み
7. `npm run handoff:check` pass
