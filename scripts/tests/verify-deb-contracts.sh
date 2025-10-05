#!/bin/bash
# Regression guard for the .deb packaging of @escapeplan/contracts.
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
BUILD_DIR="${ROOT_DIR}/build/deb"
API_ROOT="${BUILD_DIR}/opt/escapeplan/api"
WEB_ROOT="${BUILD_DIR}/opt/escapeplan/web"
API_NODE_MODULES="${API_ROOT}/node_modules"
WEB_NODE_MODULES="${WEB_ROOT}/node_modules"

fail() {
    echo "[verify-deb-contracts] $*" >&2
    exit 1
}

require_build_artifacts() {
    if [ ! -d "${API_NODE_MODULES}" ] || [ ! -d "${WEB_NODE_MODULES}" ]; then
        fail "Build artifacts not found. Run 'pnpm run build:deb' before this check."
    fi
}

assert_file() {
    local path="$1"
    if [ ! -f "${path}" ]; then
        fail "Expected file missing: ${path}"
    fi
}

assert_symlink_points_into_pnpm() {
    local path="$1"
    if [ ! -e "${path}" ]; then
        fail "Expected dependency link missing: ${path}"
    fi

    local resolved
    resolved=$(readlink -f "${path}" 2>/dev/null || true)
    if [ -z "${resolved}" ]; then
        fail "Unable to resolve symlink for ${path}"
    fi

    if [[ "${resolved}" != *"/.pnpm/"* ]]; then
        fail "Symlink ${path} does not point into .pnpm store (resolved: ${resolved})"
    fi
}

verify_runtime_imports() {
    (cd "${API_ROOT}" && node --input-type=module - <<'NODE')
await import('@escapeplan/contracts/runtime');
await import('drizzle-zod');
NODE
}

require_build_artifacts

assert_file "${API_NODE_MODULES}/@escapeplan/contracts/dist/runtime.js"
assert_file "${WEB_NODE_MODULES}/@escapeplan/contracts/dist/runtime.js"

assert_symlink_points_into_pnpm "${API_NODE_MODULES}/drizzle-zod"
assert_symlink_points_into_pnpm "${API_NODE_MODULES}/drizzle-orm"
assert_symlink_points_into_pnpm "${API_NODE_MODULES}/zod"
assert_symlink_points_into_pnpm "${API_NODE_MODULES}/@escapeplan/contracts/node_modules/drizzle-zod"
assert_symlink_points_into_pnpm "${API_NODE_MODULES}/@escapeplan/contracts/node_modules/zod"
assert_symlink_points_into_pnpm "${API_NODE_MODULES}/@escapeplan/contracts/node_modules/drizzle-orm"

verify_runtime_imports

echo "[verify-deb-contracts] All checks passed"
