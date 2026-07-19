import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeStableStandardDistributionReceipt } from '../scripts/finalize-stable-standard-distribution-receipt.mjs';
import { qualifyCompletedRun } from '../scripts/prepare-stable-standard-distribution.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(path.join(repo, '.github/workflows/stable-standard-distribution.yml'), 'utf8');
for (const input of ['standard_vm_run_id', 'standard_vm_evidence_ref', 'standard_vm_evidence_base64', 'standard_vm_evidence_sha256']) {
  assert.match(workflow, new RegExp(`^      ${input}:`, 'm'));
}
assert.doesNotMatch(workflow, /^      full_vm_/m);
assert.match(workflow, /git add Formula\/opl\.rb Casks\/one-person-lab\.rb/);
assert.doesNotMatch(workflow, /git add[^\n]*one-person-lab-full/);
assert.match(workflow, /git diff --quiet -- Casks\/one-person-lab-full\.rb Casks\/one-person-lab-nightly\.rb/);
assert.match(workflow, /stable-standard-distribution\/v\$\{version\}/);
assert.match(workflow, /tap_name="\$\{GITHUB_REPOSITORY\/\\\/homebrew-\/\\\/\}"/);
assert.match(workflow, /install -m 0644 Formula\/opl\.rb "\$tap_root\/Formula\/opl\.rb"/);
assert.match(workflow, /install -m 0644 Casks\/one-person-lab\.rb "\$tap_root\/Casks\/one-person-lab\.rb"/);
assert.match(workflow, /brew audit --strict --online "\$tap_name\/opl"/);
assert.match(workflow, /brew audit --cask --online --except=livecheck_version,livecheck_https_availability "\$tap_name\/one-person-lab"/);

const sourceRunId = '29686334520';
const sourceAppSha = 'a'.repeat(40);
const supersededJob = 'Verify remote standard release assets';
const successfulVmJobs = [
  'Run clean standard first-run VM smoke / Clean VM first launch',
  'Run clean standard first-run VM smoke / Persist qualification attempt receipt',
];
const recoveredRun = qualifyCompletedRun({
  databaseId: Number(sourceRunId),
  headSha: sourceAppSha,
  status: 'completed',
  conclusion: 'failure',
  jobs: [
    ...successfulVmJobs.map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    { name: supersededJob, status: 'completed', conclusion: 'failure' },
  ],
}, sourceRunId, sourceAppSha, 'Standard VM', {
  allowedFailureJob: supersededJob,
  requiredSuccessJobs: successfulVmJobs,
});
assert.equal(recoveredRun.qualification.mode, 'exact_standard_receipt_supersession');
assert.throws(() => qualifyCompletedRun({
  databaseId: Number(sourceRunId), headSha: sourceAppSha, status: 'completed', conclusion: 'failure',
  jobs: [{ name: 'Release source gate', status: 'completed', conclusion: 'failure' }],
}, sourceRunId, sourceAppSha, 'Source release', { allowedFailureJob: supersededJob }), /unexpected failed jobs/);
assert.throws(() => qualifyCompletedRun({
  databaseId: Number(sourceRunId), headSha: sourceAppSha, status: 'completed', conclusion: 'failure',
  jobs: [{ name: supersededJob, status: 'completed', conclusion: 'failure' }],
}, sourceRunId, sourceAppSha, 'Standard VM', {
  allowedFailureJob: supersededJob,
  requiredSuccessJobs: successfulVmJobs,
}), /lacks successful required job/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-standard-distribution-'));
fs.mkdirSync(path.join(root, 'Formula'), { recursive: true });
fs.mkdirSync(path.join(root, 'Casks'), { recursive: true });
fs.writeFileSync(path.join(root, 'Formula/opl.rb'), 'formula\n');
fs.writeFileSync(path.join(root, 'Casks/one-person-lab.rb'), 'cask\n');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const plan = {
  schema: 'opl_stable_standard_distribution_plan.v1', stable_session_id: `sha256:${'1'.repeat(64)}`,
  release: { version: '26.7.18', public: true, latest: false, source_release_run: { conclusion: 'success' } },
  cohort: { app_sha: 'a'.repeat(40), framework_sha: 'b'.repeat(40), release_set_generation: '26.7.18', release_set_manifest_digest: `sha256:${'2'.repeat(64)}` },
  release_set: { generation: '26.7.18', manifest_digest: `sha256:${'2'.repeat(64)}`, stable_channel_digest: `sha256:${'2'.repeat(64)}`,
    formula: { path: 'Formula/opl.rb', source_head: 'b'.repeat(40), sha256: hash('Formula/opl.rb') }, app: { source_commit: 'a'.repeat(40) } },
  standard_vm: { result: 'passed', run_readback: { conclusion: 'success' }, evidence_receipt: { status: 'passed' } },
  tap: { repo: 'gaofeng21cn/homebrew-one-person-lab', formula: { path: 'Formula/opl.rb', source_head: 'b'.repeat(40), sha256: hash('Formula/opl.rb') },
    standard_cask: { path: 'Casks/one-person-lab.rb', sha256: hash('Casks/one-person-lab.rb') } },
};
process.env.OPL_HOMEBREW_TAP_ROOT = root;
const receipt = finalizeStableStandardDistributionReceipt(plan, {
  tapCommit: 'c'.repeat(40), annotatedTag: 'stable-standard-distribution/v26.7.18',
});
assert.equal(receipt.schema, 'opl_stable_distribution_receipt.v3');
assert.equal(receipt.standard_vm.result, 'passed');
assert.equal(receipt.tap.standard_cask.path, 'Casks/one-person-lab.rb');
assert.equal('full_cask' in receipt.tap, false);
assert.equal('nightly_cask' in receipt.tap, false);
