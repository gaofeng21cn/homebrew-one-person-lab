#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tapRoot = process.env.OPL_HOMEBREW_TAP_ROOT
  ? path.resolve(process.env.OPL_HOMEBREW_TAP_ROOT)
  : scriptRoot;
const gitShaPattern = /^[a-f0-9]{40}$/;
const shaRefPattern = /^sha256:[a-f0-9]{64}$/;
const expectedDistributionPaths = [
  'Formula/opl.rb',
  'Casks/one-person-lab.rb',
  'Casks/one-person-lab-full.rb',
  'Casks/one-person-lab-nightly.rb',
];

function parseArgs(argv) {
  const options = { plan: '', tapCommit: '', annotatedTag: '', output: '' };
  const keys = {
    '--plan': 'plan',
    '--tap-commit': 'tapCommit',
    '--annotated-tag': 'annotatedTag',
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
    if (!value) throw new Error(`Missing required receipt input: ${key}.`);
  }
  return options;
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function validateDistributionFile(file) {
  if (!expectedDistributionPaths.includes(file?.path)) {
    throw new Error(`Stable distribution file is outside the admitted Homebrew surface: ${file?.path ?? '(missing)'}.`);
  }
  const actual = fileSha256(path.join(tapRoot, file.path));
  if (actual !== file.sha256) {
    throw new Error(`${file.path} changed after stable distribution preparation.`);
  }
}

export function finalizeStableDistributionReceipt(plan, options) {
  if (plan?.schema !== 'opl_stable_distribution_plan.v2') {
    throw new Error('Stable distribution plan must use schema opl_stable_distribution_plan.v2.');
  }
  if (!gitShaPattern.test(options.tapCommit)) {
    throw new Error('tap_commit must be a 40-character lowercase Git SHA.');
  }
  const expectedTag = `stable-distribution/v${plan.release.version}`;
  if (options.annotatedTag !== expectedTag) {
    throw new Error(`annotated_tag must be ${expectedTag}.`);
  }
  const sourceRun = plan.release?.source_release_run;
  const allowedFullVmFailure = 'Run clean Full first-run VM smoke / Clean VM first launch';
  const sourceBlockingJobs = sourceRun?.jobs?.filter((job) => !['success', 'skipped'].includes(job.conclusion)) ?? [];
  const sourceQualified = (sourceRun?.conclusion === 'success'
      && sourceRun?.qualification?.mode === 'source_run_success'
      && sourceRun?.qualification?.superseded_failed_jobs?.length === 0
      && sourceBlockingJobs.length === 0)
    || (sourceRun?.conclusion === 'failure'
      && sourceRun?.qualification?.mode === 'exact_full_vm_receipt_supersession'
      && sourceRun?.qualification?.superseded_failed_jobs?.length === 1
      && sourceRun.qualification.superseded_failed_jobs[0] === allowedFullVmFailure
      && sourceBlockingJobs.length === 1
      && sourceBlockingJobs[0]?.name === allowedFullVmFailure
      && sourceBlockingJobs[0]?.conclusion === 'failure'
      && sourceRun.qualification.qualification_run_id === plan.full_vm?.run_id
      && sourceRun.qualification.evidence_sha256 === plan.full_vm?.evidence_sha256);
  const evidence = plan.full_vm?.evidence_receipt;
  const fullAssetName = `One-Person-Lab-Full-${plan.release?.version}-mac-arm64.dmg`;
  const fullAsset = plan.release?.assets?.find((asset) => asset?.name === fullAssetName);
  const harnessDiffers = evidence?.verification_harness?.app_sha !== plan.cohort?.app_sha
    || evidence?.verification_harness?.shell_sha !== plan.cohort?.shell_sha;
  const expectedHarnessScope = harnessDiffers ? 'smoke_or_validator_only' : 'same_cohort';
  const fullVmQualified = plan.full_vm?.result === 'passed'
    && plan.full_vm?.run_readback?.conclusion === 'success'
    && plan.full_vm?.run_readback?.head_sha === evidence?.verification_harness?.app_sha
    && evidence?.status === 'passed'
    && evidence?.stable_session_id === plan.stable_session_id
    && evidence?.release_cohort_ref === plan.cohort?.release_cohort_ref
    && evidence?.qualification?.run_id === plan.full_vm?.run_id
    && evidence?.qualification?.source_artifact_run_id === plan.release?.source_release_run_id
    && evidence?.qualification?.evidence_ref === plan.full_vm?.evidence_ref
    && evidence?.cohort?.app_sha === plan.cohort?.app_sha
    && evidence?.cohort?.shell_sha === plan.cohort?.shell_sha
    && evidence?.cohort?.framework_sha === plan.cohort?.framework_sha
    && evidence?.verification_harness?.differs_from_artifact_cohort === harnessDiffers
    && evidence?.verification_harness?.change_scope === expectedHarnessScope
    && evidence?.artifact?.name === fullAssetName
    && evidence?.artifact?.sha256 === fullAsset?.sha256;
  if (plan.release?.public !== true || plan.release?.latest !== false
    || !sourceQualified
    || !fullVmQualified) {
    throw new Error('Stable distribution plan no longer carries passed App and Full qualification evidence.');
  }
  if (plan.release_set?.generation !== plan.cohort?.release_set_generation
    || plan.release_set?.manifest_digest !== plan.cohort?.release_set_manifest_digest
    || plan.release_set?.stable_channel_digest !== plan.release_set?.manifest_digest
    || !shaRefPattern.test(plan.release_set?.manifest_digest ?? '')
    || plan.release_set?.formula?.formula_name !== 'opl'
    || plan.release_set?.formula?.source_head !== plan.cohort?.framework_sha
    || plan.release_set?.base?.source_commit !== plan.cohort?.framework_sha
    || plan.release_set?.app?.source_commit !== plan.cohort?.app_sha) {
    throw new Error('Stable distribution plan no longer identifies one exact Release Set cohort.');
  }
  const files = [
    plan.tap.formula,
    plan.tap.standard_cask,
    plan.tap.full_cask,
    plan.tap.nightly_cask,
  ];
  if (new Set(files.map((file) => file?.path)).size !== expectedDistributionPaths.length) {
    throw new Error('Stable distribution plan must contain each admitted Formula/Cask path exactly once.');
  }
  for (const file of files) validateDistributionFile(file);
  return {
    schema: 'opl_stable_distribution_receipt.v2',
    status: 'verified',
    stable_session_id: plan.stable_session_id,
    release_set: plan.release_set,
    release: {
      repo: plan.release.repo,
      tag: plan.release.tag,
      version: plan.release.version,
      public: true,
      latest: false,
      source_release_run_id: plan.release.source_release_run_id,
      source_release_run: plan.release.source_release_run,
      assets: plan.release.assets,
    },
    cohort: plan.cohort,
    full_vm: plan.full_vm,
    tap: {
      repo: plan.tap.repo,
      commit_sha: options.tapCommit,
      annotated_tag: options.annotatedTag,
      formula: plan.tap.formula,
      standard_cask: plan.tap.standard_cask,
      full_cask: plan.tap.full_cask,
      nightly_cask: plan.tap.nightly_cask,
      validation: {
        boundary_tests: 'passed',
        formula_style: 'passed',
        formula_audit: 'passed',
        brew_style: 'passed',
        brew_audit: 'passed',
        atomic_push: 'required_and_annotated_tag_presence_proves_success',
      },
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(fs.readFileSync(path.resolve(options.plan), 'utf8'));
  const receipt = finalizeStableDistributionReceipt(plan, options);
  const output = path.resolve(options.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
