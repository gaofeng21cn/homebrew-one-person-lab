import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.match(read('.gitignore'), /^\.worktrees\/$/m);

for (const workflow of [
  '.github/workflows/sync-from-app-releases.yml',
  '.github/workflows/tap-check.yml',
]) {
  const content = read(workflow);
  assert.match(content, /App release operator\/authority/);
  assert.match(content, /do not create tap-local release truth\/currentness/);
}

function writeMockGh(dir, assetsJson) {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  fs.writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  printf '{"tagName":"v1.2.3","isDraft":false,"isPrerelease":false,"assets":${assetsJson}}'
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

const successTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-success-'));
fs.mkdirSync(path.join(successTmp, 'Casks'));
const successBin = writeMockGh(successTmp, JSON.stringify([
  { name: 'One-Person-Lab-1.2.3-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  { name: 'standard-local-authorization-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
]));

const success = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
  '--release-tag',
  'v1.2.3',
], {
  cwd: successTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${successBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(success.status, 0, success.stderr);
const generated = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab.rb'), 'utf8');
assert.match(generated, /# downstream_mirror_only: true/);
assert.match(generated, /# release_truth_authority: app_release/);
assert.match(generated, /# failure_feedback_owner: app_release_operator/);
assert.match(generated, /# must_not_define_release_currentness: true/);

const failureTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-failure-'));
fs.mkdirSync(path.join(failureTmp, 'Casks'));
const failureBin = writeMockGh(failureTmp, '[]');

const result = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
], {
  cwd: failureTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${failureBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});

assert.notEqual(result.status, 0);
assert.match(result.stderr, /downstream App release mirror only/);
assert.match(result.stderr, /App release operator\/authority/);
assert.match(result.stderr, /must not define release truth\/currentness/);

const usage = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--wat',
  'stable',
], {
  cwd: failureTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${failureBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});

assert.notEqual(usage.status, 0);
assert.match(usage.stderr, /Unknown option: --wat/);
assert.doesNotMatch(usage.stderr, /App release operator\/authority/);
