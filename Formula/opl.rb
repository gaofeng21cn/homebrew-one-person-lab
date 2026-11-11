class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "https://github.com/gaofeng21cn/one-person-lab/archive/5dbc68e3558eb72186a9741cf0004c4909348739.tar.gz"
  version "0.3.14"
  sha256 "2c80543c7d869d1c455a2d5b910d50b58a5c14a42eeea645efb532e2bf26e3da"
  license "Apache-2.0"

  depends_on "node@22"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # framework_source_head: 5dbc68e3558eb72186a9741cf0004c4909348739
  # framework_artifact_ref: ghcr.io/gaofeng21cn/one-person-lab-framework:0.3.14
  # framework_artifact_digest: sha256:ded136e1159965cd9c60bd29c030eb2f1bfc8b6412b4a122fd899827da70dc94
  # framework_package_archive_sha256: 7b692bb4e536a18f3d5a9ffedd33a1a773e415eeb055018d6d943a8fe6fb25d8
  # homebrew_transport_archive_sha256: 2c80543c7d869d1c455a2d5b910d50b58a5c14a42eeea645efb532e2bf26e3da
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
    # Homebrew 5.1.3 does not expose formula_opt_bin to Formula instances.
    node_bin = HOMEBREW_PREFIX/"opt/node@22/bin"
    npm = node_bin/"npm"
    ENV["npm_config_cache"] = buildpath/".npm-cache"
    ENV["npm_config_update_notifier"] = "false"
    system npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"
    system npm, "run", "build"
    system npm, "prune", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
    libexec.install Dir["*"]
    (bin/"opl").write_env_script libexec/"bin/opl", PATH: "#{node_bin}:$PATH"
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
    ENV["PATH"] = "/usr/bin:/bin"
    assert_match "OPL", shell_output("#{bin}/opl --help")
  end
end
