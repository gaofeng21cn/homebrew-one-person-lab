class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "https://github.com/gaofeng21cn/one-person-lab/archive/3a31e933e21a3885e16f3ee21425c16fa89613fa.tar.gz"
  version "0.3.27"
  sha256 "97910d1037d21815798516e6b0b3a32d121126192d0bfa8d3ba8dd8aed72c70f"
  license "Apache-2.0"

  depends_on "node@24"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # framework_source_head: 3a31e933e21a3885e16f3ee21425c16fa89613fa
  # framework_artifact_ref: ghcr.io/gaofeng21cn/one-person-lab-framework:0.3.27
  # framework_artifact_digest: sha256:ea6575e3078608c7060ed018e341b8bb1bf0e529649188f91142a3990cfe1931
  # framework_package_archive_sha256: 73fdecdd186c677670bbd25689f02df5fb41741e1344d1354a773193e137fabc
  # homebrew_transport_archive_sha256: 97910d1037d21815798516e6b0b3a32d121126192d0bfa8d3ba8dd8aed72c70f
  # formula_identity: opl
  # internal_npm_package: opl-framework
  # internal_installation_implementation_only: true
  # carrier_scope: framework_cli_runtime_and_production_dependencies
  # app_payload_installed: false
  # opl_packages_payload_installed: false
  # package_specific_formula_allowed: false
  # package_specific_cask_allowed: false
  # opl_packages_lifecycle_owner: opl_cli
  # opl_packages_lifecycle_command: opl pack
  # user_state_initialized_during_brew_install: false
  # first_user_state_reconcile: opl doctor --json
  # OPL_HOMEBREW_FORMULA_BOUNDARY_END

  def install
    # Homebrew 5.1.3 does not expose formula_opt_bin to Formula instances.
    node_bin = HOMEBREW_PREFIX/"opt/node@24/bin"
    npm = node_bin/"npm"
    ENV["npm_config_cache"] = buildpath/".npm-cache"
    ENV["npm_config_update_notifier"] = "false"
    system npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"
    system npm, "run", "build"
    system npm, "prune", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    libexec.install Dir["*"]
    (bin/"opl").write_env_script libexec/"bin/opl", PATH: "#{node_bin}:$PATH"
    if (libexec/"packages/daemon/bin/opld").exist?
      (bin/"opld").write_env_script libexec/"packages/daemon/bin/opld", PATH: "#{node_bin}:$PATH"
    end
  end

  def caveats
    <<~EOS
      This Formula installs only the OPL Framework, CLI (opl), daemon (opld),
      and their production dependencies. It does not install the OPL App or OPL Packages.

      Verify environment readiness or manage packages via:
        opl doctor --json
        opl pack --help
    EOS
  end

  test do
    ENV["PATH"] = "/usr/bin:/bin"
    assert_match "OPL", shell_output("#{bin}/opl --help")
  end
end
