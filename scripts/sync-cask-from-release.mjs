#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const appRepo = 'gaofeng21cn/one-person-lab-app';
const failureRoute = [
  'Homebrew tap is a downstream App release mirror only.',
  `Route this failure to the App release operator/authority for ${appRepo}; fix or republish the App release, then rerun tap sync.`,
  'The tap must not define release truth/currentness or invent tap-local status semantics.',
].join('\n');
const appReleaseFailurePattern = /No published nightly release found|Latest stable release|Missing release asset|must expose a sha256 digest|Draft releases|Stable cask updates must (?:read|use)|Nightly cask updates must (?:read|use)/;
const sha256Pattern = /^sha256:(?<hash>[a-f0-9]{64})$/i;
const stableVersionPattern = /^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])$/;
const nightlyVersionPattern = /^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])-nightly(?:\.r[1-9])?$/;
const caskConflictMap = {
  'one-person-lab': ['one-person-lab-full', 'one-person-lab-nightly'],
  'one-person-lab-nightly': ['one-person-lab', 'one-person-lab-full'],
  'one-person-lab-full': ['one-person-lab', 'one-person-lab-nightly'],
};

function parseArgs(argv) {
  const parsed = {
    channel: '',
    releaseTag: '',
    dependsOnOplFormula: false,
    allowMissingNightly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--with-opl-formula') {
      parsed.dependsOnOplFormula = true;
      continue;
    }
    if (token === '--allow-missing-nightly') {
      parsed.allowMissingNightly = true;
      continue;
    }
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
  if (parsed.channel === 'full' && parsed.dependsOnOplFormula) {
    throw new Error('Full casks consume the App-owned embedded Base and must not depend on Formula opl.');
  }
  if (parsed.allowMissingNightly && (parsed.channel !== 'nightly' || parsed.releaseTag)) {
    throw new Error('--allow-missing-nightly is valid only for automatic Nightly discovery.');
  }
  return parsed;
}

function ghJson(args) {
  if (
    process.env.OPL_APP_RELEASE_VIEW_JSON?.trim()
    && args[0] === 'release'
    && args[1] === 'view'
  ) {
    return JSON.parse(process.env.OPL_APP_RELEASE_VIEW_JSON);
  }
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function latestNightlyTag({ allowMissingNightly }) {
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
    && nightlyVersionPattern.test(versionFromTag(candidate.tagName))
  ));
  if (release) return release.tagName;
  if (allowMissingNightly) return null;
  throw new Error('No published nightly release found with YY.M.D-nightly or YY.M.D-nightly.r1 through .r9.');
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
  return latestNightlyTag(options);
}

function assetByName(assets, name) {
  const asset = assets.find((candidate) => candidate?.name === name);
  if (!asset) throw new Error(`Missing release asset: ${name}`);
  return asset;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function standardDmgAsset(assets, { channel, version }) {
  const expectedName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const exact = assets.find((candidate) => candidate?.name === expectedName);
  if (exact) return exact;
  if (channel !== 'nightly') return assetByName(assets, expectedName);

  const migratedLegacyPattern = new RegExp(
    `^One-Person-Lab-${escapeRegExp(version)}\\.[1-9][0-9]*\\.[1-9][0-9]*-mac-arm64\\.dmg$`,
  );
  const migratedLegacyAssets = assets.filter((candidate) => migratedLegacyPattern.test(candidate?.name ?? ''));
  if (migratedLegacyAssets.length === 1) return migratedLegacyAssets[0];
  if (migratedLegacyAssets.length > 1) {
    throw new Error(`Missing release asset: ${expectedName}; multiple legacy Nightly DMGs matched the canonical release.`);
  }
  return assetByName(assets, expectedName);
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
      'opl-release-manifest.json',
      'One-Person-Lab-Full-#{version}-mac-arm64.dmg',
    ]) {
      if (!content.includes(required)) {
        throw new Error(`Full cask is missing required boundary marker: ${required}`);
      }
    }
    return;
  }
  if (/One-Person-Lab-Full-[^"'\s]+-mac-arm64\.dmg/i.test(content)) {
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
    '  # downstream_mirror_only: true',
    '  # release_truth_authority: app_release',
    '  # failure_feedback_owner: app_release_operator',
    `  # full_first_install_allowed: ${isFull ? 'true' : 'false'}`,
    '  # stable_promotion_from_nightly_allowed: false',
    '  # publishes_or_pushes_remote: false',
    `  # cohort: ${isFull ? 'full_first_install_homebrew_distribution' : 'standard_desktop_homebrew_distribution'}`,
    `  # standard_updater_visible: ${isFull ? 'false' : 'true'}`,
    `  # bundled_full_runtime_payload_allowed: ${isFull ? 'true' : 'false'}`,
    '  # homebrew_allowed_software_objects: opl_base,opl_app',
    '  # opl_packages_lifecycle_owned_by_homebrew: false',
    '  # opl_packages_lifecycle_owner: opl_cli',
    '  # opl_packages_lifecycle_command: opl packages',
    '  # package_specific_formula_allowed: false',
    '  # package_specific_cask_allowed: false',
    '  # forbidden_package_formulae: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow',
    '  # forbidden_package_casks: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow',
    '  # must_not_define_release_currentness: true',
    '  # must_not_write_user_codex_state: true',
    '  # must_not_define_agent_semantics: true',
    '  # OPL_HOMEBREW_BOUNDARY_END',
  ].join('\n');
}

function renderCask({ channel, version, checksum, manifestUrl, dmgAssetName, dependsOnOplFormula }) {
  const isFull = channel === 'full';
  const token = channel === 'nightly' ? 'one-person-lab-nightly' : isFull ? 'one-person-lab-full' : 'one-person-lab';
  const expectedDmgAssetName = `${isFull ? 'One-Person-Lab-Full' : 'One-Person-Lab'}-${version}-mac-arm64.dmg`;
  const renderedDmgAssetName = dmgAssetName === expectedDmgAssetName
    ? `${isFull ? 'One-Person-Lab-Full' : 'One-Person-Lab'}-#{version}-mac-arm64.dmg`
    : dmgAssetName;
  return [
    `cask "${token}" do`,
    `  version "${version}"`,
    `  sha256 "${checksum}"`,
    '',
    `  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/${renderedDmgAssetName}"`,
    `  name "${isFull ? 'One Person Lab Full' : 'One Person Lab'}"`,
    `  desc "${isFull ? 'Complete first-install package for One Person Lab' : 'AI-first desktop research and agent orchestration app'}"`,
    '  homepage "https://github.com/gaofeng21cn/one-person-lab-app"',
    '',
    ...(channel === 'stable'
      ? [
          '  livecheck do',
          '    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"',
          '    regex(%r{/releases/tag/v?(\\d+(?:\\.\\d+)*)}i)',
          '  end',
          '',
        ]
      : [
          '  livecheck do',
          `    skip "${isFull
            ? 'Full casks track explicitly published Full cohorts through App release automation'
            : 'Nightly casks track prerelease cohorts through tap automation'}"`,
          '  end',
          '',
        ]),
    `  conflicts_with cask: [${(caskConflictMap[token] ?? []).map((conflict) => `"${conflict}"`).join(', ')}]`,
    ...(dependsOnOplFormula ? ['  depends_on formula: "opl"'] : []),
    '  depends_on macos: :big_sur',
    '  depends_on arch: :arm64',
    '',
    boundaryBlock({ channel, version, manifestUrl, checksum }),
    '',
    '  app "One Person Lab.app"',
    ...(isFull
      ? [
          '',
          '  caveats <<~EOS',
          '    This cask installs the complete first-install package. After launch,',
          '    One Person Lab manages runtime, Packages, and Agent exposure through',
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
  if (options.dependsOnOplFormula && !fs.existsSync(path.join('Formula', 'opl.rb'))) {
    throw new Error('--with-opl-formula requires an already generated Formula/opl.rb.');
  }
  const tag = resolveTag(options);
  if (!tag) {
    console.log(JSON.stringify({
      status: 'no_op',
      channel: 'nightly',
      reason: 'no_eligible_published_prerelease',
    }, null, 2));
    return;
  }
  const version = versionFromTag(tag);
  if ((options.channel === 'stable' || options.channel === 'full') && !stableVersionPattern.test(version)) {
    throw new Error('Stable cask updates must use YY.M.D without a same-day suffix.');
  }
  if (options.channel === 'nightly' && !nightlyVersionPattern.test(version)) {
    throw new Error('Nightly cask updates must use YY.M.D-nightly or YY.M.D-nightly.r1 through .r9.');
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
  if (release.tagName !== tag) {
    throw new Error(`Release tag mismatch: expected ${tag}, got ${release.tagName || '(missing)'}.`);
  }
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
  const dmgAsset = options.channel === 'full'
    ? assetByName(assets, dmgName)
    : standardDmgAsset(assets, { channel: options.channel, version });
  const manifestAsset = assetByName(assets, options.channel === 'full' ? 'opl-release-manifest.json' : 'latest-arm64-mac.yml');
  assetByName(assets, 'standard-local-authorization-policy.json');
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
    dmgAssetName: dmgAsset.name,
    dependsOnOplFormula: options.dependsOnOplFormula,
  });
  validateRenderedCask({ channel: options.channel, content });
  fs.writeFileSync(caskPath, content, 'utf8');

  console.log(JSON.stringify({
    status: 'rendered',
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
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (appReleaseFailurePattern.test(message)) {
    console.error(failureRoute);
  }
  process.exit(1);
}
