class Opl < Formula
  desc "Headless OPL Framework and CLI"
  homepage "https://github.com/gaofeng21cn/one-person-lab"
  url "https://github.com/gaofeng21cn/one-person-lab/archive/d25ae9b4c8f285310e3efddf1fffb3c4e5f36639.tar.gz"
  version "0.3.26"
  sha256 "33c5e81808e8ac45e2025569bb8df504ceac7a1c282cd9ed4d80ad27e724ee5e"
  license "Apache-2.0"

  depends_on "node@22"

  # OPL_HOMEBREW_FORMULA_BOUNDARY_START
  # release_truth_authority: opl_framework_package_manifest
  # framework_source_head: d25ae9b4c8f285310e3efddf1fffb3c4e5f36639
  # framework_artifact_ref: ghcr.io/gaofeng21cn/one-person-lab-framework:0.3.26
  # framework_artifact_digest: sha256:ae3c736ffed6743271606232ddb05be9cdbfffbd5d31fd488619bf38a8dcd402
  # framework_package_archive_sha256: f9871c8497d948ec539ca59e4e995fc6ea5e9780fa382a7142732cc4d0f2d557
  # homebrew_transport_archive_sha256: 33c5e81808e8ac45e2025569bb8df504ceac7a1c282cd9ed4d80ad27e724ee5e
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
