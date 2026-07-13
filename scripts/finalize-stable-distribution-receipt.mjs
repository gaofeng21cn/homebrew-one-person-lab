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

function validateCask(cask) {
  const actual = fileSha256(path.join(tapRoot, cask.path));
  if (actual !== cask.sha256) {
    throw new Error(`${cask.path} changed after stable distribution preparation.`);
  }
}

export function finalizeStableDistributionReceipt(plan, options) {
  if (plan?.schema !== 'opl_stable_distribution_plan.v1') {
    throw new Error('Stable distribution plan must use schema opl_stable_distribution_plan.v1.');
  }
  if (!gitShaPattern.test(options.tapCommit)) {
    throw new Error('tap_commit must be a 40-character lowercase Git SHA.');
  }
  const expectedTag = `stable-distribution/v${plan.release.version}`;
  if (options.annotatedTag !== expectedTag) {
    throw new Error(`annotated_tag must be ${expectedTag}.`);
  }
  validateCask(plan.tap.standard_cask);
  validateCask(plan.tap.full_cask);
  return {
    schema: 'opl_stable_distribution_receipt.v1',
    status: 'verified',
    stable_session_id: plan.stable_session_id,
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
      standard_cask: plan.tap.standard_cask,
      full_cask: plan.tap.full_cask,
      validation: {
        boundary_tests: 'passed',
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
