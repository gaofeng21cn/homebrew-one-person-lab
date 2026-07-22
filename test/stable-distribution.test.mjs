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
  'full_vm_evidence_base64',
  'full_vm_evidence_sha256',
  'full_vm_result',
]) {
  assert.match(stableWorkflow, new RegExp(`^      ${required}:`, 'm'));
}
assert.match(stableWorkflow, /--expected-release-set-generation "\$\{\{ inputs\.release_set_generation \}\}"/);
assert.match(stableWorkflow, /--expected-manifest-digest "\$\{\{ inputs\.release_set_manifest_digest \}\}"/);
assert.match(stableWorkflow, /--resolved-manifest-output "\$RUNNER_TEMP\/opl-release-set-manifest\.json"/);
assert.doesNotMatch(stableWorkflow, /actions\/download-artifact/);
assert.doesNotMatch(stableWorkflow, /^\s+actions: read$/m);
assert.match(stableWorkflow, /FULL_VM_EVIDENCE_BASE64: \$\{\{ inputs\.full_vm_evidence_base64 \}\}/);
assert.match(stableWorkflow, /bytes\.toString\('base64'\) !== encoded/);
assert.match(stableWorkflow, /--full-vm-evidence "\$\{\{ steps\.full_vm_evidence\.outputs\.receipt \}\}"/);
assert.doesNotMatch(stableWorkflow, /\bmapfile\b/);
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
assert.match(
  nightlyWorkflow,
  /Formal Stable writes require stable-standard-distribution\.yml or stable-distribution\.yml plus session\/cohort\/VM evidence/,
);

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
const stableSessionId = `sha256:${'1'.repeat(64)}`;
const releaseCohortRef = `sha256:${'2'.repeat(64)}`;
const sourceRunId = '29220000001';
const fullVmRunId = '29220000002';
const fullVmEvidenceRef = `opl-first-run-vm-full-${fullVmRunId}`;
const buildSmokeHarnessSha256 = '6'.repeat(64);
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
  sourceRunJobs = [],
  fullVmRunStatus = 'completed',
  fullVmRunConclusion = 'success',
  fullVmHeadSha = appSha,
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
  const sourceRun = JSON.stringify({
    databaseId: Number(sourceRunId),
    headSha: appSha,
    status: sourceRunStatus,
    conclusion: sourceRunConclusion,
    url: `https://github.example/runs/${sourceRunId}`,
    jobs: sourceRunJobs,
  });
  const fullVmRun = JSON.stringify({
    databaseId: Number(fullVmRunId),
    headSha: fullVmHeadSha,
    status: fullVmRunStatus,
    conclusion: fullVmRunConclusion,
    url: `https://github.example/runs/${fullVmRunId}`,
    jobs: [],
  });
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
  if [ "$run_id" = "${sourceRunId}" ]; then
    printf '%s' '${sourceRun}'
  else
    printf '%s' '${fullVmRun}'
  fi
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

function scopeProof({
  verificationAppSha = appSha,
  verificationShellSha = shellSha,
  classification = 'same_as_artifact_cohort',
  appChangedPaths = [],
  shellChangedPaths = [],
} = {}) {
  return {
    schema: 'opl_app_qualification_harness_scope.v1',
    classification,
    app: {
      repo: 'gaofeng21cn/one-person-lab-app',
      base_sha: appSha,
      head_sha: verificationAppSha,
      changed_paths: appChangedPaths,
    },
    shell: {
      repo: 'gaofeng21cn/opl-aion-shell',
      base_sha: shellSha,
      head_sha: verificationShellSha,
      changed_paths: shellChangedPaths,
    },
  };
}

function scopeProofV2() {
  return {
    schema: 'opl_app_qualification_harness_scope.v2',
    profile: 'full',
    classification: 'same_as_artifact_cohort',
    expectations: {
      artifact_semantic_digest: '7'.repeat(64),
      verification_semantic_digest: '7'.repeat(64),
      semantic_equal: true,
      artifact_probe_digest: '8'.repeat(64),
      verification_probe_digest: '8'.repeat(64),
      probe_equal: true,
    },
    reuse_authorization: {
      allowed: true,
      reason: 'exact_cohort',
      forbidden_paths: { app: [], shell: [] },
    },
    app: {
      repo: 'gaofeng21cn/one-person-lab-app',
      base_sha: appSha,
      head_sha: appSha,
      changed_paths: [],
    },
    shell: {
      repo: 'gaofeng21cn/opl-aion-shell',
      base_sha: shellSha,
      head_sha: shellSha,
      changed_paths: [],
    },
  };
}

function writeFullVmEvidence(tempRoot, overrides = {}) {
  const receipt = {
    schema: 'opl_app_artifact_qualification_receipt.v1',
    status: 'passed',
    stable_session_id: stableSessionId,
    release_cohort_ref: releaseCohortRef,
    version,
    package_profile: 'full',
    qualification: {
      run_id: fullVmRunId,
      source_artifact_run_id: sourceRunId,
      source_artifact_name: `opl-full-first-install-dmg-${version}-mac-arm64`,
      evidence_ref: fullVmEvidenceRef,
      result: 'passed',
    },
    artifact: {
      name: `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
      sha256: 'd'.repeat(64),
      size_bytes: 123,
    },
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
    build_manifest: {
      schema: 'opl_app_build_artifact_cohort.v2',
      sha256: 'f'.repeat(64),
      smoke_harness_sha256: buildSmokeHarnessSha256,
    },
    verification_harness: {
      app_sha: appSha,
      shell_sha: shellSha,
      smoke_harness_sha256: buildSmokeHarnessSha256,
      differs_from_artifact_cohort: false,
      change_scope: 'same_as_artifact_cohort',
      scope_proof: scopeProof(),
    },
    smoke_summary: { path: 'tart-smoke-summary.json', sha256: 'a'.repeat(64) },
    ...overrides,
  };
  const receiptPath = path.join(tempRoot, 'artifact-qualification-receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receiptPath;
}

function prepareArgs(tempRoot, output = path.join(tempRoot, 'plan.json')) {
  const fullVmEvidence = path.join(tempRoot, 'artifact-qualification-receipt.json');
  return [
    path.join(root, 'scripts/prepare-stable-distribution.mjs'),
    '--release-tag', tag,
    '--stable-session-id', stableSessionId,
    '--release-cohort-ref', releaseCohortRef,
    '--app-sha', appSha,
    '--shell-sha', shellSha,
    '--framework-sha', frameworkSha,
    '--release-set-generation', releaseSetGeneration,
    '--release-set-manifest', path.join(tempRoot, 'opl-release-set-manifest.json'),
    '--release-set-manifest-digest', releaseSetManifestDigest,
    '--source-release-run-id', sourceRunId,
    '--full-vm-run-id', fullVmRunId,
    '--full-vm-evidence', fullVmEvidence,
    '--full-vm-evidence-ref', fullVmEvidenceRef,
    '--full-vm-evidence-sha256', crypto.createHash('sha256').update(fs.readFileSync(fullVmEvidence)).digest('hex'),
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
  writeFullVmEvidence(tempRoot);
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
assert.equal(plan.release.source_release_run.qualification.mode, 'source_run_success');
assert.equal(plan.full_vm.result, 'passed');
assert.equal(plan.full_vm.run_readback.conclusion, 'success');
assert.equal(plan.full_vm.evidence_receipt.status, 'passed');
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
assert.equal(receipt.full_vm.run_id, fullVmRunId);
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
assert.match(failedSource.stderr, /Source release has unexpected failed jobs/);

const supersededSourceRoot = createTapFixture('opl-stable-distribution-superseded-source-');
const supersededSource = runPrepare(supersededSourceRoot, mockGh(supersededSourceRoot, {
  sourceRunConclusion: 'failure',
  sourceRunJobs: [{
    name: 'Run clean Full first-run VM smoke / Clean VM first launch',
    status: 'completed',
    conclusion: 'failure',
  }],
}));
assert.equal(supersededSource.status, 0, supersededSource.stderr);
const supersededPlan = JSON.parse(fs.readFileSync(path.join(supersededSourceRoot, 'plan.json'), 'utf8'));
assert.equal(supersededPlan.release.source_release_run.qualification.mode, 'exact_full_vm_receipt_supersession');
const supersededFinalize = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(supersededSourceRoot, 'plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(supersededSourceRoot, 'receipt.json'),
], {
  cwd: supersededSourceRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: supersededSourceRoot },
});
assert.equal(supersededFinalize.status, 0, supersededFinalize.stderr);

const forgedSourcePlan = structuredClone(supersededPlan);
forgedSourcePlan.release.source_release_run.qualification.mode = 'source_run_success';
fs.writeFileSync(
  path.join(supersededSourceRoot, 'forged-source-plan.json'),
  `${JSON.stringify(forgedSourcePlan, null, 2)}\n`,
);
const forgedSourceFinalize = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(supersededSourceRoot, 'forged-source-plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(supersededSourceRoot, 'forged-receipt.json'),
], {
  cwd: supersededSourceRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: supersededSourceRoot },
});
assert.notEqual(forgedSourceFinalize.status, 0);
assert.match(forgedSourceFinalize.stderr, /passed App and Full qualification evidence/);

const forgedHarnessPlan = structuredClone(supersededPlan);
forgedHarnessPlan.full_vm.run_readback.head_sha = '8'.repeat(40);
fs.writeFileSync(
  path.join(supersededSourceRoot, 'forged-harness-plan.json'),
  `${JSON.stringify(forgedHarnessPlan, null, 2)}\n`,
);
const forgedHarnessFinalize = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(supersededSourceRoot, 'forged-harness-plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(supersededSourceRoot, 'forged-harness-receipt.json'),
], {
  cwd: supersededSourceRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: supersededSourceRoot },
});
assert.notEqual(forgedHarnessFinalize.status, 0);
assert.match(forgedHarnessFinalize.stderr, /passed App and Full qualification evidence/);

const unexpectedSourceRoot = createTapFixture('opl-stable-distribution-unexpected-source-');
const unexpectedSource = runPrepare(unexpectedSourceRoot, mockGh(unexpectedSourceRoot, {
  sourceRunConclusion: 'failure',
  sourceRunJobs: [{ name: 'Release source gate', status: 'completed', conclusion: 'failure' }],
}));
assert.notEqual(unexpectedSource.status, 0);
assert.match(unexpectedSource.stderr, /Release source gate/);

const cancelledSourceRoot = createTapFixture('opl-stable-distribution-cancelled-source-');
const cancelledSource = runPrepare(cancelledSourceRoot, mockGh(cancelledSourceRoot, {
  sourceRunConclusion: 'failure',
  sourceRunJobs: [
    {
      name: 'Run clean Full first-run VM smoke / Clean VM first launch',
      status: 'completed',
      conclusion: 'failure',
    },
    { name: 'Publish Full first-install assets', status: 'completed', conclusion: 'cancelled' },
  ],
}));
assert.notEqual(cancelledSource.status, 0);
assert.match(cancelledSource.stderr, /Publish Full first-install assets \(cancelled\)/);

const scopeV2Root = createTapFixture('opl-stable-distribution-scope-v2-');
const scopeV2ReceiptPath = path.join(scopeV2Root, 'artifact-qualification-receipt.json');
const scopeV2Receipt = JSON.parse(fs.readFileSync(scopeV2ReceiptPath, 'utf8'));
scopeV2Receipt.verification_harness.scope_proof = scopeProofV2();
fs.writeFileSync(scopeV2ReceiptPath, `${JSON.stringify(scopeV2Receipt, null, 2)}\n`);
const scopeV2Run = runPrepare(scopeV2Root, mockGh(scopeV2Root));
assert.equal(scopeV2Run.status, 0, scopeV2Run.stderr);

const harnessSha = '9'.repeat(40);
const harnessRoot = createTapFixture('opl-stable-distribution-harness-scope-');
const harnessReceiptPath = path.join(harnessRoot, 'artifact-qualification-receipt.json');
const harnessReceipt = JSON.parse(fs.readFileSync(harnessReceiptPath, 'utf8'));
harnessReceipt.verification_harness = {
  ...harnessReceipt.verification_harness,
  app_sha: harnessSha,
  differs_from_artifact_cohort: true,
  change_scope: 'smoke_or_validator_only',
  scope_proof: scopeProof({
    verificationAppSha: harnessSha,
    classification: 'smoke_or_validator_only',
    appChangedPaths: ['.github/workflows/opl-first-run-vm.yml'],
  }),
};
fs.writeFileSync(harnessReceiptPath, `${JSON.stringify(harnessReceipt, null, 2)}\n`);
const harnessRun = runPrepare(harnessRoot, mockGh(harnessRoot, { fullVmHeadSha: harnessSha }));
assert.equal(harnessRun.status, 0, harnessRun.stderr);

const wrongHarnessRoot = createTapFixture('opl-stable-distribution-wrong-harness-');
const wrongHarnessReceiptPath = path.join(wrongHarnessRoot, 'artifact-qualification-receipt.json');
const wrongHarnessReceipt = JSON.parse(fs.readFileSync(wrongHarnessReceiptPath, 'utf8'));
wrongHarnessReceipt.verification_harness = {
  ...wrongHarnessReceipt.verification_harness,
  app_sha: harnessSha,
  differs_from_artifact_cohort: true,
  change_scope: 'smoke_or_validator_only',
  scope_proof: scopeProof({
    verificationAppSha: harnessSha,
    classification: 'smoke_or_validator_only',
    appChangedPaths: ['.github/workflows/opl-first-run-vm.yml'],
  }),
};
fs.writeFileSync(wrongHarnessReceiptPath, `${JSON.stringify(wrongHarnessReceipt, null, 2)}\n`);
const wrongHarnessRun = runPrepare(wrongHarnessRoot, mockGh(wrongHarnessRoot));
assert.notEqual(wrongHarnessRun.status, 0);
assert.match(wrongHarnessRun.stderr, /expected head SHA/);

const smokeOnlyHarnessRoot = createTapFixture('opl-stable-distribution-smoke-only-harness-');
const smokeOnlyHarnessReceiptPath = path.join(smokeOnlyHarnessRoot, 'artifact-qualification-receipt.json');
const smokeOnlyHarnessReceipt = JSON.parse(fs.readFileSync(smokeOnlyHarnessReceiptPath, 'utf8'));
smokeOnlyHarnessReceipt.verification_harness = {
  ...smokeOnlyHarnessReceipt.verification_harness,
  smoke_harness_sha256: '9'.repeat(64),
  differs_from_artifact_cohort: true,
  change_scope: 'smoke_or_validator_only',
  scope_proof: scopeProof({ classification: 'smoke_or_validator_only' }),
};
fs.writeFileSync(smokeOnlyHarnessReceiptPath, `${JSON.stringify(smokeOnlyHarnessReceipt, null, 2)}\n`);
const smokeOnlyHarnessRun = runPrepare(smokeOnlyHarnessRoot, mockGh(smokeOnlyHarnessRoot));
assert.equal(smokeOnlyHarnessRun.status, 0, smokeOnlyHarnessRun.stderr);

const forgedEnumRoot = createTapFixture('opl-stable-distribution-forged-enum-');
const forgedEnumReceiptPath = path.join(forgedEnumRoot, 'artifact-qualification-receipt.json');
const forgedEnumReceipt = JSON.parse(fs.readFileSync(forgedEnumReceiptPath, 'utf8'));
forgedEnumReceipt.verification_harness.change_scope = 'same_cohort';
fs.writeFileSync(forgedEnumReceiptPath, `${JSON.stringify(forgedEnumReceipt, null, 2)}\n`);
const forgedEnumRun = runPrepare(forgedEnumRoot, mockGh(forgedEnumRoot));
assert.notEqual(forgedEnumRun.status, 0);
assert.match(forgedEnumRun.stderr, /change_scope must be same_as_artifact_cohort/);

const forgedSmokeDigestRoot = createTapFixture('opl-stable-distribution-forged-smoke-digest-');
const forgedSmokeDigestReceiptPath = path.join(forgedSmokeDigestRoot, 'artifact-qualification-receipt.json');
const forgedSmokeDigestReceipt = JSON.parse(fs.readFileSync(forgedSmokeDigestReceiptPath, 'utf8'));
forgedSmokeDigestReceipt.verification_harness.smoke_harness_sha256 = 'not-a-sha256';
fs.writeFileSync(forgedSmokeDigestReceiptPath, `${JSON.stringify(forgedSmokeDigestReceipt, null, 2)}\n`);
const forgedSmokeDigestRun = runPrepare(forgedSmokeDigestRoot, mockGh(forgedSmokeDigestRoot));
assert.notEqual(forgedSmokeDigestRun.status, 0);
assert.match(forgedSmokeDigestRun.stderr, /verification harness smoke_harness_sha256/);

const forgedBuildSmokeDigestRoot = createTapFixture('opl-stable-distribution-forged-build-smoke-digest-');
const forgedBuildSmokeDigestReceiptPath = path.join(forgedBuildSmokeDigestRoot, 'artifact-qualification-receipt.json');
const forgedBuildSmokeDigestReceipt = JSON.parse(fs.readFileSync(forgedBuildSmokeDigestReceiptPath, 'utf8'));
forgedBuildSmokeDigestReceipt.build_manifest.smoke_harness_sha256 = 'not-a-sha256';
fs.writeFileSync(
  forgedBuildSmokeDigestReceiptPath,
  `${JSON.stringify(forgedBuildSmokeDigestReceipt, null, 2)}\n`,
);
const forgedBuildSmokeDigestRun = runPrepare(
  forgedBuildSmokeDigestRoot,
  mockGh(forgedBuildSmokeDigestRoot),
);
assert.notEqual(forgedBuildSmokeDigestRun.status, 0);
assert.match(forgedBuildSmokeDigestRun.stderr, /build_manifest smoke_harness_sha256/);

const missingScopeProofRoot = createTapFixture('opl-stable-distribution-missing-scope-proof-');
const missingScopeProofReceiptPath = path.join(missingScopeProofRoot, 'artifact-qualification-receipt.json');
const missingScopeProofReceipt = JSON.parse(fs.readFileSync(missingScopeProofReceiptPath, 'utf8'));
delete missingScopeProofReceipt.verification_harness.scope_proof;
fs.writeFileSync(missingScopeProofReceiptPath, `${JSON.stringify(missingScopeProofReceipt, null, 2)}\n`);
const missingScopeProofRun = runPrepare(missingScopeProofRoot, mockGh(missingScopeProofRoot));
assert.notEqual(missingScopeProofRun.status, 0);
assert.match(missingScopeProofRun.stderr, /scope_proof must be an object/);

const forgedFinalizerScopePlan = structuredClone(plan);
forgedFinalizerScopePlan.full_vm.evidence_receipt.verification_harness.change_scope = 'same_cohort';
fs.writeFileSync(
  path.join(successRoot, 'forged-finalizer-scope-plan.json'),
  `${JSON.stringify(forgedFinalizerScopePlan, null, 2)}\n`,
);
const forgedFinalizerScope = spawnSync(process.execPath, [
  path.join(root, 'scripts/finalize-stable-distribution-receipt.mjs'),
  '--plan', path.join(successRoot, 'forged-finalizer-scope-plan.json'),
  '--tap-commit', '7'.repeat(40),
  '--annotated-tag', `stable-distribution/v${version}`,
  '--output', path.join(successRoot, 'forged-finalizer-scope-receipt.json'),
], {
  cwd: successRoot,
  encoding: 'utf8',
  env: { ...process.env, OPL_HOMEBREW_TAP_ROOT: successRoot },
});
assert.notEqual(forgedFinalizerScope.status, 0);
assert.match(forgedFinalizerScope.stderr, /change_scope must be same_as_artifact_cohort/);

const digestMismatchRoot = createTapFixture('opl-stable-distribution-digest-mismatch-');
const digestMismatchArgs = prepareArgs(digestMismatchRoot);
digestMismatchArgs[digestMismatchArgs.indexOf('--full-vm-evidence-sha256') + 1] = '0'.repeat(64);
const digestMismatch = runPrepare(digestMismatchRoot, mockGh(digestMismatchRoot), digestMismatchArgs);
assert.notEqual(digestMismatch.status, 0);
assert.match(digestMismatch.stderr, /receipt digest does not match/);

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
