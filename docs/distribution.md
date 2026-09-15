# Distribution Architecture

This document owns the Tap's maintainer contract. User installation belongs to
[README](../README.md); upstream source, artifacts, releases, and runtime state
remain with their product owners.

## Product Boundaries

The only Formula is `Formula/opl.rb`. It uses the `opl-framework` npm package
to install the `opl` CLI/runtime and all production dependencies, including
Temporal. The npm package is an implementation detail, not another Formula or
OPL Package identity. Formula installation does not initialize a workspace or
run Package lifecycle operations.

Standard and eligible Nightly App casks depend on that same Base Formula. Full
consumes the App-owned embedded Base and must not install another Formula.
App first launch performs Framework reconciliation. Direct DMG installation
may use an App-managed Framework root when no system Formula exists, but only
one compatible carrier may be active. Homebrew does not version or mutate
Package payloads carried inside Full; installed Package lifecycle remains
Framework-owned.

Fleet Agent and Codex Models are independent casks. Each owner publishes
its signed, notarized DMG, checksum, version, and metadata; the Tap verifies
those exact bytes. Codex Models's release DMG is universal. Neither cask
depends on Formula `opl`.

The Tap does not publish Package-specific Formulae or Casks. Allowed product
identities and dependencies are enforced by the actual distribution scripts,
casks, workflows, and boundary tests.

## Writer Ownership

| Surface | Writer | Inputs |
| --- | --- | --- |
| Framework Formula | `sync-framework-artifact.yml` | Immutable Framework OCI artifact digest |
| Standard cask | App protected Homebrew follower | Published Standard App artifact and exact Cask CAS |
| Full cask | App protected `append_full` publisher | Qualified Full DMG and embedded Base bytes |
| Nightly cask | `sync-from-app-releases.yml` | Eligible immutable App Nightly prerelease |
| Fleet Agent cask | `sync-fleet-agent-release.yml` | Exact Fleet Agent release |
| Codex Models cask | `sync-codex-models-release.yml` | Exact model-manager release |

Tap workflows serialize writes with `opl-homebrew-tap-write`. Framework Formula
and App Casks advance independently; neither requires the other to advance. Full is an
App-owned additive publication; this repository validates and indexes it,
without another Full publisher. Scheduled synchronization writes Nightly only.
Its Stable/Full modes use temporary diagnostics and cannot publish.

With no eligible Nightly, the scheduled route returns `no_op` without modifying
the index. It does not automatically remove an existing Nightly cask. Withdrawal
of a previously published token therefore needs an explicit owner cleanup;
the no-release result alone does not prove that the token is absent.

## Immutable Evidence

Formula generation reads the independent Framework OCI artifact by digest. Its
version, source commit and source layer identify Framework alone. The generator
hashes the pinned GitHub source archive used by Homebrew and builds the CLI from
that source. App and Package versions are not inputs. App Casks use the App
owner's publication follower independently.

Casks mirror exact owner-published asset names, URLs, and digests. Product
versioning belongs to those releases; the Tap does not rewrite versions or
manufacture assets to match a local naming convention. App release numbers use
`YY.M.D`; Nightly uses `YY.M.D-nightly` with same-day `.r1` through `.r9`
rebuilds. CI run identity belongs to release evidence.

## Validation And Failure Routing

Run the source boundary and affected distribution tests before committing:

```bash
node test/downstream-boundary.test.mjs
node test/stable-distribution.test.mjs
node test/fleet-agent-cask.test.mjs
node test/codex-models-cask.test.mjs
git diff --check
```

Formal publication additionally runs the workflow's Homebrew style/audit and
remote commit/tag readback. Local tests alone do not prove an upstream release,
installed App, successful publication, or current remote cask.

Formula version, source head, or archive checksum failures route to Framework.
App tag, asset, digest, promotion, and notarization failures route to App.
Fleet Agent and Codex Models failures route to their respective release
owners. Preserve that ownership when diagnosing transport failures; do not add
Tap-local readiness or release-currentness state.

## Document Lifecycle

Maintain this contract in place alongside the affected workflow or generator.
Keep user commands in the README and implementation details here. Transfer
unique active constraints before removing a superseded section; Git history
retains completed migrations. Validate mechanics and actual implementation,
not prescribed prose, headings, or Markdown snapshots.
