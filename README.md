# One Person Lab Homebrew Tap

Homebrew tap for the One Person Lab desktop App.

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

The tap syncs casks from published `gaofeng21cn/one-person-lab-app` GitHub
Releases through the `Sync From App Releases` workflow. The scheduled run tracks
the latest published nightly prerelease; manual runs can sync stable, nightly,
Full, or all casks.

This tap is a downstream transport/index mirror only. Release truth, latest /
currentness decisions, asset fixes, promotion, and republishing stay with the
`gaofeng21cn/one-person-lab-app` GitHub Releases operator/authority. If tap sync
or audit fails, route the failing tag, asset, digest, or audit output back to
that App release authority and rerun the tap sync after the App release is fixed;
do not add tap-local status, readiness, or release-currentness semantics here.

The casks download signed release assets from `gaofeng21cn/one-person-lab-app`.
After installation, open
`One Person Lab.app`; first launch prepares the workspace and continues
App-managed maintenance in the background.

If the App reports that setup or repair is needed, follow the in-app prompt.
Terminal diagnostics remain available when needed:

```bash
opl system initialize --json
```

The `one-person-lab-full` cask is an explicit stable first-install surface for
the larger Full DMG. It stays outside standard updater metadata. MAS/MAG/RCA/OMA
agent packs are prepared by App/CLI maintenance after the App is installed. This
tap intentionally does not publish `one-person-lab-modules` or agent-specific
formulae.
