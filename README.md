# One Person Lab Homebrew Tap

Install OPL Base, One Person Lab App, OPL Fleet Agent, and Codex Model Manager
from their owner-published releases. This repository is a downstream index;
[distribution architecture](docs/distribution.md) owns the maintainer boundary.

## Install

```bash
brew tap gaofeng21cn/one-person-lab
brew install --cask one-person-lab
open -a "One Person Lab"
```

Choose one App variant:

| Cask | Installation |
| --- | --- |
| `one-person-lab` | Stable Standard App plus the `opl` Base Formula |
| `one-person-lab-full` | Explicit Stable first-install Full DMG with embedded Base; no second Formula |
| `one-person-lab-nightly` | Opt-in immutable Nightly prerelease when available, with the Base Formula |

For a headless Base installation:

```bash
brew install opl
opl install --headless --skip-packages
```

The Formula installs the Framework runtime and dependencies, not the desktop
App or OPL Packages. Initialize first, then manage Packages through
`opl packages`. App first launch uses the same Framework reconcile contract;
follow its setup or repair prompt when required.

Independent utilities do not depend on the `opl` Formula:

```bash
brew install --cask opl-fleet-agent
open -a "OPL Fleet Agent"
brew install --cask opl-codex-model-manager
open -a "Codex 模型管理器"
```

## Update

```bash
brew update
brew upgrade --cask one-person-lab
```

Use the installed cask token for another variant or utility. A Homebrew-owned
Base remains on the Homebrew update channel; the App must not create another
active Framework carrier.

## Maintain

[Distribution architecture](docs/distribution.md) explains release inputs,
writer ownership, validation, and failure routing. Update this README when
installation changes; update that document when distribution contracts change.
Keep retired procedures in Git history and repair links when retiring a page.
Neither document owns upstream release status or duplicates a version inventory.

## License

[Apache-2.0](LICENSE).
