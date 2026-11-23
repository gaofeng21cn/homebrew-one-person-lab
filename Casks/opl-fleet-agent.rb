cask "opl-fleet-agent" do
  version "0.2.51"
  sha256 "9d28b8991739636e53303f44e805551ea593292d8fd0a789361e3613ecea0d6a"

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
