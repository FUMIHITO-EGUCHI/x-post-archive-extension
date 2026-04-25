#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { argv, exit } from 'node:process';

const path = argv[2];
if (!path) {
  console.error('[commit-msg] usage: node .git/workflow-guard/check-commit-message.mjs <commit-msg-file>');
  exit(2);
}
if (!existsSync(path)) {
  console.error(`[commit-msg] file not found: ${path}`);
  exit(2);
}

const raw = readFileSync(path, 'utf8');
const normalized = raw.replace(/\r\n/g, '\n');
const body = normalized
  .split('\n')
  .filter((line) => !line.startsWith('#'))
  .join('\n')
  .trim();

if (body.length === 0) {
  exit(0);
}

const autoPatterns = [
  /^Merge /,
  /^Revert "/,
  /^fixup! /,
  /^squash! /,
  /^amend! /,
];
const firstLine = body.split('\n', 1)[0] ?? '';
if (autoPatterns.some((re) => re.test(firstLine))) {
  exit(0);
}

if (body.includes('[skip-issue]')) {
  exit(0);
}

const issueRefRe = /(^|[\s(\[{])#\d+\b/;
if (issueRefRe.test(body)) {
  exit(0);
}

console.error('');
console.error('[commit-msg] commit message must reference a GitHub Issue.');
console.error('');
console.error('  Include `#<issue-number>` somewhere in the commit message, e.g.:');
console.error('    feat: add date-range filter (#42)');
console.error('');
console.error('  For trivial changes (typo / doc tweak) you may use the escape:');
console.error('    chore: fix typo in README [skip-issue]');
console.error('');
exit(1);
