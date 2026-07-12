cask "one-person-lab" do
  version "26.7.12"
  sha256 "628c5eb3d439760f7dc0779920d0d8d062fa2e9f27d4c9046c99a846615f7c13"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-#{version}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"
    regex(%r{/releases/tag/v?(\d+(?:\.\d+)*)}i)
  end

  conflicts_with cask: ["one-person-lab-full", "one-person-lab-nightly"]
  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: stable
  # package_kind: app_standard
  # version: 26.7.12
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.12/latest-arm64-mac.yml
  # checksum: sha256:628c5eb3d439760f7dc0779920d0d8d062fa2e9f27d4c9046c99a846615f7c13
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # standard_updater_visible: true
  # opl_packages_payload_allowed: false
  # bundled_full_runtime_payload_allowed: false
  # opl_packages_homebrew_allowed: false
  # opl_packages_lifecycle_owner: one-person-lab
  # forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
