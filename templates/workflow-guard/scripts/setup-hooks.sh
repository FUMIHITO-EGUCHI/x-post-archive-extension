#!/bin/sh
# setup-hooks.sh

set -e

HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
SCRIPTS_DIR="$(dirname "$0")"

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
install_hook "commit-msg"

echo "Git hooks installed successfully."
