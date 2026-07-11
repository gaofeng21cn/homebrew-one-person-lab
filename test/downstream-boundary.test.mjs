import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formulaMetadataFromManifest,
  renderFormula,
  writeFormulaAtomically,
} from '../scripts/sync-formula-from-framework-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.match(read('.gitignore'), /^\.worktrees\/$/m);

const formulaDir = path.join(root, 'Formula');
assert.equal(fs.existsSync(path.join(formulaDir, 'opl.rb')), false, 'Formula publication is pending');
assert.match(read('README.md'), /Formula publication is not yet public/);
assert.doesNotMatch(read('README.md'), /brew install opl/);
assert.match(read('README.md'), /canonical\n`opl-framework` package/);
assert.match(read('README.md'), /production\ndependencies, including Temporal/);
assert.match(read('README.md'), /does not install the desktop App or any\nAgent package/);
assert.match(read('README.md'), /does not create or reconcile user\nworkspace state/);
assert.match(read('README.md'), /opl install --headless --skip-modules/);
assert.match(read('README.md'), /Homebrew-owned base update stays on the Homebrew channel/);
assert.match(read('README.md'), /Only one compatible Framework\ncarrier may be active at a time/);

for (const cask of [
  'Casks/one-person-lab.rb',
  'Casks/one-person-lab-nightly.rb',
  'Casks/one-person-lab-full.rb',
]) {
  assert.doesNotMatch(read(cask), /depends_on formula: "opl"/);
}

const manifestFixture = {
  opl_version: '26.7.10',
  packages: {
    framework_core: {
      version: '26.7.10',
      source_git: {
        repo_url: 'https://github.com/gaofeng21cn/one-person-lab.git',
        head_sha: '1'.repeat(40),
      },
      source_archive: { sha256: '2'.repeat(64) },
      homebrew_formula: {
        package_name: 'opl-framework',
        version: '26.7.10',
        source_head: '1'.repeat(40),
        archive_url: `https://github.com/gaofeng21cn/one-person-lab/archive/${'1'.repeat(40)}.tar.gz`,
        archive_kind: 'immutable_github_commit_archive',
        sha256_source: 'tap_sync_download_and_hash',
      },
    },
  },
};
const formulaMetadata = formulaMetadataFromManifest(manifestFixture);
assert.equal(
  formulaMetadata.archiveUrl,
  `https://github.com/gaofeng21cn/one-person-lab/archive/${'1'.repeat(40)}.tar.gz`,
);
assert.throws(
  () => formulaMetadataFromManifest({
    ...manifestFixture,
    packages: {
      framework_core: {
        ...manifestFixture.packages.framework_core,
        homebrew_formula: undefined,
      },
    },
  }),
  /homebrew_formula projection/,
);
assert.throws(
  () => formulaMetadataFromManifest({
    ...manifestFixture,
    packages: {
      framework_core: {
        ...manifestFixture.packages.framework_core,
        homebrew_formula: {
          ...manifestFixture.packages.framework_core.homebrew_formula,
          package_name: 'opl-framework-shared',
        },
      },
    },
  }),
  /package_name must be opl-framework/,
);
const renderedFormula = renderFormula({
  ...formulaMetadata,
  transportSha256: '3'.repeat(64),
});
assert.match(renderedFormula, /version "26\.7\.10"/);
assert.match(renderedFormula, new RegExp(`framework_source_head: ${'1'.repeat(40)}`));
assert.match(renderedFormula, new RegExp(`framework_package_archive_sha256: ${'2'.repeat(64)}`));
assert.match(renderedFormula, new RegExp(`sha256 "${'3'.repeat(64)}"`));
assert.match(renderedFormula, /installed_package: opl-framework/);
assert.match(renderedFormula, /carrier_scope: framework_cli_runtime_and_production_dependencies/);
assert.match(renderedFormula, /temporal_dependency_scope: framework_production_dependency/);
assert.match(renderedFormula, /app_payload_installed: false/);
assert.match(renderedFormula, /agent_payload_installed: false/);
assert.match(renderedFormula, /user_state_initialized_during_brew_install: false/);
assert.match(renderedFormula, /first_user_state_reconcile: opl install --headless --skip-modules/);
assert.match(renderedFormula, /ENV\["npm_config_cache"\] = buildpath\/"\.npm-cache"/);
assert.match(renderedFormula, /system npm, "install", "--omit=dev", "--ignore-scripts"/);
assert.doesNotMatch(renderedFormula, /system npm, "prune"/);
assert.doesNotMatch(renderedFormula, /system npm, "ci"/);
assert.match(renderedFormula, /def caveats/);
assert.match(renderedFormula, /opl install --headless --skip-modules/);
assert.doesNotMatch(renderedFormula, /system .*"opl", "install"/);
const atomicFormulaTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-atomic-formula-'));
const atomicFormulaPath = path.join(atomicFormulaTmp, 'Formula/opl.rb');
writeFormulaAtomically(atomicFormulaPath, renderedFormula);
assert.equal(fs.readFileSync(atomicFormulaPath, 'utf8'), renderedFormula);
assert.deepEqual(
  fs.readdirSync(path.dirname(atomicFormulaPath)),
  ['opl.rb'],
  'atomic Formula generation must not leave temporary files',
);
const atomicFormulaSyntax = spawnSync('ruby', ['-c', atomicFormulaPath], { encoding: 'utf8' });
assert.equal(atomicFormulaSyntax.status, 0, atomicFormulaSyntax.stderr);

for (const workflow of [
  '.github/workflows/sync-from-app-releases.yml',
  '.github/workflows/tap-check.yml',
]) {
  const content = read(workflow);
  assert.match(content, /App release operator\/authority/);
  assert.match(content, /OPL Framework package release operator\/authority/);
  assert.match(content, /do not create tap-local release truth\/currentness/);
  assert.doesNotMatch(content, /App cask-only|Formula\/ must not be published/);
}
assert.match(
  read('.github/workflows/sync-from-app-releases.yml'),
  /A published opl Formula cannot be preserved silently/,
);

for (const [cask, channel, packageKind] of [
  ['Casks/one-person-lab.rb', 'stable', 'app_standard'],
  ['Casks/one-person-lab-nightly.rb', 'nightly', 'app_standard'],
  ['Casks/one-person-lab-full.rb', 'full', 'app_full_first_install'],
]) {
  const content = read(cask);
  assert.match(content, new RegExp(`# channel: ${channel}`));
  assert.match(content, new RegExp(`# package_kind: ${packageKind}`));
  assert.match(content, /# downstream_mirror_only: true/);
  assert.match(content, /# release_truth_authority: app_release/);
  assert.match(content, /# failure_feedback_owner: app_release_operator/);
  assert.match(content, /# must_not_define_release_currentness: true/);
}

function writeMockGh(dir, assetsJson) {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const gh = path.join(bin, 'gh');
  fs.writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  printf '{"tagName":"v1.2.3","isDraft":false,"isPrerelease":false,"assets":${assetsJson}}'
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

const successTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-success-'));
fs.mkdirSync(path.join(successTmp, 'Casks'));
const successBin = writeMockGh(successTmp, JSON.stringify([
  { name: 'One-Person-Lab-1.2.3-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { name: 'One-Person-Lab-Full-1.2.3-mac-arm64.dmg', digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' },
  { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  { name: 'opl-release-manifest.json', digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
  { name: 'standard-local-authorization-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
]));

const success = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
  '--release-tag',
  'v1.2.3',
], {
  cwd: successTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${successBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(success.status, 0, success.stderr);
const generated = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab.rb'), 'utf8');
assert.match(generated, /# downstream_mirror_only: true/);
assert.match(generated, /# release_truth_authority: app_release/);
assert.match(generated, /# failure_feedback_owner: app_release_operator/);
assert.match(generated, /# must_not_define_release_currentness: true/);
assert.doesNotMatch(generated, /depends_on formula: "opl"/);

fs.mkdirSync(path.join(successTmp, 'Formula'));
fs.writeFileSync(path.join(successTmp, 'Formula/opl.rb'), '# current Formula\n');
const successWithFormula = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
  '--release-tag',
  'v1.2.3',
  '--with-opl-formula',
], {
  cwd: successTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${successBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(successWithFormula.status, 0, successWithFormula.stderr);
assert.match(
  fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab.rb'), 'utf8'),
  /depends_on formula: "opl"/,
);

const fullSuccess = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'full',
  '--release-tag',
  'v1.2.3',
], {
  cwd: successTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${successBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(fullSuccess.status, 0, fullSuccess.stderr);
const generatedFull = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-full.rb'), 'utf8');
assert.match(generatedFull, /# channel: full/);
assert.match(generatedFull, /opl-release-manifest\.json/);
assert.doesNotMatch(generatedFull, /depends_on formula: "opl"/);

const projectionTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-projection-failure-'));
const legacyManifestPath = path.join(projectionTmp, 'legacy-manifest.json');
const sentinelFormulaPath = path.join(projectionTmp, 'opl.rb');
fs.writeFileSync(legacyManifestPath, JSON.stringify({
  ...manifestFixture,
  packages: {
    framework_core: {
      ...manifestFixture.packages.framework_core,
      package_name: 'opl-framework-shared',
      homebrew_formula: undefined,
    },
  },
}));
fs.writeFileSync(sentinelFormulaPath, 'sentinel\n');
const legacyFormulaSync = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-formula-from-framework-manifest.mjs'),
  '--manifest-file',
  legacyManifestPath,
  '--formula-path',
  sentinelFormulaPath,
], { encoding: 'utf8' });
assert.notEqual(legacyFormulaSync.status, 0);
assert.match(legacyFormulaSync.stderr, /homebrew_formula projection/);
assert.equal(fs.readFileSync(sentinelFormulaPath, 'utf8'), 'sentinel\n');

const failureTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-failure-'));
fs.mkdirSync(path.join(failureTmp, 'Casks'));
const failureBin = writeMockGh(failureTmp, '[]');

const result = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
], {
  cwd: failureTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${failureBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});

assert.notEqual(result.status, 0);
assert.match(result.stderr, /downstream App release mirror only/);
assert.match(result.stderr, /App release operator\/authority/);
assert.match(result.stderr, /must not define release truth\/currentness/);

const usage = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--wat',
  'stable',
], {
  cwd: failureTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${failureBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});

assert.notEqual(usage.status, 0);
assert.match(usage.stderr, /Unknown option: --wat/);
assert.doesNotMatch(usage.stderr, /App release operator\/authority/);
