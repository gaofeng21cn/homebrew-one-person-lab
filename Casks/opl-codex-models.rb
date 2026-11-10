cask "opl-codex-models" do
  version "0.4.3"
  sha256 "b491b6687d7877352c6a77f07b78a011e9198579c9899863fe7cf2e6acfb31f9"

  url "https://github.com/gaofeng21cn/opl-codex-models/releases/download/v#{version}/Codex-Models.dmg"
  name "Codex Models"
  desc "Manage Codex official and custom model catalogs"
  homepage "https://github.com/gaofeng21cn/opl-codex-models"

  depends_on macos: :sonoma

  # release_truth_authority: opl-codex-models_release
  # downstream_mirror_only: true
  # user_model_data_preserved_on_uninstall: true

  app "CodexModelManager.app"

  uninstall launchctl: "com.onepersonlab.codex-model-manager.sync"
end
