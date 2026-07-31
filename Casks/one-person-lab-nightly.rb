cask "one-person-lab-nightly" do
  version "26.7.3190-nightly.0"
  sha256 "6bcfa3fecab16e750d4bb92d2c35541f55f6c2c3c225ec9f3d3a5ca56bf473d9"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.31-nightly/One-Person-Lab-26.7.31-nightly-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Nightly casks track prerelease cohorts through App release automation"
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-full"]
  depends_on formula: "opl"
  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: nightly
  # package_kind: app_standard
  # version: 26.7.31-nightly
  # display_version: 26.7.31-nightly
  # updater_version: 26.7.3190-nightly.0
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.31-nightly/latest-arm64-mac.yml
  # checksum: sha256:6bcfa3fecab16e750d4bb92d2c35541f55f6c2c3c225ec9f3d3a5ca56bf473d9
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # standard_updater_visible: true
  # bundled_full_runtime_payload_allowed: false
  # formula_dependency_required: true
  # framework_carrier: homebrew_formula_opl
  # active_framework_count_target: 1
  # homebrew_allowed_software_objects: opl_base,opl_app
  # opl_packages_lifecycle_owned_by_homebrew: false
  # opl_packages_lifecycle_owner: one-person-lab
  # opl_packages_lifecycle_command: opl packages
  # package_specific_formula_allowed: false
  # package_specific_cask_allowed: false
  # forbidden_package_formulae: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow
  # forbidden_package_casks: mas,mag,rca,oma,obf,mas-scholar-skills,opl-flow
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
