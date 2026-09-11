cask "opl-fleet-agent" do
  version "0.2.45"
  sha256 "dc69cf11228d6e4ab3e0601453dc616a4f29e3c81e091b81f4c5121b30ce8ddb"

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
