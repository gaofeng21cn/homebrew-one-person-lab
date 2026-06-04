cask "one-person-lab-nightly" do
  version "26.6.3-nightly"
  sha256 "6cffc679824061273d7e4a744725e3c3fc874ab039849cbd8cfa4718e166ddbb"

  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v#{version}/One-Person-Lab-#{version}-mac-arm64.dmg"
  name "One Person Lab"
  desc "AI-first desktop research and agent orchestration app"
  homepage "https://github.com/gaofeng21cn/one-person-lab-app"

  livecheck do
    skip "Nightly casks track prerelease cohorts through tap automation"
  end

  depends_on macos: :big_sur
  depends_on arch: :arm64

  # OPL_HOMEBREW_BOUNDARY_START
  # channel: nightly
  # package_kind: app_standard
  # version: 26.6.3-nightly
  # manifest: https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.3-nightly/latest-arm64-mac.yml
  # checksum: sha256:6cffc679824061273d7e4a744725e3c3fc874ab039849cbd8cfa4718e166ddbb
  # full_first_install_allowed: false
  # stable_promotion_from_nightly_allowed: false
  # publishes_or_pushes_remote: false
  # cohort: standard_desktop_homebrew_distribution
  # modules_payload_allowed: false
  # OPL_HOMEBREW_BOUNDARY_END

  app "One Person Lab.app"
end
