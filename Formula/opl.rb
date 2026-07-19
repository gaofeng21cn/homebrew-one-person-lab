class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "https://github.com/gaofeng21cn/one-person-lab/archive/0d1f90b8646cbc66953fada15cead239372ac476.tar.gz"
  version "0.3.3"
  sha256 "7e2fd87c8d88548b8c7a8503d6d20c11bf56f344a54a00026f50bb9ae527863b"
  license "Apache-2.0"

  depends_on "node@22"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # release_set_generation: 26.7.18-r1
  # release_set_bom_digest: sha256:b73394dd4f1c3d92b9d3cd56fb8cc7000782d3f28d97e091ed90168b1feee146
  # framework_source_head: 0d1f90b8646cbc66953fada15cead239372ac476
  # framework_artifact_ref: ghcr.io/gaofeng21cn/one-person-lab-framework:0.3.3
  # framework_artifact_digest: sha256:3517307677df500b85f97ef330f86e76465b2d9615e3758a851ad21a763cc6bc
  # framework_package_archive_sha256: 75fdec03c75c5d71d83c3eb0eb8392b7f62c06d929dc0e50770ebf07ec5e3038
  # homebrew_transport_archive_sha256: 7e2fd87c8d88548b8c7a8503d6d20c11bf56f344a54a00026f50bb9ae527863b
  # formula_identity: opl
  # internal_npm_package: opl-framework
  # internal_installation_implementation_only: true
  # carrier_scope: framework_cli_runtime_and_production_dependencies
  # temporal_dependency_scope: framework_production_dependency
  # app_payload_installed: false
  # opl_packages_payload_installed: false
  # package_specific_formula_allowed: false
  # package_specific_cask_allowed: false
  # opl_packages_lifecycle_owner: opl_cli
  # opl_packages_lifecycle_command: opl packages
  # user_state_initialized_during_brew_install: false
  # first_user_state_reconcile: opl install --headless --skip-packages
  # OPL_HOMEBREW_FORMULA_BOUNDARY_END

  def install
    npm = formula_opt_bin("node@22")/"npm"
    ENV["npm_config_cache"] = buildpath/".npm-cache"
    ENV["npm_config_update_notifier"] = "false"
    system npm, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/opl"
  end

  def caveats
    <<~EOS
      This Formula installs only the OPL Framework, CLI, runtime, and their
      production dependencies. It does not install the OPL App or OPL Packages.

      Initialize or reconcile user state explicitly after installation:
        opl install --headless --skip-packages
    EOS
  end

  test do
    assert_match "OPL", shell_output("#{bin}/opl --help")
  end
end
