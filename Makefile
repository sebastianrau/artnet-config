NPM ?= npm
ELECTRON_BUILDER ?= npx electron-builder
APP_NAME ?= Art-Net-Config
OUT_DIR ?= release
VERSION := $(shell node -p "require('./package.json').version")
TAG ?= v$(VERSION)
RELEASE_TITLE ?= Art-Net Config $(TAG)
RELEASE_NOTES ?= RELEASE.md
GH ?= gh

.PHONY: help install \
	build-mac-amd64 build-mac-arm64 \
	build-win-amd64 build-win-arm64 \
	build-linux-amd64 build-linux-arm64 build-linux-raspberry-arm \
	build-all-amd64 build-all-arm64 build-all \
	archive-mac-amd64 archive-mac-arm64 \
	archive-win-amd64 archive-win-arm64 \
	archive-linux-amd64 archive-linux-arm64 archive-linux-raspberry-arm \
	archive-all release clean

help:
	@echo "Electron build targets:"
	@echo "  make install                    Install dependencies"
	@echo "  make build-mac-amd64            Build runnable macOS x64 .app folder"
	@echo "  make build-mac-arm64            Build runnable macOS arm64 .app folder"
	@echo "  make build-win-amd64            Build runnable Windows x64 folder"
	@echo "  make build-win-arm64            Build runnable Windows arm64 folder"
	@echo "  make build-linux-amd64          Build runnable Linux x64 folder"
	@echo "  make build-linux-arm64          Build runnable Linux arm64 folder"
	@echo "  make build-linux-raspberry-arm  Build runnable Linux armv7l folder for Raspberry Pi"
	@echo "  make build-all-amd64            Build macOS, Windows, Linux x64"
	@echo "  make build-all-arm64            Build macOS, Windows, Linux arm64"
	@echo "  make build-all                  Build all Electron targets"
	@echo "  make archive-all                Build and archive all targets for GitHub upload"
	@echo "  make release                    Build archives and create GitHub release for package.json version tag"
	@echo "  make clean                      Remove Electron build artifacts"

install:
	$(NPM) install

build-mac-amd64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-amd64" "$(OUT_DIR)/$(APP_NAME)-mac-amd64"
	$(ELECTRON_BUILDER) --mac --x64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-mac-amd64"
	mkdir -p "$(OUT_DIR)/$(APP_NAME)-mac-amd64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-amd64/mac/Art-Net Config.app" "$(OUT_DIR)/$(APP_NAME)-mac-amd64/"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-amd64"

build-mac-arm64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-arm64" "$(OUT_DIR)/$(APP_NAME)-mac-arm64"
	$(ELECTRON_BUILDER) --mac --arm64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-mac-arm64"
	mkdir -p "$(OUT_DIR)/$(APP_NAME)-mac-arm64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-arm64/mac-arm64/Art-Net Config.app" "$(OUT_DIR)/$(APP_NAME)-mac-arm64/"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-mac-arm64"

build-win-amd64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-win-amd64" "$(OUT_DIR)/$(APP_NAME)-win-amd64"
	$(ELECTRON_BUILDER) --win --x64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-win-amd64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-win-amd64/win-unpacked" "$(OUT_DIR)/$(APP_NAME)-win-amd64"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-win-amd64"

build-win-arm64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-win-arm64" "$(OUT_DIR)/$(APP_NAME)-win-arm64"
	$(ELECTRON_BUILDER) --win --arm64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-win-arm64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-win-arm64/win-arm64-unpacked" "$(OUT_DIR)/$(APP_NAME)-win-arm64"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-win-arm64"

build-linux-amd64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-amd64" "$(OUT_DIR)/$(APP_NAME)-linux-amd64"
	$(ELECTRON_BUILDER) --linux --x64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-linux-amd64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-amd64/linux-unpacked" "$(OUT_DIR)/$(APP_NAME)-linux-amd64"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-amd64"

build-linux-arm64:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-arm64" "$(OUT_DIR)/$(APP_NAME)-linux-arm64"
	$(ELECTRON_BUILDER) --linux --arm64 --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-linux-arm64"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-arm64/linux-arm64-unpacked" "$(OUT_DIR)/$(APP_NAME)-linux-arm64"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-arm64"

build-linux-raspberry-arm:
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-raspberry-arm" "$(OUT_DIR)/$(APP_NAME)-linux-raspberry-arm"
	$(ELECTRON_BUILDER) --linux --armv7l --dir -c.directories.output="$(OUT_DIR)/.tmp-$(APP_NAME)-linux-raspberry-arm"
	mv "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-raspberry-arm/linux-armv7l-unpacked" "$(OUT_DIR)/$(APP_NAME)-linux-raspberry-arm"
	rm -rf "$(OUT_DIR)/.tmp-$(APP_NAME)-linux-raspberry-arm"

build-all-amd64: build-mac-amd64 build-win-amd64 build-linux-amd64

build-all-arm64: build-mac-arm64 build-win-arm64 build-linux-arm64

build-all: build-all-amd64 build-all-arm64 build-linux-raspberry-arm

archive-mac-amd64: build-mac-amd64
	cd "$(OUT_DIR)" && zip -qry "$(APP_NAME)-mac-amd64.zip" "$(APP_NAME)-mac-amd64"

archive-mac-arm64: build-mac-arm64
	cd "$(OUT_DIR)" && zip -qry "$(APP_NAME)-mac-arm64.zip" "$(APP_NAME)-mac-arm64"

archive-win-amd64: build-win-amd64
	cd "$(OUT_DIR)" && zip -qry "$(APP_NAME)-win-amd64.zip" "$(APP_NAME)-win-amd64"

archive-win-arm64: build-win-arm64
	cd "$(OUT_DIR)" && zip -qry "$(APP_NAME)-win-arm64.zip" "$(APP_NAME)-win-arm64"

archive-linux-amd64: build-linux-amd64
	cd "$(OUT_DIR)" && tar -czf "$(APP_NAME)-linux-amd64.tar.gz" "$(APP_NAME)-linux-amd64"

archive-linux-arm64: build-linux-arm64
	cd "$(OUT_DIR)" && tar -czf "$(APP_NAME)-linux-arm64.tar.gz" "$(APP_NAME)-linux-arm64"

archive-linux-raspberry-arm: build-linux-raspberry-arm
	cd "$(OUT_DIR)" && tar -czf "$(APP_NAME)-linux-raspberry-arm.tar.gz" "$(APP_NAME)-linux-raspberry-arm"

archive-all: archive-mac-amd64 archive-mac-arm64 archive-win-amd64 archive-win-arm64 archive-linux-amd64 archive-linux-arm64 archive-linux-raspberry-arm

release: archive-all
	@test -n "$(VERSION)" || (echo "Could not read version from package.json" && exit 1)
	@$(GH) release view "$(TAG)" >/dev/null 2>&1 && (echo "GitHub release $(TAG) already exists" && exit 1) || true
	$(GH) release create "$(TAG)" \
		"$(OUT_DIR)/$(APP_NAME)-mac-amd64.zip" \
		"$(OUT_DIR)/$(APP_NAME)-mac-arm64.zip" \
		"$(OUT_DIR)/$(APP_NAME)-win-amd64.zip" \
		"$(OUT_DIR)/$(APP_NAME)-win-arm64.zip" \
		"$(OUT_DIR)/$(APP_NAME)-linux-amd64.tar.gz" \
		"$(OUT_DIR)/$(APP_NAME)-linux-arm64.tar.gz" \
		"$(OUT_DIR)/$(APP_NAME)-linux-raspberry-arm.tar.gz" \
		--title "$(RELEASE_TITLE)" \
		--notes-file "$(RELEASE_NOTES)"

clean:
	rm -rf release
