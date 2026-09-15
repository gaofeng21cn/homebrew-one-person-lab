#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frameworkRepo = 'https://github.com/gaofeng21cn/one-person-lab.git';
const formulaName = 'opl';
const internalNpmPackageName = 'opl-framework';
const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const shaPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function parseGhcrImage(image) {
  const match = image.match(
    /^ghcr\.io\/(?<repository>[a-z0-9._/-]+?)(?::(?<tag>[^/:@]+)|@(?<digest>sha256:[a-f0-9]{64}))$/,
  );
  if (!match?.groups) throw new Error(`Unsupported Framework artifact image: ${image}`);
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


export function formulaMetadataFromArtifact(manifest, artifactRef, artifactDigest) {
  const ref = parseGhcrImage(artifactRef);
  if (ref.repository !== 'gaofeng21cn/one-person-lab-framework'
    || ref.referenceKind !== 'digest' || ref.reference !== artifactDigest) throw new Error('Formula requires the canonical immutable Framework artifact.');
  const version = manifest.annotations?.['org.opencontainers.image.version'];
  const headSha = manifest.annotations?.['org.opencontainers.image.revision'];
  const source = manifest.annotations?.['org.opencontainers.image.source'];
  const layers = manifest.layers?.filter(x => x.mediaType === 'application/vnd.onepersonlab.framework.source.v1+gzip') ?? [];
  if (manifest.artifactType !== 'application/vnd.onepersonlab.framework.v1'
    || source !== frameworkRepo.replace(/\.git$/, '') || !semverPattern.test(version ?? '')
    || !shaPattern.test(headSha ?? '') || layers.length !== 1 || !digestPattern.test(layers[0].digest ?? '')) {
    throw new Error('Invalid Framework artifact identity or source archive.');
  }
  return { formulaName, packageName: formulaName, version, headSha, packageSha256: layers[0].digest.slice(7),
    artifactRef, artifactDigest, archiveUrl: `https://github.com/gaofeng21cn/one-person-lab/archive/${headSha}.tar.gz` };
}

export async function readFrameworkArtifact(artifactRef) {
  const ref = parseGhcrImage(artifactRef);
  if (ref.repository !== 'gaofeng21cn/one-person-lab-framework' || ref.referenceKind !== 'digest') {
    throw new Error('Formula requires the canonical immutable Framework artifact.');
  }
  const auth = await registryAuthorization(ref.repository);
  const result = await readOciManifest(ref.repository, ref.reference, auth);
  if (result.digest !== ref.reference) throw new Error('Framework artifact digest mismatch.');
  return formulaMetadataFromArtifact(result.payload, artifactRef, result.digest);
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
    # Homebrew 5.1.3 does not expose formula_opt_bin to Formula instances.
    node_bin = HOMEBREW_PREFIX/"opt/node@22/bin"
    npm = node_bin/"npm"
    ENV["npm_config_cache"] = buildpath/".npm-cache"
    ENV["npm_config_update_notifier"] = "false"
    system npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"
    system npm, "run", "build"
    system npm, "prune", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    libexec.install Dir["*"]
    (bin/"opl").write_env_script libexec/"bin/opl", PATH: "#{node_bin}:$PATH"
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
    ENV["PATH"] = "/usr/bin:/bin"
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
  const options = { formulaPath: 'Formula/opl.rb', artifactRef: '' };
  const keys = { '--artifact-ref': 'artifactRef', '--formula-path': 'formulaPath' };
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = keys[process.argv[i]];
    if (!key || !process.argv[i+1]) throw new Error(`Invalid option: ${process.argv[i]}`);
    options[key] = process.argv[i+1];
  }
  if (path.basename(options.formulaPath) !== 'opl.rb') throw new Error('The only allowed Formula output is opl.rb.');
  const metadata = await readFrameworkArtifact(options.artifactRef);
  metadata.transportSha256 = await sha256OfUrl(metadata.archiveUrl);
  writeFormulaAtomically(options.formulaPath, renderFormula(metadata));
  console.log(JSON.stringify(metadata));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
