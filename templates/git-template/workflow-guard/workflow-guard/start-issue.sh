#!/bin/sh
# Create an issue branch with the required naming convention.

set -e

TYPE="$1"
NUMBER="$2"
TOPIC="$3"

if [ -z "$TYPE" ] || [ -z "$NUMBER" ] || [ -z "$TOPIC" ]; then
  echo "Usage: sh .git/workflow-guard/start-issue.sh <type> <number> <topic>"
  echo "  type:   feature / fix / refactor / docs / chore"
  echo "  number: issue number (or 'skip' for [skip-issue] work)"
  echo "  topic:  short-topic (lowercase, numbers, hyphens only)"
  exit 1
fi

case "$TYPE" in
  feature|fix|refactor|docs|chore)
    ;;
  *)
    echo "Invalid type: $TYPE"
    echo "  type must be one of: feature / fix / refactor / docs / chore"
    exit 1
    ;;
esac

case "$TOPIC" in
  *[!a-z0-9-]*|'')
    echo "Invalid topic: $TOPIC"
    echo "  topic must use lowercase letters, numbers, and hyphens only"
    exit 1
    ;;
esac

if [ "$NUMBER" = "skip" ]; then
  if [ "$TYPE" != "chore" ]; then
    echo "skip is only allowed with chore branches."
    exit 1
  fi
  BRANCH="chore/skip-$TOPIC"
else
  case "$NUMBER" in
    *[!0-9]*|'')
      echo "Invalid number: $NUMBER"
      echo "  number must be digits only, or 'skip' for chore work"
      exit 1
      ;;
  esac
  BRANCH="$TYPE/$NUMBER-$TOPIC"
fi

if [ -n "$(git status --short)" ]; then
  echo "Working tree is dirty. Commit or stash before creating a new branch."
  git status --short
  exit 1
fi

if git show-ref --verify --quiet refs/heads/master; then
  BASE_BRANCH="master"
elif git show-ref --verify --quiet refs/heads/main; then
  BASE_BRANCH="main"
else
  echo "Neither master nor main exists."
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]; then
  git switch "$BASE_BRANCH" >/dev/null 2>&1 || git checkout "$BASE_BRANCH"
fi

git switch -c "$BRANCH" >/dev/null 2>&1 || git checkout -b "$BRANCH"

echo ""
echo "Branch created: $BRANCH"
if [ "$NUMBER" != "skip" ]; then
  echo "Remember to link this branch to issue #$NUMBER on GitHub."
fi
