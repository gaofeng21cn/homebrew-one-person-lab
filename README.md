# One Person Lab Homebrew Tap

Homebrew tap for OPL Base and the One Person Lab App, with OPL Formula publication pending.

## Public Role Boundary

This repository is a downstream Homebrew distribution tap. The three casks
mirror App metadata and download targets derived from published
`gaofeng21cn/one-person-lab-app` releases. The tap contains Formula generation
and validation plumbing, but `opl` Formula publication is not yet public.

The tap does not own Framework or App release truth. Formula sync is fail-closed
until the Framework package authority publishes a matching
`framework_core.homebrew_formula` projection in
`ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable`. Once present, the sync
atomically generates the sole allowed `Formula/opl.rb` from the approved version,
source head, and immutable archive URL, computes the transport checksum from the
downloaded bytes, and adds the same-tap Formula dependency to all three casks.
Until then, no Formula or Cask Formula dependency is published.

## Aligned Installation Semantics

The future `opl` Formula is the headless base carrier. Its internal installation
implementation uses the `opl-framework` npm package to install the `opl`
CLI/runtime and all Framework production dependencies, including Temporal.
`opl-framework` is not a second public Formula or OPL Package identity. The
Formula does not install the desktop App or any OPL Package, does not create or
reconcile user workspace state, and does not run Package lifecycle operations.

After Formula publication, the three App casks depend on that same Formula.
Installing an App cask therefore installs two independently maintained products:
the OPL base carrier and the OPL App GUI. The first App launch invokes the
Framework reconcile contract; a Formula-only CLI installation performs the same
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

New stable releases use `YY.M.D`. New Nightly releases use the immutable
`YY.M.D-nightly.<run_id>.<attempt>` form. Previously mirrored releases are not
rewritten; the next successful sync advances the Cask to a matching published
App release with release-owned assets and digests.

Formal Stable distribution has one write owner: `.github/workflows/stable-distribution.yml`.
It requires the App promotion session, exact App/Shell/Framework cohort, source
release run, and passed Full clean-VM evidence. The workflow derives Standard
and Full from one public non-latest App release, validates both casks, commits
them together, and atomically pushes `main` with the immutable annotated tag
`stable-distribution/v<version>`. That tag and the Actions artifact carry
`opl_stable_distribution_receipt.v1`. The scheduled sync workflow writes Nightly
only; its Stable/Full modes are read-only diagnostics and cannot publish casks.

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
from published App GitHub Releases while Formula publication remains pending.

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
the larger Full DMG. It stays outside standard updater metadata. Package
material carried inside that App-owned asset remains governed by OPL Package
lifecycle receipts after installation; Homebrew does not version or mutate it.
This tap permits only Formula `opl` plus the three App Casks. It never publishes
Package-specific Formulae or Casks for MAS, MAG, RCA, OMA, BookForge,
MAS ScholarSkills, or OPL Flow.
