cask "opl-codex-model-manager" do
  version "0.4.0"
  sha256 "c46dc1f52161300a9fff0a15508c679bd5ca8a9eaa68d2b8f9a973d8d6582f7f"

  url "https://github.com/gaofeng21cn/opl-codex-model-manager/releases/download/v#{version}/Codex-Model-Manager.dmg"
  name "Codex Models"
  desc "Manage Codex official and custom model catalogs"
  homepage "https://github.com/gaofeng21cn/opl-codex-model-manager"

  depends_on macos: :sonoma

  # release_truth_authority: opl-codex-model-manager_release
  # downstream_mirror_only: true
  # user_model_data_preserved_on_uninstall: true

  app "CodexModelManager.app"

  uninstall launchctl: "com.onepersonlab.codex-model-manager.sync"
end
