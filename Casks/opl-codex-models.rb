cask "opl-codex-models" do
  version "0.4.5"
  sha256 "32e555139a7421ca03e73252bc3bf6d1a688851cc90ecf167d62754e059d8741"

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
