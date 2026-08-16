import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checksumFromFile,
  renderCask,
  validateRelease,
  verifyDownloadedAssets,
  writeAtomically,
} from '../scripts/sync-fleet-agent-cask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checksum = '3c9206813e2776a8acbdb05e97c6eba04eaec11102bf99bdc77bcfc7b9890dbe';
const checksumContent = `${checksum}  OPL-Fleet-Agent.dmg\n`;
const digest = (content) => createHash('sha256').update(content).digest('hex');

assert.deepEqual(validateRelease({ tagName: 'v0.2.40', isDraft: false, isPrerelease: false }), {
  tag: 'v0.2.40',
  version: '0.2.40',
});
assert.throws(
  () => validateRelease({ tagName: 'v0.2.40', isDraft: false, isPrerelease: true }),
  /published, non-prerelease/,
);
assert.throws(
  () => validateRelease({ tagName: 'v0.2.40-beta.1', isDraft: false, isPrerelease: false }),
  /vX\.Y\.Z/,
);
assert.equal(checksumFromFile(checksumContent), checksum);
assert.throws(() => checksumFromFile(`${checksum}  Codex-TPS.dmg\n`), /one checksum/);

const dmgBytes = Buffer.from('signed-and-notarized-dmg-fixture');
const publishedChecksum = digest(dmgBytes);
const checksumBytes = Buffer.from(`${publishedChecksum}  OPL-Fleet-Agent.dmg\n`);
const release = {
  assets: [
    { name: 'OPL-Fleet-Agent.dmg', digest: `sha256:${publishedChecksum}` },
    { name: 'OPL-Fleet-Agent.dmg.sha256', digest: `sha256:${digest(checksumBytes)}` },
  ],
};
assert.equal(verifyDownloadedAssets({ release, dmgBytes, checksumBytes }), publishedChecksum);
assert.throws(
  () => verifyDownloadedAssets({ release, dmgBytes: Buffer.from('tampered'), checksumBytes }),
  /GitHub asset digest/,
);

const expectedCask = renderCask({ version: '0.2.40', checksum });
assert.equal(fs.readFileSync(path.join(root, 'Casks/opl-fleet-agent.rb'), 'utf8'), expectedCask);
assert.match(expectedCask, /depends_on macos: :ventura/);
assert.match(expectedCask, /auto_updates true/);
assert.match(expectedCask, /desc "Local menu bar monitor for Codex token throughput"/);
assert.doesNotMatch(expectedCask, /Codex TPS|codex-tps|depends_on formula/);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-fleet-agent-atomic.'));
const target = path.join(temporaryDirectory, 'Casks', 'opl-fleet-agent.rb');
writeAtomically(target, expectedCask);
assert.equal(fs.readFileSync(target, 'utf8'), expectedCask);
assert.deepEqual(fs.readdirSync(path.dirname(target)), ['opl-fleet-agent.rb']);
fs.rmSync(temporaryDirectory, { recursive: true, force: true });

console.log('Fleet Agent Cask tests passed.');
