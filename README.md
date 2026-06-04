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

Update with the standard Homebrew flow:

```bash
brew update
brew upgrade --cask one-person-lab
```

The tap syncs casks from published `gaofeng21cn/one-person-lab-app` GitHub
Releases through the `Sync From App Releases` workflow. The scheduled run tracks
the latest published nightly prerelease; manual runs can sync stable, nightly,
or both.

This tap is a transport/index only. The casks download signed release assets
from `gaofeng21cn/one-person-lab-app`. After installation, open
`One Person Lab.app`; first launch prepares the workspace and continues
App-managed maintenance in the background.

If the App reports that setup or repair is needed, follow the in-app prompt.
Terminal diagnostics remain available when needed:

```bash
opl system initialize --json
```

Full first-install packages are distributed from GitHub Releases, not Homebrew.
MAS/MAG/RCA/OMA agent packs are prepared by App/CLI maintenance after the App is
installed. This tap intentionally does not publish `one-person-lab-modules`,
agent-specific formulae, or Full first-install casks.
