#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE' >&2
Usage: package-deb.sh --version <semver> --api-dir <path> --web-dir <path> [--ffmpeg-dir <path>] [--output <dir>]

Creates a Debian package that installs the EscapePlan API and web frontend assets
into /opt/escapeplan and reloads systemd units on installation.

Required inputs:
  --version    Semantic version for the package (e.g., 0.1.0)
  --api-dir    Directory containing prebuilt API release (package.json, dist, systemd/start.sh, etc.)
  --web-dir    Directory containing prebuilt web release (e.g., build output with systemd/start.sh)

Optional inputs:
  --ffmpeg-dir Directory with ffmpeg worker scripts/configurations (copied to /opt/escapeplan/ffmpeg)
  --output     Target directory for the generated .deb (default: artifacts/)

Environment variables:
  PACKAGE_NAME     Defaults to escapeplan-apps
  PACKAGE_ARCH     Defaults to arm64
USAGE
}

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORK_ROOT="${ROOT_DIR}/work/deb"
OUTPUT_DIR="${ROOT_DIR}/artifacts"
PACKAGE_NAME=${PACKAGE_NAME:-escapeplan-apps}
PACKAGE_ARCH=${PACKAGE_ARCH:-arm64}

VERSION=""
API_DIR=""
WEB_DIR=""
FFMPEG_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --api-dir)
      API_DIR="$2"
      shift 2
      ;;
    --web-dir)
      WEB_DIR="$2"
      shift 2
      ;;
    --ffmpeg-dir)
      FFMPEG_DIR="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$VERSION" || -z "$API_DIR" || -z "$WEB_DIR" ]]; then
  echo "--version, --api-dir, and --web-dir are required." >&2
  usage
  exit 1
fi

for dir in "$API_DIR" "$WEB_DIR"; do
  if [[ ! -d "$dir" ]]; then
    echo "Directory not found: $dir" >&2
    exit 1
  fi
done

if [[ -n "$FFMPEG_DIR" && ! -d "$FFMPEG_DIR" ]]; then
  echo "FFmpeg directory not found: $FFMPEG_DIR" >&2
  exit 1
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb is required to build packages." >&2
  exit 1
fi

mkdir -p "$WORK_ROOT" "$OUTPUT_DIR"
STAGING_DIR="${WORK_ROOT}/${PACKAGE_NAME}_${VERSION}"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/DEBIAN" "$STAGING_DIR/opt/escapeplan"

install -d "$STAGING_DIR/opt/escapeplan/api" "$STAGING_DIR/opt/escapeplan/web"
rsync -a --delete "$API_DIR"/ "$STAGING_DIR/opt/escapeplan/api/"
rsync -a --delete "$WEB_DIR"/ "$STAGING_DIR/opt/escapeplan/web/"

if [[ -n "$FFMPEG_DIR" ]]; then
  install -d "$STAGING_DIR/opt/escapeplan/ffmpeg"
  rsync -a --delete "$FFMPEG_DIR"/ "$STAGING_DIR/opt/escapeplan/ffmpeg/"
fi

cat <<CONTROL >"$STAGING_DIR/DEBIAN/control"
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: misc
Priority: optional
Architecture: ${PACKAGE_ARCH}
Maintainer: EscapePlan Platform Team <ops@escapeplan>
Depends: nodejs (>= 22), nginx, hostapd, dnsmasq, ffmpeg, sqlite3, cron
Description: EscapePlan API and Web release bundle
 Provides EscapePlan server applications for the Raspberry Pi appliance.
CONTROL

cat <<'POSTINST' >"$STAGING_DIR/DEBIAN/postinst"
#!/bin/bash
set -e

chown -R escapeplan:escapeplan /opt/escapeplan || true
systemctl daemon-reload || true

if systemctl list-unit-files | grep -q '^escapeplan-api.service'; then
  systemctl enable --now escapeplan-api.service || true
fi

if systemctl list-unit-files | grep -q '^escapeplan-web.service'; then
  systemctl enable --now escapeplan-web.service || true
fi

if systemctl list-unit-files | grep -q '^escapeplan-ffmpeg@.service'; then
  systemctl reset-failed escapeplan-ffmpeg@.service || true
fi

exit 0
POSTINST

cat <<'PRERM' >"$STAGING_DIR/DEBIAN/prerm"
#!/bin/bash
set -e

if systemctl list-unit-files | grep -q '^escapeplan-web.service'; then
  systemctl stop escapeplan-web.service || true
fi

if systemctl list-unit-files | grep -q '^escapeplan-api.service'; then
  systemctl stop escapeplan-api.service || true
fi

exit 0
PRERM

chmod 0755 "$STAGING_DIR/DEBIAN/postinst" "$STAGING_DIR/DEBIAN/prerm"

OUTPUT_PKG="${OUTPUT_DIR}/${PACKAGE_NAME}_${VERSION}_${PACKAGE_ARCH}.deb"
rm -f "$OUTPUT_PKG"

dpkg-deb --build --root-owner-group "$STAGING_DIR" "$OUTPUT_PKG"

echo "Package created: $OUTPUT_PKG"
echo "To deploy: sudo dpkg -i $(basename "$OUTPUT_PKG")"
