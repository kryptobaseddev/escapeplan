#!/usr/bin/env bash
# Verify OS and App versions are compatible

set -euo pipefail

# Check if VERSION_MANIFEST.json exists
if [ ! -f "VERSION_MANIFEST.json" ]; then
  echo "[ERROR] VERSION_MANIFEST.json not found"
  exit 1
fi

# Extract versions using jq or grep
if command -v jq &> /dev/null; then
  OS_VERSION=$(jq -r '.components.os.version' VERSION_MANIFEST.json)
  APP_VERSION=$(jq -r '.components.app.version' VERSION_MANIFEST.json)
  MIN_OS=$(jq -r '.compatibility.minOsVersion' VERSION_MANIFEST.json)
  MIN_APP=$(jq -r '.compatibility.minAppVersion' VERSION_MANIFEST.json)
else
  echo "[ERROR] jq is not installed. Please install jq to verify versions."
  exit 1
fi

echo "=================================="
echo "EscapePlan Version Verification"
echo "=================================="
echo ""
echo "OS Version:      $OS_VERSION"
echo "App Version:     $APP_VERSION"
echo "Min OS Version:  $MIN_OS"
echo "Min App Version: $MIN_APP"
echo ""

# Check if versions match
if [ "$OS_VERSION" != "$APP_VERSION" ]; then
  echo "[WARNING] ⚠️  Version mismatch detected!"
  echo "[WARNING] OS version ($OS_VERSION) does not match App version ($APP_VERSION)"
  echo "[WARNING] This may cause compatibility issues."
  echo ""
  exit 1
fi

echo "[OK] ✅ Versions synchronized: $OS_VERSION"
echo ""

# Check package.json version
if [ -f "package.json" ]; then
  PKG_VERSION=$(jq -r '.version' package.json)
  echo "Package.json version: $PKG_VERSION"

  if [ "$PKG_VERSION" != "$APP_VERSION" ]; then
    echo "[WARNING] ⚠️  package.json version ($PKG_VERSION) does not match manifest ($APP_VERSION)"
    echo ""
  else
    echo "[OK] ✅ package.json version matches manifest"
    echo ""
  fi
fi

echo "=================================="
echo "Version verification complete"
echo "=================================="
