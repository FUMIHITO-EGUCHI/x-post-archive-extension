---
paths:
  - docs/handoff/**/*.md
  - .github/ISSUE_TEMPLATE/**
---

# AI Handoff Rules (Issue-based)

タスクは **GitHub Issues** で管理する。運用ガイド全文は `docs/handoff/README.md`、背景は `docs/decisions/0004-simplify-issue-workflow.md`。

## Issue

- 状態は Issue の open / closed とリンクした PR で表す。**ラベルは付けない**（既存ラベルは過去の記録として残っているだけ）
- Issue 本文の編集は objective / scope / checklist のメンテナンスのみ。経過・考察・結果はコメントに追記する
- **AI は自分の判断で Issue を close しない**。ユーザーが明示的に指示したときだけ `gh issue close` を実行する

## Branch と commit

- branch は `<type>/<topic>` または `<type>/<number>-<topic>`（type は `feature` / `fix` / `refactor` / `docs` / `chore`）。`sh scripts/start-issue.sh <type> <number|-> <topic>` で作る
- commit・branch と Issue の紐付けは任意。関連があれば PR 本文に `Refs #N` を書く（`Closes #N` はマージ時に自動 close されるので使わない）
- `master` への直接 commit は pre-commit hook が拒否する。`--no-verify` で hook を回避しない

## AI 間 handoff

他の AI が作業中の Issue に割り込む・引き継ぐときは、Issue に handoff コメントを残す。

```markdown
## Handoff
- From: <自分>
- To: <相手>

### Done so far
### Blocker
### Next step suggestion
### Related
```

## Never

- AI が自発的に Issue を close する
- Issue コメントを **編集・削除** する（追記のみ）
- Gist / Issue に秘匿情報（`.env` 等）を載せる
- `--no-verify` で hook を回避する
