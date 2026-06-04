#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const appRepo = 'gaofeng21cn/one-person-lab-app';
const sha256Pattern = /^sha256:(?<hash>[a-f0-9]{64})$/i;
const caskConflictMap = {
  'one-person-lab': ['one-person-lab-full', 'one-person-lab-nightly'],
  'one-person-lab-nightly': ['one-person-lab', 'one-person-lab-full'],
  'one-person-lab-full': ['one-person-lab', 'one-person-lab-nightly'],
};

function parseArgs(argv) {
  const parsed = {
    channel: '',
    releaseTag: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${token} requires a value.`);
    }
    index += 1;
    if (token === '--channel') {
      parsed.channel = value;
    } else if (token === '--release-tag') {
      parsed.releaseTag = value;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  if (!['stable', 'nightly', 'full'].includes(parsed.channel)) {
    throw new Error('--channel must be stable, nightly, or full.');
  }
  return parsed;
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function latestNightlyTag() {
  const releases = ghJson([
    'release',
    'list',
    '--repo',
    appRepo,
    '--limit',
    '30',
    '--json',
    'tagName,isDraft,isPrerelease,publishedAt',
  ]);
  const release = releases.find((candidate) => (
    candidate.isPrerelease
    && !candidate.isDraft
    && /nightly/i.test(candidate.tagName)
  ));
  if (!release) throw new Error('No published nightly release found.');
  return release.tagName;
}

function resolveTag(options) {
  if (options.releaseTag) return options.releaseTag;
  if (options.channel === 'stable' || options.channel === 'full') {
    const release = ghJson([
      'release',
      'view',
      '--repo',
      appRepo,
      '--json',
      'tagName,isDraft,isPrerelease',
    ]);
    if (release.isDraft || release.isPrerelease) {
      throw new Error('Latest stable release must be published and non-prerelease.');
    }
    return release.tagName;
  }
  return latestNightlyTag();
}

function assetByName(assets, name) {
  const asset = assets.find((candidate) => candidate?.name === name);
  if (!asset) throw new Error(`Missing release asset: ${name}`);
  return asset;
}

function digestOf(asset) {
  const match = String(asset.digest || '').trim().match(sha256Pattern);
  if (!match?.groups?.hash) {
    throw new Error(`Release asset ${asset.name} must expose a sha256 digest.`);
  }
  return match.groups.hash.toLowerCase();
}

function validateRenderedCask({ channel, content }) {
  const isFull = channel === 'full';
  if (isFull) {
    for (const required of [
      'package_kind: app_full_first_install',
      'full_first_install_allowed: true',
      'standard_updater_visible: false',
      'full-package-manifest.json',
      'One-Person-Lab-Full-#{version}-mac-arm64.dmg',
    ]) {
      if (!content.includes(required)) {
        throw new Error(`Full cask is missing required boundary marker: ${required}`);
      }
    }
    return;
  }
  if (/One-Person-Lab-Full-[^"'\s]+-mac-arm64\.dmg|full-package-manifest/i.test(content)) {
    throw new Error('Standard and Nightly casks must not reference Full first-install assets.');
  }
}

function versionFromTag(tag) {
  return tag.replace(/^v/, '');
}

function boundaryBlock({ channel, version, manifestUrl, checksum }) {
  const isFull = channel === 'full';
  return [
    '  # OPL_HOMEBREW_BOUNDARY_START',
    `  # channel: ${channel}`,
    `  # package_kind: ${isFull ? 'app_full_first_install' : 'app_standard'}`,
    `  # version: ${version}`,
    `  # manifest: ${manifestUrl}`,
    `  # checksum: sha256:${checksum}`,
    `  # full_first_install_allowed: ${isFull ? 'true' : 'false'}`,
    '  # stable_promotion_from_nightly_allowed: false',
    '  # publishes_or_pushes_remote: false',
    `  # cohort: ${isFull ? 'full_first_install_homebrew_distribution' : 'standard_desktop_homebrew_distribution'}`,
    `  # standard_updater_visible: ${isFull ? 'false' : 'true'}`,
    '  # modules_payload_allowed: false',
    `  # bundled_full_runtime_payload_allowed: ${isFull ? 'true' : 'false'}`,
    '  # agent_pack_homebrew_allowed: false',
    '  # agent_pack_activation_owner: app_cli_managed_background_maintenance',
    '  # forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly',
    '  # must_not_write_user_codex_state: true',
    '  # must_not_define_agent_semantics: true',
    '  # OPL_HOMEBREW_BOUNDARY_END',
  ].join('\n');
}

function renderCask({ channel, version, checksum, manifestUrl }) {
  const isFull = channel === 'full';
  const token = channel === 'nightly' ? 'one-person-lab-nightly' : isFull ? 'one-person-lab-full' : 'one-person-lab';
  return [
    `cask "${token}" do`,
    `  version "${version}"`,
    `  sha256 "${checksum}"`,
    '',
    `  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/${isFull ? 'One-Person-Lab-Full' : 'One-Person-Lab'}-#{version}-mac-arm64.dmg"`,
    `  name "${isFull ? 'One Person Lab Full' : 'One Person Lab'}"`,
    `  desc "${isFull ? 'Complete first-install package for One Person Lab' : 'AI-first desktop research and agent orchestration app'}"`,
    '  homepage "https://github.com/gaofeng21cn/one-person-lab-app"',
    '',
    ...(channel === 'stable' || isFull
      ? [
          '  livecheck do',
          '    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"',
          '    regex(%r{/releases/tag/v?(\\d+(?:\\.\\d+)*)}i)',
          '  end',
          '',
        ]
      : [
          '  livecheck do',
          '    skip "Nightly casks track prerelease cohorts through tap automation"',
          '  end',
          '',
        ]),
    '  depends_on macos: :big_sur',
    '  depends_on arch: :arm64',
    `  conflicts_with cask: [${(caskConflictMap[token] ?? []).map((conflict) => `"${conflict}"`).join(', ')}]`,
    '',
    boundaryBlock({ channel, version, manifestUrl, checksum }),
    '',
    '  app "One Person Lab.app"',
    ...(isFull
      ? [
          '',
          '  caveats <<~EOS',
          '    This cask installs the complete first-install package. After launch,',
          '    One Person Lab manages runtime, modules, and agent exposure through',
          '    the App/CLI; Full assets stay outside standard updater metadata.',
          '  EOS',
        ]
      : []),
    'end',
    '',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tag = resolveTag(options);
  const version = versionFromTag(tag);
  if ((options.channel === 'stable' || options.channel === 'full') && /nightly/i.test(version)) {
    throw new Error('Stable cask updates must not use nightly releases.');
  }
  if (options.channel === 'nightly' && !/nightly/i.test(version)) {
    throw new Error('Nightly cask updates must use nightly releases.');
  }

  const release = ghJson([
    'release',
    'view',
    tag,
    '--repo',
    appRepo,
    '--json',
    'tagName,isDraft,isPrerelease,assets',
  ]);
  if (release.isDraft) throw new Error('Draft releases must not update Homebrew casks.');
  if ((options.channel === 'stable' || options.channel === 'full') && release.isPrerelease) {
    throw new Error('Stable cask updates must read a non-prerelease release.');
  }
  if (options.channel === 'nightly' && !release.isPrerelease) {
    throw new Error('Nightly cask updates must read a prerelease release.');
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const dmgName = options.channel === 'full'
    ? `One-Person-Lab-Full-${version}-mac-arm64.dmg`
    : `One-Person-Lab-${version}-mac-arm64.dmg`;
  const dmgAsset = assetByName(assets, dmgName);
  const manifestAsset = assetByName(assets, options.channel === 'full' ? 'full-package-manifest.json' : 'latest-arm64-mac.yml');
  assetByName(assets, options.channel === 'full' ? 'full-gatekeeper-launch-policy.json' : 'standard-gatekeeper-launch-policy.json');
  const checksum = digestOf(dmgAsset);
  const manifestUrl = `https://github.com/${appRepo}/releases/download/${tag}/${manifestAsset.name}`;
  const caskPath = options.channel === 'nightly'
    ? path.join('Casks', 'one-person-lab-nightly.rb')
    : options.channel === 'full'
      ? path.join('Casks', 'one-person-lab-full.rb')
      : path.join('Casks', 'one-person-lab.rb');
  const content = renderCask({
    channel: options.channel,
    version,
    checksum,
    manifestUrl,
  });
  validateRenderedCask({ channel: options.channel, content });
  fs.writeFileSync(caskPath, content, 'utf8');

  console.log(JSON.stringify({
    channel: options.channel,
    tag,
    version,
    cask: caskPath,
    checksum_sha256: checksum,
    manifest_url: manifestUrl,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
