import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formulaMetadataFromManifest,
  parseGhcrImage,
  renderFormula,
  validateRemoteManifestBinding,
  writeFormulaAtomically,
} from '../scripts/sync-formula-from-framework-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.match(read('.gitignore'), /^\.worktrees\/$/m);

const formulaDir = path.join(root, 'Formula');
const formulaPublished = fs.existsSync(path.join(formulaDir, 'opl.rb'));
const formulaFiles = fs.existsSync(formulaDir)
  ? fs.readdirSync(formulaDir).filter((name) => name.endsWith('.rb')).sort()
  : [];
assert.deepEqual(
  formulaFiles.filter((name) => name !== 'opl.rb'),
  [],
  'the tap may publish only Formula/opl.rb',
);
assert.deepEqual(
  fs.readdirSync(path.join(root, 'Casks')).filter((name) => name.endsWith('.rb')).sort(),
  ['one-person-lab-full.rb', 'one-person-lab-nightly.rb', 'one-person-lab.rb'],
  'the tap may publish only the three App casks',
);
assert.match(read('README.md'), /sole Formula identity is `opl`/);
assert.match(read('README.md'), /materialized only by the formal Stable distribution workflow/);
assert.match(read('README.md'), /internal installation\nimplementation uses the `opl-framework` npm package/);
assert.match(read('README.md'), /`opl-framework` is not a second public Formula or OPL Package identity/);
assert.match(read('README.md'), /production dependencies, including Temporal/);
assert.match(read('README.md'), /does not install the desktop App or any OPL Package/);
assert.match(read('README.md'), /does not create or\nreconcile user workspace state/);
assert.match(read('README.md'), /opl install --headless --skip-packages/);
assert.match(read('README.md'), /managed after base\ninitialization by `opl packages`/);
assert.match(read('README.md'), /permits only Formula `opl` plus the three App Casks/);
assert.match(read('README.md'), /Homebrew-owned Base update stays on the Homebrew channel/);
assert.match(read('README.md'), /Only one compatible Framework\ncarrier may be active at a time/);
assert.match(read('README.md'), /New stable releases use `YY\.M\.D`/);
assert.match(read('README.md'), /`YY\.M\.D-nightly\.<run_id>\.<attempt>`/);
assert.match(read('README.md'), /opl_stable_distribution_receipt\.v2/);
assert.match(read('README.md'), /no eligible Nightly exists it completes as a no-op/);
for (const channelConsumer of [
  'README.md',
  'scripts/sync-formula-from-framework-manifest.mjs',
]) {
  const content = read(channelConsumer);
  assert.match(content, /one-person-lab-manifest(?::|`[^\n]*:)latest-stable|latest-stable/);
  assert.doesNotMatch(content, /one-person-lab-manifest:latest(?!-stable)/);
}

for (const cask of [
  'Casks/one-person-lab.rb',
  'Casks/one-person-lab-nightly.rb',
  'Casks/one-person-lab-full.rb',
]) {
  assert.equal(
    /depends_on formula: "opl"/.test(read(cask)),
    formulaPublished,
    `${cask} Formula dependency must match Formula/opl.rb publication`,
  );
}
assert.match(
  read('Casks/one-person-lab-full.rb'),
  /skip "Full casks track explicitly published Full cohorts through App release automation"/,
);
assert.doesNotMatch(read('Casks/one-person-lab-full.rb'), /releases\/latest/);
for (const workflow of [
  '.github/workflows/tap-check.yml',
  '.github/workflows/sync-from-app-releases.yml',
]) {
  assert.doesNotMatch(read(workflow), /--no-signing/);
}

const canonicalPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
const releaseSetGeneration = '26.7.13-r4';
const frameworkSha = '1'.repeat(40);
const frameworkArtifact = 'ghcr.io/gaofeng21cn/one-person-lab-framework:0.2.1';
const frameworkArtifactDigest = `sha256:${'4'.repeat(64)}`;
const packageArtifacts = Object.fromEntries(canonicalPackageIds.map((packageId) => [packageId, {
  package_id: packageId,
  version: '0.2.0',
}]));
const packageMembers = Object.fromEntries(canonicalPackageIds.map((packageId) => [packageId, {
  package_id: packageId,
  component_id: packageId,
  component_kind: 'package',
  version: '0.2.0',
}]));
const packageCatalog = Object.fromEntries(canonicalPackageIds.map((packageId) => [packageId, {
  package_id: packageId,
  versions: [{ version: '0.2.0' }],
}]));
const manifestFixture = {
  opl_version: '999.999.999',
  release_set_generation: releaseSetGeneration,
  release_set: {
    surface_kind: 'opl_release_set.v2',
    generation: releaseSetGeneration,
    bom_status: 'complete',
    bom_digest: `sha256:${'5'.repeat(64)}`,
    component_count: 9,
    components: {
      base: {
        component_id: 'opl-base',
        component_kind: 'base',
        version: '0.2.1',
        source_commit: frameworkSha,
        artifact_ref: frameworkArtifact,
        artifact_digest: frameworkArtifactDigest,
        artifact_status: 'published_immutable',
      },
      app: {
        component_id: 'opl-app',
        component_kind: 'app',
        version: '26.7.13',
      },
      packages: {
        package_count: 7,
        members: packageMembers,
      },
    },
  },
  packages: {
    framework_core: {
      version: '0.2.1',
      artifact: frameworkArtifact,
      artifact_digest: frameworkArtifactDigest,
      artifact_status: 'published_immutable',
      source_git: {
        repo_url: 'https://github.com/gaofeng21cn/one-person-lab.git',
        head_sha: frameworkSha,
      },
      source_archive: { sha256: '2'.repeat(64) },
      homebrew_formula: {
        surface_kind: 'opl_homebrew_formula_projection.v1',
        formula_name: 'opl',
        package_name: 'opl',
        approval_status: 'owner_approved',
        carrier_scope: 'framework_core_only',
        version: '0.2.1',
        source_head: frameworkSha,
        archive_url: `https://github.com/gaofeng21cn/one-person-lab/archive/${frameworkSha}.tar.gz`,
        archive_kind: 'immutable_github_commit_archive',
        sha256_source: 'tap_sync_download_and_hash',
        tap_generator_role: 'consume_projection_without_inference',
      },
    },
    package_artifacts: packageArtifacts,
    package_catalog: packageCatalog,
  },
};
const formulaMetadata = formulaMetadataFromManifest(manifestFixture);
assert.equal(formulaMetadata.formulaName, 'opl');
assert.equal(formulaMetadata.packageName, 'opl');
assert.equal(formulaMetadata.version, '0.2.1');
assert.equal(formulaMetadata.releaseSetGeneration, releaseSetGeneration);
assert.equal(
  formulaMetadata.archiveUrl,
  `https://github.com/gaofeng21cn/one-person-lab/archive/${frameworkSha}.tar.gz`,
);
assert.doesNotThrow(
  () => formulaMetadataFromManifest({ ...manifestFixture, opl_version: '26.7.10' }),
  'Formula version must not be compared with the retired manifest.opl_version field',
);
assert.throws(
  () => formulaMetadataFromManifest({
    ...manifestFixture,
    packages: {
      ...manifestFixture.packages,
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
      ...manifestFixture.packages,
      framework_core: {
        ...manifestFixture.packages.framework_core,
        homebrew_formula: {
          ...manifestFixture.packages.framework_core.homebrew_formula,
          package_name: 'opl-framework',
        },
      },
    },
  }),
  /formula_name and package_name must both be opl/,
);
assert.throws(
  () => formulaMetadataFromManifest({
    ...manifestFixture,
    packages: {
      ...manifestFixture.packages,
      framework_core: {
        ...manifestFixture.packages.framework_core,
        homebrew_formula: {
          ...manifestFixture.packages.framework_core.homebrew_formula,
          formula_name: undefined,
        },
      },
    },
  }),
  /formula_name and package_name must both be opl/,
);
assert.throws(
  () => formulaMetadataFromManifest({
    ...manifestFixture,
    packages: {
      ...manifestFixture.packages,
      package_catalog: {
        ...manifestFixture.packages.package_catalog,
        mas: {
          ...manifestFixture.packages.package_catalog.mas,
          homebrew_formula: { formula_name: 'mas' },
        },
      },
    },
  }),
  /mas must not declare a Homebrew Formula or Cask/,
);
assert.deepEqual(
  parseGhcrImage(`ghcr.io/gaofeng21cn/one-person-lab-manifest:${releaseSetGeneration}`),
  {
    repository: 'gaofeng21cn/one-person-lab-manifest',
    reference: releaseSetGeneration,
    referenceKind: 'tag',
  },
);
assert.doesNotThrow(() => validateRemoteManifestBinding({
  generationReference: releaseSetGeneration,
  generationDigest: `sha256:${'6'.repeat(64)}`,
  stableReference: 'latest-stable',
  stableDigest: `sha256:${'6'.repeat(64)}`,
  expectedGeneration: releaseSetGeneration,
  expectedDigest: `sha256:${'6'.repeat(64)}`,
}));
assert.throws(() => validateRemoteManifestBinding({
  generationReference: releaseSetGeneration,
  generationDigest: `sha256:${'6'.repeat(64)}`,
  stableReference: 'latest-stable',
  stableDigest: `sha256:${'7'.repeat(64)}`,
  expectedGeneration: releaseSetGeneration,
  expectedDigest: `sha256:${'6'.repeat(64)}`,
}), /latest-stable does not point to exact Release Set digest/);
const renderedFormula = renderFormula({
  ...formulaMetadata,
  transportSha256: '3'.repeat(64),
});
assert.match(renderedFormula, /version "0\.2\.1"/);
assert.match(renderedFormula, new RegExp(`release_set_generation: ${releaseSetGeneration}`));
assert.match(renderedFormula, new RegExp(`framework_source_head: ${frameworkSha}`));
assert.match(renderedFormula, new RegExp(`framework_artifact_digest: ${frameworkArtifactDigest}`));
assert.match(renderedFormula, new RegExp(`framework_package_archive_sha256: ${'2'.repeat(64)}`));
assert.match(renderedFormula, new RegExp(`sha256 "${'3'.repeat(64)}"`));
assert.match(renderedFormula, /formula_identity: opl/);
assert.match(renderedFormula, /internal_npm_package: opl-framework/);
assert.match(renderedFormula, /internal_installation_implementation_only: true/);
assert.match(renderedFormula, /carrier_scope: framework_cli_runtime_and_production_dependencies/);
assert.match(renderedFormula, /temporal_dependency_scope: framework_production_dependency/);
assert.match(renderedFormula, /app_payload_installed: false/);
assert.match(renderedFormula, /opl_packages_payload_installed: false/);
assert.match(renderedFormula, /package_specific_formula_allowed: false/);
assert.match(renderedFormula, /package_specific_cask_allowed: false/);
assert.match(renderedFormula, /opl_packages_lifecycle_owner: opl_cli/);
assert.match(renderedFormula, /opl_packages_lifecycle_command: opl packages/);
assert.match(renderedFormula, /user_state_initialized_during_brew_install: false/);
assert.match(renderedFormula, /first_user_state_reconcile: opl install --headless --skip-packages/);
assert.match(renderedFormula, /ENV\["npm_config_cache"\] = buildpath\/"\.npm-cache"/);
assert.match(renderedFormula, /system npm, "install", "--omit=dev", "--ignore-scripts"/);
assert.doesNotMatch(renderedFormula, /system npm, "prune"/);
assert.doesNotMatch(renderedFormula, /system npm, "ci"/);
assert.match(renderedFormula, /def caveats/);
assert.match(renderedFormula, /opl install --headless --skip-packages/);
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
  /--allow-missing-nightly/,
);
assert.doesNotMatch(
  read('.github/workflows/sync-from-app-releases.yml'),
  /sync-formula-from-framework-manifest/,
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
  assert.match(content, /# homebrew_allowed_software_objects: opl_base,opl_app/);
  assert.match(content, /# opl_packages_lifecycle_owned_by_homebrew: false/);
  assert.match(content, /# opl_packages_lifecycle_owner: opl_cli/);
  assert.match(content, /# opl_packages_lifecycle_command: opl packages/);
  assert.match(content, /# package_specific_formula_allowed: false/);
  assert.match(content, /# package_specific_cask_allowed: false/);
  assert.match(content, /# forbidden_package_formulae: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow/);
  assert.match(content, /# forbidden_package_casks: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow/);
  assert.match(content, /# must_not_define_release_currentness: true/);
}

for (const file of [
  'README.md',
  'scripts/sync-cask-from-release.mjs',
  'scripts/sync-formula-from-framework-manifest.mjs',
  'Casks/one-person-lab.rb',
  'Casks/one-person-lab-nightly.rb',
  'Casks/one-person-lab-full.rb',
  '.github/workflows/sync-from-app-releases.yml',
  '.github/workflows/tap-check.yml',
]) {
  const content = read(file);
  assert.doesNotMatch(content, /\bmodules\b|agent_pack|one-person-lab-modules|skip-modules/);
}

function writeMockGh(dir, {
  tagName = 'v26.7.12',
  isDraft = false,
  isPrerelease = false,
  assets = [],
  releases = [],
} = {}) {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const gh = path.join(bin, 'gh');
  const payload = JSON.stringify({ tagName, isDraft, isPrerelease, assets });
  const releasesPayload = JSON.stringify(releases);
  fs.writeFileSync(gh, `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  printf '%s' '${payload}'
  exit 0
fi
if [ "$1" = "release" ] && [ "$2" = "list" ]; then
  printf '%s' '${releasesPayload}'
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 99
`, { mode: 0o755 });
  return bin;
}

const successTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-success-'));
fs.mkdirSync(path.join(successTmp, 'Casks'));
const successBin = writeMockGh(successTmp, { assets: [
  { name: 'One-Person-Lab-26.7.12-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { name: 'One-Person-Lab-Full-26.7.12-mac-arm64.dmg', digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' },
  { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  { name: 'opl-release-manifest.json', digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
  { name: 'standard-local-authorization-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
] });

const success = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
  '--release-tag',
  'v26.7.12',
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
assert.match(generated, /# opl_packages_lifecycle_owned_by_homebrew: false/);
assert.match(generated, /# opl_packages_lifecycle_owner: opl_cli/);
assert.match(generated, /# opl_packages_lifecycle_command: opl packages/);
assert.match(generated, /# package_specific_formula_allowed: false/);
assert.match(generated, /# package_specific_cask_allowed: false/);
assert.match(generated, /# must_not_define_release_currentness: true/);
assert.doesNotMatch(generated, /depends_on formula: "opl"/);

fs.mkdirSync(path.join(successTmp, 'Formula'));
fs.writeFileSync(path.join(successTmp, 'Formula/opl.rb'), '# current Formula\n');
const successWithFormula = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'stable',
  '--release-tag',
  'v26.7.12',
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
  'v26.7.12',
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
assert.match(generatedFull, /skip "Full casks track explicitly published Full cohorts through App release automation"/);
assert.doesNotMatch(generatedFull, /releases\/latest/);
assert.doesNotMatch(generatedFull, /depends_on formula: "opl"/);

const nightlyVersion = '26.7.12-nightly.123456789.2';
const nightlyBin = writeMockGh(successTmp, {
  tagName: `v${nightlyVersion}`,
  isPrerelease: true,
  assets: [
    { name: `One-Person-Lab-${nightlyVersion}-mac-arm64.dmg`, digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    { name: 'standard-local-authorization-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
  ],
});
const nightlySuccess = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'nightly',
  '--release-tag',
  `v${nightlyVersion}`,
], {
  cwd: successTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${nightlyBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(nightlySuccess.status, 0, nightlySuccess.stderr);
const generatedNightly = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-nightly.rb'), 'utf8');
assert.match(generatedNightly, /version "26\.7\.12-nightly\.123456789\.2"/);
assert.match(generatedNightly, /# package_specific_formula_allowed: false/);
assert.match(generatedNightly, /# package_specific_cask_allowed: false/);

const noNightlyTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-nightly-noop-'));
fs.mkdirSync(path.join(noNightlyTmp, 'Casks'));
const noNightlyBin = writeMockGh(noNightlyTmp, { releases: [] });
const noNightly = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'nightly',
  '--allow-missing-nightly',
], {
  cwd: noNightlyTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${noNightlyBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.equal(noNightly.status, 0, noNightly.stderr);
assert.deepEqual(JSON.parse(noNightly.stdout), {
  status: 'no_op',
  channel: 'nightly',
  reason: 'no_eligible_published_prerelease',
});
assert.equal(fs.existsSync(path.join(noNightlyTmp, 'Casks/one-person-lab-nightly.rb')), false);

const noNightlyStrict = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-cask-from-release.mjs'),
  '--channel',
  'nightly',
], {
  cwd: noNightlyTmp,
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: `${noNightlyBin}${path.delimiter}${process.env.PATH ?? ''}`,
  },
});
assert.notEqual(noNightlyStrict.status, 0);
assert.match(noNightlyStrict.stderr, /No published nightly release found/);

const projectionTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-projection-failure-'));
const legacyManifestPath = path.join(projectionTmp, 'legacy-manifest.json');
const sentinelFormulaPath = path.join(projectionTmp, 'opl.rb');
fs.writeFileSync(legacyManifestPath, JSON.stringify({
  ...manifestFixture,
  packages: {
    ...manifestFixture.packages,
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
const failureBin = writeMockGh(failureTmp);

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

for (const [channel, tag, expected] of [
  ['stable', 'v26.7.12-a', /Stable cask updates must use YY\.M\.D without a same-day suffix/],
  ['stable', 'v1.2.3', /Stable cask updates must use YY\.M\.D without a same-day suffix/],
  ['nightly', 'v26.7.12-nightly', /Nightly cask updates must use YY\.M\.D-nightly/],
  ['nightly', 'v26.7.12-nightly.123456789.0', /Nightly cask updates must use YY\.M\.D-nightly/],
]) {
  const invalidVersion = spawnSync(process.execPath, [
    path.join(root, 'scripts/sync-cask-from-release.mjs'),
    '--channel',
    channel,
    '--release-tag',
    tag,
  ], {
    cwd: failureTmp,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${failureBin}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });
  assert.notEqual(invalidVersion.status, 0);
  assert.match(invalidVersion.stderr, expected);
}

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

const packageSpecificFormula = spawnSync(process.execPath, [
  path.join(root, 'scripts/sync-formula-from-framework-manifest.mjs'),
  '--manifest-file',
  legacyManifestPath,
  '--formula-path',
  path.join(projectionTmp, 'mas.rb'),
], { encoding: 'utf8' });
assert.notEqual(packageSpecificFormula.status, 0);
assert.match(packageSpecificFormula.stderr, /only allowed Formula output is opl\.rb/);
