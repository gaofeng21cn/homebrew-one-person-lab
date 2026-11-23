#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

const releaseTagPattern = /^v(?<version>\d+\.\d+\.\d+)$/;
const digestPattern = /^sha256:(?<hash>[a-f0-9]{64})$/i;

export const TARGETS = {
  'opl-codex-models': {
    token: 'opl-codex-models',
    label: 'Codex Models',
    releaseRepo: 'gaofeng21cn/opl-codex-models',
    dmgName: 'Codex-Models.dmg',
    checksumName: 'Codex-Models.dmg.sha256',
    defaultCaskPath: path.join('Casks', 'opl-codex-models.rb'),
    tempPrefix: 'opl-codex-models-cask.',
    name: 'Codex Models',
    desc: 'Manage Codex official and custom model catalogs',
    homepage: 'https://github.com/gaofeng21cn/opl-codex-models',
    hasLivecheck: false,
    autoUpdates: false,
    macos: ':sonoma',
    boundaryComments: [
      '  # release_truth_authority: opl-codex-models_release',
      '  # downstream_mirror_only: true',
      '  # user_model_data_preserved_on_uninstall: true',
    ],
    app: 'CodexModelManager.app',
    uninstall: '  uninstall launchctl: "com.onepersonlab.codex-model-manager.sync"',
  },
  'opl-fleet-agent': {
    token: 'opl-fleet-agent',
    label: 'Fleet Agent',
    releaseRepo: 'gaofeng21cn/opl-fleet-agent',
    dmgName: 'OPL-Fleet-Agent.dmg',
    checksumName: 'OPL-Fleet-Agent.dmg.sha256',
    defaultCaskPath: path.join('Casks', 'opl-fleet-agent.rb'),
    tempPrefix: 'opl-fleet-agent-cask.',
    name: 'OPL Fleet Agent',
    desc: 'Local menu bar monitor for Codex token throughput',
    homepage: 'https://github.com/gaofeng21cn/opl-fleet-agent',
    hasLivecheck: true,
    autoUpdates: true,
    macos: ':ventura',
    boundaryComments: [
      '  # release_truth_authority: opl-fleet-agent_release',
      '  # downstream_mirror_only: true',
      '  # retired_install_aliases_allowed: false',
    ],
    app: 'OPL Fleet Agent.app',
    uninstall: '',
  },
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getTargetConfig(target) {
  const config = typeof target === 'string' ? TARGETS[target] : null;
  if (!config) {
    throw new Error(`Unknown target "${target ?? ''}". Expected one of: ${Object.keys(TARGETS).join(', ')}.`);
  }
  return config;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      target: { type: 'string' },
      'release-tag': { type: 'string' },
      'cask-path': { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });

  const target = values.target;
  if (!target || target.startsWith('--')) {
    throw new Error(`--target is required and must be one of: ${Object.keys(TARGETS).join(', ')}.`);
  }
  const config = getTargetConfig(target);

  const releaseTag = values['release-tag'] ?? '';
  if (values['release-tag'] !== undefined && (!releaseTag || releaseTag.startsWith('--'))) {
    throw new Error('--release-tag requires a value.');
  }

  const caskPath = values['cask-path'] ?? config.defaultCaskPath;
  if (values['cask-path'] !== undefined && (!caskPath || caskPath.startsWith('--'))) {
    throw new Error('--cask-path requires a value.');
  }

  return { target, releaseTag, caskPath };
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

export function validateRelease(release, requestedTag = '', target = '') {
  const label = target ? getTargetConfig(target).label : 'DMG Cask';
  const tag = String(release?.tagName ?? '');
  const match = tag.match(releaseTagPattern);
  if (!match?.groups?.version) {
    throw new Error(`${label} Homebrew sync requires a vX.Y.Z release tag.`);
  }
  if (requestedTag && tag !== requestedTag) {
    throw new Error(`Release tag mismatch: expected ${requestedTag}, got ${tag}.`);
  }
  if (release.isDraft || release.isPrerelease) {
    throw new Error(`${label} Homebrew sync requires a published, non-prerelease release.`);
  }
  return { tag, version: match.groups.version };
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

export function checksumFromFile(content, target) {
  const { dmgName, checksumName } = getTargetConfig(target);
  const pattern = new RegExp(`^([a-f0-9]{64})  ${escapeRegExp(dmgName)}$`, 'i');
  const match = String(content).trim().match(pattern);
  if (!match) throw new Error(`${checksumName} must contain one checksum for ${dmgName}.`);
  return match[1].toLowerCase();
}

export function verifyDownloadedAssets({ target, release, dmgBytes, checksumBytes }) {
  const { dmgName, checksumName } = getTargetConfig(target);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const dmgAsset = assetByName(assets, dmgName);
  const checksumAsset = assetByName(assets, checksumName);
  const actualDmgDigest = sha256(dmgBytes);
  const actualChecksumDigest = sha256(checksumBytes);
  const publishedChecksum = checksumFromFile(checksumBytes.toString('utf8'), target);

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

export function renderCask({ target, version, checksum }) {
  const config = getTargetConfig(target);
  const lines = [
    `cask "${config.token}" do`,
    `  version "${version}"`,
    `  sha256 "${checksum}"`,
    '',
    `  url "https://github.com/${config.releaseRepo}/releases/download/v#{version}/${config.dmgName}"`,
    `  name "${config.name}"`,
    `  desc "${config.desc}"`,
    `  homepage "${config.homepage}"`,
    '',
  ];

  if (config.hasLivecheck) {
    lines.push(
      '  livecheck do',
      '    url :url',
      '    strategy :github_latest',
      '  end',
      '',
    );
  }

  if (config.autoUpdates) {
    lines.push('  auto_updates true');
  }

  lines.push(
    `  depends_on macos: ${config.macos}`,
    '',
    ...config.boundaryComments,
    '',
    `  app "${config.app}"`,
  );

  if (config.uninstall) {
    lines.push('', config.uninstall);
  }

  lines.push('end', '');
  return lines.join('\n');
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

function downloadReleaseAssets(config, tag, destination) {
  execFileSync('gh', [
    'release',
    'download',
    tag,
    '--repo',
    config.releaseRepo,
    '--dir',
    destination,
    '--pattern',
    config.dmgName,
    '--pattern',
    config.checksumName,
  ], { stdio: 'inherit' });
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const config = getTargetConfig(options.target);
  try {
    const viewArgs = ['release', 'view'];
    if (options.releaseTag) viewArgs.push(options.releaseTag);
    viewArgs.push('--repo', config.releaseRepo, '--json', 'tagName,isDraft,isPrerelease,assets');
    const release = ghJson(viewArgs);
    const { tag, version } = validateRelease(release, options.releaseTag, options.target);
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), config.tempPrefix));
    try {
      downloadReleaseAssets(config, tag, temporaryDirectory);
      const checksum = verifyDownloadedAssets({
        target: options.target,
        release,
        dmgBytes: fs.readFileSync(path.join(temporaryDirectory, config.dmgName)),
        checksumBytes: fs.readFileSync(path.join(temporaryDirectory, config.checksumName)),
      });
      writeAtomically(options.caskPath, renderCask({ target: options.target, version, checksum }));
      console.log(JSON.stringify({
        status: 'rendered',
        target: options.target,
        tag,
        version,
        checksum,
        cask: options.caskPath,
      }, null, 2));
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(message);
    wrapped.releaseRepo = config.releaseRepo;
    throw wrapped;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (error && typeof error === 'object' && 'releaseRepo' in error && error.releaseRepo) {
      console.error(`Route this failure to the release owner for ${error.releaseRepo}; the Tap is only a downstream Cask projection.`);
    }
    process.exit(1);
  }
}
