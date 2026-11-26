cask "opl-fleet-agent" do
  version "0.2.56"
  sha256 "37846999c9098585f65f409f47afc3d3e4d95a8426ef80415239261d4b56587b"

  url "https://github.com/gaofeng21cn/opl-fleet-agent/releases/download/v#{version}/OPL-Fleet-Agent.dmg"
  name "OPL Fleet Agent"
  desc "Local menu bar monitor for Codex token throughput"
  homepage "https://github.com/gaofeng21cn/opl-fleet-agent"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :ventura

  # release_truth_authority: opl-fleet-agent_release
  # downstream_mirror_only: true
  # retired_install_aliases_allowed: false

  app "OPL Fleet Agent.app"
end
