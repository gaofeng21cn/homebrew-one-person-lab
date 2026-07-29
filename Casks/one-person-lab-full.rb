cask "one-person-lab-full" do
  version "26.7.7"
  sha256 "4e0f403c48fb0397099758c30423a4ee5908851e0a9e885537cdbb71603f96ed"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.7/One-Person-Lab-Full-26.7.7-mac-arm64.dmg"
  name "One Person Lab Full"
  desc "Complete first-install package for One Person Lab"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "The immutable Release Bundle maps display tags to monotonic machine versions"
  end

  conflicts_with cask: ["one-person-lab", "one-person-lab-nightly"]
  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: stable
  # package_kind: app_full_first_install
  # version: 26.7.7
  # display_version: 26.7.7
  # updater_version: 26.7.7
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.7/opl-release-manifest.json
  # checksum: sha256:4e0f403c48fb0397099758c30423a4ee5908851e0a9e885537cdbb71603f96ed
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
  # opl_packages_lifecycle_owner: opl_cli
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
