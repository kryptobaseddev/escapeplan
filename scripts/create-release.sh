#!/usr/bin/env bash
set -euo pipefail

# EscapePlan Release Creator
# Automates GitHub release creation with .deb package upload

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

echo "[RELEASE] Creating release v${VERSION}..."

# 1. Verify clean working directory
if ! git diff-index --quiet HEAD --; then
  echo "[ERROR] Working directory has uncommitted changes"
  echo "[ERROR] Please commit or stash changes before creating a release"
  exit 1
fi

# 2. Verify we're in the right directory
if [ ! -f "package.json" ]; then
  echo "[ERROR] Must run from escapeplan-app root directory"
  exit 1
fi

# 3. Update version in root package.json
echo "[RELEASE] Updating package.json version to ${VERSION}..."
# Use Node to update version (requires jq alternative or sed)
if command -v jq &> /dev/null; then
  jq ".version = \"${VERSION}\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
  # Fallback to sed
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
  rm -f package.json.bak
fi

# 4. Update version in app package.json files
for pkg_json in apps/*/package.json; do
  if [ -f "$pkg_json" ]; then
    echo "[RELEASE] Updating ${pkg_json}..."
    if command -v jq &> /dev/null; then
      jq ".version = \"${VERSION}\"" "$pkg_json" > "${pkg_json}.tmp" && mv "${pkg_json}.tmp" "$pkg_json"
    else
      sed -i.bak "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" "$pkg_json"
      rm -f "${pkg_json}.bak"
    fi
  fi
done

# 5. Create git tag
echo "[RELEASE] Creating git tag v${VERSION}..."
git add package.json apps/*/package.json 2>/dev/null || true
git commit -m "chore: bump version to ${VERSION}" || echo "[INFO] No version changes to commit"
git tag -a "v${VERSION}" -m "Release v${VERSION}"

# 6. Build the project
echo "[RELEASE] Building project..."
pnpm install
pnpm build

# 7. Build .deb package
echo "[RELEASE] Building .deb package..."
if [ ! -f "build/deb/build.sh" ]; then
  echo "[WARNING] .deb build script not found at build/deb/build.sh"
  echo "[WARNING] Skipping .deb package creation"
  DEB_FILE=""
else
  cd build/deb
  ./build.sh
  cd ../..
  DEB_FILE=$(find build/deb/output -name "escapeplan-app_*.deb" -type f | head -1)

  if [ -z "$DEB_FILE" ]; then
    echo "[WARNING] .deb package not found in build/deb/output/"
    echo "[WARNING] Continuing without .deb package"
  else
    echo "[RELEASE] .deb package created: $DEB_FILE"
  fi
fi

# 8. Create GitHub release via gh CLI
echo "[RELEASE] Creating GitHub release..."
if ! command -v gh &> /dev/null; then
  echo "[ERROR] GitHub CLI (gh) is not installed"
  echo "[ERROR] Install it from: https://cli.github.com/"
  exit 1
fi

# Check for CHANGELOG.md or create release notes
RELEASE_NOTES="Release v${VERSION}

## Changes
- See commit history for detailed changes

## Installation
Download the .deb package and install on your Raspberry Pi running EscapePlan OS.

\`\`\`bash
sudo dpkg -i escapeplan-app_${VERSION}_arm64.deb
sudo systemctl restart escapeplan-api escapeplan-web
\`\`\`

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)"

# Create release as draft
gh release create "v${VERSION}" \
  --title "EscapePlan v${VERSION}" \
  --notes "$RELEASE_NOTES" \
  --draft

# 9. Upload .deb package to release (if it exists)
if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
  echo "[RELEASE] Uploading .deb package to release..."
  gh release upload "v${VERSION}" "$DEB_FILE"
  echo "[RELEASE] ✅ .deb package uploaded"
fi

echo ""
echo "[RELEASE] ✅ Release v${VERSION} created successfully (draft)"
echo "[RELEASE] Review at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases"
echo ""
echo "Next steps:"
echo "1. Review the draft release on GitHub"
echo "2. Edit release notes if needed"
echo "3. Publish the release when ready"
echo "4. Push the tag: git push origin v${VERSION}"
