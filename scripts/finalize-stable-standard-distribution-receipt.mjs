#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitSha = /^[a-f0-9]{40}$/;
const digestRef = /^sha256:[a-f0-9]{64}$/;
const supersededAssetJob = 'Verify remote standard release assets';

function sha256(relativePath) {
  const root = path.resolve(process.env.OPL_HOMEBREW_TAP_ROOT || scriptRoot);
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

function carriesPassedRunEvidence(run) {
  if (run?.conclusion === 'success') return true;
  const blockingJobs = (run?.jobs ?? []).filter((job) => !['success', 'skipped'].includes(job.conclusion));
  return run?.status === 'completed'
    && run?.conclusion === 'failure'
    && run?.qualification?.mode === 'exact_standard_receipt_supersession'
    && JSON.stringify(run.qualification.superseded_failed_jobs) === JSON.stringify([supersededAssetJob])
    && blockingJobs.length === 1
    && blockingJobs[0].name === supersededAssetJob
    && blockingJobs[0].conclusion === 'failure';
}

export function finalizeStableStandardDistributionReceipt(plan, options) {
  if (plan?.schema !== 'opl_stable_standard_distribution_plan.v1') throw new Error('Standard distribution plan schema is invalid.');
  if (!gitSha.test(options.tapCommit)) throw new Error('tap_commit must be a lowercase 40-character Git SHA.');
  const expectedTag = `stable-standard-distribution/v${plan.release?.version}`;
  if (options.annotatedTag !== expectedTag) throw new Error(`annotated_tag must be ${expectedTag}.`);
  if (plan.release?.public !== true || plan.release?.latest !== false
    || !carriesPassedRunEvidence(plan.release?.source_release_run)
    || plan.standard_vm?.result !== 'passed'
    || !carriesPassedRunEvidence(plan.standard_vm?.run_readback)
    || plan.standard_vm?.evidence_receipt?.status !== 'passed') {
    throw new Error('Standard distribution no longer carries passed Standard release evidence.');
  }
  if (plan.release_set?.generation !== plan.cohort?.release_set_generation
    || plan.release_set?.manifest_digest !== plan.cohort?.release_set_manifest_digest
    || plan.release_set?.stable_channel_digest !== plan.release_set?.manifest_digest
    || !digestRef.test(plan.release_set?.manifest_digest || '')
    || plan.release_set?.formula?.source_head !== plan.cohort?.framework_sha
    || plan.release_set?.app?.source_commit !== plan.cohort?.app_sha) {
    throw new Error('Standard distribution Release Set cohort changed after preparation.');
  }
  for (const file of [plan.tap?.formula, plan.tap?.standard_cask]) {
    if (!['Formula/opl.rb', 'Casks/one-person-lab.rb'].includes(file?.path) || sha256(file.path) !== file.sha256) {
      throw new Error(`Standard distribution file changed or is outside its write set: ${file?.path || '<missing>'}.`);
    }
  }
  return {
    schema: 'opl_stable_distribution_receipt.v3', status: 'verified', stable_session_id: plan.stable_session_id,
    release_set: plan.release_set, release: plan.release, cohort: plan.cohort, standard_vm: plan.standard_vm,
    tap: { repo: plan.tap.repo, commit_sha: options.tapCommit, annotated_tag: options.annotatedTag,
      formula: plan.tap.formula, standard_cask: plan.tap.standard_cask,
      validation: { boundary_tests: 'passed', formula_style: 'passed', formula_audit: 'passed', cask_style: 'passed', cask_audit: 'passed', atomic_push: 'required' } },
  };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, index, all) => {
    if (index % 2 === 0) pairs.push([token.slice(2).replaceAll('-', '_'), all[index + 1]]); return pairs;
  }, []));
  const plan = JSON.parse(fs.readFileSync(path.resolve(args.plan), 'utf8'));
  const receipt = finalizeStableStandardDistributionReceipt(plan, {
    tapCommit: args.tap_commit, annotatedTag: args.annotated_tag,
  });
  fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(receipt, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
