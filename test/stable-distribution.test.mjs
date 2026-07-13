import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stableWorkflow = read('.github/workflows/stable-distribution.yml');
const legacyWorkflow = read('.github/workflows/sync-from-app-releases.yml');

for (const required of [
  'release_tag',
  'stable_session_id',
  'release_cohort_ref',
  'app_sha',
  'shell_sha',
  'framework_sha',
  'source_release_run_id',
  'full_vm_run_id',
  'full_vm_evidence_ref',
  'full_vm_evidence_sha256',
  'full_vm_result',
]) {
  assert.match(stableWorkflow, new RegExp(`^      ${required}:`, 'm'));
}
assert.match(stableWorkflow, /git add Casks\/one-person-lab\.rb Casks\/one-person-lab-full\.rb/);
assert.match(stableWorkflow, /git push --atomic origin HEAD:main "refs\/tags\/\$\{RECEIPT_TAG\}"/);
assert.match(stableWorkflow, /remote_receipt_tag_object/);
assert.match(stableWorkflow, /local_receipt_tag_object/);
assert.match(stableWorkflow, /stable-distribution\/v\$\{version\}/);
assert.match(stableWorkflow, /opl-stable-distribution-receipt-\$\{version\}-\$\{session_hex\}/);
assert.match(stableWorkflow, /group: opl-homebrew-tap-write/);
assert.match(legacyWorkflow, /group: opl-homebrew-tap-write/);
assert.doesNotMatch(legacyWorkflow, /^\s+- stable$/m);
assert.doesNotMatch(legacyWorkflow, /^\s+- full$/m);
assert.doesNotMatch(legacyWorkflow, /^\s+- all$/m);
assert.match(legacyWorkflow, /Formal Stable writes require stable-distribution\.yml plus session\/cohort\/VM evidence/);

const version = '26.7.13';
const tag = `v${version}`;
const assets = [
  [`One-Person-Lab-${version}-mac-arm64.dmg`, 'a'],
  ['latest-arm64-mac.yml', 'b'],
  ['standard-local-authorization-policy.json', 'c'],
  [`One-Person-Lab-Full-${version}-mac-arm64.dmg`, 'd'],
  ['opl-release-manifest.json', 'e'],
].map(([name, digit]) => ({ name, digest: `sha256:${digit.repeat(64)}` }));

function mockGh(rootDir, { isLatest = false, releaseAssets = assets } = {}) {
  const bin = path.join(rootDir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const release = JSON.stringify({
    tagName: tag,
    isDraft: false,
    isPrerelease: false,
    publishedAt: '2026-07-13T00:00:00Z',
    assets: releaseAssets,
  });
  const releases = JSON.stringify([{
    tagName: tag,
    isLatest,
    isDraft: false,
    isPrerelease: false,
    publishedAt: '2026-07-13T00:00:00Z',
  }]);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -euo pipefail
if [ "$1 $2" = "release view" ]; then
  printf '%s' '${release}'
  exit 0
fi
if [ "$1 $2" = "release list" ]; then
  printf '%s' '${releases}'
  exit 0
fi
if [ "$1 $2" = "run view" ]; then
  run_id="$3"
  printf '{"databaseId":%s,"headSha":"%s","status":"completed","conclusion":"success","url":"https://github.example/runs/%s"}' "$run_id" "${'3'.repeat(40)}" "$run_id"
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

function prepareArgs(output) {
  return [
    path.join(root, 'scripts/prepare-stable-distribution.mjs'),
    '--release-tag', tag,
    '--stable-session-id', `sha256:${'1'.repeat(64)}`,
    '--release-cohort-ref', `sha256:${'2'.repeat(64)}`,
    '--app-sha', '3'.repeat(40),
    '--shell-sha', '4'.repeat(40),
    '--framework-sha', '5'.repeat(40),
    '--source-release-run-id', '29220000001',
    '--full-vm-run-id', '29220000002',
    '--full-vm-evidence-ref', 'opl-first-run-vm-full-29220000002/receipt.json',
    '--full-vm-evidence-sha256', '6'.repeat(64),
    '--full-vm-result', 'passed',
    '--output', output,
  ];
}

function createTapFixture(prefix) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(tempRoot, 'Casks'));
  return tempRoot;
}

function runPrepare(tempRoot, ghBin, args = prepareArgs(path.join(tempRoot, 'plan.json'))) {
  return spawnSync(process.execPath, args, {
    cwd: tempRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPL_HOMEBREW_TAP_ROOT: tempRoot,
      PATH: `${ghBin}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });
}

const successRoot = createTapFixture('opl-stable-distribution-success-');
const success = runPrepare(successRoot, mockGh(successRoot));
assert.equal(success.status, 0, success.stderr);
const plan = JSON.parse(fs.readFileSync(path.join(successRoot, 'plan.json'), 'utf8'));
assert.equal(plan.schema, 'opl_stable_distribution_plan.v1');
assert.equal(plan.release.latest, false);
assert.equal(plan.release.assets.length, 5);
assert.equal(plan.release.source_release_run.conclusion, 'success');
assert.equal(plan.full_vm.result, 'passed');
assert.equal(plan.full_vm.run_readback.conclusion, 'success');
assert.equal(plan.tap.standard_cask.version, version);
assert.equal(plan.tap.full_cask.version, version);
assert.match(fs.readFileSync(path.join(successRoot, plan.tap.standard_cask.path), 'utf8'), /app_standard/);
assert.match(fs.readFileSync(path.join(successRoot, plan.tap.full_cask.path), 'utf8'), /app_full_first_install/);

const finalize = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(successRoot, 'plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(successRoot, 'receipt.json'),
], {
  cwd: successRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: successRoot },
});
assert.equal(finalize.status, 0, finalize.stderr);
const receipt = JSON.parse(fs.readFileSync(path.join(successRoot, 'receipt.json'), 'utf8'));
assert.equal(receipt.schema, 'opl_stable_distribution_receipt.v1');
assert.equal(receipt.status, 'verified');
assert.equal(receipt.release.repo, 'gaofeng21cn/one-person-lab-app');
assert.equal(receipt.release.public, true);
assert.equal(receipt.release.latest, false);
assert.equal(receipt.cohort.app_sha, '3'.repeat(40));
assert.equal(receipt.full_vm.run_id, '29220000002');
assert.equal(receipt.tap.repo, 'gaofeng21cn/homebrew-one-person-lab');
assert.equal(receipt.tap.commit_sha, '7'.repeat(40));
assert.equal(receipt.tap.annotated_tag, `stable-distribution/v${version}`);
for (const cask of [receipt.tap.standard_cask, receipt.tap.full_cask]) {
  assert.match(cask.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    cask.sha256,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(successRoot, cask.path))).digest('hex'),
  );
}

const latestRoot = createTapFixture('opl-stable-distribution-latest-');
const latest = runPrepare(latestRoot, mockGh(latestRoot, { isLatest: true }));
assert.notEqual(latest.status, 0);
assert.match(latest.stderr, /before the App release is marked latest/);

const missingFullRoot = createTapFixture('opl-stable-distribution-missing-full-');
const missingFullAssets = assets.filter((asset) => !asset.name.startsWith('One-Person-Lab-Full-'));
const missingFull = runPrepare(missingFullRoot, mockGh(missingFullRoot, { releaseAssets: missingFullAssets }));
assert.notEqual(missingFull.status, 0);
assert.match(missingFull.stderr, /exactly one release asset named One-Person-Lab-Full/);

const failedVmRoot = createTapFixture('opl-stable-distribution-failed-vm-');
const failedVmArgs = prepareArgs(path.join(failedVmRoot, 'plan.json'));
failedVmArgs[failedVmArgs.indexOf('passed')] = 'failed';
const failedVm = runPrepare(failedVmRoot, mockGh(failedVmRoot), failedVmArgs);
assert.notEqual(failedVm.status, 0);
assert.match(failedVm.stderr, /full_vm_result must be passed/);

fs.appendFileSync(path.join(successRoot, receipt.tap.standard_cask.path), '# changed after plan\n');
const staleCaskReceipt = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(successRoot, 'plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(successRoot, 'stale-receipt.json'),
], {
  cwd: successRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: successRoot },
});
assert.notEqual(staleCaskReceipt.status, 0);
assert.match(staleCaskReceipt.stderr, /changed after stable distribution preparation/);
