#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORK_DIR="${ROOT_DIR}/work"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"

PIGEN_REPO=${PIGEN_REPO:-"https://github.com/RPi-Distro/pi-gen.git"}
PIGEN_REF=${PIGEN_REF:-"2024-07-04-raspios-bookworm-arm64"}
ESCAPEPLAN_BASE_VERSION=${ESCAPEPLAN_BASE_VERSION:-"0.1.0-dev"}
TOOLS_DIR="${ROOT_DIR}/tools/bin"

ensure_qemu() {
  if command -v qemu-aarch64-static >/dev/null 2>&1; then
    return
  fi

  local qemu_path="${TOOLS_DIR}/qemu-aarch64-static"
  if [[ -x "${qemu_path}" ]]; then
    export PATH="${TOOLS_DIR}:$PATH"
    return
  fi

  echo "qemu-aarch64-static not found; fetching qemu-user-static package..."
  mkdir -p "${TOOLS_DIR}"
  local tmp_dir
  tmp_dir=$(mktemp -d)
  local deb_url=${QEMU_DEB_URL:-"https://deb.debian.org/debian/pool/main/q/qemu/qemu-user-static_7.2+dfsg-7+deb12u16+b2_amd64.deb"}
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to download qemu-user-static" >&2
    exit 1
  fi
  curl -fsSL "${deb_url}" -o "${tmp_dir}/qemu-user-static.deb"
  dpkg-deb -x "${tmp_dir}/qemu-user-static.deb" "${tmp_dir}/out"
  if [[ ! -f "${tmp_dir}/out/usr/bin/qemu-aarch64-static" ]]; then
    echo "Failed to extract qemu-aarch64-static from ${deb_url}" >&2
    exit 1
  fi
  mv "${tmp_dir}/out/usr/bin/qemu-aarch64-static" "${qemu_path}"
  chmod +x "${qemu_path}"
  rm -rf "${tmp_dir}"
  export PATH="${TOOLS_DIR}:$PATH"
}

PIGEN_DIR="${WORK_DIR}/pi-gen"

mkdir -p "${WORK_DIR}" "${DEPLOY_DIR}" "${ARTIFACTS_DIR}"

if [[ ! -d "${PIGEN_DIR}/.git" ]]; then
  echo "Cloning pi-gen from ${PIGEN_REPO}..."
  git clone --depth=1 "${PIGEN_REPO}" "${PIGEN_DIR}"
fi

pushd "${PIGEN_DIR}" >/dev/null

echo "Fetching pi-gen updates..."
git fetch --tags origin
if git rev-parse --verify "${PIGEN_REF}" >/dev/null 2>&1; then
  git checkout "${PIGEN_REF}"
else
  echo "Warning: pi-gen ref ${PIGEN_REF} not found. Falling back to origin/main." >&2
  git checkout origin/main
fi

# Sync EscapePlan configuration
rsync -a --delete "${ROOT_DIR}/config/config" "${PIGEN_DIR}/config"
if [[ -d "${ROOT_DIR}/config/stage-skips" ]]; then
  rsync -a "${ROOT_DIR}/config/stage-skips/" "${PIGEN_DIR}/"
fi

# Overlay custom stages (stage2/05-escapeplan-base etc.)
if [[ -d "${ROOT_DIR}/stages" ]]; then
  rsync -a "${ROOT_DIR}/stages/" "${PIGEN_DIR}/"
fi

export PIGEN_WORK_DIR="${WORK_DIR}/build"
export PIGEN_DEPLOY_DIR="${DEPLOY_DIR}"
export LOCALVERSION="-${ESCAPEPLAN_BASE_VERSION}"

export CONTINUE=${CONTINUE:-0}
export PRESERVE_CONTAINER=${PRESERVE_CONTAINER:-0}

rm -rf "${PIGEN_WORK_DIR}" "${PIGEN_DEPLOY_DIR}"/image_* || true

ensure_qemu

echo "Starting pi-gen build (Docker)..."
PIGEN_DOCKER_OPTS="${PIGEN_DOCKER_OPTS:-"--privileged"}" \
  ./build-docker.sh

echo "Pi-gen build completed. Preparing artifacts..."
LATEST_IMAGE=$(ls -t "${PIGEN_DEPLOY_DIR}"/*.img* 2>/dev/null | head -n1 || true)
if [[ -z "${LATEST_IMAGE}" ]]; then
  echo "No image artifact produced." >&2
  exit 1
fi

IMAGE_BASENAME=$(basename "${LATEST_IMAGE}")
TARGET_IMAGE_PATH="${ARTIFACTS_DIR}/${IMAGE_BASENAME}"
cp "${LATEST_IMAGE}" "${TARGET_IMAGE_PATH}"

pushd "${ARTIFACTS_DIR}" >/dev/null
sha256sum "${IMAGE_BASENAME}" >"${IMAGE_BASENAME}.sha256"
cat <<MANIFEST >"${IMAGE_BASENAME}.manifest.json"
{
  "image": "${IMAGE_BASENAME}",
  "sha256": "$(cut -d' ' -f1 "${IMAGE_BASENAME}.sha256")",
  "createdAt": "$(date --iso-8601=seconds)",
  "piGenRef": "${PIGEN_REF}",
  "escapeplanBaseVersion": "${ESCAPEPLAN_BASE_VERSION}"
}
MANIFEST
popd >/dev/null

popd >/dev/null

echo "Artifacts written to ${ARTIFACTS_DIR}:"
ls -1 "${ARTIFACTS_DIR}"
