cask "opl-codex-model-manager" do
  version "0.3.0"
  sha256 "c09f88b813566a285e9f1ec77a0d1928e1894b27f5fb7fd250d887c381402bb0"

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
