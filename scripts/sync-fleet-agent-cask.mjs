#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const releaseRepo = 'gaofeng21cn/opl-fleet-agent';
const dmgName = 'OPL-Fleet-Agent.dmg';
const checksumName = `${dmgName}.sha256`;
const releaseTagPattern = /^v(?<version>\d+\.\d+\.\d+)$/;
const digestPattern = /^sha256:(?<hash>[a-f0-9]{64})$/i;

export function parseArgs(argv) {
  const options = { releaseTag: '', caskPath: path.join('Casks', 'opl-fleet-agent.rb') };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
    index += 1;
    if (option === '--release-tag') options.releaseTag = value;
    else if (option === '--cask-path') options.caskPath = value;
    else throw new Error(`Unknown option: ${option}`);
  }
  return options;
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

export function validateRelease(release, requestedTag = '') {
  const tag = String(release?.tagName ?? '');
  const tagMatch = tag.match(releaseTagPattern);
  if (!tagMatch?.groups?.version) {
    throw new Error('Fleet Agent Homebrew sync requires a vX.Y.Z release tag.');
  }
  if (requestedTag && tag !== requestedTag) {
    throw new Error(`Release tag mismatch: expected ${requestedTag}, got ${tag}.`);
  }
  if (release.isDraft || release.isPrerelease) {
    throw new Error('Fleet Agent Homebrew sync requires a published, non-prerelease release.');
  }
  return { tag, version: tagMatch.groups.version };
}

export function assetByName(assets, name) {
  const matches = assets.filter((asset) => asset?.name === name);
  if (matches.length !== 1) throw new Error(`Release must contain exactly one ${name} asset.`);
  return matches[0];
}

export function assetDigest(asset) {
  const match = String(asset?.digest ?? '').trim().match(digestPattern);
  if (!match?.groups?.hash) {
    throw new Error(`Release asset ${asset?.name ?? '(unknown)'} must expose a SHA-256 digest.`);
  }
  return match.groups.hash.toLowerCase();
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function checksumFromFile(content) {
  const match = String(content).trim().match(/^([a-f0-9]{64})  OPL-Fleet-Agent\.dmg$/i);
  if (!match) throw new Error(`${checksumName} must contain one checksum for ${dmgName}.`);
  return match[1].toLowerCase();
}

export function verifyDownloadedAssets({ release, dmgBytes, checksumBytes }) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const dmgAsset = assetByName(assets, dmgName);
  const checksumAsset = assetByName(assets, checksumName);
  const actualDmgDigest = sha256(dmgBytes);
  const actualChecksumDigest = sha256(checksumBytes);
  const publishedChecksum = checksumFromFile(checksumBytes.toString('utf8'));

  if (actualDmgDigest !== assetDigest(dmgAsset)) {
    throw new Error(`${dmgName} bytes do not match the GitHub asset digest.`);
  }
  if (actualChecksumDigest !== assetDigest(checksumAsset)) {
    throw new Error(`${checksumName} bytes do not match the GitHub asset digest.`);
  }
  if (actualDmgDigest !== publishedChecksum) {
    throw new Error(`${dmgName} bytes do not match the published checksum file.`);
  }
  return actualDmgDigest;
}

export function renderCask({ version, checksum }) {
  return [
    'cask "opl-fleet-agent" do',
    `  version "${version}"`,
    `  sha256 "${checksum}"`,
    '',
    '  url "https://github.com/gaofeng21cn/opl-fleet-agent/releases/download/v#{version}/OPL-Fleet-Agent.dmg"',
    '  name "OPL Fleet Agent"',
    '  desc "Local menu bar monitor for Codex token throughput"',
    '  homepage "https://github.com/gaofeng21cn/opl-fleet-agent"',
    '',
    '  auto_updates true',
    '  depends_on macos: :ventura',
    '',
    '  # release_truth_authority: opl-fleet-agent_release',
    '  # downstream_mirror_only: true',
    '  # retired_install_aliases_allowed: false',
    '',
    '  app "OPL Fleet Agent.app"',
    'end',
    '',
  ].join('\n');
}

export function writeAtomically(targetPath, content) {
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(targetPath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function downloadReleaseAssets(tag, destination) {
  execFileSync('gh', [
    'release',
    'download',
    tag,
    '--repo',
    releaseRepo,
    '--dir',
    destination,
    '--pattern',
    dmgName,
    '--pattern',
    checksumName,
  ], { stdio: 'inherit' });
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const viewArgs = ['release', 'view'];
  if (options.releaseTag) viewArgs.push(options.releaseTag);
  viewArgs.push('--repo', releaseRepo, '--json', 'tagName,isDraft,isPrerelease,assets');
  const release = ghJson(viewArgs);
  const { tag, version } = validateRelease(release, options.releaseTag);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-fleet-agent-cask.'));
  try {
    downloadReleaseAssets(tag, temporaryDirectory);
    const checksum = verifyDownloadedAssets({
      release,
      dmgBytes: fs.readFileSync(path.join(temporaryDirectory, dmgName)),
      checksumBytes: fs.readFileSync(path.join(temporaryDirectory, checksumName)),
    });
    writeAtomically(options.caskPath, renderCask({ version, checksum }));
    console.log(JSON.stringify({ status: 'rendered', tag, version, checksum, cask: options.caskPath }, null, 2));
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`Route this failure to the release owner for ${releaseRepo}; the Tap is only a downstream Cask projection.`);
    process.exit(1);
  }
}
