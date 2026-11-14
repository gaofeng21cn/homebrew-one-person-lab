cask "opl-codex-models" do
  version "0.4.4"
  sha256 "2a69d6d661fc1b3d613f024c521a3bbaa131590435e0e99fc6f4b3c0ac63d491"

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
