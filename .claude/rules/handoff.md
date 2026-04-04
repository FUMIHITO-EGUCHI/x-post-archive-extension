---
paths: ai-handoff/**/*.md
---

# AI Handoff Rules

- `ai-handoff/current-task.md` は常に 1 件のアクティブタスクだけを指すダッシュボードとして使う
- `ai-handoff/tasks/` には 1 タスク 1 ファイルで task packet を置く
- `ai-handoff/findings/` には圧縮済みの調査結果だけを置き、生ログは置かない
- `ai-handoff/templates/` には再利用テンプレート、`ai-handoff/archive/` には完了済み packet / findings を置く
- handoff 開始前は task packet を作成または更新し、`current-task.md` から参照できる状態にする
- 作業完了時は task packet の結果欄と `current-task.md` を更新し、次の着手者が迷わない状態にする
