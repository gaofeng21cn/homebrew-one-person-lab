# One Person Lab Homebrew Tap

Homebrew tap for the One Person Lab desktop App.

```bash
brew tap gaofeng21cn/one-person-lab
brew install --cask one-person-lab
```

Nightly builds are opt-in:

```bash
brew install --cask one-person-lab-nightly
```

This tap is a transport/index only. The casks download signed release assets
from `gaofeng21cn/one-person-lab-app`; One Person Lab activation and repair
remain owned by the OPL CLI:

```bash
opl system initialize --json
opl module reconcile
opl skill sync
```

Full first-install packages are distributed from GitHub Releases, not Homebrew.
CLI and module-bundle formula lanes are reserved until matching release-cohort
tarball assets exist.
