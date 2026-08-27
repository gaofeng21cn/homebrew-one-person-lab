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
} from '../scripts/sync-codex-model-manager-cask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checksum = '9f0949228f4c9710bc9aab6e21f74deb6de9eea42f7f83238863e04f520c3926';
const checksumContent = `${checksum}  Codex-Model-Manager.dmg\n`;
const digest = (content) => createHash('sha256').update(content).digest('hex');

assert.deepEqual(validateRelease({ tagName: 'v0.2.0', isDraft: false, isPrerelease: false }), {
  tag: 'v0.2.0',
  version: '0.2.0',
});
assert.throws(
  () => validateRelease({ tagName: 'v0.2.0', isDraft: false, isPrerelease: true }),
  /published, non-prerelease/,
);
assert.throws(
  () => validateRelease({ tagName: 'v0.2.0-beta.1', isDraft: false, isPrerelease: false }),
  /vX\.Y\.Z/,
);
assert.equal(checksumFromFile(checksumContent), checksum);
assert.throws(() => checksumFromFile(`${checksum}  Other.dmg\n`), /one checksum/);

const dmgBytes = Buffer.from('signed-and-notarized-dmg-fixture');
const publishedChecksum = digest(dmgBytes);
const checksumBytes = Buffer.from(`${publishedChecksum}  Codex-Model-Manager.dmg\n`);
const release = {
  assets: [
    { name: 'Codex-Model-Manager.dmg', digest: `sha256:${publishedChecksum}` },
    { name: 'Codex-Model-Manager.dmg.sha256', digest: `sha256:${digest(checksumBytes)}` },
  ],
};
assert.equal(verifyDownloadedAssets({ release, dmgBytes, checksumBytes }), publishedChecksum);
assert.throws(
  () => verifyDownloadedAssets({ release, dmgBytes: Buffer.from('tampered'), checksumBytes }),
  /GitHub asset digest/,
);

const checkedInCask = fs.readFileSync(path.join(root, 'Casks/opl-codex-model-manager.rb'), 'utf8');
const version = checkedInCask.match(/^  version "(?<version>\d+\.\d+\.\d+)"$/m)?.groups?.version;
const checkedInChecksum = checkedInCask.match(/^  sha256 "(?<checksum>[a-f0-9]{64})"$/m)?.groups?.checksum;
assert.ok(version);
assert.ok(checkedInChecksum);
assert.equal(checkedInCask, renderCask({ version, checksum: checkedInChecksum }));
assert.match(checkedInCask, /depends_on macos: :sonoma/);
assert.match(checkedInCask, /app "CodexModelManager\.app"/);
assert.match(checkedInCask, /user_model_data_preserved_on_uninstall: true/);
assert.doesNotMatch(checkedInCask, /depends_on formula:/);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-model-manager-atomic.'));
const target = path.join(temporaryDirectory, 'Casks', 'opl-codex-model-manager.rb');
writeAtomically(target, checkedInCask);
assert.equal(fs.readFileSync(target, 'utf8'), checkedInCask);
assert.deepEqual(fs.readdirSync(path.dirname(target)), ['opl-codex-model-manager.rb']);
fs.rmSync(temporaryDirectory, { recursive: true, force: true });

console.log('Codex Model Manager Cask tests passed.');
