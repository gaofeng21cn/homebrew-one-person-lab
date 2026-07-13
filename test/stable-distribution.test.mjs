import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formulaMetadataFromManifest,
  renderFormula,
} from '../scripts/sync-formula-from-framework-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stableWorkflow = read('.github/workflows/stable-distribution.yml');
const nightlyWorkflow = read('.github/workflows/sync-from-app-releases.yml');

for (const required of [
  'release_tag',
  'stable_session_id',
  'release_cohort_ref',
  'app_sha',
  'shell_sha',
  'framework_sha',
  'release_set_generation',
  'release_set_manifest_digest',
  'source_release_run_id',
  'full_vm_run_id',
  'full_vm_evidence_ref',
  'full_vm_evidence_sha256',
  'full_vm_result',
]) {
  assert.match(stableWorkflow, new RegExp(`^      ${required}:`, 'm'));
}
assert.match(stableWorkflow, /--expected-release-set-generation "\$\{\{ inputs\.release_set_generation \}\}"/);
assert.match(stableWorkflow, /--expected-manifest-digest "\$\{\{ inputs\.release_set_manifest_digest \}\}"/);
assert.match(stableWorkflow, /--resolved-manifest-output "\$RUNNER_TEMP\/opl-release-set-manifest\.json"/);
assert.match(
  stableWorkflow,
  /git add Formula\/opl\.rb Casks\/one-person-lab\.rb Casks\/one-person-lab-nightly\.rb Casks\/one-person-lab-full\.rb/,
);
assert.match(stableWorkflow, /git status --porcelain -- "\$required"/);
assert.match(stableWorkflow, /brew style "\$GITHUB_REPOSITORY\/opl"/);
assert.match(stableWorkflow, /brew audit --strict --online "\$GITHUB_REPOSITORY\/opl"/);
assert.match(stableWorkflow, /git push --atomic origin HEAD:main "refs\/tags\/\$\{RECEIPT_TAG\}"/);
assert.match(stableWorkflow, /remote_receipt_tag_object/);
assert.match(stableWorkflow, /local_receipt_tag_object/);
assert.match(stableWorkflow, /stable-distribution\/v\$\{version\}/);
assert.match(stableWorkflow, /opl-stable-distribution-receipt-\$\{version\}-\$\{session_hex\}/);
assert.match(stableWorkflow, /group: opl-homebrew-tap-write/);
assert.match(nightlyWorkflow, /group: opl-homebrew-tap-write/);
assert.match(nightlyWorkflow, /--allow-missing-nightly/);
assert.doesNotMatch(nightlyWorkflow, /sync-formula-from-framework-manifest/);
assert.match(nightlyWorkflow, /git add Casks\/one-person-lab-nightly\.rb/);
assert.doesNotMatch(nightlyWorkflow, /git add Formula\/opl\.rb/);
assert.doesNotMatch(nightlyWorkflow, /^\s+- stable$/m);
assert.doesNotMatch(nightlyWorkflow, /^\s+- full$/m);
assert.doesNotMatch(nightlyWorkflow, /^\s+- all$/m);
assert.match(nightlyWorkflow, /Formal Stable writes require stable-distribution\.yml plus session\/cohort\/VM evidence/);

const version = '26.7.13';
const tag = `v${version}`;
const releaseSetGeneration = '26.7.13-r4';
const releaseSetManifestDigest = `sha256:${'8'.repeat(64)}`;
const appSha = '3'.repeat(40);
const shellSha = '4'.repeat(40);
const frameworkSha = '5'.repeat(40);
const frameworkVersion = '0.2.1';
const frameworkArtifact = `ghcr.io/gaofeng21cn/one-person-lab-framework:${frameworkVersion}`;
const frameworkArtifactDigest = `sha256:${'f'.repeat(64)}`;
const canonicalPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
const assets = [
  [`One-Person-Lab-${version}-mac-arm64.dmg`, 'a'],
  ['latest-arm64-mac.yml', 'b'],
  ['standard-local-authorization-policy.json', 'c'],
  [`One-Person-Lab-Full-${version}-mac-arm64.dmg`, 'd'],
  ['opl-release-manifest.json', 'e'],
].map(([name, digit]) => ({ name, digest: `sha256:${digit.repeat(64)}` }));

function releaseSetManifest(overrides = {}) {
  const packageArtifacts = Object.fromEntries(canonicalPackageIds.map((packageId) => [packageId, {
    package_id: packageId,
    version: '0.2.0',
  }]));
  const packageMembers = Object.fromEntries(canonicalPackageIds.map((packageId) => [packageId, {
    component_id: packageId,
    component_kind: 'package',
    package_id: packageId,
    version: '0.2.0',
  }]));
  const manifest = {
    release_set_generation: releaseSetGeneration,
    release_set: {
      surface_kind: 'opl_release_set.v2',
      generation: releaseSetGeneration,
      bom_status: 'complete',
      bom_digest: `sha256:${'7'.repeat(64)}`,
      component_count: 9,
      components: {
        base: {
          component_id: 'opl-base',
          component_kind: 'base',
          version: frameworkVersion,
          source_commit: frameworkSha,
          artifact_ref: frameworkArtifact,
          artifact_digest: frameworkArtifactDigest,
          artifact_status: 'published_immutable',
        },
        app: {
          component_id: 'opl-app',
          component_kind: 'app',
          version,
          source_commit: appSha,
          artifact_ref: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${tag}/One-Person-Lab-${version}-mac-arm64.dmg`,
          artifact_digest: `sha256:${'a'.repeat(64)}`,
          artifact_status: 'published_immutable',
          release_status: 'published',
          release_tag: tag,
        },
        packages: {
          package_count: 7,
          members: packageMembers,
        },
      },
    },
    packages: {
      framework_core: {
        version: frameworkVersion,
        artifact: frameworkArtifact,
        artifact_digest: frameworkArtifactDigest,
        artifact_status: 'published_immutable',
        source_git: {
          repo_url: 'https://github.com/gaofeng21cn/one-person-lab.git',
          head_sha: frameworkSha,
        },
        source_archive: { sha256: '9'.repeat(64) },
        homebrew_formula: {
          surface_kind: 'opl_homebrew_formula_projection.v1',
          formula_name: 'opl',
          package_name: 'opl',
          approval_status: 'owner_approved',
          carrier_scope: 'framework_core_only',
          version: frameworkVersion,
          source_head: frameworkSha,
          archive_url: `https://github.com/gaofeng21cn/one-person-lab/archive/${frameworkSha}.tar.gz`,
          archive_kind: 'immutable_github_commit_archive',
          sha256_source: 'tap_sync_download_and_hash',
          tap_generator_role: 'consume_projection_without_inference',
        },
      },
      package_artifacts: packageArtifacts,
    },
  };
  return { ...manifest, ...overrides };
}

function mockGh(rootDir, {
  isLatest = false,
  releaseAssets = assets,
  sourceRunStatus = 'completed',
  sourceRunConclusion = 'success',
  fullVmRunStatus = 'completed',
  fullVmRunConclusion = 'success',
} = {}) {
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
  if [ "$run_id" = "29220000001" ]; then
    status="${sourceRunStatus}"
    conclusion="${sourceRunConclusion}"
  else
    status="${fullVmRunStatus}"
    conclusion="${fullVmRunConclusion}"
  fi
  printf '{"databaseId":%s,"headSha":"%s","status":"%s","conclusion":"%s","url":"https://github.example/runs/%s"}' "$run_id" "${appSha}" "$status" "$conclusion" "$run_id"
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

function prepareArgs(tempRoot, output = path.join(tempRoot, 'plan.json')) {
  return [
    path.join(root, 'scripts/prepare-stable-distribution.mjs'),
    '--release-tag', tag,
    '--stable-session-id', `sha256:${'1'.repeat(64)}`,
    '--release-cohort-ref', `sha256:${'2'.repeat(64)}`,
    '--app-sha', appSha,
    '--shell-sha', shellSha,
    '--framework-sha', frameworkSha,
    '--release-set-generation', releaseSetGeneration,
    '--release-set-manifest', path.join(tempRoot, 'opl-release-set-manifest.json'),
    '--release-set-manifest-digest', releaseSetManifestDigest,
    '--source-release-run-id', '29220000001',
    '--full-vm-run-id', '29220000002',
    '--full-vm-evidence-ref', 'opl-first-run-vm-full-29220000002/receipt.json',
    '--full-vm-evidence-sha256', '6'.repeat(64),
    '--full-vm-result', 'passed',
    '--output', output,
  ];
}

function createTapFixture(prefix, manifest = releaseSetManifest()) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(tempRoot, 'Casks'));
  fs.copyFileSync(
    path.join(root, 'Casks/one-person-lab-nightly.rb'),
    path.join(tempRoot, 'Casks/one-person-lab-nightly.rb'),
  );
  fs.mkdirSync(path.join(tempRoot, 'Formula'));
  const metadata = formulaMetadataFromManifest(manifest);
  fs.writeFileSync(
    path.join(tempRoot, 'Formula/opl.rb'),
    renderFormula({ ...metadata, transportSha256: '0'.repeat(64) }),
  );
  fs.writeFileSync(
    path.join(tempRoot, 'opl-release-set-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return tempRoot;
}

function runPrepare(tempRoot, ghBin, args = prepareArgs(tempRoot)) {
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
assert.equal(plan.schema, 'opl_stable_distribution_plan.v2');
assert.equal(plan.release.latest, false);
assert.equal(plan.release.assets.length, 5);
assert.equal(plan.release.source_release_run.conclusion, 'success');
assert.equal(plan.full_vm.result, 'passed');
assert.equal(plan.full_vm.run_readback.conclusion, 'success');
assert.equal(plan.release_set.generation, releaseSetGeneration);
assert.equal(plan.release_set.manifest_digest, releaseSetManifestDigest);
assert.equal(plan.release_set.stable_channel_digest, releaseSetManifestDigest);
assert.equal(plan.release_set.formula.formula_name, 'opl');
assert.equal(plan.release_set.formula.version, frameworkVersion);
assert.equal(plan.release_set.formula.transport_sha256, '0'.repeat(64));
assert.equal(plan.release_set.base.source_commit, frameworkSha);
assert.equal(plan.release_set.app.source_commit, appSha);
for (const distribution of [
  plan.tap.standard_cask,
  plan.tap.full_cask,
  plan.tap.nightly_cask,
]) {
  assert.match(
    fs.readFileSync(path.join(successRoot, distribution.path), 'utf8'),
    /depends_on formula: "opl"/,
  );
}

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
assert.equal(receipt.schema, 'opl_stable_distribution_receipt.v2');
assert.equal(receipt.status, 'verified');
assert.equal(receipt.release.repo, 'gaofeng21cn/one-person-lab-app');
assert.equal(receipt.release.public, true);
assert.equal(receipt.release.latest, false);
assert.equal(receipt.release.source_release_run.conclusion, 'success');
assert.equal(receipt.cohort.app_sha, appSha);
assert.equal(receipt.cohort.framework_sha, frameworkSha);
assert.equal(receipt.release_set.manifest_digest, releaseSetManifestDigest);
assert.equal(receipt.full_vm.run_id, '29220000002');
assert.equal(receipt.tap.repo, 'gaofeng21cn/homebrew-one-person-lab');
assert.equal(receipt.tap.commit_sha, '7'.repeat(40));
assert.equal(receipt.tap.annotated_tag, `stable-distribution/v${version}`);
for (const distribution of [
  receipt.tap.formula,
  receipt.tap.standard_cask,
  receipt.tap.full_cask,
  receipt.tap.nightly_cask,
]) {
  assert.match(distribution.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    distribution.sha256,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(successRoot, distribution.path))).digest('hex'),
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
const failedVmArgs = prepareArgs(failedVmRoot);
failedVmArgs[failedVmArgs.indexOf('passed')] = 'failed';
const failedVm = runPrepare(failedVmRoot, mockGh(failedVmRoot), failedVmArgs);
assert.notEqual(failedVm.status, 0);
assert.match(failedVm.stderr, /full_vm_result must be passed/);

const failedSourceRoot = createTapFixture('opl-stable-distribution-failed-source-');
const failedSource = runPrepare(failedSourceRoot, mockGh(failedSourceRoot, {
  sourceRunConclusion: 'failure',
}));
assert.notEqual(failedSource.status, 0);
assert.match(failedSource.stderr, /Source release must complete successfully before Stable distribution/);

const runningSourceRoot = createTapFixture('opl-stable-distribution-running-source-');
const runningSource = runPrepare(runningSourceRoot, mockGh(runningSourceRoot, {
  sourceRunStatus: 'in_progress',
  sourceRunConclusion: '',
}));
assert.notEqual(runningSource.status, 0);
assert.match(runningSource.stderr, /Source release must be completed before Stable distribution/);

const failedFullVmRunRoot = createTapFixture('opl-stable-distribution-failed-full-vm-run-');
const failedFullVmRun = runPrepare(failedFullVmRunRoot, mockGh(failedFullVmRunRoot, {
  fullVmRunConclusion: 'failure',
}));
assert.notEqual(failedFullVmRun.status, 0);
assert.match(failedFullVmRun.stderr, /Full clean-VM must complete successfully before Stable distribution/);

const mismatchedAppManifest = releaseSetManifest();
mismatchedAppManifest.release_set.components.app.artifact_digest = `sha256:${'0'.repeat(64)}`;
const mismatchedAppRoot = createTapFixture('opl-stable-distribution-app-mismatch-', mismatchedAppManifest);
const mismatchedApp = runPrepare(mismatchedAppRoot, mockGh(mismatchedAppRoot));
assert.notEqual(mismatchedApp.status, 0);
assert.match(mismatchedApp.stderr, /App release and Release Set v2 App component/);

const tamperedPlan = structuredClone(plan);
tamperedPlan.release_set.manifest_digest = `sha256:${'0'.repeat(64)}`;
fs.writeFileSync(path.join(successRoot, 'tampered-plan.json'), `${JSON.stringify(tamperedPlan, null, 2)}\n`);
const tamperedReceipt = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(successRoot, 'tampered-plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(successRoot, 'tampered-receipt.json'),
], {
  cwd: successRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: successRoot },
});
assert.notEqual(tamperedReceipt.status, 0);
assert.match(tamperedReceipt.stderr, /one exact Release Set cohort/);

fs.appendFileSync(path.join(successRoot, receipt.tap.formula.path), '# changed after plan\n');
const staleFormulaReceipt = spawnSync(process.execPath, [
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
assert.notEqual(staleFormulaReceipt.status, 0);
assert.match(staleFormulaReceipt.stderr, /Formula\/opl\.rb changed after stable distribution preparation/);
