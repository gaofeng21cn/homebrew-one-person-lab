cask "one-person-lab-full" do
  version "26.8.3191,26.8.31"
  sha256 "d94814513899259a854e3e86191aaed26fe9b1e9a9ed538e2728234929b5154f"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version.csv.second}/One-Person-Lab-Full-#{version.csv.second}-mac-arm64.dmg"
  name "One Person Lab Full"
  desc "Complete first-install package for One Person Lab"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Stable casks pair display tags with monotonic updater versions"
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-nightly"]
  depends_on macos: :monterey
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: stable
  # package_kind: app_full_first_install
  # version: 26.8.31
  # display_version: 26.8.31
  # updater_version: 26.8.3191
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.8.31/opl-release-manifest.json
  # checksum: sha256:d94814513899259a854e3e86191aaed26fe9b1e9a9ed538e2728234929b5154f
  # full_first_install_allowed: true
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: full_first_install_homebrew_distribution
  # standard_updater_visible: false
  # bundled_full_runtime_payload_allowed: true
  # formula_dependency_required: false
  # framework_carrier: full_dmg_embedded_opl_base
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

  caveats <<~EOS
    This cask installs the complete first-install package. After launch,
    One Person Lab manages runtime, Packages, and Agent exposure through
    the App/CLI; Full assets stay outside standard updater metadata.
  EOS
end
