#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formulaMetadataFromManifest,
  writeFileAtomically,
} from './sync-formula-from-framework-manifest.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tapRoot = process.env.OPL_HOMEBREW_TAP_ROOT
  ? path.resolve(process.env.OPL_HOMEBREW_TAP_ROOT)
  : scriptRoot;
const appRepo = 'gaofeng21cn/one-person-lab-app';
const tapRepo = 'gaofeng21cn/homebrew-one-person-lab';
const releaseSetRepo = 'ghcr.io/gaofeng21cn/one-person-lab-manifest';
const shaRefPattern = /^sha256:[a-f0-9]{64}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const gitShaPattern = /^[a-f0-9]{40}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const stableTagPattern = /^v(?<version>[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01]))$/;

function parseArgs(argv) {
  const options = {
    releaseTag: '',
    stableSessionId: '',
    releaseCohortRef: '',
    appSha: '',
    shellSha: '',
    frameworkSha: '',
    releaseSetGeneration: '',
    releaseSetManifest: '',
    releaseSetManifestDigest: '',
    sourceReleaseRunId: '',
    fullVmRunId: '',
    fullVmEvidence: '',
    fullVmEvidenceRef: '',
    fullVmEvidenceSha256: '',
    fullVmResult: '',
    output: '',
  };
  const keys = {
    '--release-tag': 'releaseTag',
    '--stable-session-id': 'stableSessionId',
    '--release-cohort-ref': 'releaseCohortRef',
    '--app-sha': 'appSha',
    '--shell-sha': 'shellSha',
    '--framework-sha': 'frameworkSha',
    '--release-set-generation': 'releaseSetGeneration',
    '--release-set-manifest': 'releaseSetManifest',
    '--release-set-manifest-digest': 'releaseSetManifestDigest',
    '--source-release-run-id': 'sourceReleaseRunId',
    '--full-vm-run-id': 'fullVmRunId',
    '--full-vm-evidence': 'fullVmEvidence',
    '--full-vm-evidence-ref': 'fullVmEvidenceRef',
    '--full-vm-evidence-sha256': 'fullVmEvidenceSha256',
    '--full-vm-result': 'fullVmResult',
    '--output': 'output',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const key = keys[token];
    if (!key) throw new Error(`Unknown option: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value.`);
    options[key] = value;
    index += 1;
  }
  for (const [key, value] of Object.entries(options)) {
    if (!value) throw new Error(`Missing required stable distribution input: ${key}.`);
  }
  return options;
}

function assertInputs(options) {
  if (!stableTagPattern.test(options.releaseTag)) {
    throw new Error('Stable distribution release tag must use vYY.M.D.');
  }
  for (const [label, value] of [
    ['stable_session_id', options.stableSessionId],
    ['release_cohort_ref', options.releaseCohortRef],
  ]) {
    if (!shaRefPattern.test(value)) throw new Error(`${label} must be sha256:<64 lowercase hex>.`);
  }
  for (const [label, value] of [
    ['app_sha', options.appSha],
    ['shell_sha', options.shellSha],
    ['framework_sha', options.frameworkSha],
  ]) {
    if (!gitShaPattern.test(value)) throw new Error(`${label} must be a 40-character lowercase Git SHA.`);
  }
  for (const [label, value] of [
    ['source_release_run_id', options.sourceReleaseRunId],
    ['full_vm_run_id', options.fullVmRunId],
  ]) {
    if (!runIdPattern.test(value)) throw new Error(`${label} must be a decimal GitHub Actions run id.`);
  }
  if (!options.fullVmEvidenceRef.trim()) throw new Error('full_vm_evidence_ref must not be empty.');
  if (!sha256Pattern.test(options.fullVmEvidenceSha256)) {
    throw new Error('full_vm_evidence_sha256 must be 64 lowercase hex characters.');
  }
  if (options.fullVmResult !== 'passed') throw new Error('full_vm_result must be passed.');
  if (!/^[0-9]{2}\.[0-9]{1,2}\.[0-9]{1,2}(?:-r[1-9][0-9]*)?$/.test(options.releaseSetGeneration)) {
    throw new Error('release_set_generation must use YY.M.D[-rN].');
  }
  if (!shaRefPattern.test(options.releaseSetManifestDigest)) {
    throw new Error('release_set_manifest_digest must be sha256:<64 lowercase hex>.');
  }
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function releaseReadback(tag) {
  const release = ghJson([
    'release', 'view', tag,
    '--repo', appRepo,
    '--json', 'tagName,isDraft,isPrerelease,publishedAt,assets',
  ]);
  const releases = ghJson([
    'release', 'list',
    '--repo', appRepo,
    '--limit', '50',
    '--json', 'tagName,isLatest,isDraft,isPrerelease,publishedAt',
  ]);
  const listed = releases.find((candidate) => candidate?.tagName === tag);
  if (release.tagName !== tag || listed?.tagName !== tag) {
    throw new Error(`Stable distribution release readback did not resolve exact tag ${tag}.`);
  }
  if (release.isDraft || release.isPrerelease || !release.publishedAt) {
    throw new Error('Stable distribution requires a public non-draft, non-prerelease App release.');
  }
  if (listed.isLatest !== false) {
    throw new Error('Stable distribution must finish before the App release is marked latest.');
  }
  return release;
}

function actionsRunReadback(runId, expectedHeadSha, label, { requireSuccess }) {
  const run = ghJson([
    'run', 'view', runId,
    '--repo', appRepo,
    '--json', 'databaseId,headSha,status,conclusion,url,jobs',
  ]);
  if (String(run.databaseId) !== runId) {
    throw new Error(`${label} run id mismatch: expected ${runId}, got ${run.databaseId || '(missing)'}.`);
  }
  if (expectedHeadSha && run.headSha !== expectedHeadSha) {
    throw new Error(`${label} must use expected head SHA ${expectedHeadSha}, got ${run.headSha || '(missing)'}.`);
  }
  if (run.status !== 'completed') {
    throw new Error(`${label} must be completed before Stable distribution.`);
  }
  if (requireSuccess && run.conclusion !== 'success') {
    throw new Error(`${label} must complete successfully before Stable distribution.`);
  }
  return {
    run_id: runId,
    head_sha: run.headSha,
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    jobs: (run.jobs ?? []).map((job) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
    })),
  };
}

function normalizedDigest(asset) {
  const match = String(asset?.digest || '').match(/^sha256:(?<hash>[a-f0-9]{64})$/i);
  if (!match?.groups?.hash) {
    throw new Error(`Release asset ${asset?.name || '(unknown)'} must expose a sha256 digest.`);
  }
  return match.groups.hash.toLowerCase();
}

function releaseAsset(release, name) {
  const matches = (release.assets ?? []).filter((candidate) => candidate?.name === name);
  if (matches.length !== 1) throw new Error(`Stable distribution requires exactly one release asset named ${name}.`);
  return {
    name,
    sha256: normalizedDigest(matches[0]),
    url: `https://github.com/${appRepo}/releases/download/${release.tagName}/${name}`,
  };
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fullVmEvidenceReadback(options) {
  const receiptPath = path.resolve(options.fullVmEvidence);
  if (!fs.existsSync(receiptPath)) {
    throw new Error('Full clean-VM qualification receipt file is missing.');
  }
  const digest = fileSha256(receiptPath);
  if (digest !== options.fullVmEvidenceSha256) {
    throw new Error('Full clean-VM qualification receipt digest does not match the owner-provided digest.');
  }
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch {
    throw new Error('Full clean-VM qualification receipt must be valid JSON.');
  }
  const version = stableTagPattern.exec(options.releaseTag).groups.version;
  const expected = [
    ['schema', receipt.schema, 'opl_app_artifact_qualification_receipt.v1'],
    ['status', receipt.status, 'passed'],
    ['stable_session_id', receipt.stable_session_id, options.stableSessionId],
    ['release_cohort_ref', receipt.release_cohort_ref, options.releaseCohortRef],
    ['version', receipt.version, version],
    ['package_profile', receipt.package_profile, 'full'],
    ['qualification.run_id', String(receipt.qualification?.run_id ?? ''), options.fullVmRunId],
    ['qualification.source_artifact_run_id', String(receipt.qualification?.source_artifact_run_id ?? ''), options.sourceReleaseRunId],
    ['qualification.source_artifact_name', receipt.qualification?.source_artifact_name, `opl-full-first-install-dmg-${version}-mac-arm64`],
    ['qualification.evidence_ref', receipt.qualification?.evidence_ref, options.fullVmEvidenceRef],
    ['qualification.result', receipt.qualification?.result, 'passed'],
    ['artifact.name', receipt.artifact?.name, `One-Person-Lab-Full-${version}-mac-arm64.dmg`],
    ['cohort.app_sha', receipt.cohort?.app_sha, options.appSha],
    ['cohort.shell_sha', receipt.cohort?.shell_sha, options.shellSha],
    ['cohort.framework_sha', receipt.cohort?.framework_sha, options.frameworkSha],
  ];
  for (const [label, actual, wanted] of expected) {
    if (actual !== wanted) {
      throw new Error(`Full clean-VM qualification receipt ${label} mismatch.`);
    }
  }
  if (!sha256Pattern.test(receipt.artifact?.sha256 ?? '')) {
    throw new Error('Full clean-VM qualification receipt artifact SHA-256 is invalid.');
  }
  if (!gitShaPattern.test(receipt.verification_harness?.app_sha ?? '')) {
    throw new Error('Full clean-VM qualification receipt verification harness SHA is invalid.');
  }
  if (!gitShaPattern.test(receipt.verification_harness?.shell_sha ?? '')) {
    throw new Error('Full clean-VM qualification receipt verification harness shell SHA is invalid.');
  }
  const harnessDiffers = receipt.verification_harness.app_sha !== options.appSha
    || receipt.verification_harness.shell_sha !== options.shellSha;
  if (receipt.verification_harness.differs_from_artifact_cohort !== harnessDiffers
    || (harnessDiffers && receipt.verification_harness.change_scope !== 'smoke_or_validator_only')) {
    throw new Error('Full clean-VM qualification receipt does not declare the exact harness change scope.');
  }
  return { digest, receipt };
}

function qualifySourceReleaseRun(run, fullVmEvidence) {
  if (run.conclusion === 'success') {
    return {
      ...run,
      qualification: { mode: 'source_run_success', superseded_failed_jobs: [] },
    };
  }
  const blockingJobs = run.jobs.filter((job) => !['success', 'skipped'].includes(job.conclusion));
  const allowedFailure = 'Run clean Full first-run VM smoke / Clean VM first launch';
  if (run.conclusion !== 'failure'
    || blockingJobs.length !== 1
    || blockingJobs[0].name !== allowedFailure
    || blockingJobs[0].conclusion !== 'failure'
    || fullVmEvidence.receipt.qualification.source_artifact_run_id !== run.run_id) {
    const names = blockingJobs.map((job) => `${job.name} (${job.conclusion})`).join(', ') || '(none reported)';
    throw new Error(`Source release has unexpected failed jobs and cannot be superseded: ${names}.`);
  }
  return {
    ...run,
    qualification: {
      mode: 'exact_full_vm_receipt_supersession',
      superseded_failed_jobs: [allowedFailure],
      qualification_run_id: fullVmEvidence.receipt.qualification.run_id,
      evidence_sha256: fullVmEvidence.digest,
    },
  };
}

function caskMetadata(relativePath, version) {
  const filePath = path.join(tapRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(`version "${version}"`)) {
    throw new Error(`${relativePath} does not declare stable version ${version}.`);
  }
  const url = content.match(/^\s*url\s+"(?<url>[^"]+)"/m)?.groups?.url;
  if (!url) throw new Error(`${relativePath} does not expose a cask URL.`);
  if (!content.includes('depends_on formula: "opl"')) {
    throw new Error(`${relativePath} must depend on the Formula published in the same Stable distribution.`);
  }
  return { path: relativePath, version, sha256: fileSha256(filePath), url };
}

function currentCaskMetadata(relativePath) {
  const content = fs.readFileSync(path.join(tapRoot, relativePath), 'utf8');
  const version = content.match(/^\s*version\s+"(?<version>[^"]+)"/m)?.groups?.version;
  if (!version) throw new Error(`${relativePath} does not expose a cask version.`);
  return caskMetadata(relativePath, version);
}

function activateFormulaDependency(relativePath) {
  const filePath = path.join(tapRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('depends_on formula: "opl"')) return;
  const anchor = '  depends_on macos: :big_sur';
  if (content.split(anchor).length !== 2) {
    throw new Error(`${relativePath} has no unique dependency insertion boundary.`);
  }
  writeFileAtomically(filePath, content.replace(
    anchor,
    `  depends_on formula: "opl"\n${anchor}`,
  ));
}

function formulaFileMetadata(manifest, expectedFrameworkSha) {
  const metadata = formulaMetadataFromManifest(manifest);
  if (metadata.headSha !== expectedFrameworkSha) {
    throw new Error('Stable distribution Framework SHA differs from the Release Set Base source commit.');
  }
  const relativePath = 'Formula/opl.rb';
  const filePath = path.join(tapRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const transportSha256 = content.match(/^\s*sha256\s+"(?<sha256>[a-f0-9]{64})"$/m)?.groups?.sha256;
  if (!transportSha256
    || !content.includes(`# homebrew_transport_archive_sha256: ${transportSha256}`)) {
    throw new Error(`${relativePath} does not bind one transport archive SHA-256.`);
  }
  for (const expected of [
    `version "${metadata.version}"`,
    `url "${metadata.archiveUrl}"`,
    `# release_set_generation: ${metadata.releaseSetGeneration}`,
    `# framework_source_head: ${metadata.headSha}`,
    `# framework_artifact_digest: ${metadata.artifactDigest}`,
    `# framework_package_archive_sha256: ${metadata.packageSha256}`,
    '# app_payload_installed: false',
    '# opl_packages_payload_installed: false',
  ]) {
    if (!content.includes(expected)) throw new Error(`${relativePath} does not match the exact Release Set Base projection.`);
  }
  return {
    path: relativePath,
    formula_name: metadata.formulaName,
    version: metadata.version,
    source_head: metadata.headSha,
    artifact_ref: metadata.artifactRef,
    artifact_digest: metadata.artifactDigest,
    transport_sha256: transportSha256,
    sha256: fileSha256(filePath),
  };
}

function renderCasks(release, releaseTag) {
  const env = { ...process.env, OPL_APP_RELEASE_VIEW_JSON: JSON.stringify(release) };
  const script = path.join(scriptRoot, 'scripts', 'sync-cask-from-release.mjs');
  if (!fs.existsSync(path.join(tapRoot, 'Formula', 'opl.rb'))) {
    throw new Error('Stable distribution requires Formula/opl.rb to be generated before App casks.');
  }
  for (const channel of ['stable', 'full']) {
    execFileSync(process.execPath, [
      script,
      '--channel', channel,
      '--release-tag', releaseTag,
      '--with-opl-formula',
    ], { cwd: tapRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  }
  activateFormulaDependency('Casks/one-person-lab-nightly.rb');
}

function releaseSetMetadata(options, release, assets) {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(options.releaseSetManifest), 'utf8'));
  const releaseSet = manifest?.release_set;
  if (manifest?.release_set_generation !== options.releaseSetGeneration
    || releaseSet?.surface_kind !== 'opl_release_set.v2'
    || releaseSet.generation !== options.releaseSetGeneration
    || releaseSet.bom_status !== 'complete'
    || !shaRefPattern.test(releaseSet.bom_digest ?? '')) {
    throw new Error('Stable distribution requires the exact complete Release Set v2 generation.');
  }
  const app = releaseSet.components?.app;
  const version = stableTagPattern.exec(options.releaseTag).groups.version;
  const dmg = assets.find((asset) => asset.name === `One-Person-Lab-${version}-mac-arm64.dmg`);
  if (app?.component_id !== 'opl-app'
    || app.component_kind !== 'app'
    || app.version !== version
    || app.source_commit !== options.appSha
    || app.artifact_ref !== dmg?.url
    || app.artifact_digest !== `sha256:${dmg?.sha256}`
    || app.artifact_status !== 'published_immutable'
    || app.release_status !== 'published'
    || app.release_tag !== options.releaseTag) {
    throw new Error('App release and Release Set v2 App component do not identify the same published artifact.');
  }
  const formula = formulaFileMetadata(manifest, options.frameworkSha);
  return {
    generation: options.releaseSetGeneration,
    manifest_ref: `${releaseSetRepo}:${options.releaseSetGeneration}`,
    manifest_digest: options.releaseSetManifestDigest,
    stable_channel_ref: `${releaseSetRepo}:latest-stable`,
    stable_channel_digest: options.releaseSetManifestDigest,
    bom_digest: releaseSet.bom_digest,
    component_count: releaseSet.component_count,
    base: {
      component_id: 'opl-base',
      version: formula.version,
      source_commit: formula.source_head,
      artifact_ref: formula.artifact_ref,
      artifact_digest: formula.artifact_digest,
    },
    app: {
      component_id: 'opl-app',
      version: app.version,
      source_commit: app.source_commit,
      artifact_ref: app.artifact_ref,
      artifact_digest: app.artifact_digest,
    },
    formula,
  };
}

function buildPlan(options, release, sourceReleaseRun, fullVmRun, fullVmEvidence) {
  const version = stableTagPattern.exec(options.releaseTag).groups.version;
  const assets = [
    releaseAsset(release, `One-Person-Lab-${version}-mac-arm64.dmg`),
    releaseAsset(release, 'latest-arm64-mac.yml'),
    releaseAsset(release, 'standard-local-authorization-policy.json'),
    releaseAsset(release, `One-Person-Lab-Full-${version}-mac-arm64.dmg`),
    releaseAsset(release, 'opl-release-manifest.json'),
  ];
  const fullDmg = assets.find((asset) => asset.name === fullVmEvidence.receipt.artifact.name);
  if (!fullDmg || fullDmg.sha256 !== fullVmEvidence.receipt.artifact.sha256) {
    throw new Error('Full clean-VM qualification receipt does not bind the published Full DMG bytes.');
  }
  const releaseSet = releaseSetMetadata(options, release, assets);
  renderCasks(release, options.releaseTag);
  return {
    schema: 'opl_stable_distribution_plan.v2',
    stable_session_id: options.stableSessionId,
    release_set: releaseSet,
    release: {
      repo: appRepo,
      tag: options.releaseTag,
      version,
      public: true,
      latest: false,
      source_release_run_id: options.sourceReleaseRunId,
      source_release_run: sourceReleaseRun,
      assets,
    },
    cohort: {
      release_cohort_ref: options.releaseCohortRef,
      app_sha: options.appSha,
      shell_sha: options.shellSha,
      framework_sha: options.frameworkSha,
      release_set_generation: releaseSet.generation,
      release_set_manifest_digest: releaseSet.manifest_digest,
    },
    full_vm: {
      run_id: options.fullVmRunId,
      evidence_ref: options.fullVmEvidenceRef,
      evidence_sha256: options.fullVmEvidenceSha256,
      result: options.fullVmResult,
      run_readback: fullVmRun,
      evidence_receipt: fullVmEvidence.receipt,
    },
    tap: {
      repo: tapRepo,
      formula: releaseSet.formula,
      standard_cask: caskMetadata('Casks/one-person-lab.rb', version),
      full_cask: caskMetadata('Casks/one-person-lab-full.rb', version),
      nightly_cask: currentCaskMetadata('Casks/one-person-lab-nightly.rb'),
    },
  };
}

export function prepareStableDistribution(options) {
  assertInputs(options);
  const release = releaseReadback(options.releaseTag);
  const fullVmEvidence = fullVmEvidenceReadback(options);
  const sourceReleaseRun = qualifySourceReleaseRun(actionsRunReadback(
    options.sourceReleaseRunId,
    options.appSha,
    'Source release',
    { requireSuccess: false },
  ), fullVmEvidence);
  const fullVmRun = actionsRunReadback(
    options.fullVmRunId,
    fullVmEvidence.receipt.verification_harness.app_sha,
    'Full clean-VM',
    { requireSuccess: true },
  );
  return buildPlan(options, release, sourceReleaseRun, fullVmRun, fullVmEvidence);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = prepareStableDistribution(options);
  const output = path.resolve(options.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
