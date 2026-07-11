# One Person Lab Homebrew Tap

Homebrew tap for the One Person Lab desktop App, with OPL Formula publication pending.

## Public Role Boundary

This repository is a downstream Homebrew distribution tap. The three casks
mirror App metadata and download targets derived from published
`gaofeng21cn/one-person-lab-app` releases. The tap contains Formula generation
and validation plumbing, but `opl` Formula publication is not yet public.

The tap does not own Framework or App release truth. Formula sync is fail-closed
until the Framework package authority publishes a matching
`framework_core.homebrew_formula` projection in
`ghcr.io/gaofeng21cn/one-person-lab-manifest:latest`. Once present, the sync
atomically generates the sole allowed `Formula/opl.rb` from the approved version,
source head, and immutable archive URL, computes the transport checksum from the
downloaded bytes, and adds the same-tap Formula dependency to all three casks.
Until then, no Formula or Cask Formula dependency is published.

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

The DMG-origin App may use an App-managed private Framework install for launch recovery, but
Casks do not define Framework version truth. Casks continue to sync from
published App GitHub Releases while Formula publication remains pending.

This tap is a downstream transport/index mirror only. Formula failures involving
the package version, source head, or package archive checksum route to the OPL
Framework package release authority. Cask failures involving a tag, DMG asset,
digest, promotion, or notarization route to the App release authority. Do not add
tap-local status, readiness, or release-currentness semantics here.

The casks download signed release assets from `gaofeng21cn/one-person-lab-app`.
After installation, open
`One Person Lab.app`; first launch prepares the workspace and continues
App-managed maintenance in the background.

If the App reports that setup or repair is needed, follow the in-app prompt.

The `one-person-lab-full` cask is an explicit stable first-install surface for
the larger Full DMG. It stays outside standard updater metadata. MAS/MAG/RCA/OMA
agent packs are prepared by App/CLI maintenance after the App is installed. This
tap intentionally does not publish `one-person-lab-modules` or agent-specific
formulae.
