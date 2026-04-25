import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(here, 'workflow-guard', 'workflow-guard', 'check-branch.mjs');

function runCheck(branch, env = {}) {
  return spawnSync(process.execPath, [scriptPath, branch], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

test('accepts numbered work branches', () => {
  const result = runCheck('refactor/13-workflow-guard');
  assert.equal(result.status, 0);
});

test('accepts skip-issue chore branches', () => {
  const result = runCheck('chore/skip-release-v0-20');
  assert.equal(result.status, 0);
});

test('rejects master without override', () => {
  const result = runCheck('master');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /direct commit to master/i);
});

test('accepts master with override', () => {
  const result = runCheck('master', { ALLOW_MASTER_COMMIT: '1' });
  assert.equal(result.status, 0);
});

test('rejects branch names without issue number', () => {
  const result = runCheck('fix/workflow-guard');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch name must match/i);
});

test('rejects unsupported prefixes', () => {
  const result = runCheck('codex/13-workflow-guard');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch name must match/i);
});
