cask "one-person-lab" do
  version "26.8.2891,26.8.28"
  sha256 "03c7b8d625fb9ede0d4d3ea56726151ed3316a903fc13aa3188de94f7a4968e9"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version.csv.second}/One-Person-Lab-#{version.csv.second}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Stable casks pair display tags with monotonic updater versions"
  end

  conflicts_with cask: ["one-person-lab-full", "one-person-lab-nightly"]
  depends_on formula: "opl"
  depends_on macos: :monterey
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: stable
  # package_kind: app_standard
  # version: 26.8.28
  # display_version: 26.8.28
  # updater_version: 26.8.2891
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.8.28/opl-app-component-manifest.json
  # checksum: sha256:03c7b8d625fb9ede0d4d3ea56726151ed3316a903fc13aa3188de94f7a4968e9
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
