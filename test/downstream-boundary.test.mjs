import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formulaMetadataFromArtifact,
  renderFormula,
  writeFormulaAtomically,
} from '../scripts/sync-formula-from-framework-artifact.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

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

if (formulaPublished) {
  const oplFormula = read('Formula/opl.rb');
  assert.match(oplFormula, /depends_on "node@22"/);
  assert.match(oplFormula, /node_bin = HOMEBREW_PREFIX\/"opt\/node@22\/bin"/);
  assert.doesNotMatch(oplFormula, /npm = formula_opt_bin/);
  assert.match(oplFormula, /write_env_script libexec\/"bin\/opl", PATH: "#\{node_bin\}:\$PATH"/);
  assert.match(oplFormula, /ENV\["PATH"\] = "\/usr\/bin:\/bin"/);
}

const caskFiles = fs.readdirSync(path.join(root, 'Casks'))
  .filter((name) => name.endsWith('.rb'))
  .sort();
assert.deepEqual(
  caskFiles.filter((name) => !['one-person-lab-nightly.rb', 'opl-fleet-agent.rb', 'opl-codex-models.rb'].includes(name)),
  ['one-person-lab-full.rb', 'one-person-lab.rb'],
  'the tap may publish only the Stable, Full, optional Nightly, Fleet Agent, and Codex Models casks',
);
assert.ok(caskFiles.includes('opl-fleet-agent.rb'), 'the unified OPL Tap must publish OPL Fleet Agent');
assert.ok(caskFiles.includes('opl-codex-models.rb'), 'the unified OPL Tap must publish Codex Models');

const standardCask = read('Casks/one-person-lab.rb');
const fullCask = read('Casks/one-person-lab-full.rb');
const nightlyPath = path.join(root, 'Casks/one-person-lab-nightly.rb');
const hasNightlyCask = fs.existsSync(nightlyPath);

function assertCsvStableCask(content, { token, dmgPrefix, requiresFormula }) {
  assert.match(content, new RegExp(`^cask "${token}" do$`, 'm'));
  const versionMatch = content.match(/^\s*version "([^"]+)"$/m);
  assert.ok(versionMatch, `${token} must declare version`);
  const parts = versionMatch[1].split(',');
  assert.equal(parts.length, 2, `${token} version must use updater,display CSV semantics`);
  assert.ok(parts[0] && parts[1], `${token} CSV version parts must be non-empty`);
  assert.match(content, /^\s*sha256 "[a-f0-9]{64}"$/m, `${token} must declare a 64-char sha256`);
  assert.match(
    content,
    new RegExp(`^\\s*url "https://github\\.com/gaofeng21cn/one-person-lab-app/releases/download/v#\\{version\\.csv\\.second\\}/${dmgPrefix}-#\\{version\\.csv\\.second\\}-mac-arm64\\.dmg"$`, 'm'),
    `${token} URL must bind the display version`,
  );
  assert.match(content, /^\s*depends_on arch: :arm64$/m);
  assert.match(content, /^\s*depends_on macos: :ventura$/m);
  assert.doesNotMatch(content, /depends_on macos: :big_sur/);
  assert.doesNotMatch(content, /immutable/i);
  assert.equal(
    /depends_on formula: "opl"/.test(content),
    requiresFormula,
    `${token} Formula dependency expectation mismatch`,
  );
}

assertCsvStableCask(standardCask, {
  token: 'one-person-lab',
  dmgPrefix: 'One-Person-Lab',
  requiresFormula: formulaPublished,
});
assert.match(standardCask, /conflicts_with cask: \["one-person-lab-full", "one-person-lab-nightly"\]/);
assert.doesNotMatch(standardCask, /One-Person-Lab-Full/);

assertCsvStableCask(fullCask, {
  token: 'one-person-lab-full',
  dmgPrefix: 'One-Person-Lab-Full',
  requiresFormula: false,
});
assert.match(fullCask, /conflicts_with cask: \["one-person-lab", "one-person-lab-nightly"\]/);
assert.doesNotMatch(fullCask, /releases\/latest/);
assert.doesNotMatch(fullCask, /releases\/download\/v[^/]+-full-[a-f0-9]{12}\//);

if (hasNightlyCask) {
  const nightlyCask = read('Casks/one-person-lab-nightly.rb');
  assert.match(nightlyCask, /^cask "one-person-lab-nightly" do$/m);
  assert.match(nightlyCask, /^\s*version "[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])-nightly(?:\.r[1-9])?"$/m);
  assert.match(nightlyCask, /^\s*sha256 "[a-f0-9]{64}"$/m);
  assert.match(
    nightlyCask,
    /^\s*url "https:\/\/github\.com\/gaofeng21cn\/one-person-lab-app\/releases\/download\/v#\{version\}\/One-Person-Lab-[^"]+-mac-arm64\.dmg"$/m,
  );
  assert.match(nightlyCask, /conflicts_with cask: \["one-person-lab", "one-person-lab-full"\]/);
  assert.match(nightlyCask, /^\s*depends_on arch: :arm64$/m);
  assert.match(nightlyCask, /^\s*depends_on macos: :ventura$/m);
  assert.doesNotMatch(nightlyCask, /depends_on macos: :big_sur/);
  assert.doesNotMatch(nightlyCask, /One-Person-Lab-Full/);
  assert.equal(
    /depends_on formula: "opl"/.test(nightlyCask),
    formulaPublished,
    'one-person-lab-nightly.rb Formula dependency must match Formula/opl.rb publication',
  );
}

const frameworkSha = '1'.repeat(40);
const frameworkArtifactDigest = `sha256:${'4'.repeat(64)}`;
const frameworkArtifact = `ghcr.io/gaofeng21cn/one-person-lab-framework@${frameworkArtifactDigest}`;
const manifestFixture = {
  artifactType: 'application/vnd.onepersonlab.framework.v1',
  annotations: {
    'org.opencontainers.image.version': '0.2.1',
    'org.opencontainers.image.revision': frameworkSha,
    'org.opencontainers.image.source': 'https://github.com/gaofeng21cn/one-person-lab',
  },
  layers: [{ mediaType: 'application/vnd.onepersonlab.framework.source.v1+gzip', digest: `sha256:${'2'.repeat(64)}` }],
};
const formulaMetadata = formulaMetadataFromArtifact(manifestFixture, frameworkArtifact, frameworkArtifactDigest);
assert.equal(formulaMetadata.version, '0.2.1');
assert.throws(
  () => formulaMetadataFromArtifact(manifestFixture, frameworkArtifact.replace('one-person-lab-framework', 'other'), frameworkArtifactDigest),
  /canonical immutable/,
);
assert.throws(
  () => formulaMetadataFromArtifact({ ...manifestFixture, layers: [] }, frameworkArtifact, frameworkArtifactDigest),
  /Invalid Framework/,
);

const renderedFormula = renderFormula({
  ...formulaMetadata,
  transportSha256: '3'.repeat(64),
});
assert.match(renderedFormula, /version "0\.2\.1"/);
assert.match(renderedFormula, new RegExp(`url "https://github\\.com/gaofeng21cn/one-person-lab/archive/${frameworkSha}\\.tar\\.gz"`));
assert.match(renderedFormula, new RegExp(`sha256 "${'3'.repeat(64)}"`));
assert.match(renderedFormula, /depends_on "node@22"/);
assert.match(renderedFormula, /ENV\["npm_config_cache"\] = buildpath\/"\.npm-cache"/);
assert.match(renderedFormula, /node_bin = HOMEBREW_PREFIX\/"opt\/node@22\/bin"/);
assert.doesNotMatch(renderedFormula, /npm = formula_opt_bin/);
assert.match(renderedFormula, /write_env_script libexec\/"bin\/opl", PATH: "#\{node_bin\}:\$PATH"/);
assert.match(renderedFormula, /ENV\["PATH"\] = "\/usr\/bin:\/bin"/);
assert.match(renderedFormula, /system npm, "ci", "--ignore-scripts"/);
assert.match(renderedFormula, /system npm, "prune", "--omit=dev", "--ignore-scripts"/);
assert.match(renderedFormula, /system npm, "run", "build"/);
assert.match(renderedFormula, /def caveats/);
assert.match(renderedFormula, /opl install --headless --skip-packages/);
assert.doesNotMatch(renderedFormula, /system .*"opl", "install"/);

const atomicFormulaTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-atomic-formula-'));
try {
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
} finally {
  fs.rmSync(atomicFormulaTmp, { recursive: true, force: true });
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

function runSyncCask(cwd, binDir, args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts/sync-cask-from-release.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });
}

const successTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-success-'));
try {
  fs.mkdirSync(path.join(successTmp, 'Casks'));
  const successBin = writeMockGh(successTmp, {
    assets: [
      { name: 'One-Person-Lab-26.7.12-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'One-Person-Lab-Full-26.7.12-mac-arm64.dmg', digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      { name: 'opl-release-manifest.json', digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
      { name: 'standard-gatekeeper-launch-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
      { name: 'standard-apple-notarization-receipt.json', digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' },
    ],
  });

  const success = runSyncCask(successTmp, successBin, ['--channel', 'stable', '--release-tag', 'v26.7.12']);
  assert.equal(success.status, 0, success.stderr);
  const generated = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab.rb'), 'utf8');
  assert.match(generated, /^cask "one-person-lab" do$/m);
  assert.match(generated, /^\s*version "26\.7\.12"$/m);
  assert.match(generated, /^\s*sha256 "a{64}"$/m);
  assert.match(generated, /One-Person-Lab-#\{version\}-mac-arm64\.dmg/);
  assert.doesNotMatch(generated, /depends_on formula: "opl"/);

  fs.mkdirSync(path.join(successTmp, 'Formula'));
  fs.writeFileSync(path.join(successTmp, 'Formula/opl.rb'), '# current Formula\n');
  const successWithFormula = runSyncCask(successTmp, successBin, [
    '--channel',
    'stable',
    '--release-tag',
    'v26.7.12',
    '--with-opl-formula',
  ]);
  assert.equal(successWithFormula.status, 0, successWithFormula.stderr);
  assert.match(fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab.rb'), 'utf8'), /depends_on formula: "opl"/);

  const fullSuccess = runSyncCask(successTmp, successBin, ['--channel', 'full', '--release-tag', 'v26.7.12']);
  assert.equal(fullSuccess.status, 0, fullSuccess.stderr);
  const generatedFull = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-full.rb'), 'utf8');
  assert.match(generatedFull, /^cask "one-person-lab-full" do$/m);
  assert.match(generatedFull, /One-Person-Lab-Full-#\{version\}-mac-arm64\.dmg/);
  assert.doesNotMatch(generatedFull, /releases\/latest/);
  assert.doesNotMatch(generatedFull, /depends_on formula: "opl"/);

  const unifiedTrustBin = writeMockGh(successTmp, {
    assets: [
      { name: 'One-Person-Lab-26.7.12-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      { name: 'opl-release-attestation.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
    ],
  });
  assert.equal(
    runSyncCask(successTmp, unifiedTrustBin, ['--channel', 'stable', '--release-tag', 'v26.7.12']).status,
    0,
  );

  const legacyTrustBin = writeMockGh(successTmp, {
    assets: [
      { name: 'One-Person-Lab-26.7.12-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      { name: 'standard-local-authorization-policy.json', digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' },
    ],
  });
  assert.equal(
    runSyncCask(successTmp, legacyTrustBin, ['--channel', 'stable', '--release-tag', 'v26.7.12']).status,
    0,
  );

  const missingTrustBin = writeMockGh(successTmp, {
    assets: [
      { name: 'One-Person-Lab-26.7.12-mac-arm64.dmg', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ],
  });
  const missingTrust = runSyncCask(successTmp, missingTrustBin, ['--channel', 'stable', '--release-tag', 'v26.7.12']);
  assert.notEqual(missingTrust.status, 0);
  assert.match(missingTrust.stderr, /opl-release-attestation\.json/);
  assert.match(missingTrust.stderr, /standard-gatekeeper-launch-policy\.json/);
  assert.match(missingTrust.stderr, /standard-apple-notarization-receipt\.json/);
  assert.match(missingTrust.stderr, /legacy fallback standard-local-authorization-policy\.json are also absent/);

  const fullFormulaBypass = runSyncCask(successTmp, successBin, [
    '--channel',
    'full',
    '--release-tag',
    'v26.7.12',
    '--with-opl-formula',
  ]);
  assert.notEqual(fullFormulaBypass.status, 0);
  assert.match(fullFormulaBypass.stderr, /Full casks consume the App-owned embedded Base/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-full.rb'), 'utf8'),
    /depends_on formula: "opl"/,
  );

  const nightlyVersion = '26.7.12-nightly';
  const nightlyBin = writeMockGh(successTmp, {
    tagName: `v${nightlyVersion}`,
    isPrerelease: true,
    assets: [
      { name: `One-Person-Lab-${nightlyVersion}-mac-arm64.dmg`, digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ],
  });
  const nightlySuccess = runSyncCask(successTmp, nightlyBin, ['--channel', 'nightly', '--release-tag', `v${nightlyVersion}`]);
  assert.equal(nightlySuccess.status, 0, nightlySuccess.stderr);
  const generatedNightly = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-nightly.rb'), 'utf8');
  assert.match(generatedNightly, /version "26\.7\.12-nightly"/);
  assert.match(generatedNightly, /depends_on macos: :ventura/);
  assert.match(generatedNightly, /One-Person-Lab-#\{version\}-mac-arm64\.dmg/);

  const migratedNightlyVersion = '26.7.15-nightly';
  const migratedNightlyAssetVersion = `${migratedNightlyVersion}.29445296888.1`;
  const migratedNightlyBin = writeMockGh(successTmp, {
    tagName: `v${migratedNightlyVersion}`,
    isPrerelease: true,
    assets: [
      { name: `One-Person-Lab-${migratedNightlyAssetVersion}-mac-arm64.dmg`, digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { name: 'latest-arm64-mac.yml', digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ],
  });
  const migratedNightly = runSyncCask(successTmp, migratedNightlyBin, [
    '--channel',
    'nightly',
    '--release-tag',
    `v${migratedNightlyVersion}`,
  ]);
  assert.equal(migratedNightly.status, 0, migratedNightly.stderr);
  const generatedMigratedNightly = fs.readFileSync(path.join(successTmp, 'Casks/one-person-lab-nightly.rb'), 'utf8');
  assert.match(generatedMigratedNightly, /version "26\.7\.15-nightly"/);
  assert.match(
    generatedMigratedNightly,
    /releases\/download\/v#\{version\}\/One-Person-Lab-26\.7\.15-nightly\.29445296888\.1-mac-arm64\.dmg/,
  );
} finally {
  fs.rmSync(successTmp, { recursive: true, force: true });
}

const noNightlyTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-nightly-noop-'));
try {
  fs.mkdirSync(path.join(noNightlyTmp, 'Casks'));
  const noNightlyBin = writeMockGh(noNightlyTmp, { releases: [] });
  const noNightly = runSyncCask(noNightlyTmp, noNightlyBin, ['--channel', 'nightly', '--allow-missing-nightly']);
  assert.equal(noNightly.status, 0, noNightly.stderr);
  assert.deepEqual(JSON.parse(noNightly.stdout), {
    status: 'no_op',
    channel: 'nightly',
    reason: 'no_eligible_published_prerelease',
  });
  assert.equal(fs.existsSync(path.join(noNightlyTmp, 'Casks/one-person-lab-nightly.rb')), false);

  const noNightlyStrict = runSyncCask(noNightlyTmp, noNightlyBin, ['--channel', 'nightly']);
  assert.notEqual(noNightlyStrict.status, 0);
  assert.match(noNightlyStrict.stderr, /No published nightly release found/);
} finally {
  fs.rmSync(noNightlyTmp, { recursive: true, force: true });
}

const failureTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-boundary-failure-'));
try {
  fs.mkdirSync(path.join(failureTmp, 'Casks'));
  const failureBin = writeMockGh(failureTmp);

  const result = runSyncCask(failureTmp, failureBin, ['--channel', 'stable']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /downstream App release mirror only/);
  assert.match(result.stderr, /App release operator\/authority/);
  assert.match(result.stderr, /must not define release truth\/currentness/);

  for (const [channel, tag, expected] of [
    ['stable', 'v26.7.12-a', /Stable cask updates must use YY\.M\.D without a same-day suffix/],
    ['stable', 'v1.2.3', /Stable cask updates must use YY\.M\.D without a same-day suffix/],
    ['nightly', 'v26.7.12-nightly.r0', /Nightly cask updates must use YY\.M\.D-nightly/],
    ['nightly', 'v26.7.12-nightly.r10', /Nightly cask updates must use YY\.M\.D-nightly/],
    ['nightly', 'v26.7.12-nightly.123456789.1', /Nightly cask updates must use YY\.M\.D-nightly/],
    ['nightly', 'v26.7.12-nightly.123456789.0', /Nightly cask updates must use YY\.M\.D-nightly/],
  ]) {
    const invalidVersion = runSyncCask(failureTmp, failureBin, ['--channel', channel, '--release-tag', tag]);
    assert.notEqual(invalidVersion.status, 0);
    assert.match(invalidVersion.stderr, expected);
  }

  const usage = runSyncCask(failureTmp, failureBin, ['--wat', 'stable']);
  assert.notEqual(usage.status, 0);
  assert.match(usage.stderr, /Unknown option: --wat/);
  assert.doesNotMatch(usage.stderr, /App release operator\/authority/);
} finally {
  fs.rmSync(failureTmp, { recursive: true, force: true });
}

const packageSpecificFormula = spawnSync(
  process.execPath,
  [
    path.join(root, 'scripts/sync-formula-from-framework-artifact.mjs'),
    '--artifact-ref',
    frameworkArtifact,
    '--formula-path',
    '/tmp/mas.rb',
  ],
  { encoding: 'utf8' },
);
assert.notEqual(packageSpecificFormula.status, 0);
assert.match(packageSpecificFormula.stderr, /only allowed Formula output is opl\.rb/);
