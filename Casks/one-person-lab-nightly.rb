cask "one-person-lab-nightly" do
  version "26.6.12-nightly"
  sha256 "108baddd7d60032d5498106853c988fabc824dd78988bf6192c00812547d3054"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-#{version}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Nightly casks track prerelease cohorts through tap automation"
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-full"]
  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: nightly
  # package_kind: app_standard
  # version: 26.6.12-nightly
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.12-nightly/latest-arm64-mac.yml
  # checksum: sha256:108baddd7d60032d5498106853c988fabc824dd78988bf6192c00812547d3054
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # standard_updater_visible: true
  # modules_payload_allowed: false
  # bundled_full_runtime_payload_allowed: false
  # agent_pack_homebrew_allowed: false
  # agent_pack_activation_owner: app_cli_managed_background_maintenance
  # forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
