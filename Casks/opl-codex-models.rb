cask "opl-codex-models" do
  version "0.4.8"
  sha256 "a1275c8d372b9983d075093be1afb95703c846097a88853ca41653dc42bff4e3"

  url "https://github.com/gaofeng21cn/opl-codex-models/releases/download/v#{version}/Codex-Models.dmg"
  name "Codex Models"
  desc "Manage Codex official and custom model catalogs"
  homepage "https://github.com/gaofeng21cn/opl-codex-models"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :sonoma

  # release_truth_authority: opl-codex-models_release
  # downstream_mirror_only: true
  # user_model_data_preserved_on_uninstall: true

  app "CodexModelManager.app"

  uninstall launchctl: "com.onepersonlab.codex-model-manager.sync"
end
