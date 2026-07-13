#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tapRoot = process.env.OPL_HOMEBREW_TAP_ROOT
  ? path.resolve(process.env.OPL_HOMEBREW_TAP_ROOT)
  : scriptRoot;
const appRepo = 'gaofeng21cn/one-person-lab-app';
const tapRepo = 'gaofeng21cn/homebrew-one-person-lab';
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
    sourceReleaseRunId: '',
    fullVmRunId: '',
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
    '--source-release-run-id': 'sourceReleaseRunId',
    '--full-vm-run-id': 'fullVmRunId',
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

function actionsRunReadback(runId, expectedAppSha, label, { requireSuccess }) {
  const run = ghJson([
    'run', 'view', runId,
    '--repo', appRepo,
    '--json', 'databaseId,headSha,status,conclusion,url',
  ]);
  if (String(run.databaseId) !== runId) {
    throw new Error(`${label} run id mismatch: expected ${runId}, got ${run.databaseId || '(missing)'}.`);
  }
  if (run.headSha !== expectedAppSha) {
    throw new Error(`${label} must use frozen App SHA ${expectedAppSha}, got ${run.headSha || '(missing)'}.`);
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

function caskMetadata(relativePath, version) {
  const filePath = path.join(tapRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(`version "${version}"`)) {
    throw new Error(`${relativePath} does not declare stable version ${version}.`);
  }
  const url = content.match(/^\s*url\s+"(?<url>[^"]+)"/m)?.groups?.url;
  if (!url) throw new Error(`${relativePath} does not expose a cask URL.`);
  return { path: relativePath, version, sha256: fileSha256(filePath), url };
}

function renderCasks(release, releaseTag) {
  const env = { ...process.env, OPL_APP_RELEASE_VIEW_JSON: JSON.stringify(release) };
  const script = path.join(scriptRoot, 'scripts', 'sync-cask-from-release.mjs');
  const formulaArgs = fs.existsSync(path.join(tapRoot, 'Formula', 'opl.rb')) ? ['--with-opl-formula'] : [];
  for (const channel of ['stable', 'full']) {
    execFileSync(process.execPath, [
      script,
      '--channel', channel,
      '--release-tag', releaseTag,
      ...formulaArgs,
    ], { cwd: tapRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  }
}

function buildPlan(options, release, sourceReleaseRun, fullVmRun) {
  const version = stableTagPattern.exec(options.releaseTag).groups.version;
  const assets = [
    releaseAsset(release, `One-Person-Lab-${version}-mac-arm64.dmg`),
    releaseAsset(release, 'latest-arm64-mac.yml'),
    releaseAsset(release, 'standard-local-authorization-policy.json'),
    releaseAsset(release, `One-Person-Lab-Full-${version}-mac-arm64.dmg`),
    releaseAsset(release, 'opl-release-manifest.json'),
  ];
  renderCasks(release, options.releaseTag);
  return {
    schema: 'opl_stable_distribution_plan.v1',
    stable_session_id: options.stableSessionId,
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
    },
    full_vm: {
      run_id: options.fullVmRunId,
      evidence_ref: options.fullVmEvidenceRef,
      evidence_sha256: options.fullVmEvidenceSha256,
      result: options.fullVmResult,
      run_readback: fullVmRun,
    },
    tap: {
      repo: tapRepo,
      standard_cask: caskMetadata('Casks/one-person-lab.rb', version),
      full_cask: caskMetadata('Casks/one-person-lab-full.rb', version),
    },
  };
}

export function prepareStableDistribution(options) {
  assertInputs(options);
  const release = releaseReadback(options.releaseTag);
  const sourceReleaseRun = actionsRunReadback(
    options.sourceReleaseRunId,
    options.appSha,
    'Source release',
    { requireSuccess: false },
  );
  const fullVmRun = actionsRunReadback(
    options.fullVmRunId,
    options.appSha,
    'Full clean-VM',
    { requireSuccess: true },
  );
  return buildPlan(options, release, sourceReleaseRun, fullVmRun);
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
