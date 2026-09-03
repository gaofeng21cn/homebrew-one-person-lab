cask "one-person-lab-nightly" do
  version "26.9.491-nightly.1,26.9.4-nightly"
  sha256 "dd14c6ae61d80028da7623348d7645cc8ae86097d3ef12af5e475633946b99bd"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version.csv.second}/One-Person-Lab-#{version.csv.second}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Nightly casks track prerelease cohorts through App release automation"
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-full"]
  depends_on formula: "opl"
  depends_on macos: :monterey
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: nightly
  # package_kind: app_standard
  # version: 26.9.4-nightly
  # display_version: 26.9.4-nightly
  # updater_version: 26.9.491-nightly.1
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.9.4-nightly/latest-mac.yml
  # checksum: sha256:dd14c6ae61d80028da7623348d7645cc8ae86097d3ef12af5e475633946b99bd
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
