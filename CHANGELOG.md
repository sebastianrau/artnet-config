# Changelog

## v0.1.0 - 2026-06-21

Initial desktop release of Art-Net Config.

### Added

- Electron desktop app that starts the Art-Net server and opens the UI in one window.
- Showtechnik-inspired dark UI for Art-Net device discovery and configuration.
- Art-Net device polling, device list, identify command, name editing, addressing, merge mode, IP configuration, DMX test output, and advanced commands.
- Build targets for runnable app folders on macOS, Windows, Linux, and Raspberry Pi Linux ARM.
- Release archive targets for GitHub uploads:
  - `Art-Net-Config-mac-amd64.zip`
  - `Art-Net-Config-mac-arm64.zip`
  - `Art-Net-Config-win-amd64.zip`
  - `Art-Net-Config-win-arm64.zip`
  - `Art-Net-Config-linux-amd64.tar.gz`
  - `Art-Net-Config-linux-arm64.tar.gz`
  - `Art-Net-Config-linux-raspberry-arm.tar.gz`

### Fixed

- Avoided truncating ArtCommand packets.
- Avoided rendering network-provided Art-Net device strings as HTML.
- Refreshed selected device details when new poll data arrives.
- Sent port direction changes from the addressing UI.
- Validated IPv4 values before ArtIpProg packet creation.
