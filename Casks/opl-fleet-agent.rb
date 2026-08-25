cask "opl-fleet-agent" do
  version "0.2.41"
  sha256 "85cb09793ca743a10669b88f2980ce799e08c55039153452b8112207f32ef797"

  url "https://github.com/gaofeng21cn/opl-fleet-agent/releases/download/v#{version}/OPL-Fleet-Agent.dmg"
  name "OPL Fleet Agent"
  desc "Local menu bar monitor for Codex token throughput"
  homepage "https://github.com/gaofeng21cn/opl-fleet-agent"

  auto_updates true
  depends_on macos: :ventura

  # release_truth_authority: opl-fleet-agent_release
  # downstream_mirror_only: true
  # retired_install_aliases_allowed: false

  app "OPL Fleet Agent.app"
end
