# Art-Net Config

Art-Net Config is a desktop and web-based configuration tool for Art-Net devices. It discovers devices on the network, shows their Art-Net settings, and provides controls for naming, addressing, IP configuration, merge mode, identify, and basic DMX test output.

The desktop version is an all-in-one Electron app: it starts the local Art-Net server internally and opens the GUI in a window.

## Features

- Art-Net device discovery via ArtPoll.
- Device list with IP, MAC, firmware, OEM, ports, DHCP, and Art-Net 4 status.
- Device name editing.
- Net, subnet, per-port universe, and input/output direction configuration.
- Merge mode controls.
- IP programming controls.
- Identify and LED commands.
- 16-channel DMX test output.
- Showtechnik-inspired dark UI.
- Release builds for macOS, Windows, Linux, and Raspberry Pi Linux ARM.

## Requirements

- Node.js
- npm
- Network access to the Art-Net interface
- Permission to bind UDP port `6454`

On macOS, Windows, or Linux, the firewall may ask for permission when the app starts.

## Install

```bash
npm install
```

## Run

Start the Electron desktop app:

```bash
npm run gui
```

Start only the web server:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

If HTTP port `3000` is already in use:

```bash
PORT=3001 npm start
```

## Build Runnable Apps

The Makefile builds runnable app folders, not installers.

```bash
make build-mac-amd64
make build-mac-arm64
make build-win-amd64
make build-win-arm64
make build-linux-amd64
make build-linux-arm64
make build-linux-raspberry-arm
```

Build everything:

```bash
make build-all
```

## Build GitHub Release Archives

Create uploadable release archives:

```bash
make archive-all
```

Expected output:

```text
release/Art-Net-Config-mac-amd64.zip
release/Art-Net-Config-mac-arm64.zip
release/Art-Net-Config-win-amd64.zip
release/Art-Net-Config-win-arm64.zip
release/Art-Net-Config-linux-amd64.tar.gz
release/Art-Net-Config-linux-arm64.tar.gz
release/Art-Net-Config-linux-raspberry-arm.tar.gz
```

## Clean Builds

```bash
make clean
```

## Notes

- macOS builds are currently unsigned, so Gatekeeper may show a warning.
- The app must bind UDP port `6454` for Art-Net communication.
- Electron-builder may download platform runtimes during the first build.
- Cross-platform Electron builds can require platform-specific tooling, especially when building Windows or macOS artifacts from another operating system.

## Release

See [RELEASE.md](RELEASE.md) for the release checklist and GitHub release notes.
