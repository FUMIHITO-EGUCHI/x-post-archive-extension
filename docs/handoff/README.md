# AI Handoff — Issue-based Workflow

タスクは GitHub Issues で管理する。状態は Issue の open / closed と関連 PR で表し、ラベルは使わない。旧 `ai-handoff/` の履歴は git log を参照する。

運用の背景は `docs/decisions/0001-task-management-on-github-issues.md` と `docs/decisions/0004-simplify-issue-workflow.md`、AI 実行制御は `docs/handoff/ai-execution.md` を参照する。

## Issue と作業

- Task、Investigation、Bug のテンプレートから適切なものを選ぶ。Issue の作成者は Claude、Codex、人間のいずれでもよい。
- 作業前に目的、範囲、完了条件と関連する作業を確認する。大きなタスクは必要に応じて子 Issue に分ける。
- 必要な経過、ブロッカー、検証結果はコメントで共有する。本文は objective / scope / checklist のメンテナンスに使う。
- 作業の重複を避け、引き継ぎが必要ならコメントで相手と次の作業を明示する。
- 人間が Issue の close を判断する。AI は自分の判断で close せず、ユーザーの明示指示がある場合のみ代行する。

## AI 間 handoff

必要に応じて次の雛形を使う。

```markdown
## Handoff

- From: <自分>
- To: <相手>

### Done so far
- <到達点>

### Blocker
- <障害、試した手段、仮説>

### Next step suggestion
- <相手に依頼する作業>

### Related
- <関連資料、PR、コミット>
```

## Branch と commit

branch は `feature` / `fix` / `refactor` / `docs` / `chore` のいずれかを使い、`<type>/<topic>` または `<type>/<number>-<topic>` とする。topic は英小文字・数字をハイフンで区切る。

着手時は `sh scripts/start-issue.sh <type> <number|-> <topic>` を使う。番号なしの場合は第 2 引数に `-` を渡す。commit・branch と Issue の紐付けは任意で、関連があれば PR 本文に `Refs #N` を記載する。

`scripts/pre-commit` は branch 名を検査し、`master` / `main` への直接 commit を拒否する。メンテナンス時のみ `ALLOW_MASTER_COMMIT=1` で回避できる。`sh scripts/setup-hooks.sh` で hook を設置する。lint と content-script guard は維持し、`--no-verify` で回避しない。他 repo 向けの Git template は `templates/git-template/README.md` を参照する。

## 検証と完了

変更に応じて `npm run lint`、`npm run typecheck`、`npm run build`、関連テストと動作確認を行う。ブラウザの手動確認には原則 Shared Profile を使い、別 profile はユーザーの明示許可がある場合のみ使う。検証結果と未確認事項を伝え、人間が完了を判断する。

## Findings

長文調査ノートは原則 `docs/findings/YYYY-MM-DD-<topic>.md` に置き、関連 Issue からリンクする。個人情報が含まれる場合のみ Secret Gist を使う。公開前には findings の個人情報を確認する。
