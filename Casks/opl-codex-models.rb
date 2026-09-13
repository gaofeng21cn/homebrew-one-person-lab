cask "opl-codex-models" do
  version "0.4.1"
  sha256 "9e26b443a6b39db6ff1a021c204aab5059ed17027bc33081851d9cec30f47483"

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
