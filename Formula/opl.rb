class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "https://github.com/gaofeng21cn/one-person-lab/archive/7ccab8e0286fb19a95e370053da9feb147339071.tar.gz"
  version "0.3.28"
  sha256 "4b54126503bd7d3f817b69722b90f87813784048fd356638f069a4fd39a03ee8"
  license "Apache-2.0"

  depends_on "node@24"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # framework_source_head: 7ccab8e0286fb19a95e370053da9feb147339071
  # framework_artifact_ref: ghcr.io/gaofeng21cn/one-person-lab-framework:0.3.28
  # framework_artifact_digest: sha256:ad2dc10acc3d3c11befddae9fa793ff4f56113092fee7dd5ac344634c18cce65
  # framework_package_archive_sha256: 89f11d5c6420d264b65e6c6fc30edaead08f293cfa7009b71b3e6eb7d8a0d6be
  # homebrew_transport_archive_sha256: 4b54126503bd7d3f817b69722b90f87813784048fd356638f069a4fd39a03ee8
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
    if (buildpath/"packages/daemon/dist/cli/bin-opl.js").exist?
      system npm, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    else
      system npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"
      system npm, "run", "build"
      system npm, "prune", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    end
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
