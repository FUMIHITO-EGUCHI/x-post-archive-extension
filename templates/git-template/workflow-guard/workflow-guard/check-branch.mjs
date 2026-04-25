#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { argv, env, exit } from 'node:process';

const BRANCH_PATTERN = /^(feature|fix|refactor|docs|chore)\/\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKIP_PATTERN = /^chore\/skip-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getCurrentBranch() {
  const branchArg = argv[2];
  if (branchArg) {
    return branchArg.trim();
  }

  try {
    return execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    console.error('[check-branch] failed to detect current branch.');
    if (error instanceof Error && error.message) {
      console.error(error.message);
    }
    exit(2);
  }
}

const branch = getCurrentBranch();

if (!branch) {
  console.error('[check-branch] branch name is empty.');
  exit(1);
}

if (branch === 'master' || branch === 'main') {
  if (env.ALLOW_MASTER_COMMIT === '1') {
    exit(0);
  }

  console.error(`[check-branch] direct commit to ${branch} is not allowed.`);
  console.error('  Start work with: sh .git/workflow-guard/start-issue.sh <type> <number> <topic>');
  console.error('  For maintenance commits, set ALLOW_MASTER_COMMIT=1');
  exit(1);
}

if (SKIP_PATTERN.test(branch) || BRANCH_PATTERN.test(branch)) {
  exit(0);
}

console.error('[check-branch] branch name must match one of these patterns:');
console.error('  feature/<number>-<topic>');
console.error('  fix/<number>-<topic>');
console.error('  refactor/<number>-<topic>');
console.error('  docs/<number>-<topic>');
console.error('  chore/<number>-<topic>');
console.error('  chore/skip-<topic>');
console.error('  topic must use lowercase letters, numbers, and hyphens only.');
exit(1);
