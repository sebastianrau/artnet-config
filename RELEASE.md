# Release Checklist

Current release: `v0.1.0`

## Build Artifacts

Create all uploadable release archives:

```bash
make archive-all
```

Expected files:

```text
release/Art-Net-Config-mac-amd64.zip
release/Art-Net-Config-mac-arm64.zip
release/Art-Net-Config-win-amd64.zip
release/Art-Net-Config-win-arm64.zip
release/Art-Net-Config-linux-amd64.tar.gz
release/Art-Net-Config-linux-arm64.tar.gz
release/Art-Net-Config-linux-raspberry-arm.tar.gz
```

## Git Tag

After committing the release changes:

```bash
git tag -a v0.1.0 -m "Art-Net Config v0.1.0"
git push origin master
git push origin v0.1.0
```

## GitHub Release Notes

Title:

```text
Art-Net Config v0.1.0
```

Body:

```markdown
Initial desktop release of Art-Net Config.

## Highlights

- All-in-one Electron desktop app.
- Starts the Art-Net server internally and opens the GUI automatically.
- Showtechnik-inspired interface for Art-Net device discovery and configuration.
- Supports runnable release folders for macOS, Windows, Linux, and Raspberry Pi Linux ARM.

## Downloads

- macOS Intel: `Art-Net-Config-mac-amd64.zip`
- macOS Apple Silicon: `Art-Net-Config-mac-arm64.zip`
- Windows x64: `Art-Net-Config-win-amd64.zip`
- Windows arm64: `Art-Net-Config-win-arm64.zip`
- Linux x64: `Art-Net-Config-linux-amd64.tar.gz`
- Linux arm64: `Art-Net-Config-linux-arm64.tar.gz`
- Raspberry Pi Linux ARM: `Art-Net-Config-linux-raspberry-arm.tar.gz`

## Notes

- macOS builds are currently unsigned, so Gatekeeper may show a warning.
- The app binds Art-Net UDP port `6454`; firewall permission may be required.
- Release artifacts are unpacked/runnable app folders packaged as zip or tar.gz archives, not installers.
```
