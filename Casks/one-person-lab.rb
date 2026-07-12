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
  # downstream_mirror_only: true
  # release_truth_authority: app_release
  # failure_feedback_owner: app_release_operator
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # standard_updater_visible: true
  # bundled_full_runtime_payload_allowed: false
  # homebrew_allowed_software_objects: opl_base,opl_app
  # opl_packages_lifecycle_owned_by_homebrew: false
  # opl_packages_lifecycle_owner: opl_cli
  # opl_packages_lifecycle_command: opl packages
  # package_specific_formula_allowed: false
  # package_specific_cask_allowed: false
  # forbidden_package_formulae: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow
  # forbidden_package_casks: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow
  # must_not_define_release_currentness: true
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
