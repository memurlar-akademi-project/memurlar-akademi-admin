import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('./deploy.yml', import.meta.url), 'utf8');

function triggerBlock(source) {
  const start = source.indexOf('\non:\n');
  assert.notEqual(start, -1, 'workflow must declare triggers');
  const after = source.slice(start + 1);
  const end = after.search(/\n(?:permissions|concurrency|env|jobs):/);
  return end === -1 ? after : after.slice(0, end);
}

test('production deployment is manual-only and fail-closed', () => {
  const triggers = triggerBlock(workflow);
  assert.match(triggers, /^  workflow_dispatch:/m);
  assert.doesNotMatch(triggers, /^  (?:push|pull_request|schedule):/m);
  assert.match(triggers, /release_sha:\n(?:        .*\n){0,4}        required: true/m);
  assert.match(triggers, /production_confirmation:\n(?:        .*\n){0,4}        required: true/m);
  assert.match(workflow, /test "\$EVENT_NAME" = "workflow_dispatch"/);
  assert.match(workflow, /test "\$DISPATCH_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /memurlar-akademi-project\/memurlar-akademi-admin/);
  assert.match(workflow, /DEPLOY_MEMURLAR_PRODUCTION/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
});

test('production deployment releases only the verified requested SHA', () => {
  assert.match(workflow, /group: memurlar-admin-production\n  cancel-in-progress: false/);
  assert.match(workflow, /environment:\n      name: memurlar-production/);
  assert.match(workflow, /ref: \$\{\{ inputs\.release_sha \}\}/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$REQUESTED_RELEASE_SHA"/);
  assert.match(workflow, /git fetch --no-tags origin main/);
  assert.match(workflow, /git merge-base --is-ancestor "\$REQUESTED_RELEASE_SHA" origin\/main/);
  assert.match(workflow, /needs: release-gate/);
  assert.match(workflow, /needs\.release-gate\.result == 'success'/);
});

test('workflow and contract test do not enable unsafe diagnostic secret output', () => {
  assert.doesNotMatch(workflow, /^\s*set\s+-[A-Za-z]*x[A-Za-z]*\b/m);
  assert.doesNotMatch(workflow, /(?:echo|printf)[^\n]*\$\{\{\s*secrets\./);
});
