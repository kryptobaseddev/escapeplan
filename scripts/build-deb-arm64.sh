#!/bin/bash
set -euo pipefail

# Get version from VERSION file
VERSION=$(cat VERSION | tr -d '\n')

# Force ARM64 architecture for Raspberry Pi
DEB_ARCH="arm64"
SHARP_PLATFORM="linux-arm64"
SQLITE_PLATFORM="linux-arm64"
ARCH_VERIFY_STRING="ARM aarch64"
echo "Cross-compiling from $(uname -m) to arm64 for Raspberry Pi"

PKG_NAME="escapeplan"
# Use absolute paths to avoid issues when cd'ing during the build
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/deb"
DIST_DIR="${PROJECT_ROOT}/dist"

echo "Building for architecture: ${DEB_ARCH} (cross-compile for Raspberry Pi)"

# Ensure required pieces are present before packaging.
if [ ! -d "packages/contracts/dist" ]; then
    echo "Contracts dist artifacts not found. Run pnpm --filter @escapeplan/contracts build first." >&2
    exit 1
fi

# Validate that critical runtime files exist in contracts dist/
REQUIRED_CONTRACTS_FILES=(
    "packages/contracts/dist/runtime.js"
    "packages/contracts/dist/runtime.d.ts"
    "packages/contracts/dist/validation.js"
    "packages/contracts/dist/validation.d.ts"
    "packages/contracts/dist/index.js"
    "packages/contracts/dist/index.d.ts"
    "packages/contracts/dist/paths.js"
    "packages/contracts/dist/paths.d.ts"
)

for file in "${REQUIRED_CONTRACTS_FILES[@]}"; do
    if [ ! -f "${file}" ]; then
        echo "Required contracts file missing: ${file}" >&2
        echo "Run: pnpm --filter @escapeplan/contracts build" >&2
        exit 1
    fi
done

echo "Contracts dist validation passed - all required files present."

resolve_pnpm_module() {
    # Locate an actual module directory inside .pnpm for a given dependency.
    local node_modules_root="$1"
    local module_name="$2"
    local pnpm_root="${node_modules_root}/.pnpm"
    if [ ! -d "${pnpm_root}" ]; then
        echo "Unable to locate .pnpm directory in ${node_modules_root}" >&2
        return 1
    fi

    local match
    match=$(find "${pnpm_root}" -maxdepth 1 -type d -name "${module_name}@*" | sort | head -n1 || true)
    if [ -z "${match}" ]; then
        echo "Unable to resolve ${module_name} within ${pnpm_root}" >&2
        return 1
    fi

    local module_path="${match}/node_modules/${module_name}"
    if [ ! -d "${module_path}" ]; then
        echo "Resolved path ${module_path} for ${module_name} is missing" >&2
        return 1
    fi

    echo "${module_path}"
}

create_relative_symlink() {
    # Create or refresh a symlink using a relative path to keep the .deb relocatable.
    local target_path="$1"
    local source_path="$2"

    mkdir -p "$(dirname "${target_path}")"
    local relative_source
    relative_source=$(realpath --relative-to="$(dirname "${target_path}")" "${source_path}")
    ln -sfn "${relative_source}" "${target_path}"
}

prepare_contracts_package() {
    local target_root="$1"
    local contracts_source="/mnt/projects/escape-plan/escapeplan-app/packages/contracts"
    local contracts_dest="${target_root}/node_modules/@escapeplan/contracts"

    echo "[CONTRACTS] ========================================"
    echo "[CONTRACTS] Deploying contracts package to ${target_root}"
    echo "[CONTRACTS] ========================================"

    # Verify source exists
    if [ ! -d "${contracts_source}/dist" ]; then
        echo "[CONTRACTS] ERROR: Contracts dist not found at ${contracts_source}/dist"
        exit 1
    fi

    # Check if contracts already exists and what type it is
    if [ -e "${contracts_dest}" ]; then
        if [ -L "${contracts_dest}" ]; then
            echo "[CONTRACTS] Found existing symlink at destination - removing"
            rm -f "${contracts_dest}"
        elif [ -d "${contracts_dest}" ]; then
            echo "[CONTRACTS] Found existing directory at destination - removing"
            rm -rf "${contracts_dest}"
        fi
    fi

    # Create destination directory
    echo "[CONTRACTS] Creating destination directory: ${contracts_dest}"
    mkdir -p "${contracts_dest}"

    # Copy dist directory
    echo "[CONTRACTS] Copying dist directory..."
    cp -r "${contracts_source}/dist" "${contracts_dest}/"
    echo "[CONTRACTS] ✓ dist directory copied ($(du -sh "${contracts_dest}/dist" | cut -f1))"

    # Copy package.json
    echo "[CONTRACTS] Copying package.json..."
    cp "${contracts_source}/package.json" "${contracts_dest}/"
    echo "[CONTRACTS] ✓ package.json copied"

    # Verify all critical files exist
    echo "[CONTRACTS] Verifying critical files..."
    local required_files=(
        "dist/runtime.js"
        "dist/runtime.d.ts"
        "dist/index.js"
        "dist/index.d.ts"
        "dist/schema.js"
        "dist/schema.d.ts"
        "dist/validation.js"
        "dist/validation.d.ts"
        "package.json"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "${contracts_dest}/${file}" ]; then
            echo "[CONTRACTS] ERROR: Missing critical file: ${file}"
            exit 1
        fi
    done

    echo "[CONTRACTS] ✓ All ${#required_files[@]} critical files verified"

    # Create node_modules directory for dependency symlinks
    echo "[CONTRACTS] Creating node_modules directory for dependencies..."
    mkdir -p "${contracts_dest}/node_modules"

    # Repair dependency links
    echo "[CONTRACTS] Linking pnpm dependencies..."
    local node_modules_root="${target_root}/node_modules"
    local dependency
    for dependency in drizzle-zod drizzle-orm zod; do
        echo "[CONTRACTS] - Resolving ${dependency}..."
        local resolved_path
        resolved_path=$(resolve_pnpm_module "${node_modules_root}" "${dependency}") || exit 1
        create_relative_symlink "${contracts_dest}/node_modules/${dependency}" "${resolved_path}"
        echo "[CONTRACTS]   ✓ ${dependency} linked"
    done

    echo "[CONTRACTS] ✓ Contracts package fully deployed to ${target_root}"
    echo "[CONTRACTS] ✓ Package is real directory (not symlink) with all files present"
    echo "[CONTRACTS] ========================================"
}

echo "Building ${PKG_NAME} v${VERSION} for ${DEB_ARCH}..."

# Clean previous builds (with force for locked files)
# Use find to forcefully remove all subdirectories
if [ -d "${BUILD_DIR}" ]; then
    find "${BUILD_DIR}" -mindepth 1 -delete 2>/dev/null || true
    rm -rf "${BUILD_DIR}" 2>/dev/null || true
fi

# Handle dist directory that may have locked FUSE files
if [ -d "${DIST_DIR}" ]; then
    # Remove all visible files first
    find "${DIST_DIR}" -type f ! -name '.fuse_hidden*' -delete 2>/dev/null || true
    # Try to remove directory, ignore if FUSE files remain
    rm -rf "${DIST_DIR}" 2>/dev/null || true
fi

mkdir -p "${BUILD_DIR}/DEBIAN" "${DIST_DIR}"

# Create package structure
mkdir -p "${BUILD_DIR}/opt/escapeplan/api"
mkdir -p "${BUILD_DIR}/opt/escapeplan/web"
mkdir -p "${BUILD_DIR}/etc/systemd/system"
mkdir -p "${BUILD_DIR}/etc/escapeplan"

# Use pnpm deploy to create production node_modules with real files (no symlinks)
echo "Deploying production dependencies for API..."
pnpm --filter escapeplan-api deploy --prod --legacy "${BUILD_DIR}/opt/escapeplan/api"

echo "Installing ${DEB_ARCH}-specific sharp binaries for API..."
cd "${BUILD_DIR}/opt/escapeplan/api"

# Remove ALL sharp platform binaries installed by pnpm deploy
# This prevents Sharp's runtime loader from selecting the wrong platform
echo "Removing x86_64 sharp binaries to force ARM64 usage..."
rm -rf node_modules/.pnpm/@img+sharp-linux-x64@* 2>/dev/null || true
rm -rf node_modules/.pnpm/@img+sharp-linuxmusl-x64@* 2>/dev/null || true
rm -rf node_modules/.pnpm/@img+sharp-win32-x64@* 2>/dev/null || true
rm -rf node_modules/.pnpm/@img+sharp-darwin-x64@* 2>/dev/null || true
rm -rf node_modules/.pnpm/@img+sharp-darwin-arm64@* 2>/dev/null || true
echo "✓ Non-ARM64 Linux sharp binaries removed"

# Download and extract sharp binary for target architecture
echo "Downloading sharp ${DEB_ARCH} prebuilt binary..."
curl -L https://registry.npmjs.org/@img/sharp-${SHARP_PLATFORM}/-/sharp-${SHARP_PLATFORM}-0.34.4.tgz -o /tmp/sharp-${DEB_ARCH}.tgz
mkdir -p "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-${SHARP_PLATFORM}@0.34.4/node_modules/@img/sharp-${SHARP_PLATFORM}/lib"
tar -xzf /tmp/sharp-${DEB_ARCH}.tgz -C /tmp
cp /tmp/package/lib/sharp-${SHARP_PLATFORM}.node "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-${SHARP_PLATFORM}@0.34.4/node_modules/@img/sharp-${SHARP_PLATFORM}/lib/"
cp /tmp/package/package.json "${BUILD_DIR}/opt/escapeplan/api/node_modules/.pnpm/@img+sharp-${SHARP_PLATFORM}@0.34.4/node_modules/@img/sharp-${SHARP_PLATFORM}/"
rm -f /tmp/sharp-${DEB_ARCH}.tgz
rm -rf /tmp/package
echo "✓ Sharp ${DEB_ARCH} binary installed (ONLY ARM64 platform available)"
cd -

echo "Installing ${DEB_ARCH}-specific better-sqlite3 binaries for API..."
cd "${BUILD_DIR}/opt/escapeplan/api"

# Find the better-sqlite3 pnpm module directory
BETTER_SQLITE3_PNPM_DIR=$(find "node_modules/.pnpm" -maxdepth 1 -type d -name "better-sqlite3@12.4.1*" | head -n1)

if [ -z "${BETTER_SQLITE3_PNPM_DIR}" ]; then
    echo "ERROR: better-sqlite3@12.4.1 pnpm directory not found"
    echo "Expected pattern: node_modules/.pnpm/better-sqlite3@12.4.1*"
    echo "Available directories:"
    find "node_modules/.pnpm" -maxdepth 1 -name "better-sqlite3@*" -type d 2>/dev/null || echo "  None found"
    exit 1
fi

echo "Found better-sqlite3 at: ${BETTER_SQLITE3_PNPM_DIR}"

# Define target paths
BETTER_SQLITE3_MODULE_DIR="${BETTER_SQLITE3_PNPM_DIR}/node_modules/better-sqlite3"
BETTER_SQLITE3_BINARY_DIR="${BETTER_SQLITE3_MODULE_DIR}/build/Release"
BETTER_SQLITE3_BINARY_PATH="${BETTER_SQLITE3_BINARY_DIR}/better_sqlite3.node"

echo "Target binary path: ${BETTER_SQLITE3_BINARY_PATH}"

# Create build directory structure
mkdir -p "${BETTER_SQLITE3_BINARY_DIR}"

# Download pre-built binary from npm
# The npm package contains platform-specific prebuilds
echo "Downloading better-sqlite3@12.4.1 ${DEB_ARCH} prebuilt binary..."

# Create temporary directory for download
TEMP_SQLITE_DIR="/tmp/better-sqlite3-${DEB_ARCH}-$$"
mkdir -p "${TEMP_SQLITE_DIR}"

# Download the npm package tarball
if curl -L "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-12.4.1.tgz" -o "${TEMP_SQLITE_DIR}/better-sqlite3.tgz"; then
    echo "✓ Downloaded better-sqlite3 package"
else
    echo "ERROR: Failed to download better-sqlite3 from npm registry"
    rm -rf "${TEMP_SQLITE_DIR}"
    exit 1
fi

# Extract the tarball
if tar -xzf "${TEMP_SQLITE_DIR}/better-sqlite3.tgz" -C "${TEMP_SQLITE_DIR}"; then
    echo "✓ Extracted better-sqlite3 package"
else
    echo "ERROR: Failed to extract better-sqlite3 tarball"
    rm -rf "${TEMP_SQLITE_DIR}"
    exit 1
fi

# Look for prebuild files in the package
# better-sqlite3 uses prebuildify, binaries are in prebuilds/ directory
PREBUILD_BINARY="${TEMP_SQLITE_DIR}/package/prebuilds/${SQLITE_PLATFORM}/node.napi.node"

if [ ! -f "${PREBUILD_BINARY}" ]; then
    echo "WARNING: No prebuilt ${DEB_ARCH} binary found in npm package"
    echo "Expected at: ${PREBUILD_BINARY}"
    echo "Available prebuilds:"
    find "${TEMP_SQLITE_DIR}/package" -name "*.node" || echo "  None found"
    echo ""
    echo "Downloading prebuilt binary from GitHub releases..."

    # better-sqlite3@12.4.1 releases only have v115 (Node 18) and v127 (Node 23) binaries
    # Use v127 for Node.js 20+ as it's forward compatible
    # Use v115 for Node.js 18-19
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        NODE_ABI="127"
    elif [ "$NODE_VERSION" -ge 18 ]; then
        NODE_ABI="115"
    else
        echo "ERROR: Unsupported Node.js version: $(node --version)"
        echo "better-sqlite3@12.4.1 requires Node.js 18 or higher"
        rm -rf "${TEMP_SQLITE_DIR}"
        exit 1
    fi

    GITHUB_BINARY_URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v12.4.1/better-sqlite3-v12.4.1-node-v${NODE_ABI}-${SQLITE_PLATFORM}.tar.gz"

    echo "Downloading from: ${GITHUB_BINARY_URL}"
    if curl -L "${GITHUB_BINARY_URL}" -o "${TEMP_SQLITE_DIR}/better-sqlite3-${DEB_ARCH}.tar.gz"; then
        echo "✓ Downloaded prebuilt binary from GitHub"

        # Extract the binary
        if tar -xzf "${TEMP_SQLITE_DIR}/better-sqlite3-${DEB_ARCH}.tar.gz" -C "${TEMP_SQLITE_DIR}"; then
            echo "✓ Extracted prebuilt binary"
            BINARY_SOURCE="${TEMP_SQLITE_DIR}/build/Release/better_sqlite3.node"

            if [ ! -f "${BINARY_SOURCE}" ]; then
                echo "ERROR: Binary not found after extraction"
                echo "Expected at: ${BINARY_SOURCE}"
                rm -rf "${TEMP_SQLITE_DIR}"
                exit 1
            fi
        else
            echo "ERROR: Failed to extract GitHub binary"
            rm -rf "${TEMP_SQLITE_DIR}"
            exit 1
        fi
    else
        echo "ERROR: Failed to download prebuilt binary from GitHub"
        echo "URL: ${GITHUB_BINARY_URL}"
        rm -rf "${TEMP_SQLITE_DIR}"
        exit 1
    fi
else
    echo "✓ Found prebuilt ${DEB_ARCH} binary in package"
    BINARY_SOURCE="${PREBUILD_BINARY}"
fi

# Copy the binary to the target location
if cp "${BINARY_SOURCE}" "${BETTER_SQLITE3_BINARY_PATH}"; then
    echo "✓ Copied ${DEB_ARCH} binary to ${BETTER_SQLITE3_BINARY_PATH}"
else
    echo "ERROR: Failed to copy binary"
    rm -rf "${TEMP_SQLITE_DIR}"
    exit 1
fi

# Verify the binary architecture
echo "Verifying binary architecture..."
ARCH_CHECK=$(file "${BETTER_SQLITE3_BINARY_PATH}" | grep -o "${ARCH_VERIFY_STRING}" || echo "")

if [ -n "${ARCH_CHECK}" ]; then
    echo "✓ Binary verification PASSED: ${ARCH_VERIFY_STRING}"
    echo "  Full file output: $(file "${BETTER_SQLITE3_BINARY_PATH}")"
else
    echo "ERROR: Binary verification FAILED"
    echo "  Expected: ${ARCH_VERIFY_STRING}"
    echo "  Got: $(file "${BETTER_SQLITE3_BINARY_PATH}")"
    rm -rf "${TEMP_SQLITE_DIR}"
    exit 1
fi

# Verify the binary is executable
chmod +x "${BETTER_SQLITE3_BINARY_PATH}"
if [ -x "${BETTER_SQLITE3_BINARY_PATH}" ]; then
    echo "✓ Binary is executable"
else
    echo "ERROR: Failed to make binary executable"
    rm -rf "${TEMP_SQLITE_DIR}"
    exit 1
fi

# Clean up temporary directory
rm -rf "${TEMP_SQLITE_DIR}"

echo "✓ better-sqlite3 ${DEB_ARCH} binary installed and verified"
echo "  Location: ${BETTER_SQLITE3_BINARY_PATH}"
echo "  Size: $(du -h "${BETTER_SQLITE3_BINARY_PATH}" | cut -f1)"
cd -

echo "Deploying production dependencies for Web..."
pnpm --filter escapeplan-web deploy --prod --legacy "${BUILD_DIR}/opt/escapeplan/web"

# Fix workspace references in package.json files for deployment
echo "Fixing workspace references in package.json files..."
sed -i 's|"@escapeplan/contracts": "workspace:\*"|"@escapeplan/contracts": "file:../contracts"|g' "${BUILD_DIR}/opt/escapeplan/api/package.json"
sed -i 's|"@escapeplan/contracts": "file:../../packages/contracts"|"@escapeplan/contracts": "file:../contracts"|g' "${BUILD_DIR}/opt/escapeplan/api/package.json"
sed -i 's|"@escapeplan/contracts": "workspace:\*"|"@escapeplan/contracts": "file:../contracts"|g' "${BUILD_DIR}/opt/escapeplan/web/package.json"
sed -i 's|"@escapeplan/contracts": "file:../../packages/contracts"|"@escapeplan/contracts": "file:../contracts"|g' "${BUILD_DIR}/opt/escapeplan/web/package.json"
echo "✓ Workspace references fixed"

# Copy built files over the deployed structure
echo "Copying built API files..."
cp -r apps/escapeplan-api/dist/* "${BUILD_DIR}/opt/escapeplan/api/"

echo "Copying API systemd service wrapper..."
if [ ! -d "apps/escapeplan-api/systemd" ]; then
    echo "ERROR: API systemd directory missing"
    exit 1
fi
cp -r apps/escapeplan-api/systemd "${BUILD_DIR}/opt/escapeplan/api/"

echo "Copying built Web files..."
cp -r apps/escapeplan-web/.svelte-kit "${BUILD_DIR}/opt/escapeplan/web/"

echo "Copying Web systemd service wrapper..."
if [ ! -d "apps/escapeplan-web/systemd" ]; then
    echo "ERROR: Web systemd directory missing"
    exit 1
fi
cp -r apps/escapeplan-web/systemd "${BUILD_DIR}/opt/escapeplan/web/"

# Create server.js wrapper for SvelteKit
echo "Creating server.js wrapper for SvelteKit..."
cat > "${BUILD_DIR}/opt/escapeplan/web/server.js" << 'EOF'
import { Server } from './.svelte-kit/output/server/index.js';
import { manifest } from './.svelte-kit/output/server/manifest.js';
import { env } from 'node:process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = env.PORT || '3000';
const HOST = env.HOST || '0.0.0.0';
const CLIENT_DIR = path.join(__dirname, '.svelte-kit/output/client');

// MIME type lookup
const mimeTypes = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.otf': 'font/otf',
	'.webmanifest': 'application/manifest+json',
	'.txt': 'text/plain',
	'.xml': 'application/xml',
	'.pdf': 'application/pdf',
};

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return mimeTypes[ext] || 'application/octet-stream';
}

// Initialize SvelteKit server
const server = new Server(manifest);

await server.init({
	env: env,
	read: null
});

// Create HTTP server
const httpServer = http.createServer(async (req, res) => {
	// Parse URL
	const url = new URL(req.url, `http://${req.headers.host}`);
	const pathname = decodeURIComponent(url.pathname);

	// Try to serve static files first
	if (pathname.startsWith('/_app/') || pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname.endsWith('.webmanifest') || pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|otf)$/)) {
		const filePath = path.join(CLIENT_DIR, pathname);

		// Security check: ensure file is within CLIENT_DIR
		const resolvedPath = path.resolve(filePath);
		if (!resolvedPath.startsWith(path.resolve(CLIENT_DIR))) {
			res.writeHead(403, { 'Content-Type': 'text/plain' });
			res.end('Forbidden');
			return;
		}

		// Check if file exists
		if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
			const stat = fs.statSync(resolvedPath);
			const mimeType = getMimeType(resolvedPath);

			res.writeHead(200, {
				'Content-Type': mimeType,
				'Content-Length': stat.size,
				'Cache-Control': pathname.startsWith('/_app/immutable/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate'
			});

			const readStream = fs.createReadStream(resolvedPath);
			readStream.pipe(res);
			return;
		}
	}

	// Let SvelteKit handle all other requests
	try {
		// Build Web API Request from Node.js request
		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) {
			if (value) {
				if (Array.isArray(value)) {
					for (const v of value) headers.append(key, v);
				} else {
					headers.append(key, value);
				}
			}
		}

		// Handle request body for POST/PUT/PATCH
		let body = null;
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			const chunks = [];
			for await (const chunk of req) {
				chunks.push(chunk);
			}
			if (chunks.length > 0) {
				body = Buffer.concat(chunks);
			}
		}

		const request = new Request(`http://${req.headers.host}${req.url}`, {
			method: req.method,
			headers,
			body
		});

		// Get response from SvelteKit
		const response = await server.respond(request, {
			getClientAddress: () => {
				return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
			}
		});

		// Write response to Node.js response
		res.writeHead(response.status, Object.fromEntries(response.headers));

		if (response.body) {
			const reader = response.body.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				res.write(value);
			}
		}

		res.end();
	} catch (error) {
		console.error('Error handling request:', error);
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('Internal Server Error');
	}
});

// Start server
httpServer.listen(PORT, HOST, () => {
	console.log(`SvelteKit server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
	console.log(`Received ${signal}, shutting down gracefully...`);
	httpServer.close(() => {
		console.log('Server closed');
		process.exit(0);
	});

	// Force shutdown after 10 seconds
	setTimeout(() => {
		console.error('Forced shutdown after timeout');
		process.exit(1);
	}, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
EOF

chmod 755 "${BUILD_DIR}/opt/escapeplan/web/server.js"
echo "✓ server.js created at ${BUILD_DIR}/opt/escapeplan/web/server.js"

# Replace workspace contracts with actual built content
echo "Replacing contracts workspace dependency with built files..."
prepare_contracts_package "${BUILD_DIR}/opt/escapeplan/api"
prepare_contracts_package "${BUILD_DIR}/opt/escapeplan/web"

# Copy packages/contracts for on-device development and debugging
echo "Deploying packages/contracts for on-device development..."
PACKAGES_CONTRACTS_SRC="packages/contracts"
PACKAGES_CONTRACTS_DEST="${BUILD_DIR}/opt/escapeplan/packages/contracts"

# Verify source exists
if [ ! -d "${PACKAGES_CONTRACTS_SRC}" ]; then
    echo "ERROR: Source packages/contracts directory not found at ${PACKAGES_CONTRACTS_SRC}"
    exit 1
fi

# Create destination directory
mkdir -p "${PACKAGES_CONTRACTS_DEST}"

# Copy source files
echo "  Copying src/ directory..."
cp -r "${PACKAGES_CONTRACTS_SRC}/src" "${PACKAGES_CONTRACTS_DEST}/"

# Copy compiled files
echo "  Copying dist/ directory..."
cp -r "${PACKAGES_CONTRACTS_SRC}/dist" "${PACKAGES_CONTRACTS_DEST}/"

# Copy configuration files
echo "  Copying package.json..."
cp "${PACKAGES_CONTRACTS_SRC}/package.json" "${PACKAGES_CONTRACTS_DEST}/"

echo "  Copying tsconfig.json..."
cp "${PACKAGES_CONTRACTS_SRC}/tsconfig.json" "${PACKAGES_CONTRACTS_DEST}/"

# Verify packages directory structure
if [ ! -d "${PACKAGES_CONTRACTS_DEST}/src" ]; then
    echo "ERROR: packages/contracts/src directory missing after copy"
    exit 1
fi

if [ ! -d "${PACKAGES_CONTRACTS_DEST}/dist" ]; then
    echo "ERROR: packages/contracts/dist directory missing after copy"
    exit 1
fi

if [ ! -f "${PACKAGES_CONTRACTS_DEST}/package.json" ]; then
    echo "ERROR: packages/contracts/package.json missing after copy"
    exit 1
fi

echo "✓ packages/contracts deployed to ${PACKAGES_CONTRACTS_DEST}"
echo "  Size: $(du -sh ${PACKAGES_CONTRACTS_DEST} | cut -f1)"
echo "  Source files: $(find ${PACKAGES_CONTRACTS_DEST}/src -name '*.ts' | wc -l) .ts files"
echo "  Compiled files: $(find ${PACKAGES_CONTRACTS_DEST}/dist -name '*.js' | wc -l) .js files"

# FINAL VERIFICATION - Contracts must exist
echo ""
echo "========================================"
echo "FINAL VERIFICATION: Contracts Deployment"
echo "========================================"

API_CONTRACTS="${BUILD_DIR}/opt/escapeplan/api/node_modules/@escapeplan/contracts"
WEB_CONTRACTS="${BUILD_DIR}/opt/escapeplan/web/node_modules/@escapeplan/contracts"

# Check API contracts
echo "Verifying API contracts..."
if [ -L "${API_CONTRACTS}" ]; then
    echo "ERROR: API contracts is a symlink (should be real directory)!"
    ls -la "${API_CONTRACTS}"
    exit 1
fi

if [ ! -f "${API_CONTRACTS}/dist/runtime.js" ]; then
    echo "ERROR: Contracts missing from API package!"
    echo "Expected: ${API_CONTRACTS}/dist/runtime.js"
    ls -la "${API_CONTRACTS}" || echo "Directory does not exist"
    exit 1
fi

echo "✓ API contracts verified (real directory with files)"
echo "  Size: $(du -sh ${API_CONTRACTS} | cut -f1)"
echo "  Files: $(find ${API_CONTRACTS}/dist -name '*.js' | wc -l) .js files, $(find ${API_CONTRACTS}/dist -name '*.d.ts' | wc -l) .d.ts files"

# Check Web contracts
echo "Verifying Web contracts..."
if [ -L "${WEB_CONTRACTS}" ]; then
    echo "ERROR: Web contracts is a symlink (should be real directory)!"
    ls -la "${WEB_CONTRACTS}"
    exit 1
fi

if [ ! -f "${WEB_CONTRACTS}/dist/runtime.js" ]; then
    echo "ERROR: Contracts missing from Web package!"
    echo "Expected: ${WEB_CONTRACTS}/dist/runtime.js"
    ls -la "${WEB_CONTRACTS}" || echo "Directory does not exist"
    exit 1
fi

echo "✓ Web contracts verified (real directory with files)"
echo "  Size: $(du -sh ${WEB_CONTRACTS} | cut -f1)"
echo "  Files: $(find ${WEB_CONTRACTS}/dist -name '*.js' | wc -l) .js files, $(find ${WEB_CONTRACTS}/dist -name '*.d.ts' | wc -l) .d.ts files"

# Check packages/contracts standalone directory
echo "Verifying standalone packages/contracts directory..."
STANDALONE_CONTRACTS="${BUILD_DIR}/opt/escapeplan/packages/contracts"

if [ ! -d "${STANDALONE_CONTRACTS}" ]; then
    echo "ERROR: Standalone packages/contracts directory missing!"
    echo "Expected: ${STANDALONE_CONTRACTS}"
    exit 1
fi

if [ ! -d "${STANDALONE_CONTRACTS}/src" ]; then
    echo "ERROR: packages/contracts/src directory missing!"
    exit 1
fi

if [ ! -d "${STANDALONE_CONTRACTS}/dist" ]; then
    echo "ERROR: packages/contracts/dist directory missing!"
    exit 1
fi

if [ ! -f "${STANDALONE_CONTRACTS}/package.json" ]; then
    echo "ERROR: packages/contracts/package.json missing!"
    exit 1
fi

echo "✓ Standalone packages/contracts verified"
echo "  Location: /opt/escapeplan/packages/contracts"
echo "  Size: $(du -sh ${STANDALONE_CONTRACTS} | cut -f1)"
echo "  Source files: $(find ${STANDALONE_CONTRACTS}/src -name '*.ts' | wc -l) .ts files"
echo "  Compiled files: $(find ${STANDALONE_CONTRACTS}/dist -name '*.js' | wc -l) .js files"

# Check systemd/start.sh exists for API
echo "Verifying API systemd/start.sh..."
if [ ! -f "${BUILD_DIR}/opt/escapeplan/api/systemd/start.sh" ]; then
    echo "ERROR: API systemd/start.sh missing!"
    exit 1
fi

# Check systemd/start.sh exists for Web
echo "Verifying Web systemd/start.sh..."
if [ ! -f "${BUILD_DIR}/opt/escapeplan/web/systemd/start.sh" ]; then
    echo "ERROR: Web systemd/start.sh missing!"
    exit 1
fi

echo "✓ systemd service wrappers verified"

# Check server.js exists
echo "Verifying server.js..."
WEB_SERVER_JS="${BUILD_DIR}/opt/escapeplan/web/server.js"

if [ ! -f "${WEB_SERVER_JS}" ]; then
    echo "ERROR: server.js missing from web package!"
    echo "Expected: ${WEB_SERVER_JS}"
    exit 1
fi

if [ ! -x "${WEB_SERVER_JS}" ]; then
    echo "ERROR: server.js is not executable!"
    exit 1
fi

echo "✓ server.js verified"
echo "  Location: ${WEB_SERVER_JS}"
echo "  Size: $(du -h ${WEB_SERVER_JS} | cut -f1)"
echo "  Permissions: $(stat -c '%A' ${WEB_SERVER_JS})"

echo "========================================"
echo "✓ Contracts verified in both API and Web packages"
echo "✓ Standalone packages/contracts directory deployed"
echo "✓ All contracts are real directories (not symlinks)"
echo "✓ Web server.js created and verified"
echo "========================================"
echo ""

# Copy utility scripts
echo "Adding utility scripts to package..."
mkdir -p "${BUILD_DIR}/opt/escapeplan/scripts"
cp scripts/pi-post-install.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/postinst-orchestrator.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/nginx-configure.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/health-check.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/validate-dependencies.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp scripts/boot-rescue.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp apps/escapeplan-api/scripts/backup.sh "${BUILD_DIR}/opt/escapeplan/scripts/"
cp apps/escapeplan-api/scripts/backup.ts "${BUILD_DIR}/opt/escapeplan/scripts/"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/pi-post-install.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/postinst-orchestrator.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/nginx-configure.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/health-check.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/validate-dependencies.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/boot-rescue.sh"
chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/backup.sh"

# Create first-boot-setup.sh script for manual service activation
echo "Creating first-boot-setup.sh script..."
cat > "${BUILD_DIR}/opt/escapeplan/scripts/first-boot-setup.sh" << 'FIRST_BOOT_EOF'
#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "EscapePlan First Boot Setup"
echo "=========================================="
echo ""

# Test 1: better-sqlite3 module loading
echo -n "Testing better-sqlite3 module loading... "
if (cd /opt/escapeplan/api && node -e "require('better-sqlite3')") 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo ""
    echo -e "${RED}ERROR: better-sqlite3 module failed to load${NC}"
    echo "This typically means the native module is not compiled for ARM64."
    echo "Try running: cd /opt/escapeplan/api && npm rebuild better-sqlite3"
    exit 1
fi

# Test 2: Database connection
echo -n "Testing database connection... "
if (cd /opt/escapeplan/api && node -e "const db = require('better-sqlite3')('/var/lib/escapeplan/escapeplan.db'); db.close();") 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo ""
    echo -e "${RED}ERROR: Database connection test failed${NC}"
    echo "Check that /var/lib/escapeplan/escapeplan.db exists and is accessible."
    echo "Also verify that the .db-initialized marker file exists."
    exit 1
fi

echo ""
echo "All pre-flight checks passed!"
echo ""

# Enable services
echo "Enabling systemd services..."
if systemctl enable escapeplan-api.service escapeplan-web.service 2>&1; then
    echo -e "${GREEN}Services enabled${NC}"
else
    echo -e "${RED}Failed to enable services${NC}"
    exit 1
fi

# Start services
echo ""
echo "Starting services..."
if systemctl start escapeplan-api.service escapeplan-web.service 2>&1; then
    echo -e "${GREEN}Services started${NC}"
else
    echo -e "${RED}Failed to start services${NC}"
    echo ""
    echo "Check logs with:"
    echo "  journalctl -u escapeplan-api.service -n 50"
    echo "  journalctl -u escapeplan-web.service -n 50"
    exit 1
fi

# Wait and verify services are running
echo ""
echo "Waiting 30 seconds for services to stabilize..."
sleep 30

echo ""
echo "Verifying services are still running..."

API_STATUS=$(systemctl is-active escapeplan-api.service || echo "inactive")
WEB_STATUS=$(systemctl is-active escapeplan-web.service || echo "inactive")

if [ "$API_STATUS" = "active" ]; then
    echo -e "  escapeplan-api.service: ${GREEN}RUNNING${NC}"
else
    echo -e "  escapeplan-api.service: ${RED}FAILED${NC}"
    echo ""
    echo "API service logs (last 50 lines):"
    journalctl -u escapeplan-api.service -n 50 --no-pager
    echo ""
    exit 1
fi

if [ "$WEB_STATUS" = "active" ]; then
    echo -e "  escapeplan-web.service: ${GREEN}RUNNING${NC}"
else
    echo -e "  escapeplan-web.service: ${RED}FAILED${NC}"
    echo ""
    echo "Web service logs (last 50 lines):"
    journalctl -u escapeplan-web.service -n 50 --no-pager
    echo ""
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}SUCCESS!${NC} EscapePlan services are running."
echo "=========================================="
echo ""
echo "Access the application at:"
echo "  http://escapeplan.local"
echo "  http://10.10.10.1"
echo ""
echo "Check service status with:"
echo "  systemctl status escapeplan-api.service"
echo "  systemctl status escapeplan-web.service"
echo ""
echo "View logs with:"
echo "  journalctl -u escapeplan-api.service -f"
echo "  journalctl -u escapeplan-web.service -f"
echo ""
FIRST_BOOT_EOF

chmod 755 "${BUILD_DIR}/opt/escapeplan/scripts/first-boot-setup.sh"
echo "✓ first-boot-setup.sh created"


# Create environment file templates
cat > "${BUILD_DIR}/etc/escapeplan/api.env.example" << 'EOF'
# EscapePlan API Environment Configuration
# Copy this file to api.env and customize as needed
# Usage: cp /etc/escapeplan/api.env.example /etc/escapeplan/api.env

# Node environment
NODE_ENV=production

# API server port
PORT=4000

# Database path
ESCAPEPLAN_DB_PATH=/var/lib/escapeplan/escapeplan.db

# Better Auth secret (CHANGE THIS!)
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=CHANGE_ME_GENERATE_RANDOM_SECRET

# Better Auth URL (update for production)
BETTER_AUTH_URL=http://localhost:4000

# Logging configuration
LOG_LEVEL=info
LOG_DIR=/var/log/escapeplan

# Backup configuration
BACKUP_DIR=/var/backups/escapeplan
EOF

cat > "${BUILD_DIR}/etc/escapeplan/web.env.example" << 'EOF'
# EscapePlan Web Environment Configuration
# Copy this file to web.env and customize as needed
# Usage: cp /etc/escapeplan/web.env.example /etc/escapeplan/web.env

# Node environment
NODE_ENV=production

# Web server port
PORT=3000

# Origin URL (update for production domain)
ORIGIN=http://localhost:3000

# API server URL for server-side requests
API_URL=http://localhost:4000
EOF

# Create systemd service files
cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-api.service" << 'EOF'
[Unit]
Description=EscapePlan Fastify API
After=network-online.target NetworkManager.service escapeplan-platform-init.service escapeplan-rescue.service
Wants=network-online.target
ConditionPathExists=/opt/escapeplan/api/systemd/start.sh
ConditionPathExists=/var/lib/escapeplan/.db-initialized
ConditionPathExists=!/var/lib/escapeplan/.rescue-mode

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/api.env
WorkingDirectory=/opt/escapeplan/api
ExecStartPre=/bin/bash -c 'for i in {1..60}; do [ -f /var/lib/escapeplan/.db-initialized ] && break; sleep 1; done; [ -f /var/lib/escapeplan/.db-initialized ] || exit 1'
ExecStart=/opt/escapeplan/api/systemd/start.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=escapeplan-api

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/escapeplan /var/log/escapeplan /tmp

[Install]
WantedBy=multi-user.target
EOF

cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-web.service" << 'EOF'
[Unit]
Description=EscapePlan SvelteKit Web Frontend
After=escapeplan-api.service escapeplan-rescue.service
ConditionPathExists=/opt/escapeplan/web/systemd/start.sh
ConditionPathExists=!/var/lib/escapeplan/.rescue-mode

[Service]
Type=simple
User=escapeplan
Group=escapeplan
EnvironmentFile=-/etc/escapeplan/web.env
WorkingDirectory=/opt/escapeplan/web
ExecStart=/opt/escapeplan/web/systemd/start.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=escapeplan-web

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/escapeplan /var/log/escapeplan /tmp

[Install]
WantedBy=multi-user.target
EOF

# Copy backup systemd units from scripts directory
echo "Adding backup systemd units to package..."
cp scripts/systemd/escapeplan-backup.service "${BUILD_DIR}/etc/systemd/system/"
cp scripts/systemd/escapeplan-backup.timer "${BUILD_DIR}/etc/systemd/system/"
cp scripts/systemd/escapeplan-backup-notify@.service "${BUILD_DIR}/etc/systemd/system/"

# Copy rescue systemd unit from scripts directory
echo "Adding rescue systemd unit to package..."
cp scripts/systemd/escapeplan-rescue.service "${BUILD_DIR}/etc/systemd/system/"

# Create control file
cat > "${BUILD_DIR}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${DEB_ARCH}
Depends: nodejs (>= 22),
         nginx (>= 1.18),
         sqlite3 (>= 3.34),
         network-manager
Recommends: build-essential,
            python3
Breaks: escapeplan-apps (<< 1.0.0~)
Replaces: escapeplan-apps (<< 1.0.0~)
Provides: escapeplan-apps
Maintainer: EscapePlan Team
Description: Offline-first escape room management system
 EscapePlan is a complete escape room management solution
 designed for Raspberry Pi appliances.
 .
 Features include:
  * Real-time session management with WebSocket updates
  * Booking calendar with pricing engine
  * Multi-room support (fixed and mobile kits)
  * Camera streaming (RTSP to HLS transcoding)
  * Role-based access control (RBAC)
  * Offline-first PWA architecture
 .
 Native modules (better-sqlite3, sharp) are rebuilt for the target
 architecture (arm64/amd64) during package installation.
 .
 This package requires escapeplan-base platform services to function.
EOF

# Create postinst script that delegates to the orchestrator
cat > "${BUILD_DIR}/DEBIAN/postinst" << 'EOF'
#!/bin/bash

# ============================================================================
# ERROR HANDLING AND LOGGING INFRASTRUCTURE
# ============================================================================

# Enable strict error handling
set -e          # Exit immediately if a command exits with a non-zero status
set -o pipefail # Prevent errors in a pipeline from being masked

# Logging configuration
LOG_FILE="/var/log/escapeplan-install.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Initialize log file with header
mkdir -p "$(dirname "${LOG_FILE}")"
echo "========================================" | tee -a "${LOG_FILE}"
echo "EscapePlan Installation Started" | tee -a "${LOG_FILE}"
echo "Timestamp: ${TIMESTAMP}" | tee -a "${LOG_FILE}"
echo "========================================" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# Redirect all output to log file while maintaining console output
exec 1> >(tee -a "${LOG_FILE}")
exec 2> >(tee -a "${LOG_FILE}" >&2)

# Error cleanup handler
cleanup_on_error() {
    local exit_code=$?
    local line_number=$1

    echo "" >&2
    echo "========================================" >&2
    echo "INSTALLATION FAILED" >&2
    echo "========================================" >&2
    echo "Error occurred at line ${line_number}" >&2
    echo "Exit code: ${exit_code}" >&2
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >&2
    echo "" >&2

    # Disable and stop any services that may have been enabled
    echo "Cleaning up services..." >&2
    systemctl disable escapeplan-api.service 2>/dev/null || true
    systemctl disable escapeplan-web.service 2>/dev/null || true
    systemctl disable escapeplan-backup.timer 2>/dev/null || true
    systemctl stop escapeplan-api.service 2>/dev/null || true
    systemctl stop escapeplan-web.service 2>/dev/null || true
    systemctl stop escapeplan-backup.timer 2>/dev/null || true

    echo "" >&2
    echo "Services disabled and stopped." >&2
    echo "" >&2
    echo "Installation log saved to: ${LOG_FILE}" >&2
    echo "Please review the log file for details." >&2
    echo "" >&2
    echo "To retry installation after fixing issues:" >&2
    echo "  sudo apt-get install --reinstall escapeplan" >&2
    echo "========================================" >&2

    exit ${exit_code}
}

# Register error trap
trap 'cleanup_on_error ${LINENO}' ERR

# Logging helpers
log() {
    echo "[postinst] $1"
    logger -t escapeplan "[postinst] $1"
}

log_error() {
    echo "[postinst] ERROR: $1" >&2
    logger -t escapeplan -p user.err "[postinst] ERROR: $1"
}

resolve_pnpm_module() {
    local node_modules_root="$1"
    local module_name="$2"
    local pnpm_root="${node_modules_root}/.pnpm"
    if [ ! -d "${pnpm_root}" ]; then
        echo "[postinst] Missing .pnpm directory at ${pnpm_root}" >&2
        return 1
    fi

    local match
    match=$(find "${pnpm_root}" -maxdepth 1 -type d -name "${module_name}@*" | sort | head -n1 || true)
    if [ -z "${match}" ]; then
        echo "[postinst] Failed to resolve ${module_name} inside ${pnpm_root}" >&2
        return 1
    fi

    local module_path="${match}/node_modules/${module_name}"
    if [ ! -d "${module_path}" ]; then
        echo "[postinst] Resolved module path ${module_path} missing for ${module_name}" >&2
        return 1
    fi

    echo "${module_path}"
}

create_relative_symlink() {
    local target_path="$1"
    local source_path="$2"

    mkdir -p "$(dirname "${target_path}")"
    local relative_source
    relative_source=$(realpath --relative-to="$(dirname "${target_path}")" "${source_path}")
    ln -sfn "${relative_source}" "${target_path}"
}

repair_contracts_dependencies() {
    local install_root="$1"
    local node_modules_root="${install_root}/node_modules"
    local contracts_root="${node_modules_root}/@escapeplan/contracts"

    log "Repairing contracts dependencies for ${install_root}..."

    # Verify contracts package exists as real directory (not symlink)
    if [ ! -d "${contracts_root}" ]; then
        log_error "Contracts package missing at ${contracts_root}"
        return 1
    fi

    if [ -L "${contracts_root}" ]; then
        log_error "Contracts package at ${contracts_root} is a symlink - should be real files!"
        log_error "This indicates the package was not built correctly."
        return 1
    fi

    # Verify critical contracts files exist
    local critical_files=(
        "dist/runtime.js"
        "dist/index.js"
        "dist/schema.js"
        "package.json"
    )

    for file in "${critical_files[@]}"; do
        if [ ! -f "${contracts_root}/${file}" ]; then
            log_error "Critical contracts file missing: ${contracts_root}/${file}"
            return 1
        fi
    done

    log "✓ Contracts package verified - all critical files present"

    # Create node_modules directory inside contracts for dependency symlinks
    mkdir -p "${contracts_root}/node_modules"

    # Only create symlinks for dependencies INSIDE contracts/node_modules
    # Do NOT create a symlink for the contracts package itself
    local dependency
    for dependency in drizzle-zod drizzle-orm zod; do
        log "Linking ${dependency} for contracts package..."
        local resolved_path
        resolved_path=$(resolve_pnpm_module "${node_modules_root}" "${dependency}") || return 1

        # Create symlink in contracts/node_modules so contracts can import its dependencies
        create_relative_symlink "${contracts_root}/node_modules/${dependency}" "${resolved_path}"
        log "✓ ${dependency} linked"
    done

    log "✓ Contracts dependencies repaired successfully"
    return 0
}

# ============================================================================
# MAIN INSTALLATION LOGIC - Debian Policy 6.5 Compliant Case Statement
# ============================================================================

case "$1" in
    configure)
        log "EscapePlan package installation starting (configure mode)..."

        # Create escapeplan system user if it doesn't exist
        log "Checking for escapeplan system user..."
        if ! id escapeplan &>/dev/null; then
            log "Creating escapeplan system user..."
            useradd --system --home-dir /opt/escapeplan --shell /usr/sbin/nologin --comment "EscapePlan System User" escapeplan
            log "✓ System user created"
        else
            log "✓ System user already exists"
        fi

        # Create required data directories if they don't exist
        log "Ensuring required directories exist..."
        for dir in /var/lib/escapeplan/data /var/lib/escapeplan/backups /var/lib/escapeplan/temp /var/log/escapeplan /etc/escapeplan /var/backups/escapeplan; do
            if [ ! -d "$dir" ]; then
                log "Creating directory: $dir"
                mkdir -p "$dir"
            fi
        done
        log "✓ All required directories verified"

        # Set ownership (node_modules already bundled in package)
        log "Setting directory ownership..."
        chown -R escapeplan:escapeplan /opt/escapeplan
        chown -R escapeplan:escapeplan /var/lib/escapeplan
        chown -R escapeplan:escapeplan /var/log/escapeplan
        chown -R escapeplan:escapeplan /etc/escapeplan
        chown -R escapeplan:escapeplan /var/backups/escapeplan

        # Repair contracts dependencies (critical for package installation)
        log "Verifying and repairing contracts package dependencies..."
        log "This step ensures contracts can import drizzle-orm, drizzle-zod, and zod"

        if ! repair_contracts_dependencies "/opt/escapeplan/api"; then
            log_error "Failed to repair API contracts dependencies"
            exit 1
        fi

        if ! repair_contracts_dependencies "/opt/escapeplan/web"; then
            log_error "Failed to repair Web contracts dependencies"
            exit 1
        fi

        log "✓ All contracts packages verified and dependencies linked"

        log "Package installation complete. Running orchestrator for system configuration..."
        log ""

        # Call the orchestrator script to handle all post-installation steps
        if [ -f /opt/escapeplan/scripts/postinst-orchestrator.sh ]; then
            if /opt/escapeplan/scripts/postinst-orchestrator.sh /opt/escapeplan; then
                log ""
                log "✓ EscapePlan installation and configuration complete!"
                log ""
                log "⚠️  IMPORTANT: Services are NOT auto-enabled (prevents boot loops)"
                log ""
                log "To enable and start services safely:"
                log "  Option 1 (recommended): /opt/escapeplan/scripts/first-boot-setup.sh"
                log "  Option 2 (manual):"
                log "    systemctl enable escapeplan-api escapeplan-web"
                log "    systemctl start escapeplan-api escapeplan-web"
                log ""
                log "Check installation status with:"
                log "  /opt/escapeplan/scripts/health-check.sh"
                log ""
                log "View installation log at: ${LOG_FILE}"
            else
                log_error "Orchestrator script failed - installation may be incomplete"
                log_error "Check logs at: ${LOG_FILE}"
                exit 1
            fi
        else
            log_error "Orchestrator script not found at /opt/escapeplan/scripts/postinst-orchestrator.sh"
            log_error "Package may be corrupted or incomplete"
            exit 1
        fi
        ;;

    abort-upgrade|abort-remove|abort-deconfigure)
        log "Installation aborted: $1"
        log "Rolling back any incomplete changes..."
        ;;

    *)
        log_error "postinst called with unknown argument: $1"
        exit 1
        ;;
esac

# ============================================================================
# INSTALLATION SUCCESS FOOTER
# ============================================================================

echo ""
echo "========================================"
echo "INSTALLATION COMPLETED SUCCESSFULLY"
echo "========================================"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "Next Steps:"
echo "  1. Run first-boot setup script:"
echo "     /opt/escapeplan/scripts/first-boot-setup.sh"
echo ""
echo "  2. Or manually enable and start services:"
echo "     systemctl enable escapeplan-api escapeplan-web"
echo "     systemctl start escapeplan-api escapeplan-web"
echo ""
echo "  3. Check system status:"
echo "     /opt/escapeplan/scripts/health-check.sh"
echo ""
echo "Installation log: ${LOG_FILE}"
echo "========================================"
echo ""

#DEBHELPER#

exit 0
EOF

chmod 755 "${BUILD_DIR}/DEBIAN/postinst"

# Create prerm script
cat > "${BUILD_DIR}/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e

# ============================================================================
# EscapePlan Package Pre-Removal Script
# ============================================================================
# Handles service shutdown before package removal or upgrade.
#
# Called by dpkg with arguments:
#   remove             - Package is being removed
#   upgrade <new-ver>  - Package is being upgraded
#   deconfigure        - Package conflicts resolved by removal
#   failed-upgrade     - Upgrade failed, rolling back
# ============================================================================

log() {
    echo "[prerm] $1"
    logger -t escapeplan-prerm -p daemon.info "$1" 2>/dev/null || true
}

log_error() {
    echo "[prerm] ERROR: $1" >&2
    logger -t escapeplan-prerm -p daemon.err "$1" 2>/dev/null || true
}

case "$1" in
    remove|deconfigure)
        log "Package removal initiated - stopping services..."

        # Stop all EscapePlan services
        for service in escapeplan-api.service escapeplan-web.service escapeplan-backup.timer; do
            if systemctl is-active "$service" >/dev/null 2>&1; then
                log "Stopping $service..."
                systemctl stop "$service" 2>/dev/null || true
            fi
        done

        # Stop all ffmpeg camera workers
        if systemctl list-units 'escapeplan-ffmpeg@*.service' --all | grep -q 'escapeplan-ffmpeg'; then
            log "Stopping camera stream workers..."
            systemctl stop 'escapeplan-ffmpeg@*.service' 2>/dev/null || true
        fi

        # Disable services on removal (not upgrade)
        if [ "$1" = "remove" ]; then
            log "Disabling services..."
            for service in escapeplan-api.service escapeplan-web.service escapeplan-backup.timer escapeplan-rescue.service; do
                if systemctl is-enabled "$service" >/dev/null 2>&1; then
                    systemctl disable "$service" 2>/dev/null || true
                fi
            done
        fi

        log "Services stopped successfully"
        ;;

    upgrade|failed-upgrade)
        log "Package upgrade in progress - keeping services running"
        log "Services will be restarted by postinst after upgrade completes"
        # Do NOT stop services during upgrade to minimize downtime
        ;;

    *)
        log_error "prerm called with unknown argument: $1"
        exit 1
        ;;
esac

#DEBHELPER#

exit 0
EOF

chmod 755 "${BUILD_DIR}/DEBIAN/prerm"

# Create postrm script
cat > "${BUILD_DIR}/DEBIAN/postrm" << 'EOF'
#!/bin/bash
set -e

# ============================================================================
# EscapePlan Package Post-Removal Script
# ============================================================================
# Handles cleanup after package removal or purge.
#
# Called by dpkg with arguments:
#   purge              - Remove all configuration and data
#   remove             - Package removed, config preserved
#   upgrade            - Package upgraded successfully
#   failed-upgrade     - Upgrade failed, old version restored
#   abort-install      - Installation aborted
#   abort-upgrade      - Upgrade aborted
#   disappear          - Package overwritten by another
# ============================================================================

log() {
    echo "[postrm] $1"
    logger -t escapeplan-postrm -p daemon.info "$1" 2>/dev/null || true
}

log_error() {
    echo "[postrm] ERROR: $1" >&2
    logger -t escapeplan-postrm -p daemon.err "$1" 2>/dev/null || true
}

case "$1" in
    purge)
        log "Purging all EscapePlan configuration and data..."

        # Remove all configuration directories
        log "Removing configuration files..."
        rm -rf /etc/escapeplan

        # Remove all data directories
        log "Removing database and application data..."
        rm -rf /var/lib/escapeplan

        # Remove all log files
        log "Removing log files..."
        rm -rf /var/log/escapeplan

        # Remove all backup files
        log "Removing backup files..."
        rm -rf /var/backups/escapeplan

        # Remove nginx configuration
        log "Removing nginx configuration..."
        rm -f /etc/nginx/sites-enabled/escapeplan
        rm -f /etc/nginx/sites-available/escapeplan

        # Reload nginx if running
        if systemctl is-active nginx >/dev/null 2>&1; then
            log "Reloading nginx..."
            systemctl reload nginx 2>/dev/null || true
        fi

        # Remove system user and group
        log "Removing system user and group..."
        if id escapeplan >/dev/null 2>&1; then
            userdel escapeplan 2>/dev/null || true
        fi
        if getent group escapeplan >/dev/null 2>&1; then
            groupdel escapeplan 2>/dev/null || true
        fi

        # Remove temporary files
        log "Removing temporary files..."
        rm -f /tmp/escapeplan-*.log
        rm -f /var/log/escapeplan-install.log

        # Reload systemd daemon to clean up unit cache
        systemctl daemon-reload 2>/dev/null || true

        log "Purge complete - all EscapePlan data removed"
        ;;

    remove)
        log "Package removed - preserving configuration and data"

        # Clean up temporary files only
        rm -f /tmp/escapeplan-*.log

        # Reload systemd daemon
        systemctl daemon-reload 2>/dev/null || true

        log "Cleanup complete - configuration and data preserved"
        ;;

    upgrade|failed-upgrade|abort-install|abort-upgrade|disappear)
        log "Package operation: $1 - no cleanup required"
        ;;

    *)
        log_error "postrm called with unknown argument: $1"
        exit 1
        ;;
esac

#DEBHELPER#

exit 0
EOF

chmod 755 "${BUILD_DIR}/DEBIAN/postrm"

# Build .deb package
DEB_FILE="${DIST_DIR}/${PKG_NAME}_${VERSION}_${DEB_ARCH}.deb"
dpkg-deb --build "${BUILD_DIR}" "${DEB_FILE}"

echo "=========================================="
echo "✅ Build Complete!"
echo "=========================================="
echo "Package: ${DEB_FILE}"
echo "Architecture: ${DEB_ARCH} (cross-compiled from $(uname -m))"
echo "Size: $(du -h "${DEB_FILE}" | cut -f1)"
echo "=========================================="
