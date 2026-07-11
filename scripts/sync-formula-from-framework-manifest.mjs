#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultManifestImage = 'ghcr.io/gaofeng21cn/one-person-lab-manifest:latest';
const frameworkRepo = 'https://github.com/gaofeng21cn/one-person-lab.git';
const formulaPackageName = 'opl-framework';
const shaPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

function parseArgs(argv) {
  const options = {
    manifestFile: '',
    manifestImage: defaultManifestImage,
    formulaPath: path.join('Formula', 'opl.rb'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
    index += 1;
    if (option === '--manifest-file') options.manifestFile = value;
    else if (option === '--manifest-image') options.manifestImage = value;
    else if (option === '--formula-path') options.formulaPath = value;
    else throw new Error(`Unknown option: ${option}`);
  }
  if (options.manifestFile && argv.includes('--manifest-image')) {
    throw new Error('--manifest-file and --manifest-image are mutually exclusive.');
  }
  return options;
}

function parseGhcrImage(image) {
  const match = image.match(/^ghcr\.io\/(?<repository>[^:]+):(?<reference>[^:]+)$/);
  if (!match?.groups) throw new Error(`Unsupported Framework manifest image: ${image}`);
  return match.groups;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json();
}

async function readManifestFromGhcr(image) {
  const { repository, reference } = parseGhcrImage(image);
  const scope = `repository:${repository}:pull`;
  const tokenPayload = await fetchJson(
    `https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(scope)}`,
  );
  if (!tokenPayload.token) throw new Error(`GHCR did not issue a pull token for ${repository}.`);
  const authorization = `Bearer ${tokenPayload.token}`;
  const ociManifest = await fetchJson(
    `https://ghcr.io/v2/${repository}/manifests/${reference}`,
    {
      headers: {
        Authorization: authorization,
        Accept: 'application/vnd.oci.image.manifest.v1+json',
      },
    },
  );
  const layer = ociManifest.layers?.find((candidate) => (
    candidate.mediaType === 'application/vnd.onepersonlab.release.manifest.v1+json'
  ));
  if (!layer?.digest) throw new Error(`${image} has no OPL Framework release manifest layer.`);
  return fetchJson(`https://ghcr.io/v2/${repository}/blobs/${layer.digest}`, {
    headers: { Authorization: authorization },
  });
}

export function formulaMetadataFromManifest(manifest) {
  const framework = manifest?.packages?.framework_core;
  if (!framework) throw new Error('Framework release manifest has no packages.framework_core.');
  const projection = framework.homebrew_formula;
  if (!projection || typeof projection !== 'object') {
    throw new Error('Framework release manifest has no owner-approved homebrew_formula projection.');
  }
  const version = String(framework.version ?? '').trim();
  const headSha = String(framework.source_git?.head_sha ?? '').trim().toLowerCase();
  const packageSha256 = String(framework.source_archive?.sha256 ?? '').trim().toLowerCase();
  const archiveUrl = `https://github.com/gaofeng21cn/one-person-lab/archive/${headSha}.tar.gz`;
  if (projection.package_name !== formulaPackageName) {
    throw new Error(`homebrew_formula package_name must be ${formulaPackageName}.`);
  }
  if (!version || version !== String(manifest.opl_version ?? '').replace(/^v/, '')) {
    throw new Error('Framework version must match the OPL release manifest version.');
  }
  if (framework.source_git?.repo_url !== frameworkRepo || !shaPattern.test(headSha)) {
    throw new Error('Framework source_git must bind the canonical repository to an immutable 40-character head SHA.');
  }
  if (!sha256Pattern.test(packageSha256)) {
    throw new Error('Framework source archive must expose its release-authority SHA256.');
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
    version,
    headSha,
    packageSha256,
    archiveUrl,
  };
}

async function sha256OfUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Framework commit archive download failed (${response.status}): ${url}`);
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
  # framework_source_head: ${metadata.headSha}
  # framework_package_archive_sha256: ${metadata.packageSha256}
  # homebrew_transport_archive_sha256: ${metadata.transportSha256}
  # installed_package: opl-framework
  # carrier_scope: framework_cli_runtime_and_production_dependencies
  # temporal_dependency_scope: framework_production_dependency
  # app_payload_installed: false
  # agent_payload_installed: false
  # agent_specific_formula_allowed: false
  # user_state_initialized_during_brew_install: false
  # first_user_state_reconcile: opl install --headless --skip-modules
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
      production dependencies. It does not install the OPL App or any Agent.

      Initialize or reconcile user state explicitly after installation:
        opl install --headless --skip-modules
    EOS
  end

  test do
    assert_match "OPL", shell_output("#{bin}/opl --help")
  end
end
`;
}

export function writeFormulaAtomically(formulaPath, content) {
  fs.mkdirSync(path.dirname(formulaPath), { recursive: true });
  const temporaryPath = `${formulaPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, formulaPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = options.manifestFile
    ? JSON.parse(fs.readFileSync(options.manifestFile, 'utf8'))
    : await readManifestFromGhcr(options.manifestImage);
  const metadata = formulaMetadataFromManifest(manifest);
  metadata.transportSha256 = await sha256OfUrl(metadata.archiveUrl);
  const content = renderFormula(metadata);
  writeFormulaAtomically(options.formulaPath, content);
  console.log(JSON.stringify({
    formula: options.formulaPath,
    version: metadata.version,
    framework_source_head: metadata.headSha,
    framework_package_archive_sha256: metadata.packageSha256,
    homebrew_transport_archive_sha256: metadata.transportSha256,
    manifest_source: options.manifestFile || options.manifestImage,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
