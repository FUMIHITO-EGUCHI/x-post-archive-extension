# Workflow Guard Template

他のリポジトリに横展開するための最小テンプレート。

含むもの:

- branch naming guard
- `master` / `main` 直 commit guard
- `post-checkout` warning
- issue branch 作成 script
- commit message issue reference guard

## Branch convention

- `feature/<number>-<topic>`
- `fix/<number>-<topic>`
- `refactor/<number>-<topic>`
- `docs/<number>-<topic>`
- `chore/<number>-<topic>`
- `chore/skip-<topic>`

## Install

1. `templates/workflow-guard/scripts/` 配下を対象 repo の `scripts/` にコピーする
2. 必要なら `scripts/project-precommit-check.sh` を作る
3. `sh scripts/setup-hooks.sh` を実行する

## Project-specific pre-commit checks

`pre-commit` は branch / direct-commit guard のあとで `scripts/project-precommit-check.sh` を探す。
存在する場合だけ実行する。

例:

```sh
#!/bin/sh
set -e

npm run lint
npm test
```

## Maintenance override

`master` / `main` へ例外的に commit する場合だけ次を使う:

```sh
ALLOW_MASTER_COMMIT=1 git commit -m "chore: maintenance (#123)"
```

## Notes

- `setup-hooks.sh` は `pre-commit` `post-checkout` `commit-msg` を install する
- `check-commit-message.mjs` は `#<issue-number>` または `[skip-issue]` を要求する
- `start-issue.sh` は dirty worktree を拒否する
