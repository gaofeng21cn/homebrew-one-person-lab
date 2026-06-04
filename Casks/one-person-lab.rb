cask "one-person-lab" do
  version "26.6.3"
  sha256 "d9d8d77ac8ac8d0b106ca75b809466faf0d645c2fa582518a569600d23b0ec57"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-#{version}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    url "https://github.com/gaofeng21cn/one-person-lab-app/releases/latest"
    regex(%r{/releases/tag/v?(\d+(?:\.\d+)*)}i)
  end

  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: stable
  # package_kind: app_standard
  # version: 26.6.3
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.3/latest-arm64-mac.yml
  # checksum: sha256:d9d8d77ac8ac8d0b106ca75b809466faf0d645c2fa582518a569600d23b0ec57
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # modules_payload_allowed: false
  # agent_pack_homebrew_allowed: false
  # agent_pack_activation_owner: app_cli_managed_background_maintenance
  # forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly
  # must_not_write_user_codex_state: true
  # must_not_define_agent_semantics: true
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
