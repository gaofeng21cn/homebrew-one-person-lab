import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TARGETS,
  checksumFromFile,
  parseArgs,
  renderCask,
  validateRelease,
  verifyDownloadedAssets,
  writeAtomically,
} from '../scripts/sync-dmg-cask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (content) => createHash('sha256').update(content).digest('hex');

const renames = JSON.parse(fs.readFileSync(path.join(root, 'cask_renames.json'), 'utf8'));
assert.equal(renames['opl-codex-model-manager'], 'opl-codex-models');
assert.ok(fs.existsSync(path.join(root, 'Casks/opl-codex-models.rb')));
assert.ok(!fs.existsSync(path.join(root, 'Casks/opl-codex-model-manager.rb')));

assert.deepEqual(parseArgs(['--target', 'opl-codex-models']), {
  target: 'opl-codex-models',
  releaseTag: '',
  caskPath: path.join('Casks', 'opl-codex-models.rb'),
});
assert.deepEqual(
  parseArgs(['--target', 'opl-fleet-agent', '--release-tag', 'v0.2.40', '--cask-path', '/tmp/custom.rb']),
  {
    target: 'opl-fleet-agent',
    releaseTag: 'v0.2.40',
    caskPath: '/tmp/custom.rb',
  },
);
assert.throws(() => parseArgs([]), /--target is required/);
assert.throws(() => parseArgs(['--target', 'unknown']), /Unknown target/);
assert.throws(() => parseArgs(['--target', 'opl-codex-models', '--wat', '1']), /Unknown option/);

const targetCases = [
  {
    target: 'opl-codex-models',
    sampleVersion: '0.2.0',
    sampleChecksum: '9f0949228f4c9710bc9aab6e21f74deb6de9eea42f7f83238863e04f520c3926',
    wrongDmgName: 'Other.dmg',
    assertCask(content) {
      assert.match(content, /depends_on macos: :sonoma/);
      assert.match(content, /auto_updates true/);
      assert.match(content, /strategy :github_latest/);
      assert.match(content, /app "CodexModelManager\.app"/);
      assert.match(content, /uninstall launchctl: "com\.onepersonlab\.codex-model-manager\.sync"/);
      assert.doesNotMatch(content, /depends_on formula:/);
    },
  },
  {
    target: 'opl-fleet-agent',
    sampleVersion: '0.2.40',
    sampleChecksum: '3c9206813e2776a8acbdb05e97c6eba04eaec11102bf99bdc77bcfc7b9890dbe',
    wrongDmgName: 'Codex-TPS.dmg',
    assertCask(content) {
      assert.match(content, /depends_on macos: :ventura/);
      assert.match(content, /auto_updates true/);
      assert.match(content, /desc "Local menu bar monitor for Codex token throughput"/);
      assert.match(content, /app "OPL Fleet Agent\.app"/);
      assert.doesNotMatch(content, /Codex TPS|codex-tps|depends_on formula:/);
    },
  },
];

for (const testCase of targetCases) {
  const config = TARGETS[testCase.target];
  const sampleTag = `v${testCase.sampleVersion}`;

  assert.deepEqual(
    validateRelease({ tagName: sampleTag, isDraft: false, isPrerelease: false }, '', testCase.target),
    { tag: sampleTag, version: testCase.sampleVersion },
  );
  assert.throws(
    () => validateRelease({ tagName: sampleTag, isDraft: false, isPrerelease: true }, '', testCase.target),
    /published, non-prerelease/,
  );
  assert.throws(
    () => validateRelease({ tagName: `${sampleTag}-beta.1`, isDraft: false, isPrerelease: false }, '', testCase.target),
    /vX\.Y\.Z/,
  );
  assert.throws(
    () => validateRelease({ tagName: sampleTag, isDraft: false, isPrerelease: false }, 'v9.9.9', testCase.target),
    /Release tag mismatch/,
  );

  assert.equal(checksumFromFile(`${testCase.sampleChecksum}  ${config.dmgName}\n`, testCase.target), testCase.sampleChecksum);
  assert.throws(
    () => checksumFromFile(`${testCase.sampleChecksum}  ${testCase.wrongDmgName}\n`, testCase.target),
    /one checksum/,
  );

  const dmgBytes = Buffer.from(`signed-and-notarized-dmg-fixture-${testCase.target}`);
  const publishedChecksum = digest(dmgBytes);
  const checksumBytes = Buffer.from(`${publishedChecksum}  ${config.dmgName}\n`);
  const release = {
    assets: [
      { name: config.dmgName, digest: `sha256:${publishedChecksum}` },
      { name: config.checksumName, digest: `sha256:${digest(checksumBytes)}` },
    ],
  };
  assert.equal(
    verifyDownloadedAssets({ target: testCase.target, release, dmgBytes, checksumBytes }),
    publishedChecksum,
  );
  assert.throws(
    () => verifyDownloadedAssets({
      target: testCase.target,
      release,
      dmgBytes: Buffer.from('tampered'),
      checksumBytes,
    }),
    /GitHub asset digest/,
  );

  const checkedInCask = fs.readFileSync(path.join(root, config.defaultCaskPath), 'utf8');
  const checkedInVersion = checkedInCask.match(/^  version "(?<version>\d+\.\d+\.\d+)"$/m)?.groups?.version;
  const checkedInChecksum = checkedInCask.match(/^  sha256 "(?<checksum>[a-f0-9]{64})"$/m)?.groups?.checksum;
  assert.ok(checkedInVersion);
  assert.ok(checkedInChecksum);
  const rendered = renderCask({
    target: testCase.target,
    version: checkedInVersion,
    checksum: checkedInChecksum,
  });
  assert.equal(checkedInCask, rendered);
  testCase.assertCask(checkedInCask);

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `${testCase.target}-atomic.`));
  try {
    const targetPath = path.join(temporaryDirectory, config.defaultCaskPath);
    writeAtomically(targetPath, rendered);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), rendered);
    assert.deepEqual(fs.readdirSync(path.dirname(targetPath)), [path.basename(config.defaultCaskPath)]);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const cliTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-dmg-cask-cli.'));
try {
  const binDir = path.join(cliTmp, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const dmgBytes = Buffer.from('cli-e2e-dmg-fixture');
  const dmgHash = digest(dmgBytes);
  const checksumBytes = Buffer.from(`${dmgHash}  Codex-Models.dmg\n`);
  const checksumHash = digest(checksumBytes);
  const releaseJson = JSON.stringify({
    tagName: 'v0.9.1',
    isDraft: false,
    isPrerelease: false,
    assets: [
      { name: 'Codex-Models.dmg', digest: `sha256:${dmgHash}` },
      { name: 'Codex-Models.dmg.sha256', digest: `sha256:${checksumHash}` },
    ],
  });
  const ghPath = path.join(binDir, 'gh');
  fs.writeFileSync(ghPath, `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  printf '%s' '${releaseJson}'
  exit 0
fi
if [ "$1" = "release" ] && [ "$2" = "download" ]; then
  dest=""
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--dir" ]; then
      dest="$2"
      shift 2
      continue
    fi
    shift
  done
  printf '%s' '${dmgBytes.toString('utf8')}' > "$dest/Codex-Models.dmg"
  printf '%s' '${checksumBytes.toString('utf8')}' > "$dest/Codex-Models.dmg.sha256"
  exit 0
fi
exit 99
`, { mode: 0o755 });

  const cliOk = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/sync-dmg-cask.mjs'), '--target', 'opl-codex-models', '--release-tag', 'v0.9.1'],
    {
      cwd: cliTmp,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
    },
  );
  assert.equal(cliOk.status, 0, cliOk.stderr);
  assert.equal(
    fs.readFileSync(path.join(cliTmp, 'Casks/opl-codex-models.rb'), 'utf8'),
    renderCask({ target: 'opl-codex-models', version: '0.9.1', checksum: dmgHash }),
  );

  const cliBadArg = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/sync-dmg-cask.mjs'), '--wat'],
    { cwd: cliTmp, encoding: 'utf8' },
  );
  assert.notEqual(cliBadArg.status, 0);
  assert.doesNotMatch(cliBadArg.stderr, /Route this failure/);

  const cliUpstreamErr = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/sync-dmg-cask.mjs'), '--target', 'opl-fleet-agent', '--release-tag', 'v0.1.0'],
    {
      cwd: cliTmp,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
    },
  );
  assert.notEqual(cliUpstreamErr.status, 0);
  assert.match(cliUpstreamErr.stderr, /gaofeng21cn\/opl-fleet-agent/);
} finally {
  fs.rmSync(cliTmp, { recursive: true, force: true });
}

console.log('DMG Cask sync tests passed.');
