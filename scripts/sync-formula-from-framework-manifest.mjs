#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestRepository = 'ghcr.io/gaofeng21cn/one-person-lab-manifest';
const defaultStableChannelImage = `${manifestRepository}:latest-stable`;
const frameworkRepo = 'https://github.com/gaofeng21cn/one-person-lab.git';
const formulaName = 'opl';
const internalNpmPackageName = 'opl-framework';
const canonicalPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
const releaseSetGenerationPattern = /^[0-9]{2}\.[0-9]{1,2}\.[0-9]{1,2}(?:-r[1-9][0-9]*)?$/;
const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const shaPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function parseArgs(argv) {
  const options = {
    manifestFile: '',
    manifestImage: '',
    stableChannelImage: defaultStableChannelImage,
    expectedReleaseSetGeneration: '',
    expectedManifestDigest: '',
    formulaPath: path.join('Formula', 'opl.rb'),
    resolvedManifestOutput: '',
  };
  const keys = {
    '--manifest-file': 'manifestFile',
    '--manifest-image': 'manifestImage',
    '--stable-channel-image': 'stableChannelImage',
    '--expected-release-set-generation': 'expectedReleaseSetGeneration',
    '--expected-manifest-digest': 'expectedManifestDigest',
    '--formula-path': 'formulaPath',
    '--resolved-manifest-output': 'resolvedManifestOutput',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const key = keys[option];
    if (!key) throw new Error(`Unknown option: ${option}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
    options[key] = value;
    index += 1;
  }
  if (options.manifestFile && options.manifestImage) {
    throw new Error('--manifest-file and --manifest-image are mutually exclusive.');
  }
  if (path.basename(options.formulaPath) !== `${formulaName}.rb`) {
    throw new Error(`The only allowed Formula output is ${formulaName}.rb.`);
  }
  if (options.manifestFile) {
    if (options.expectedManifestDigest || argv.includes('--stable-channel-image')) {
      throw new Error('Local manifest fixtures must not claim remote OCI digest or channel readback.');
    }
  } else {
    if (!releaseSetGenerationPattern.test(options.expectedReleaseSetGeneration)) {
      throw new Error('Remote Formula sync requires --expected-release-set-generation YY.M.D[-rN].');
    }
    if (!digestPattern.test(options.expectedManifestDigest)) {
      throw new Error('Remote Formula sync requires --expected-manifest-digest sha256:<64 lowercase hex>.');
    }
    options.manifestImage ||= `${manifestRepository}:${options.expectedReleaseSetGeneration}`;
  }
  return options;
}

export function parseGhcrImage(image) {
  const match = image.match(
    /^ghcr\.io\/(?<repository>[a-z0-9._/-]+?)(?::(?<tag>[^/:@]+)|@(?<digest>sha256:[a-f0-9]{64}))$/,
  );
  if (!match?.groups) throw new Error(`Unsupported OPL release manifest image: ${image}`);
  return {
    repository: match.groups.repository,
    reference: match.groups.tag || match.groups.digest,
    referenceKind: match.groups.tag ? 'tag' : 'digest',
  };
}

async function fetchOk(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response;
}

async function fetchJson(url, options = {}) {
  return (await fetchOk(url, options)).json();
}

function sha256Digest(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

async function registryAuthorization(repository) {
  const scope = `repository:${repository}:pull`;
  const tokenPayload = await fetchJson(
    `https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(scope)}`,
  );
  if (!tokenPayload.token) throw new Error(`GHCR did not issue a pull token for ${repository}.`);
  return `Bearer ${tokenPayload.token}`;
}

async function readOciManifest(repository, reference, authorization) {
  const response = await fetchOk(`https://ghcr.io/v2/${repository}/manifests/${reference}`, {
    headers: {
      Authorization: authorization,
      Accept: 'application/vnd.oci.image.manifest.v1+json',
    },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const computedDigest = sha256Digest(bytes);
  const registryDigest = String(response.headers.get('docker-content-digest') ?? '').toLowerCase();
  if (!digestPattern.test(registryDigest) || registryDigest !== computedDigest) {
    throw new Error(`GHCR manifest ${repository}:${reference} did not return self-consistent digest evidence.`);
  }
  return { digest: registryDigest, payload: JSON.parse(bytes.toString('utf8')) };
}

export function validateRemoteManifestBinding({
  generationReference,
  generationDigest,
  stableReference,
  stableDigest,
  expectedGeneration,
  expectedDigest,
}) {
  if (generationReference !== expectedGeneration) {
    throw new Error(`Formula source tag must be exact Release Set generation ${expectedGeneration}.`);
  }
  if (stableReference !== 'latest-stable') {
    throw new Error('Formula stable-channel readback must use latest-stable.');
  }
  if (!digestPattern.test(expectedDigest)) {
    throw new Error('Expected Release Set manifest digest is invalid.');
  }
  if (generationDigest !== expectedDigest) {
    throw new Error(`Release Set generation digest differs from expected digest ${expectedDigest}.`);
  }
  if (stableDigest !== expectedDigest) {
    throw new Error(`latest-stable does not point to exact Release Set digest ${expectedDigest}.`);
  }
}

async function readManifestFromGhcr({
  manifestImage,
  stableChannelImage,
  expectedReleaseSetGeneration,
  expectedManifestDigest,
}) {
  const generation = parseGhcrImage(manifestImage);
  const stable = parseGhcrImage(stableChannelImage);
  if (generation.repository !== stable.repository || generation.repository !== manifestRepository.replace('ghcr.io/', '')) {
    throw new Error('Formula sync must use the canonical OPL Release Set repository for generation and stable channel.');
  }
  if (generation.referenceKind !== 'tag' || stable.referenceKind !== 'tag') {
    throw new Error('Formula sync requires explicit generation and latest-stable tags plus an expected digest.');
  }
  const authorization = await registryAuthorization(generation.repository);
  const generationManifest = await readOciManifest(
    generation.repository,
    generation.reference,
    authorization,
  );
  const stableManifest = await readOciManifest(stable.repository, stable.reference, authorization);
  validateRemoteManifestBinding({
    generationReference: generation.reference,
    generationDigest: generationManifest.digest,
    stableReference: stable.reference,
    stableDigest: stableManifest.digest,
    expectedGeneration: expectedReleaseSetGeneration,
    expectedDigest: expectedManifestDigest,
  });
  const layer = generationManifest.payload.layers?.find((candidate) => (
    candidate.mediaType === 'application/vnd.onepersonlab.release.manifest.v1+json'
  ));
  if (!layer?.digest || !digestPattern.test(layer.digest)) {
    throw new Error(`${manifestImage} has no valid OPL Release Set manifest layer.`);
  }
  const layerResponse = await fetchOk(
    `https://ghcr.io/v2/${generation.repository}/blobs/${layer.digest}`,
    { headers: { Authorization: authorization } },
  );
  const layerBytes = Buffer.from(await layerResponse.arrayBuffer());
  if (sha256Digest(layerBytes) !== layer.digest) {
    throw new Error('OPL Release Set manifest layer bytes do not match the OCI layer digest.');
  }
  return {
    manifest: JSON.parse(layerBytes.toString('utf8')),
    manifestDigest: generationManifest.digest,
  };
}

function assertNoPackageHomebrewSurface(manifest) {
  const artifacts = manifest?.packages?.package_artifacts ?? {};
  const artifactIds = Object.keys(artifacts).sort();
  if (JSON.stringify(artifactIds) !== JSON.stringify([...canonicalPackageIds].sort())) {
    throw new Error('Release Set must contain exactly the canonical seven OPL Packages.');
  }
  const catalog = manifest?.packages?.package_catalog;
  if (catalog !== undefined
    && JSON.stringify(Object.keys(catalog).sort()) !== JSON.stringify([...canonicalPackageIds].sort())) {
    throw new Error('Package catalog must contain exactly the canonical seven OPL Packages.');
  }
  const members = manifest?.release_set?.components?.packages?.members ?? {};
  if (manifest?.release_set?.components?.packages?.package_count !== canonicalPackageIds.length
    || JSON.stringify(Object.keys(members).sort()) !== JSON.stringify([...canonicalPackageIds].sort())) {
    throw new Error('Release Set Package members must contain exactly the canonical seven OPL Packages.');
  }
  for (const packageId of canonicalPackageIds) {
    const artifact = artifacts[packageId];
    const member = members[packageId];
    const catalogEntry = catalog?.[packageId];
    if (!member || artifact?.homebrew_formula !== undefined || artifact?.homebrew_cask !== undefined
      || member?.homebrew_formula !== undefined || member?.homebrew_cask !== undefined
      || catalogEntry?.homebrew_formula !== undefined || catalogEntry?.homebrew_cask !== undefined
      || catalogEntry?.versions?.some((version) => (
        version?.homebrew_formula !== undefined || version?.homebrew_cask !== undefined
      ))) {
      throw new Error(`${packageId} must not declare a Homebrew Formula or Cask.`);
    }
  }
}

export function formulaMetadataFromManifest(manifest) {
  const releaseSet = manifest?.release_set;
  const releaseSetGeneration = String(manifest?.release_set_generation ?? '').trim();
  if (releaseSet?.surface_kind !== 'opl_release_set.v2'
    || !releaseSetGenerationPattern.test(releaseSetGeneration)
    || releaseSet.generation !== releaseSetGeneration) {
    throw new Error('Formula sync requires a self-consistent OPL Release Set v2 generation.');
  }
  if (releaseSet.bom_status !== 'complete' || !digestPattern.test(releaseSet.bom_digest ?? '')) {
    throw new Error('Formula sync requires a complete Release Set v2 BOM with a valid digest.');
  }
  if (releaseSet.component_count !== 9) {
    throw new Error('Formula sync requires Base, App, and the canonical seven Packages.');
  }
  assertNoPackageHomebrewSurface(manifest);

  const framework = manifest?.packages?.framework_core;
  if (!framework) throw new Error('Framework release manifest has no packages.framework_core.');
  const base = releaseSet.components?.base;
  if (!base || base.component_id !== 'opl-base' || base.component_kind !== 'base') {
    throw new Error('Release Set v2 has no canonical opl-base component.');
  }
  const projection = framework.homebrew_formula;
  if (!projection || typeof projection !== 'object') {
    throw new Error('Framework release manifest has no owner-approved homebrew_formula projection.');
  }
  const version = String(framework.version ?? '').trim();
  const headSha = String(framework.source_git?.head_sha ?? '').trim().toLowerCase();
  const packageSha256 = String(framework.source_archive?.sha256 ?? '').trim().toLowerCase();
  const artifactDigest = String(framework.artifact_digest ?? '').trim().toLowerCase();
  const archiveUrl = `https://github.com/gaofeng21cn/one-person-lab/archive/${headSha}.tar.gz`;
  if (projection.formula_name !== formulaName || projection.package_name !== formulaName) {
    throw new Error(`homebrew_formula formula_name and package_name must both be ${formulaName}.`);
  }
  if (!semverPattern.test(version)) {
    throw new Error('Framework Formula version must be a stable Base SemVer.');
  }
  if (framework.source_git?.repo_url !== frameworkRepo || !shaPattern.test(headSha)) {
    throw new Error('Framework source_git must bind the canonical repository to an immutable 40-character head SHA.');
  }
  if (!sha256Pattern.test(packageSha256)) {
    throw new Error('Framework source archive must expose its release-authority SHA256.');
  }
  if (!digestPattern.test(artifactDigest)
    || framework.artifact_status !== 'published_immutable'
    || base.version !== version
    || base.source_commit !== headSha
    || base.artifact_ref !== framework.artifact
    || base.artifact_digest !== artifactDigest
    || base.artifact_status !== 'published_immutable') {
    throw new Error('packages.framework_core and release_set.components.base must bind the same published immutable Base.');
  }
  if (projection.surface_kind !== 'opl_homebrew_formula_projection.v1'
    || projection.approval_status !== 'owner_approved'
    || projection.carrier_scope !== 'framework_core_only'
    || projection.tap_generator_role !== 'consume_projection_without_inference') {
    throw new Error('homebrew_formula projection is not owner-approved for the Base-only tap generator.');
  }
  if (projection.version !== version || projection.source_head !== headSha) {
    throw new Error('homebrew_formula version and source_head must match canonical Framework fields.');
  }
  if (projection.archive_url !== archiveUrl || projection.archive_kind !== 'immutable_github_commit_archive') {
    throw new Error('homebrew_formula must approve the canonical immutable GitHub commit archive.');
  }
  if (projection.sha256_source !== 'tap_sync_download_and_hash') {
    throw new Error('homebrew_formula sha256_source must be tap_sync_download_and_hash.');
  }
  return {
    formulaName: projection.formula_name,
    packageName: projection.package_name,
    version,
    headSha,
    packageSha256,
    artifactRef: framework.artifact,
    artifactDigest,
    archiveUrl,
    releaseSetGeneration,
    releaseSetBomDigest: releaseSet.bom_digest,
  };
}

async function sha256OfUrl(url) {
  const response = await fetchOk(url);
  const hash = crypto.createHash('sha256');
  for await (const chunk of response.body) hash.update(chunk);
  return hash.digest('hex');
}

export function renderFormula(metadata) {
  return `class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "${metadata.archiveUrl}"
  version "${metadata.version}"
  sha256 "${metadata.transportSha256}"
  license "Apache-2.0"

  depends_on "node@22"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # release_set_generation: ${metadata.releaseSetGeneration}
  # release_set_bom_digest: ${metadata.releaseSetBomDigest}
  # framework_source_head: ${metadata.headSha}
  # framework_artifact_ref: ${metadata.artifactRef}
  # framework_artifact_digest: ${metadata.artifactDigest}
  # framework_package_archive_sha256: ${metadata.packageSha256}
  # homebrew_transport_archive_sha256: ${metadata.transportSha256}
  # formula_identity: ${formulaName}
  # internal_npm_package: ${internalNpmPackageName}
  # internal_installation_implementation_only: true
  # carrier_scope: framework_cli_runtime_and_production_dependencies
  # temporal_dependency_scope: framework_production_dependency
  # app_payload_installed: false
  # opl_packages_payload_installed: false
  # package_specific_formula_allowed: false
  # package_specific_cask_allowed: false
  # opl_packages_lifecycle_owner: opl_cli
  # opl_packages_lifecycle_command: opl packages
  # user_state_initialized_during_brew_install: false
  # first_user_state_reconcile: opl install --headless --skip-packages
  # OPL_HOMEBREW_FORMULA_BOUNDARY_END

  def install
    npm = formula_opt_bin("node@22")/"npm"
    ENV["npm_config_cache"] = buildpath/".npm-cache"
    ENV["npm_config_update_notifier"] = "false"
    system npm, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/opl"
  end

  def caveats
    <<~EOS
      This Formula installs only the OPL Framework, CLI, runtime, and their
      production dependencies. It does not install the OPL App or OPL Packages.

      Initialize or reconcile user state explicitly after installation:
        opl install --headless --skip-packages
    EOS
  end

  test do
    assert_match "OPL", shell_output("#{bin}/opl --help")
  end
end
`;
}

export function writeFileAtomically(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export const writeFormulaAtomically = writeFileAtomically;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let manifest;
  let manifestDigest = null;
  if (options.manifestFile) {
    manifest = JSON.parse(fs.readFileSync(options.manifestFile, 'utf8'));
  } else {
    const resolved = await readManifestFromGhcr(options);
    manifest = resolved.manifest;
    manifestDigest = resolved.manifestDigest;
  }
  const metadata = formulaMetadataFromManifest(manifest);
  if (options.expectedReleaseSetGeneration
    && metadata.releaseSetGeneration !== options.expectedReleaseSetGeneration) {
    throw new Error(`Resolved manifest generation is not ${options.expectedReleaseSetGeneration}.`);
  }
  metadata.transportSha256 = await sha256OfUrl(metadata.archiveUrl);
  const content = renderFormula(metadata);
  writeFormulaAtomically(options.formulaPath, content);
  if (options.resolvedManifestOutput) {
    writeFileAtomically(options.resolvedManifestOutput, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    formula: options.formulaPath,
    formula_name: metadata.formulaName,
    package_name: metadata.packageName,
    internal_npm_package: internalNpmPackageName,
    version: metadata.version,
    framework_source_head: metadata.headSha,
    framework_artifact_ref: metadata.artifactRef,
    framework_artifact_digest: metadata.artifactDigest,
    framework_package_archive_sha256: metadata.packageSha256,
    homebrew_transport_archive_sha256: metadata.transportSha256,
    release_set_generation: metadata.releaseSetGeneration,
    release_set_bom_digest: metadata.releaseSetBomDigest,
    release_set_manifest_digest: manifestDigest,
    manifest_source: options.manifestFile || options.manifestImage,
    stable_channel_readback: options.manifestFile ? null : options.stableChannelImage,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
