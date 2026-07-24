import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const retiredPath of [
  '.github/workflows/stable-distribution.yml',
  'scripts/prepare-stable-distribution.mjs',
  'scripts/finalize-stable-distribution-receipt.mjs',
]) {
  assert.equal(exists(retiredPath), false, `${retiredPath} must stay retired`);
}

const standardWorkflow = read('.github/workflows/stable-standard-distribution.yml');
const nightlyWorkflow = read('.github/workflows/sync-from-app-releases.yml');
const tapCheck = read('.github/workflows/tap-check.yml');
const readme = read('README.md');

assert.match(standardWorkflow, /git add Formula\/opl\.rb Casks\/one-person-lab\.rb/);
assert.doesNotMatch(standardWorkflow, /git add[^\n]*one-person-lab-full/);
assert.match(standardWorkflow, /git diff --quiet -- Casks\/one-person-lab-full\.rb Casks\/one-person-lab-nightly\.rb/);

assert.match(nightlyWorkflow, /git add Casks\/one-person-lab-nightly\.rb/);
assert.doesNotMatch(nightlyWorkflow, /git add[^\n]*one-person-lab-full/);
assert.doesNotMatch(nightlyWorkflow, /git add Formula\/opl\.rb/);
assert.match(nightlyWorkflow, /formal Full writes belong to the App protected append_full publisher/i);
assert.match(nightlyWorkflow, /\[ "\$channel" != "full" \]/);

for (const workflow of [tapCheck, nightlyWorkflow]) {
  assert.match(workflow, /Casks\/one-person-lab\.rb Casks\/one-person-lab-nightly\.rb/);
  assert.match(workflow, /Full casks consume the App-owned embedded Base and must not depend on Formula opl/);
  assert.match(workflow, /1bbc1afba6ca7f01c82b064dbf764d91f2f8ab6129bfec4ed65b160e171ca84e/);
}

assert.match(readme, /Formal Standard tap mutation has one workflow owner/);
assert.match(readme, /Full is an App-owned additive release\s+operation/);
assert.match(readme, /protected App `append_full` publisher/);
assert.match(readme, /This tap does not\nown a second Full publisher/);
assert.doesNotMatch(readme, /stable-distribution\.yml/);
assert.doesNotMatch(readme, /opl_stable_distribution_receipt\.v2/);

console.log('Stable distribution authority boundary tests passed.');
