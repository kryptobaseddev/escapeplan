#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: test-image.sh <path-to-image.img[.xz]>" >&2
  exit 1
fi

IMAGE_PATH="$1"

if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "Image not found: $IMAGE_PATH" >&2
  exit 1
fi

if ! command -v guestfish >/dev/null 2>&1; then
  echo "guestfish is required for offline image checks. Install libguestfs-tools." >&2
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

IMG_TO_USE="$IMAGE_PATH"

if [[ "$IMAGE_PATH" == *.xz ]]; then
  echo "Decompressing $IMAGE_PATH ..."
  IMG_TO_USE="$WORK_DIR/$(basename "${IMAGE_PATH%.xz}")"
  xz -dc "$IMAGE_PATH" >"$IMG_TO_USE"
fi

run_guestfish() {
  local cmd="$1"
  guestfish --ro -a "$IMG_TO_USE" -i -c "$cmd"
}

assert_file() {
  local path="$1"
  if [[ $(run_guestfish "exists-file $path") != "true" ]]; then
    echo "Missing required file in image: $path" >&2
    exit 1
  fi
}

echo "Checking EscapePlan platform files inside image..."

assert_file /etc/escapeplan/version
assert_file /usr/local/sbin/escapeplan-platform-init
assert_file /usr/local/sbin/escapeplan-certgen
assert_file /usr/local/sbin/escapeplan-config-apply
assert_file /etc/systemd/system/escapeplan-platform-init.service
assert_file /etc/systemd/system/escapeplan-certgen.service
assert_file /etc/systemd/system/escapeplan-api.service
assert_file /etc/systemd/system/escapeplan-web.service
assert_file /etc/systemd/system/escapeplan-ffmpeg@.service

HOSTAPD_TEMPLATE=$(run_guestfish "download /etc/escapeplan/templates/hostapd.conf.tpl -" | head -n1 || true)
if [[ -z "$HOSTAPD_TEMPLATE" ]]; then
  echo "Template hostapd.conf.tpl missing." >&2
  exit 1
fi

echo "Image validation passed."
