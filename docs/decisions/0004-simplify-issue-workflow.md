# ADR-0004: Issue 運用を簡素化する

## Status

Accepted

## Date

2026-11-23

## Context

個人開発の規模に対して、Issue のラベル管理、状態遷移、完了申請と commit 検査の運用が重い。ラベルに依存する自動化は triage bot がラベルを付けるだけで、読む側がない。

## Decision

- Issue ラベル（status / owner / priority / type / area / model / cost）の運用を廃止し、状態は Issue の open / closed と関連 PR で表す。
- GitHub 上の既存ラベルは残し、削除スクリプトは作らない。
- commit message の Issue 番号必須と、所定の 3 節による完了コメントを廃止する。commit・branch と Issue の紐付けは任意とする。
- AI は自分の判断で Issue を close しない。ユーザーの明示指示がある場合のみ代行する。
- `master` / `main` への直接 commit を禁止する pre-commit、lint、content-script guard は維持する。

## Alternatives Considered

- 従来のラベル運用を維持する案は、維持負担に見合う利用がないため採用しない。

## Consequences

- `.github/workflows/claude-issue-triage.yml`、`.github/workflows/sync-labels.yml`、`.github/labels.yml`、`scripts/sync-labels.mjs`、`scripts/sync-labels.sh`、`scripts/commit-msg`、`scripts/check-commit-message.mjs` を削除する。既存 GitHub ラベルは残る。
- `sh scripts/setup-hooks.sh` を再実行すると、ローカルの `.git/hooks/commit-msg` は削除される。worktree 等では Git が返す hooks ディレクトリを使う。
- 関連 Issue は必要に応じて PR 本文で参照する。Issue の close 判断は引き続き人間が持つ。
