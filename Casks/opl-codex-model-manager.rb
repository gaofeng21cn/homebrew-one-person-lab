cask "opl-codex-model-manager" do
  version "0.2.0"
  sha256 "9f0949228f4c9710bc9aab6e21f74deb6de9eea42f7f83238863e04f520c3926"

  url "https://github.com/gaofeng21cn/opl-codex-model-manager/releases/download/v#{version}/Codex-Model-Manager.dmg"
  name "Codex Model Manager"
  desc "Manage Codex official and custom model catalogs"
  homepage "https://github.com/gaofeng21cn/opl-codex-model-manager"

  depends_on macos: :sonoma

  # release_truth_authority: opl-codex-model-manager_release
  # downstream_mirror_only: true
  # user_model_data_preserved_on_uninstall: true

  app "CodexModelManager.app"

  uninstall launchctl: "com.onepersonlab.codex-model-manager.sync",
            delete:    "~/Library/LaunchAgents/com.onepersonlab.codex-model-manager.sync.plist"
end
