# One Person Lab Homebrew Tap

本仓是 OPL Base Formula 与 OPL App Casks 的下游分发索引，不拥有 Framework、App 或 Package release truth。

- 只允许 `Formula/opl.rb` 和 `Casks/one-person-lab*.rb`；不得新增 MAS、MAG、RCA、OMA、BookForge、ScholarSkills 或 Flow 的独立 Formula/Cask。
- Stable Formula/Cask 只由受保护的正式 workflow 从 owner-approved release inputs 生成；不要手工改写版本、URL、checksum 或发布 receipt。
- Nightly 同步只写 Nightly；Stable/Full 诊断不得变成旁路发布。
- 默认验证运行 `node test/downstream-boundary.test.mjs`、相关 distribution tests 和 `git diff --check`；正式发布还须通过 workflow 中的 `brew style/audit` 与远端 tag/main readback。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
