const gitShaPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const buildManifestSchema = 'opl_app_build_artifact_cohort.v2';
const scopeProofSchemas = new Set([
  'opl_app_qualification_harness_scope.v1',
  'opl_app_qualification_harness_scope.v2',
]);
const sameCohortScope = 'same_as_artifact_cohort';
const changedHarnessScope = 'smoke_or_validator_only';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly ${expected.join(', ')}.`);
  }
}

function assertGitSha(value, label) {
  if (!gitShaPattern.test(value ?? '')) {
    throw new Error(`${label} must be a 40-character lowercase Git SHA.`);
  }
}

function assertSha256(value, label) {
  if (!sha256Pattern.test(value ?? '')) {
    throw new Error(`${label} must be a 64-character lowercase SHA-256 digest.`);
  }
}

function validateChangedPaths(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} changed_paths must be an array.`);
  for (const entry of value) {
    const segments = typeof entry === 'string' ? entry.split('/') : [];
    if (typeof entry !== 'string'
      || !entry
      || entry !== entry.trim()
      || entry.startsWith('/')
      || entry.includes('\\')
      || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error(`${label} changed_paths must contain canonical repository-relative paths.`);
    }
  }
  const canonical = [...new Set(value)].sort();
  if (canonical.length !== value.length || canonical.some((entry, index) => entry !== value[index])) {
    throw new Error(`${label} changed_paths must be sorted and unique.`);
  }
  return value;
}

function validateScopeEntry(value, expected, label) {
  const entry = assertRecord(value, `${label} scope proof`);
  assertExactKeys(entry, ['repo', 'base_sha', 'head_sha', 'changed_paths'], `${label} scope proof`);
  if (entry.repo !== expected.repo) {
    throw new Error(`${label} scope proof repo must be ${expected.repo}.`);
  }
  assertGitSha(entry.base_sha, `${label} scope proof base_sha`);
  assertGitSha(entry.head_sha, `${label} scope proof head_sha`);
  if (entry.base_sha !== expected.baseSha || entry.head_sha !== expected.headSha) {
    throw new Error(`${label} scope proof does not bind the artifact and verification SHAs.`);
  }
  const changedPaths = validateChangedPaths(entry.changed_paths, label);
  if ((entry.base_sha === entry.head_sha) !== (changedPaths.length === 0)) {
    throw new Error(`${label} scope proof SHA equality is inconsistent with changed_paths.`);
  }
}

function validateScopeProofV2(proof, receipt) {
  assertExactKeys(
    proof,
    ['schema', 'profile', 'classification', 'expectations', 'reuse_authorization', 'app', 'shell'],
    'Qualification harness scope_proof',
  );
  if (!['standard', 'full'].includes(proof.profile)) {
    throw new Error('Qualification harness scope_proof profile must be standard or full.');
  }
  if (['standard', 'full'].includes(receipt.package_profile) && proof.profile !== receipt.package_profile) {
    throw new Error('Qualification harness scope_proof profile is inconsistent with the receipt.');
  }

  const expectations = assertRecord(proof.expectations, 'Qualification harness scope_proof expectations');
  assertExactKeys(expectations, [
    'artifact_semantic_digest',
    'verification_semantic_digest',
    'semantic_equal',
    'artifact_probe_digest',
    'verification_probe_digest',
    'probe_equal',
  ], 'Qualification harness scope_proof expectations');
  for (const field of [
    'artifact_semantic_digest',
    'verification_semantic_digest',
    'artifact_probe_digest',
    'verification_probe_digest',
  ]) assertSha256(expectations[field], `Qualification harness scope_proof expectations ${field}`);
  if (expectations.semantic_equal !== (
    expectations.artifact_semantic_digest === expectations.verification_semantic_digest
  )) throw new Error('Qualification harness scope_proof semantic_equal is inconsistent.');
  if (expectations.probe_equal !== (
    expectations.artifact_probe_digest === expectations.verification_probe_digest
  )) throw new Error('Qualification harness scope_proof probe_equal is inconsistent.');

  const authorization = assertRecord(
    proof.reuse_authorization,
    'Qualification harness scope_proof reuse_authorization',
  );
  assertExactKeys(
    authorization,
    ['allowed', 'reason', 'forbidden_paths'],
    'Qualification harness scope_proof reuse_authorization',
  );
  if (typeof authorization.allowed !== 'boolean' || typeof authorization.reason !== 'string' || !authorization.reason) {
    throw new Error('Qualification harness scope_proof reuse_authorization is malformed.');
  }
  const forbidden = assertRecord(
    authorization.forbidden_paths,
    'Qualification harness scope_proof forbidden_paths',
  );
  assertExactKeys(forbidden, ['app', 'shell'], 'Qualification harness scope_proof forbidden_paths');
  const forbiddenApp = validateChangedPaths(forbidden.app, 'Forbidden App');
  const forbiddenShell = validateChangedPaths(forbidden.shell, 'Forbidden Shell');
  if (authorization.allowed !== (
    expectations.semantic_equal
    && expectations.probe_equal
    && forbiddenApp.length === 0
    && forbiddenShell.length === 0
  )) throw new Error('Qualification harness scope_proof reuse_authorization allowed is inconsistent.');
  if (!authorization.allowed) {
    throw new Error(`Qualification harness scope_proof does not authorize reuse: ${authorization.reason}.`);
  }
}

export function validateAppQualificationHarness(receipt) {
  const cohort = assertRecord(receipt?.cohort, 'Qualification receipt cohort');
  assertGitSha(cohort.app_sha, 'Qualification receipt cohort app_sha');
  assertGitSha(cohort.shell_sha, 'Qualification receipt cohort shell_sha');

  const buildManifest = assertRecord(receipt?.build_manifest, 'Qualification receipt build_manifest');
  if (buildManifest.schema !== buildManifestSchema) {
    throw new Error(`Qualification receipt build_manifest schema must be ${buildManifestSchema}.`);
  }
  assertSha256(buildManifest.sha256, 'Qualification receipt build_manifest sha256');
  assertSha256(
    buildManifest.smoke_harness_sha256,
    'Qualification receipt build_manifest smoke_harness_sha256',
  );

  const harness = assertRecord(receipt?.verification_harness, 'Qualification receipt verification_harness');
  assertGitSha(harness.app_sha, 'Qualification receipt verification harness app_sha');
  assertGitSha(harness.shell_sha, 'Qualification receipt verification harness shell_sha');
  assertSha256(
    harness.smoke_harness_sha256,
    'Qualification receipt verification harness smoke_harness_sha256',
  );

  const differsFromArtifactCohort = harness.app_sha !== cohort.app_sha
    || harness.shell_sha !== cohort.shell_sha
    || harness.smoke_harness_sha256 !== buildManifest.smoke_harness_sha256;
  if (typeof harness.differs_from_artifact_cohort !== 'boolean'
    || harness.differs_from_artifact_cohort !== differsFromArtifactCohort) {
    throw new Error('Qualification receipt verification harness differs_from_artifact_cohort is inconsistent.');
  }
  const expectedScope = differsFromArtifactCohort ? changedHarnessScope : sameCohortScope;
  if (harness.change_scope !== expectedScope) {
    throw new Error(`Qualification receipt verification harness change_scope must be ${expectedScope}.`);
  }

  const proof = assertRecord(harness.scope_proof, 'Qualification receipt verification harness scope_proof');
  if (!scopeProofSchemas.has(proof.schema)) {
    throw new Error(`Qualification harness scope_proof schema must be one of ${[...scopeProofSchemas].join(', ')}.`);
  }
  if (proof.schema === 'opl_app_qualification_harness_scope.v1') {
    assertExactKeys(proof, ['schema', 'classification', 'app', 'shell'], 'Qualification harness scope_proof');
  } else {
    validateScopeProofV2(proof, receipt);
  }
  if (proof.classification !== expectedScope || proof.classification !== harness.change_scope) {
    throw new Error('Qualification harness scope_proof classification is inconsistent.');
  }
  validateScopeEntry(proof.app, {
    repo: 'gaofeng21cn/one-person-lab-app',
    baseSha: cohort.app_sha,
    headSha: harness.app_sha,
  }, 'App');
  validateScopeEntry(proof.shell, {
    repo: 'gaofeng21cn/opl-aion-shell',
    baseSha: cohort.shell_sha,
    headSha: harness.shell_sha,
  }, 'Shell');

  return {
    differsFromArtifactCohort,
    expectedScope,
    buildSmokeHarnessSha256: buildManifest.smoke_harness_sha256,
    verificationSmokeHarnessSha256: harness.smoke_harness_sha256,
  };
}
