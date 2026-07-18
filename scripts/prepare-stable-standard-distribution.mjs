#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formulaMetadataFromManifest } from './sync-formula-from-framework-manifest.mjs';
import { validateAppQualificationHarness } from './validate-app-qualification-harness.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tapRoot = path.resolve(process.env.OPL_HOMEBREW_TAP_ROOT || scriptRoot);
const appRepo = 'gaofeng21cn/one-person-lab-app';
const digestRef = /^sha256:[a-f0-9]{64}$/;
const digest = /^[a-f0-9]{64}$/;
const gitSha = /^[a-f0-9]{40}$/;
const runId = /^[1-9][0-9]*$/;
const stableTag = /^v(?<version>[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01]))$/;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith('--') || !value || value.startsWith('--')) throw new Error(`${token || '<argument>'} requires a value.`);
    options[token.slice(2).replaceAll('-', '_')] = value;
  }
  const required = [
    'release_tag', 'stable_session_id', 'release_cohort_ref', 'app_sha', 'shell_sha', 'framework_sha',
    'release_set_generation', 'release_set_manifest', 'release_set_manifest_digest', 'source_release_run_id',
    'standard_vm_run_id', 'standard_vm_evidence', 'standard_vm_evidence_ref', 'standard_vm_evidence_sha256',
    'standard_vm_result', 'output',
  ];
  for (const key of required) if (!options[key]) throw new Error(`Missing required Standard distribution input: ${key}.`);
  return options;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function validateInputs(options) {
  if (!stableTag.test(options.release_tag)) throw new Error('Standard distribution release tag must use vYY.M.D.');
  for (const key of ['stable_session_id', 'release_cohort_ref', 'release_set_manifest_digest']) {
    if (!digestRef.test(options[key])) throw new Error(`${key} must be sha256:<64 lowercase hex>.`);
  }
  for (const key of ['app_sha', 'shell_sha', 'framework_sha']) {
    if (!gitSha.test(options[key])) throw new Error(`${key} must be a 40-character lowercase Git SHA.`);
  }
  for (const key of ['source_release_run_id', 'standard_vm_run_id']) {
    if (!runId.test(options[key])) throw new Error(`${key} must be a decimal Actions run id.`);
  }
  if (!/^[0-9]{2}\.[0-9]{1,2}\.[0-9]{1,2}(?:-r[1-9][0-9]*)?$/.test(options.release_set_generation)) {
    throw new Error('release_set_generation must use YY.M.D[-rN].');
  }
  if (!digest.test(options.standard_vm_evidence_sha256) || options.standard_vm_result !== 'passed') {
    throw new Error('Standard VM evidence must carry a lowercase SHA-256 and result=passed.');
  }
}

function releaseReadback(options) {
  const release = ghJson(['release', 'view', options.release_tag, '--repo', appRepo, '--json', 'tagName,isDraft,isPrerelease,publishedAt,assets']);
  const listed = ghJson(['release', 'list', '--repo', appRepo, '--limit', '50', '--json', 'tagName,isLatest'])
    .find((entry) => entry.tagName === options.release_tag);
  if (release.tagName !== options.release_tag || release.isDraft || release.isPrerelease || !release.publishedAt || listed?.isLatest !== false) {
    throw new Error('Standard distribution requires the exact public non-latest Stable release.');
  }
  return release;
}

function runReadback(id, expectedHead, label) {
  const run = ghJson(['run', 'view', id, '--repo', appRepo, '--json', 'databaseId,headSha,status,conclusion,url']);
  if (String(run.databaseId) !== id || run.headSha !== expectedHead || run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error(`${label} must be completed/success on ${expectedHead}.`);
  }
  return run;
}

function asset(release, name) {
  const match = release.assets?.filter((entry) => entry.name === name) ?? [];
  const hash = String(match[0]?.digest || '').match(/^sha256:(?<hash>[a-f0-9]{64})$/)?.groups?.hash;
  if (match.length !== 1 || !hash) throw new Error(`Release must expose exactly one digest-addressed asset ${name}.`);
  return { name, sha256: hash, url: `https://github.com/${appRepo}/releases/download/${release.tagName}/${name}` };
}

function validateStandardEvidence(options, release) {
  const evidencePath = path.resolve(options.standard_vm_evidence);
  if (!fs.existsSync(evidencePath) || sha256(evidencePath) !== options.standard_vm_evidence_sha256) {
    throw new Error('Standard VM qualification receipt digest mismatch.');
  }
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const version = stableTag.exec(options.release_tag).groups.version;
  const expected = {
    schema: 'opl_app_artifact_qualification_receipt.v1', status: 'passed', stable_session_id: options.stable_session_id,
    release_cohort_ref: options.release_cohort_ref, version, package_profile: 'standard',
  };
  for (const [key, value] of Object.entries(expected)) if (evidence[key] !== value) throw new Error(`Standard VM receipt ${key} mismatch.`);
  if (String(evidence.qualification?.run_id) !== options.standard_vm_run_id
    || String(evidence.qualification?.source_artifact_run_id) !== options.source_release_run_id
    || evidence.qualification?.source_artifact_name !== 'macos-build-arm64-dmg'
    || evidence.qualification?.evidence_ref !== options.standard_vm_evidence_ref
    || evidence.qualification?.result !== 'passed'
    || evidence.cohort?.app_sha !== options.app_sha
    || evidence.cohort?.shell_sha !== options.shell_sha
    || evidence.cohort?.framework_sha !== options.framework_sha) {
    throw new Error('Standard VM receipt does not bind the frozen cohort and source artifact.');
  }
  const dmg = asset(release, `One-Person-Lab-${version}-mac-arm64.dmg`);
  if (evidence.artifact?.name !== dmg.name || evidence.artifact?.sha256 !== dmg.sha256) {
    throw new Error('Standard VM receipt does not bind the published Standard DMG bytes.');
  }
  validateAppQualificationHarness(evidence);
  return evidence;
}

function formulaMetadata(manifest, options) {
  const metadata = formulaMetadataFromManifest(manifest);
  if (metadata.headSha !== options.framework_sha) throw new Error('Formula Framework source differs from the frozen cohort.');
  const filePath = path.join(tapRoot, 'Formula/opl.rb');
  const content = fs.readFileSync(filePath, 'utf8');
  const transport = content.match(/^\s*sha256\s+"(?<hash>[a-f0-9]{64})"$/m)?.groups?.hash;
  if (!transport) throw new Error('Formula transport SHA-256 is missing.');
  return { path: 'Formula/opl.rb', formula_name: metadata.formulaName, version: metadata.version,
    source_head: metadata.headSha, artifact_ref: metadata.artifactRef, artifact_digest: metadata.artifactDigest,
    transport_sha256: transport, sha256: sha256(filePath) };
}

function caskMetadata(relativePath, version) {
  const filePath = path.join(tapRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const url = content.match(/^\s*url\s+"(?<url>[^"]+)"/m)?.groups?.url;
  if (!content.includes(`version "${version}"`) || !url || !content.includes('depends_on formula: "opl"')) {
    throw new Error(`${relativePath} is not the ${version} Standard cask bound to the OPL Formula.`);
  }
  return { path: relativePath, version, sha256: sha256(filePath), url };
}

export function prepareStableStandardDistribution(options) {
  validateInputs(options);
  const release = releaseReadback(options);
  const version = stableTag.exec(options.release_tag).groups.version;
  const evidence = validateStandardEvidence(options, release);
  const sourceRun = runReadback(options.source_release_run_id, options.app_sha, 'Source release');
  const standardVmRun = runReadback(options.standard_vm_run_id, evidence.verification_harness.app_sha, 'Standard VM');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(options.release_set_manifest), 'utf8'));
  const releaseSet = manifest.release_set;
  const standardDmg = asset(release, `One-Person-Lab-${version}-mac-arm64.dmg`);
  if (manifest.release_set_generation !== options.release_set_generation || releaseSet?.generation !== options.release_set_generation
    || releaseSet?.bom_status !== 'complete' || releaseSet?.components?.app?.source_commit !== options.app_sha
    || releaseSet.components.app.artifact_digest !== `sha256:${standardDmg.sha256}`) {
    throw new Error('Release Set does not bind the frozen Standard App artifact.');
  }
  execFileSync(process.execPath, [path.join(scriptRoot, 'scripts/sync-cask-from-release.mjs'), '--channel', 'stable', '--release-tag', options.release_tag, '--with-opl-formula'], {
    cwd: tapRoot, env: { ...process.env, OPL_APP_RELEASE_VIEW_JSON: JSON.stringify(release) }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const formula = formulaMetadata(manifest, options);
  return {
    schema: 'opl_stable_standard_distribution_plan.v1', stable_session_id: options.stable_session_id,
    release_set: { generation: options.release_set_generation, manifest_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${options.release_set_generation}`,
      manifest_digest: options.release_set_manifest_digest, stable_channel_ref: 'ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable',
      stable_channel_digest: options.release_set_manifest_digest, base: releaseSet.components.base, app: releaseSet.components.app, formula },
    release: { repo: appRepo, tag: options.release_tag, version, public: true, latest: false,
      source_release_run_id: options.source_release_run_id, source_release_run: sourceRun,
      assets: [standardDmg, asset(release, 'latest-arm64-mac.yml'), asset(release, 'standard-local-authorization-policy.json')] },
    cohort: { release_cohort_ref: options.release_cohort_ref, app_sha: options.app_sha, shell_sha: options.shell_sha,
      framework_sha: options.framework_sha, release_set_generation: options.release_set_generation,
      release_set_manifest_digest: options.release_set_manifest_digest },
    standard_vm: { run_id: options.standard_vm_run_id, evidence_ref: options.standard_vm_evidence_ref,
      evidence_sha256: options.standard_vm_evidence_sha256, result: 'passed', run_readback: standardVmRun, evidence_receipt: evidence },
    tap: { repo: 'gaofeng21cn/homebrew-one-person-lab', formula, standard_cask: caskMetadata('Casks/one-person-lab.rb', version) },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = prepareStableStandardDistribution(options);
  fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(plan, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); }
}
