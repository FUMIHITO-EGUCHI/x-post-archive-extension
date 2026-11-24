#!/bin/sh
# setup-hooks.sh
# git hooks を Git が実際に読む hooks ディレクトリにインストールする。
# clone 後や hooks を再インストールしたいときに実行する。
# worktree から実行しても、共有の hooks ディレクトリ（core.hooksPath があればそちら）に入る。
#
# 使い方: sh scripts/setup-hooks.sh

set -e

HOOKS_DIR="$(git rev-parse --git-path hooks)"
SCRIPTS_DIR="$(dirname "$0")"

mkdir -p "$HOOKS_DIR"

install_hook() {
  name="$1"
  src="$SCRIPTS_DIR/$name"
  dst="$HOOKS_DIR/$name"

  if [ ! -f "$src" ]; then
    echo "Hook source not found: $src"
    exit 1
  fi

  cp "$src" "$dst"
  chmod +x "$dst"
  echo "Installed: $dst"
}

install_hook "pre-commit"
install_hook "post-checkout"

# 旧 commit-msg hook（削除済みの check-commit-message.mjs を呼ぶ）だけを取り除く。
# 利用者が独自に置いた commit-msg hook は残す。
legacy_hook="$HOOKS_DIR/commit-msg"
if [ -f "$legacy_hook" ] && grep -q 'check-commit-message.mjs' "$legacy_hook"; then
  rm "$legacy_hook"
  echo "Removed legacy hook: $legacy_hook"
elif [ -e "$legacy_hook" ]; then
  echo "Kept custom hook: $legacy_hook"
fi

echo "Git hooks installed successfully."
