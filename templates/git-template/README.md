# Git Template

他のリポジトリで Git 運用 guard を初期状態から有効化するための Git template。

template 本体は次に置く:

- `templates/git-template/workflow-guard/`

このディレクトリを `git init --template=...` に渡すと、`.git/` 配下へ hook と helper script がコピーされる。

## What it installs

- `hooks/pre-commit`
- `hooks/post-checkout`
- `hooks/commit-msg`
- `workflow-guard/check-branch.mjs`
- `workflow-guard/check-commit-message.mjs`
- `workflow-guard/start-issue.sh`
- `workflow-guard/project-precommit-check.sh.example`

## Usage

新しい repo を Git template 付きで初期化する:

```sh
git init --template=/path/to/templates/git-template/workflow-guard
```

毎回使うなら global 設定もできる:

```sh
git config --global init.templateDir /path/to/templates/git-template/workflow-guard
```

## Commands after init

issue branch 作成:

```sh
sh .git/workflow-guard/start-issue.sh fix 13 workflow-guard
```

project 固有の pre-commit check を追加したい場合は、repo 側に `scripts/project-precommit-check.sh` を作る。

例:

```sh
#!/bin/sh
set -e

npm run lint
npm test
```

## Branch convention

- `feature/<number>-<topic>`
- `fix/<number>-<topic>`
- `refactor/<number>-<topic>`
- `docs/<number>-<topic>`
- `chore/<number>-<topic>`
- `chore/skip-<topic>`

## Maintenance override

`master` / `main` へ例外的に commit する場合だけ次を使う:

```sh
ALLOW_MASTER_COMMIT=1 git commit -m "chore: maintenance (#123)"
```

## Notes

- この template は `git init` 時にだけ自動適用される
- 既存 repo へ後付けする場合は `workflow-guard/` と `hooks/` を `.git/` 配下へコピーする
