cask "one-person-lab-full" do
  version "26.6.30"
  sha256 "a078c3110483464575366bd1ff1d844a25f159d707abecd3fac5c9e0a924a145"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-Full-#{version}-mac-arm64.dmg"
  name "One Person Lab Full"
  desc "Complete first-install package for One Person Lab"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"
    regex(%r{/releases/tag/v?(\d+(?:\.\d+)*)}i)
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-nightly"]
  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: full
  # package_kind: app_full_first_install
  # version: 26.6.30
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.30/full-package-manifest.json
  # checksum: sha256:a078c3110483464575366bd1ff1d844a25f159d707abecd3fac5c9e0a924a145
  # downstream_mirror_only: true
  # release_truth_authority: app_release
  # failure_feedback_owner: app_release_operator
  # full_first_install_allowed: true
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: full_first_install_homebrew_distribution
  # standard_updater_visible: false
  # modules_payload_allowed: false
  # bundled_full_runtime_payload_allowed: true
  # agent_pack_homebrew_allowed: false
  # agent_pack_activation_owner: app_cli_managed_background_maintenance
  # forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly
  # must_not_define_release_currentness: true
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"

  caveats <<~EOS
    This cask installs the complete first-install package. After launch,
    One Person Lab manages runtime, modules, and agent exposure through
    the App/CLI; Full assets stay outside standard updater metadata.
  EOS
end
