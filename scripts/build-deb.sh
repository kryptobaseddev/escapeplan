#!/bin/bash
set -euo pipefail

# Get version from VERSION file
VERSION=$(cat VERSION | tr -d '\n')
ARCH="arm64"
PKG_NAME="escapeplan"
BUILD_DIR="build/deb"
DIST_DIR="dist"

echo "Building ${PKG_NAME} v${VERSION} for ${ARCH}..."

# Clean previous builds
rm -rf "${BUILD_DIR}" "${DIST_DIR}"
mkdir -p "${BUILD_DIR}/DEBIAN" "${DIST_DIR}"

# Create package structure
mkdir -p "${BUILD_DIR}/opt/escapeplan/api"
mkdir -p "${BUILD_DIR}/opt/escapeplan/web"
mkdir -p "${BUILD_DIR}/etc/systemd/system"
mkdir -p "${BUILD_DIR}/etc/escapeplan"

# Copy built API
cp -r apps/escapeplan-api/dist/* "${BUILD_DIR}/opt/escapeplan/api/"
cp -r apps/escapeplan-api/package.json "${BUILD_DIR}/opt/escapeplan/api/"
cp -r packages/contracts/dist "${BUILD_DIR}/opt/escapeplan/api/contracts"

# Copy built Web
cp -r apps/escapeplan-web/.svelte-kit "${BUILD_DIR}/opt/escapeplan/web/"
cp -r apps/escapeplan-web/package.json "${BUILD_DIR}/opt/escapeplan/web/"

# Create systemd service files
cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-api.service" << 'EOF'
[Unit]
Description=EscapePlan Fastify API
After=network.target

[Service]
Type=simple
User=escapeplan
Group=escapeplan
WorkingDirectory=/opt/escapeplan/api
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

cat > "${BUILD_DIR}/etc/systemd/system/escapeplan-web.service" << 'EOF'
[Unit]
Description=EscapePlan SvelteKit Web
After=escapeplan-api.service

[Service]
Type=simple
User=escapeplan
Group=escapeplan
WorkingDirectory=/opt/escapeplan/web
ExecStart=/usr/bin/node .svelte-kit/output/server/index.js
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Create control file
cat > "${BUILD_DIR}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 20), nginx, sqlite3
Maintainer: EscapePlan Team
Description: Offline-first escape room management system
 EscapePlan is a complete escape room management solution
 designed for Raspberry Pi deployments.
EOF

# Create postinst script
cat > "${BUILD_DIR}/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Create escapeplan user if doesn't exist
if ! id escapeplan &>/dev/null; then
    useradd -r -s /bin/false escapeplan
fi

# Set ownership
chown -R escapeplan:escapeplan /opt/escapeplan

# Install production dependencies
cd /opt/escapeplan/api && npm ci --production --ignore-scripts
cd /opt/escapeplan/web && npm ci --production --ignore-scripts

# Reload systemd
systemctl daemon-reload

# Enable services (but don't start - user must configure first)
systemctl enable escapeplan-api.service
systemctl enable escapeplan-web.service

echo "EscapePlan installed successfully!"
echo "Configure /etc/escapeplan/*.env then run:"
echo "  systemctl start escapeplan-api"
echo "  systemctl start escapeplan-web"
EOF

chmod 755 "${BUILD_DIR}/DEBIAN/postinst"

# Build .deb package
DEB_FILE="${DIST_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build "${BUILD_DIR}" "${DEB_FILE}"

echo "✅ Built: ${DEB_FILE}"
echo "📦 $(du -h ${DEB_FILE} | cut -f1)"
