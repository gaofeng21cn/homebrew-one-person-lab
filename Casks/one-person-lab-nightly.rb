cask "one-person-lab-nightly" do
  version "26.11.2791-nightly.1,26.11.27-nightly"
  sha256 "f937a5a12c229b839aef0367d7e6fbd4074dd227967001037b28075b609f65a1"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version.csv.second}/One-Person-Lab-#{version.csv.second}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Nightly casks track prerelease cohorts through App release automation"
  end

  auto_updates true
  conflicts_with cask: ["one-person-lab", "one-person-lab-full"]
  depends_on arch: :arm64
  depends_on formula: "opl"
  depends_on macos: :ventura

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: nightly
  # package_kind: app_standard
  # version: 26.11.27-nightly
  # display_version: 26.11.27-nightly
  # updater_version: 26.11.2791-nightly.1
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.11.27-nightly/latest-mac.yml
  # checksum: sha256:f937a5a12c229b839aef0367d7e6fbd4074dd227967001037b28075b609f65a1
  # downstream_mirror_only: true
  # release_truth_authority: app_release
  # failure_feedback_owner: app_release_operator
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
  # opl_packages_lifecycle_command: opl pack
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
