# One Person Lab Homebrew Tap

Homebrew tap for OPL Base and the One Person Lab App.

## Public Role Boundary

This repository is a downstream Homebrew distribution tap. The three casks
mirror App metadata and download targets derived from published
`gaofeng21cn/one-person-lab-app` releases. The sole Formula identity is `opl`;
it is materialized only by the formal Stable distribution workflow.

The tap does not own Framework or App release truth. Stable Formula sync is
fail-closed: it reads one immutable Release Set generation and verifies that
`ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable` has the same digest.
It then generates `Formula/opl.rb` only from the owner-approved
`framework_core.homebrew_formula` projection, computes the transport checksum
from downloaded bytes, and adds the same-tap Formula dependency to the Standard
cask in the same atomic distribution commit and receipt. Nightly also consumes
that Formula when present. Full consumes the App-owned embedded Base and must
not add a Formula dependency.

## Aligned Installation Semantics

The `opl` Formula is the headless base carrier. Its internal installation
implementation uses the `opl-framework` npm package to install the `opl`
CLI/runtime and all Framework production dependencies, including Temporal.
`opl-framework` is not a second public Formula or OPL Package identity. The
Formula does not install the desktop App or any OPL Package, does not create or
reconcile user workspace state, and does not run Package lifecycle operations.

The Standard and Nightly casks depend on that same Formula. Installing either
cask therefore installs two independently maintained products: the OPL base
carrier and the OPL App GUI. The Full cask instead installs the Full DMG, whose
embedded Base is the sole first-install carrier; Homebrew must not install a
second Formula carrier for Full. The first App launch invokes the Framework
reconcile contract; a Formula-only CLI installation performs the same
initialization explicitly with:

```bash
opl install --headless --skip-packages
```

OPL Packages are independently versioned external packages managed after base
initialization by `opl packages`. They are not Homebrew Formulae or Casks and
are not embedded into the Base Formula. The App is a GUI control surface over
the same Framework operations: it may coordinate Base and Package updates, but
a Homebrew-owned Base update stays on the Homebrew channel instead of creating
a second private Framework installation.

Direct DMG installation has the same product semantics. When no system Formula
is available, the App invokes the Framework installer into its managed root and
then runs the same reconcile contract. The root location is App-managed; the
Framework identity and behavior remain OPL-owned. Only one compatible Framework
carrier may be active at a time.

Install and open the App:

```bash
brew tap gaofeng21cn/one-person-lab
brew install --cask one-person-lab
open -a "One Person Lab"
```

Nightly builds are opt-in:

```bash
brew install --cask one-person-lab-nightly
```

New stable releases use `YY.M.D`. The first Nightly release for a UTC date uses
`YY.M.D-nightly`; a same-day rebuild uses `.r1` through `.r9`. GitHub Actions
run identity stays in release evidence rather than the user-visible version.
During the legacy-tag migration, a canonical Nightly release may retain its
original build-identity asset filename; the Cask keeps the exact published bytes
and digest while exposing the canonical release version.

Formal Standard tap mutation has one workflow owner serialized by the shared
`opl-homebrew-tap-write` concurrency group:

- `.github/workflows/stable-standard-distribution.yml` publishes Formula `opl`
  plus the Standard cask from an exact Release Set cohort and passed Standard VM
  evidence. It leaves Full and Nightly unchanged and publishes an immutable
  `stable-standard-distribution/v<version>` tag carrying
  `opl_stable_distribution_receipt.v3`.

The Standard route requires the App promotion session, exact
App/Shell/Framework cohort, exact Release Set generation and digest, and
owner-provided qualification evidence. Full is an App-owned additive release
operation: the protected App `append_full` publisher generates and writes the
Full Cask from the qualified Full DMG and embedded Base bytes. This tap does not
own a second Full publisher; it validates, indexes, and reads back that App-owned
projection.
The scheduled sync workflow writes Nightly only; when no eligible Nightly exists it completes as a no-op.
Its Stable/Full modes are read-only diagnostics and route
Standard operators to the formal Standard workflow and Full operators to the App
protected `append_full` publisher; they cannot publish casks or Formulae.

Complete first-install package:

```bash
brew install --cask one-person-lab-full
open -a "One Person Lab"
```

Update with the standard Homebrew flow:

```bash
brew update
brew upgrade --cask one-person-lab
```

The DMG-origin App may use an App-managed private Framework install for launch
recovery, but Casks do not define Framework version truth. Casks continue to sync
from published App GitHub Releases, while Formula truth remains the exact
Framework projection inside the promoted Release Set.

This tap is a downstream transport/index mirror only. Formula failures involving
the package version, source head, or package archive checksum route to the OPL
Framework package release authority. Cask failures involving a tag, DMG asset,
digest, promotion, or notarization route to the App release authority. Do not add
tap-local status, readiness, or release-currentness semantics here.

The casks download signed release assets from `gaofeng21cn/one-person-lab-app`.
After installation, open `One Person Lab.app`; first launch uses Framework
reconcile to prepare the workspace and exposes App-managed maintenance without
duplicating the active Framework carrier.

If the App reports that setup or repair is needed, follow the in-app prompt.

The `one-person-lab-full` cask is an explicit stable first-install surface for
the larger Full DMG and is written by the App protected release path. It stays
outside standard updater metadata and does not depend on Formula `opl`. Package
material carried inside that App-owned asset remains governed by OPL Package
lifecycle receipts after installation; Homebrew does not version or mutate it.
This tap permits only Formula `opl` plus the three App Casks. It never publishes
Package-specific Formulae or Casks for MAS, MAG, RCA, OMA, BookForge,
MAS ScholarSkills, or OPL Flow.
