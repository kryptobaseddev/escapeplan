# CI/CD Pipeline Architecture Design - EscapePlan

**Version:** 1.0
**Date:** 2025-10-04
**Status:** Design Phase
**Author:** System Architect

---

## Table of Contents

1. [Pipeline Architecture Overview](#1-pipeline-architecture-overview)
2. [CI Workflow Design (ci.yml)](#2-ci-workflow-design-ciyml)
3. [Release Workflow Design (release.yml)](#3-release-workflow-design-releaseyml)
4. [Publish Workflow Design (publish.yml)](#4-publish-workflow-design-publishyml)
5. [Caching Strategy](#5-caching-strategy)
6. [Security Scanning](#6-security-scanning)
7. [Build Optimization](#7-build-optimization)
8. [Error Handling](#8-error-handling)
9. [Environment Variables & Secrets](#9-environment-variables--secrets)
10. [Workflow File Specifications](#10-workflow-file-specifications)

---

## 1. Pipeline Architecture Overview

### Three-Workflow Design

EscapePlan's CI/CD pipeline consists of three distinct workflows orchestrated to ensure code quality, automated versioning, and production-ready releases:

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD PIPELINE FLOW                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│              │     │              │     │              │
│  CI WORKFLOW │────>│   RELEASE    │────>│   PUBLISH    │
│   (ci.yml)   │     │  (release.yml)│     │ (publish.yml)│
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
      │                     │                     │
      │                     │                     │
      v                     v                     v
  Run on PR            Version PR             Build .deb
  & push to            created by             & GitHub
  main/develop         Changesets             Release
```

### Workflow Responsibilities

| Workflow | Purpose | Triggers | Duration Target | Failure Impact |
|----------|---------|----------|-----------------|----------------|
| **CI** | Code quality gate | PR, push to main/develop | <8 min | Blocks PR merge |
| **Release** | Version management | Push to main (with changesets) | <2 min | Delays version PR |
| **Publish** | Distribution packaging | Manual or automated after Release | <10 min | Delays deployment |

### Workflow Trigger Conditions

```yaml
┌─────────────────────────────────────────────────────────────────┐
│ CI WORKFLOW TRIGGERS                                            │
├─────────────────────────────────────────────────────────────────┤
│ • pull_request: [main, develop]                                 │
│ • push: [main, develop]                                         │
│ • workflow_dispatch: (manual)                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RELEASE WORKFLOW TRIGGERS                                       │
├─────────────────────────────────────────────────────────────────┤
│ • push: main (only with changeset files)                        │
│ • workflow_dispatch: (manual version bump)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PUBLISH WORKFLOW TRIGGERS                                       │
├─────────────────────────────────────────────────────────────────┤
│ • workflow_run: release.yml completed + version PR merged       │
│ • workflow_dispatch: (manual release)                           │
│ • push: tags matching 'v*.*.*'                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Dependencies and Orchestration

```
Developer Flow:
─────────────────

1. Developer creates feature branch
   └─> Adds changeset: pnpm changeset add

2. Developer opens PR → CI runs
   ├─> Lint (all packages)
   ├─> Test (all packages)
   ├─> Build (contracts → api → web)
   └─> Changeset validation (must exist for features/fixes)

3. PR merged to main → Release runs
   ├─> Changesets Action checks for pending changesets
   ├─> If changesets exist:
   │   ├─> Creates/updates "Version Packages" PR
   │   └─> Updates VERSION file, package.json, CHANGELOG.md
   └─> If no changesets: workflow exits (no-op)

4. Maintainer reviews & merges Version PR → Publish runs
   ├─> Detects new git tag (created by Changesets)
   ├─> Runs full build pipeline
   ├─> Builds .deb package for arm64
   ├─> Creates GitHub Release with assets
   └─> Uploads checksums + .deb file
```

### Secret Management Approach

**Required GitHub Secrets:**
- `GITHUB_TOKEN` - Auto-provided for releases and PR creation
- (Future) `NPM_TOKEN` - If publishing internal packages to registry
- (Future) `SLACK_WEBHOOK` - For deployment notifications

**Security Principles:**
1. Use GitHub's built-in `GITHUB_TOKEN` (auto-injected, scoped permissions)
2. Never commit credentials to repository
3. Use environment protection rules for production releases
4. Limit workflow permissions to minimum required (`contents: write`, `pull-requests: write`)

---

## 2. CI Workflow Design (ci.yml)

### Purpose
Ensure code quality and correctness for every PR and main branch commit.

### Job Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CI JOB FLOW                               │
└──────────────────────────────────────────────────────────────────┘

        ┌─────────────────────────┐
        │  validate-changesets    │
        │  (if PR, check exists)  │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │      lint-and-test      │
        │   (matrix: 3 packages)  │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │    build-monorepo       │
        │ (contracts → api → web) │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   security-scan         │
        │   (npm audit, optional) │
        └─────────────────────────┘
```

### Job Specifications

#### Job 1: validate-changesets
**Purpose:** Ensure feature/fix PRs include changeset files
**Runs on:** PRs only
**Duration:** <30 seconds

**Steps:**
1. Checkout code
2. Check for `.changeset/*.md` files (exclude README.md)
3. If PR title contains `[skip-changeset]` or is labeled `dependencies`, allow skip
4. Fail if no changeset and PR modifies `apps/` or `packages/`

**Failure Handling:** Block PR merge, comment with instructions

---

#### Job 2: lint-and-test
**Purpose:** Parallel linting and testing across all packages
**Runs on:** All triggers
**Duration:** <5 minutes
**Matrix Strategy:**

```yaml
strategy:
  fail-fast: false
  matrix:
    package:
      - name: contracts
        path: packages/contracts
        lint: tsc --noEmit
        test: echo "No tests for contracts"

      - name: api
        path: apps/escapeplan-api
        lint: tsc --noEmit
        test: vitest run

      - name: web
        path: apps/escapeplan-web
        lint: svelte-check --tsconfig ./tsconfig.json
        test: vitest run
```

**Steps per matrix item:**
1. Setup pnpm (version 10.12.4)
2. Setup Node.js 24 LTS
3. Restore pnpm store cache (key: `pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`)
4. Install dependencies: `pnpm install --frozen-lockfile`
5. Run lint command for package
6. Run test command for package

**Parallel Execution:** All 3 packages run simultaneously

---

#### Job 3: build-monorepo
**Purpose:** Sequential build respecting dependency order
**Runs on:** All triggers
**Duration:** <4 minutes
**Depends on:** `lint-and-test`

**Build Order:**
```
contracts (30s) → api (90s) → web (120s)
```

**Steps:**
1. Restore pnpm cache
2. Install dependencies (frozen lockfile)
3. Build packages in order:
   ```bash
   pnpm --filter @escapeplan/contracts build
   pnpm --filter escapeplan-api build
   pnpm --filter escapeplan-web build
   ```
4. Upload build artifacts (for debugging):
   - `packages/contracts/dist`
   - `apps/escapeplan-api/dist`
   - `apps/escapeplan-web/.svelte-kit/output`

**Cache Strategy:** Share pnpm store across jobs

---

#### Job 4: security-scan (Optional)
**Purpose:** Identify vulnerable dependencies
**Runs on:** PRs and main pushes
**Duration:** <1 minute

**Steps:**
1. Run `pnpm audit --audit-level=high`
2. If vulnerabilities found:
   - Post PR comment with summary
   - Warn but don't fail (allow overrides)
3. Future: Integrate Dependabot for automated PRs

---

### Failure Handling

**Strategies:**
1. **fail-fast: false** for matrix jobs (continue even if one package fails)
2. **Retry logic:** Use `uses: nick-fields/retry@v2` for flaky network operations
3. **Notifications:** Post failure status to PR as comment
4. **Partial failures:** If only web tests fail, still show API status

**Exit Codes:**
- Lint failures: Block merge
- Test failures: Block merge
- Build failures: Block merge
- Security scan: Warn only (allow manual override)

---

## 3. Release Workflow Design (release.yml)

### Purpose
Automate semantic versioning and changelog generation using Changesets.

### Changesets Action Integration

**How Changesets Work:**
1. Developers run `pnpm changeset add` to create `.changeset/random-name.md`
2. Changeset file specifies:
   - Which packages are affected
   - Semver bump type (major/minor/patch)
   - Description for changelog
3. On merge to main, Changesets Action:
   - Consumes all pending changesets
   - Bumps package.json versions
   - Updates CHANGELOG.md
   - Creates/updates "Version Packages" PR
4. When Version PR merges:
   - Creates git tags (e.g., `v0.2.0`)
   - Triggers Publish workflow

### Job Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     RELEASE JOB FLOW                             │
└──────────────────────────────────────────────────────────────────┘

        ┌─────────────────────────┐
        │   check-changesets      │
        │ (any .changeset/*.md?)  │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   create-version-pr     │
        │ (Changesets Action)     │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   sync-version-file     │
        │   (update VERSION)      │
        └─────────────────────────┘
```

### Job Specifications

#### Job 1: create-release-pr
**Purpose:** Create/update Version Packages PR
**Runs on:** Push to main (only if changesets exist)
**Duration:** <2 minutes

**Steps:**
1. Checkout code with full history: `fetch-depth: 0`
2. Setup pnpm 10.12.4
3. Setup Node.js 24
4. Install dependencies
5. Run Changesets Action:
   ```yaml
   - uses: changesets/action@v1
     with:
       version: pnpm changeset:version
       commit: "chore: version packages"
       title: "chore: version packages"
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```
6. Sync VERSION file script (see below)

---

### Version PR Creation Logic

**Changesets Action Behavior:**
- **If pending changesets exist:**
  - Creates PR branch: `changeset-release/main`
  - Updates `package.json` versions for affected packages
  - Generates/appends to `CHANGELOG.md`
  - Creates PR titled "chore: version packages"

- **If no changesets:**
  - No-op (workflow exits early)

**VERSION File Sync Integration:**
After Changesets runs, custom script syncs `VERSION` file:

```bash
#!/bin/bash
# scripts/sync-version.sh
# Read version from root package.json
VERSION=$(node -p "require('./package.json').version")

# Update VERSION file
echo "${VERSION}" > VERSION

# Commit if changed
if [[ $(git diff VERSION) ]]; then
  git add VERSION
  git commit --amend --no-edit
  git push --force-with-lease
fi
```

**Integration Point:**
```yaml
- name: Sync VERSION file
  if: steps.changesets.outputs.hasChangesets == 'true'
  run: |
    chmod +x scripts/sync-version.sh
    ./scripts/sync-version.sh
```

---

### Changeset Consumption Process

**Step-by-step:**
1. Changesets Action reads all `.changeset/*.md` files
2. Determines which packages to bump based on dependencies
3. Bumps versions according to semver rules:
   - `major`: Breaking changes (0.1.0 → 1.0.0)
   - `minor`: New features (0.1.0 → 0.2.0)
   - `patch`: Bug fixes (0.1.0 → 0.1.1)
4. Deletes consumed changeset files
5. Updates `CHANGELOG.md` with grouped entries
6. Commits changes to PR branch

**Example Changeset File:**
```markdown
---
"@escapeplan/contracts": patch
"escapeplan-api": minor
---

Add support for custom camera RTSP profiles
```

**Resulting CHANGELOG.md Entry:**
```markdown
## 0.2.0 - 2025-10-04

### Minor Changes

- escapeplan-api: Add support for custom camera RTSP profiles

### Patch Changes

- @escapeplan/contracts: Update schema for camera profiles
```

---

### When to Trigger Publish Workflow

**Automatic Trigger:**
Publish workflow watches for completion of Release workflow:

```yaml
# publish.yml
on:
  workflow_run:
    workflows: ["Release"]
    types: [completed]
    branches: [main]
```

**Conditions for Publish:**
1. Release workflow succeeded
2. New git tag was created (detected via `git describe --tags`)
3. Tag matches semver pattern `v*.*.*`

**Manual Override:**
```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., v0.2.0)'
        required: true
```

---

## 4. Publish Workflow Design (publish.yml)

### Purpose
Build production-ready .deb package and create GitHub Release for Raspberry Pi deployment.

### Job Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     PUBLISH JOB FLOW                             │
└──────────────────────────────────────────────────────────────────┘

        ┌─────────────────────────┐
        │   build-artifacts       │
        │  (all packages built)   │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   package-deb           │
        │ (run build-deb.sh)      │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   generate-checksums    │
        │   (SHA256 .deb file)    │
        └────────────┬────────────┘
                     │
                     v
        ┌─────────────────────────┐
        │   create-github-release │
        │  (upload assets + notes)│
        └─────────────────────────┘
```

### Job Specifications

#### Job 1: build-and-publish
**Purpose:** Full production build + distribution
**Runs on:** ubuntu-latest (cross-compile for arm64)
**Duration:** <10 minutes
**Depends on:** Release workflow completion or manual trigger

**Steps:**

**1. Checkout and Setup (1 min)**
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history for tag detection

- uses: pnpm/action-setup@v4
  with:
    version: 10.12.4

- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'pnpm'
```

**2. Install and Build (4 min)**
```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Build all packages
  run: pnpm run build
  # Executes: pnpm -r run build
  # Order: contracts → api → web
```

**3. Run Tests (3 min)**
```yaml
- name: Run test suite
  run: pnpm run test
```

**4. Build .deb Package (1 min)**
```yaml
- name: Build Debian package
  run: |
    chmod +x scripts/build-deb.sh
    ./scripts/build-deb.sh
  # Outputs: dist/escapeplan_<version>_arm64.deb
```

**5. Generate Checksums (10 sec)**
```yaml
- name: Generate checksums
  run: |
    cd dist
    sha256sum escapeplan_*.deb > SHA256SUMS
    cat SHA256SUMS
```

**6. Create GitHub Release (30 sec)**
```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    files: |
      dist/escapeplan_*.deb
      dist/SHA256SUMS
    generate_release_notes: true
    draft: false
    prerelease: false
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### .deb Package Build Process

**build-deb.sh Execution Flow:**

1. **Extract Version:** Read from `package.json` (synced via VERSION file)
2. **Create Package Structure:**
   ```
   build/deb/
   ├── DEBIAN/
   │   ├── control
   │   └── postinst
   ├── opt/escapeplan/
   │   ├── api/
   │   │   ├── dist/
   │   │   ├── package.json
   │   │   └── contracts/
   │   └── web/
   │       ├── .svelte-kit/
   │       └── package.json
   └── etc/systemd/system/
       ├── escapeplan-api.service
       └── escapeplan-web.service
   ```

3. **Copy Built Assets:**
   - API: `apps/escapeplan-api/dist/*`
   - Web: `apps/escapeplan-web/.svelte-kit/*`
   - Contracts: `packages/contracts/dist/*`

4. **Generate Metadata:**
   - Control file with version, dependencies (nodejs ≥20, nginx, sqlite3)
   - Postinst script for user creation, systemd enablement

5. **Build Package:** `dpkg-deb --build build/deb dist/escapeplan_<version>_arm64.deb`

**Package Size Estimate:** ~50-80 MB (includes SvelteKit static assets)

---

### GitHub Release Creation

**Release Notes Generation:**

Changesets provides automatic notes via `CHANGELOG.md` parsing. GitHub's `generate_release_notes` creates summary from commits.

**Custom Release Notes Template:**
```markdown
## EscapePlan v{version}

### What's Changed
{auto_generated_notes}

### Installation
Download `escapeplan_{version}_arm64.deb` and verify checksum:

```bash
sha256sum -c SHA256SUMS
sudo dpkg -i escapeplan_{version}_arm64.deb
```

### Full Changelog
See [CHANGELOG.md](./CHANGELOG.md)
```

**Asset Upload:**
- Primary: `escapeplan_0.2.0_arm64.deb`
- Checksums: `SHA256SUMS`
- (Future) Release notes PDF, migration guide

---

### Tag Creation Strategy

**Tag Naming Convention:**
- Format: `v<major>.<minor>.<patch>` (e.g., `v0.2.0`)
- Created automatically by Changesets when Version PR merges
- Annotated tags with message: "Release v0.2.0"

**Tag Lifecycle:**
1. Changesets Action creates tag after bumping versions
2. Tag pushed to origin triggers Publish workflow
3. GitHub Release associates assets with tag
4. Tag serves as deployment reference for Pi installations

**Pre-release Tags:**
- Format: `v0.2.0-beta.1`
- Triggered by changesets with `prerelease: beta` mode
- Marked as pre-release in GitHub UI

---

## 5. Caching Strategy

### pnpm Store Caching

**Cache Key Strategy:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'pnpm'  # Auto-detects pnpm-lock.yaml
```

**Manual Cache Configuration (Advanced):**
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.local/share/pnpm/store
    key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      pnpm-store-${{ runner.os }}-
```

**Lockfile v9+ Compatibility:**
pnpm 10.12.4 uses lockfile v9.1 format. GitHub Actions cache handles this natively.

**Cache Hit Scenarios:**
- **Full Hit:** Lockfile unchanged → restore entire store (~200MB)
- **Partial Hit:** Lockfile changed → restore base, fetch diffs
- **Miss:** First run or cache expired → full download

**Cache Invalidation:**
- Automatic: `pnpm-lock.yaml` changes
- Manual: Workflow dispatch with `cache: false` input
- Time-based: 7-day expiration (GitHub default)

---

### Node Modules Caching

**Not Used** - pnpm's content-addressable store makes `node_modules` caching redundant.

**Rationale:**
- pnpm links packages from global store (symlinks)
- Caching `node_modules` duplicates store cache
- Store cache + `pnpm install` faster than extracting cached `node_modules`

---

### Build Artifact Caching

**Use Cases:**
1. Share build outputs between jobs (CI → Publish)
2. Debug failed builds
3. Pre-release testing

**Implementation:**
```yaml
# CI job
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-outputs
    path: |
      packages/*/dist
      apps/*/dist
      apps/*/.svelte-kit
    retention-days: 7

# Publish job
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-outputs
```

**Optimization:**
Only upload on main branch pushes, not PRs (saves storage).

---

### Turborepo Caching (Future Enhancement)

**Current State:** Not implemented
**Benefit:** Skip unchanged package builds

**Implementation Plan:**
1. Add `turbo.json` to root:
   ```json
   {
     "pipeline": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**"]
       }
     }
   }
   ```

2. Modify build command: `turbo run build --cache-dir=.turbo`
3. Cache `.turbo` directory in workflow

**Expected Improvement:**
- PR builds: 4 min → 2 min (50% reduction if only 1 package changed)
- Main builds: Always full (no cache on version bumps)

---

## 6. Security Scanning

### Dependabot Configuration

**File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  # pnpm workspace dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      # Group minor/patch updates
      production:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
    reviewers:
      - "kryptobaseddev"
    labels:
      - "dependencies"
      - "automated"

  # GitHub Actions updates
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Behavior:**
- Weekly scans for outdated dependencies
- Groups non-major updates into single PR
- Auto-labels for CI skip (no changeset required)

---

### npm audit Integration

**CI Workflow Integration:**
```yaml
- name: Audit dependencies
  run: pnpm audit --audit-level=high --json > audit-report.json || true

- name: Parse audit results
  id: audit
  run: |
    VULN_COUNT=$(cat audit-report.json | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical')
    echo "vulnerabilities=$VULN_COUNT" >> $GITHUB_OUTPUT

- name: Comment on PR
  if: steps.audit.outputs.vulnerabilities > 0
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `⚠️ Security Audit: ${process.env.VULN_COUNT} high/critical vulnerabilities found. Review \`pnpm audit\` output.`
      })
```

**Policy:**
- High/Critical vulnerabilities: Warn (don't block)
- Rationale: Many false positives in dev dependencies
- Action: Manual review + fix or suppress

---

### CodeQL Setup (Optional)

**Purpose:** Static analysis for TypeScript/JavaScript security issues

**Implementation:**
```yaml
# .github/workflows/codeql.yml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Monday 6am

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript

      - uses: github/codeql-action/autobuild@v3

      - uses: github/codeql-action/analyze@v3
```

**Findings:** Reported to Security tab, not blocking

---

### SAST Tools Evaluation

**Considered Tools:**

| Tool | Pros | Cons | Recommendation |
|------|------|------|----------------|
| **ESLint** | Fast, existing config | Limited security rules | Already in use |
| **CodeQL** | Deep analysis, GitHub native | Slow (5-10 min) | Optional weekly scan |
| **Snyk** | Excellent dependency scanning | Requires account | Consider for production |
| **Semgrep** | Fast, customizable rules | Learning curve | Future enhancement |

**Decision:** Start with npm audit + Dependabot, add CodeQL if security incidents increase.

---

## 7. Build Optimization

### Parallel Job Execution

**Current CI Jobs:**
```
validate-changesets  ─────┐
                           ├─> build-monorepo ──> (complete)
lint-and-test (matrix) ───┘
```

**Optimization:**
- Matrix jobs run in parallel (3 containers)
- `fail-fast: false` ensures all packages tested even if one fails
- Total time = slowest job (web tests ~3 min)

---

### Workspace Dependency Handling

**Build Order Enforcement:**

**Method 1: pnpm Recursive (Current)**
```bash
pnpm -r run build
```
- pnpm automatically resolves dependency order
- Builds contracts first (no dependencies)
- Then api and web (depend on contracts)

**Method 2: Explicit Sequential (Safer)**
```bash
pnpm --filter @escapeplan/contracts build && \
pnpm --filter escapeplan-api build && \
pnpm --filter escapeplan-web build
```

**Recommendation:** Use Method 2 in CI for explicit control

---

### Build Order Rationale

**Dependency Graph:**
```
@escapeplan/contracts
    ├── escapeplan-api (workspace:*)
    └── escapeplan-web (workspace:*)
```

**Why Sequential:**
1. API and web import types from `@escapeplan/contracts/dist`
2. TypeScript compilation fails if contracts not built first
3. pnpm workspace links resolve to `dist/` exports

**Timing:**
- Contracts: 30s (TypeScript only, no bundling)
- API: 90s (tsup bundles with dependencies)
- Web: 120s (Vite builds SSR + static assets)

**Total Sequential:** ~4 minutes
**Potential Parallel (api + web):** ~2.5 minutes (requires pre-built contracts)

---

### Incremental Builds Approach

**Current:** Full rebuilds on every CI run
**Problem:** Wasteful for PRs touching only one package

**Solution: Turborepo Integration**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".svelte-kit/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true
    },
    "lint": {
      "cache": true
    }
  }
}
```

**Workflow Change:**
```yaml
- name: Build changed packages
  run: npx turbo run build --filter="...[origin/main]"
```

**Expected Improvement:**
- PR touching only web: Skip contracts + api builds (save 2 min)
- PR touching contracts: Rebuild all (no savings)

**Implementation:** Phase 2 enhancement (not blocking initial release)

---

## 8. Error Handling

### Failure Notification Strategy

**In-Workflow Notifications:**
```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const title = `❌ CI Failed: ${{ github.workflow }}`
      const body = `
      **Job:** ${{ github.job }}
      **Commit:** ${{ github.sha }}
      **Logs:** ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
      `

      if (context.eventName === 'pull_request') {
        github.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: body
        })
      }
```

**External Notifications (Future):**
- Slack webhook for main branch failures
- Email digest for security scan results

---

### Retry Logic for Flaky Tests

**Problem:** Network-dependent tests (Socket.IO, external services) occasionally timeout

**Solution: Retry Action**
```yaml
- name: Run tests with retry
  uses: nick-fields/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: pnpm run test
    retry_on: error
```

**Alternative: Vitest Retry Config**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: process.env.CI ? 2 : 0  // Retry in CI only
  }
})
```

**Recommendation:** Use Vitest native retry for granular control

---

### Partial Failure Handling

**Scenario:** Lint passes, tests fail in web package only

**Current Behavior:** Entire CI fails (correct for merge blocking)

**Enhancement: Report Matrix Failures**
```yaml
- name: Report matrix status
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const results = {
        contracts: '${{ needs.lint-and-test.result }}',
        api: '${{ needs.lint-and-test.result }}',
        web: '${{ needs.lint-and-test.result }}'
      }

      let summary = '### Test Results\n'
      for (const [pkg, status] of Object.entries(results)) {
        const icon = status === 'success' ? '✅' : '❌'
        summary += `${icon} ${pkg}: ${status}\n`
      }

      core.summary.addRaw(summary).write()
```

**Benefits:**
- Clear visibility which packages failed
- Helps prioritize fixes

---

### Emergency Workflow Cancellation

**Scenario:** Pushed 5 commits rapidly, don't need all CI runs

**GitHub Feature:** Auto-cancellation
```yaml
# ci.yml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Behavior:**
- New push to same PR/branch cancels previous run
- Saves compute time for outdated commits

**Caution:** Don't use for main branch (need complete history)

---

## 9. Environment Variables & Secrets

### Required Secrets List

| Secret Name | Purpose | Scope | Auto-provided? |
|-------------|---------|-------|----------------|
| `GITHUB_TOKEN` | Create releases, PRs | All workflows | Yes |
| `NPM_TOKEN` | Publish to registry (future) | Publish | No |
| `SLACK_WEBHOOK` | Failure notifications (future) | CI/Release | No |

**Setup:**
1. `GITHUB_TOKEN` - No action needed (auto-injected)
2. Manual secrets: Settings → Secrets and variables → Actions → New repository secret

---

### Environment Variable Management

**Workflow-level Variables:**
```yaml
env:
  NODE_ENV: production
  PNPM_VERSION: 10.12.4
  NODE_VERSION: 24
```

**Job-level Variables:**
```yaml
jobs:
  build:
    env:
      BUILD_TARGET: arm64
```

**Step-level Variables:**
```yaml
- name: Build
  env:
    CUSTOM_FLAG: true
  run: pnpm build
```

---

### Production vs Staging Configuration

**Current State:** Single production path (main branch)

**Future: Multi-Environment**

```yaml
# release.yml (staging)
on:
  push:
    branches: [develop]

env:
  ENVIRONMENT: staging
  API_URL: https://staging-api.escapeplan.local

# release.yml (production)
on:
  push:
    branches: [main]

env:
  ENVIRONMENT: production
  API_URL: https://api.escapeplan.local
```

**Environment Protection Rules:**
Settings → Environments → New environment → "production"
- Required reviewers: kryptobaseddev
- Deployment branches: main only
- Secrets scoped to environment

---

## 10. Workflow File Specifications

### Complete ci.yml Structure

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  PNPM_VERSION: 10.12.4
  NODE_VERSION: 24

jobs:
  # ────────────────────────────────────────────────────────────
  # JOB 1: Validate changesets (PRs only)
  # ────────────────────────────────────────────────────────────
  validate-changesets:
    name: Validate Changesets
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for changesets
        id: check
        run: |
          # Skip if PR labeled 'dependencies' or title contains [skip-changeset]
          if [[ "${{ contains(github.event.pull_request.labels.*.name, 'dependencies') }}" == "true" ]] || \
             [[ "${{ github.event.pull_request.title }}" =~ \[skip-changeset\] ]]; then
            echo "skip=true" >> $GITHUB_OUTPUT
            exit 0
          fi

          # Check for changeset files (exclude README)
          if ls .changeset/*.md 2>/dev/null | grep -v README.md; then
            echo "skip=false" >> $GITHUB_OUTPUT
          else
            echo "::error::No changeset found. Run 'pnpm changeset add' or add [skip-changeset] to PR title"
            exit 1
          fi

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `❌ **Changeset Required**\n\nPlease run \`pnpm changeset add\` to document this change, or add \`[skip-changeset]\` to the PR title if not needed.`
            })

  # ────────────────────────────────────────────────────────────
  # JOB 2: Lint and test (matrix across packages)
  # ────────────────────────────────────────────────────────────
  lint-and-test:
    name: Lint & Test (${{ matrix.package }})
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        package:
          - contracts
          - api
          - web
        include:
          - package: contracts
            path: packages/contracts
            lint_cmd: pnpm --filter @escapeplan/contracts run lint
            test_cmd: echo "No tests for contracts"

          - package: api
            path: apps/escapeplan-api
            lint_cmd: pnpm --filter escapeplan-api run lint
            test_cmd: pnpm --filter escapeplan-api run test

          - package: web
            path: apps/escapeplan-web
            lint_cmd: pnpm --filter escapeplan-web run check
            test_cmd: pnpm --filter escapeplan-web run test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint ${{ matrix.package }}
        run: ${{ matrix.lint_cmd }}

      - name: Test ${{ matrix.package }}
        run: ${{ matrix.test_cmd }}

  # ────────────────────────────────────────────────────────────
  # JOB 3: Build monorepo (sequential dependency order)
  # ────────────────────────────────────────────────────────────
  build:
    name: Build Monorepo
    runs-on: ubuntu-latest
    needs: [lint-and-test]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build contracts
        run: pnpm --filter @escapeplan/contracts build

      - name: Build API
        run: pnpm --filter escapeplan-api build

      - name: Build Web
        run: pnpm --filter escapeplan-web build

      - name: Upload build artifacts
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: build-outputs
          path: |
            packages/contracts/dist
            apps/escapeplan-api/dist
            apps/escapeplan-web/.svelte-kit/output
          retention-days: 7

  # ────────────────────────────────────────────────────────────
  # JOB 4: Security audit (non-blocking)
  # ────────────────────────────────────────────────────────────
  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Run audit
        run: |
          pnpm audit --audit-level=high --json > audit-report.json || true

      - name: Parse results
        id: audit
        run: |
          if [ -f audit-report.json ]; then
            VULN_COUNT=$(cat audit-report.json | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical // 0')
            echo "vulnerabilities=$VULN_COUNT" >> $GITHUB_OUTPUT
          fi

      - name: Comment on PR
        if: steps.audit.outputs.vulnerabilities > 0
        uses: actions/github-script@v7
        with:
          script: |
            const vulns = '${{ steps.audit.outputs.vulnerabilities }}'
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `⚠️ **Security Audit:** ${vulns} high/critical vulnerabilities found. Run \`pnpm audit\` locally for details.`
            })

  # ────────────────────────────────────────────────────────────
  # SUMMARY: Post overall status
  # ────────────────────────────────────────────────────────────
  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [lint-and-test, build]
    if: always()

    steps:
      - name: Generate summary
        uses: actions/github-script@v7
        with:
          script: |
            const lintResult = '${{ needs.lint-and-test.result }}'
            const buildResult = '${{ needs.build.result }}'

            let summary = '## CI Results\n\n'
            summary += `- Lint & Test: ${lintResult === 'success' ? '✅' : '❌'} ${lintResult}\n`
            summary += `- Build: ${buildResult === 'success' ? '✅' : '❌'} ${buildResult}\n`

            core.summary.addRaw(summary).write()
```

**Estimated Execution Time:**
- validate-changesets: 30s
- lint-and-test (parallel): 4 min
- build: 4 min
- security-audit (parallel): 1 min
- **Total:** ~7-8 minutes

---

### Complete release.yml Structure

```yaml
name: Release

on:
  push:
    branches: [main]
    paths:
      - '.changeset/**'
      - 'apps/**'
      - 'packages/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

env:
  PNPM_VERSION: 10.12.4
  NODE_VERSION: 24

jobs:
  # ────────────────────────────────────────────────────────────
  # JOB: Create/update version PR via Changesets
  # ────────────────────────────────────────────────────────────
  release:
    name: Create Release PR
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create Release Pull Request
        id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Sync VERSION file
        if: steps.changesets.outputs.hasChangesets == 'true'
        run: |
          # Extract version from root package.json
          VERSION=$(node -p "require('./package.json').version")
          echo "Syncing VERSION file to: $VERSION"
          echo "$VERSION" > VERSION

          # Commit if changed
          if [[ $(git diff VERSION) ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add VERSION
            git commit --amend --no-edit
            git push --force-with-lease
          fi

      - name: Output release info
        if: steps.changesets.outputs.hasChangesets == 'true'
        run: |
          echo "::notice::Release PR created/updated. Review and merge to trigger publish workflow."
```

**Estimated Execution Time:** 1-2 minutes

---

### Complete publish.yml Structure

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., v0.2.0)'
        required: true
        type: string

permissions:
  contents: write
  packages: write

env:
  PNPM_VERSION: 10.12.4
  NODE_VERSION: 24

jobs:
  # ────────────────────────────────────────────────────────────
  # JOB: Build .deb package and create GitHub Release
  # ────────────────────────────────────────────────────────────
  build-and-publish:
    name: Build & Publish
    runs-on: ubuntu-latest

    steps:
      # ──────────────────────────────────────────────────────
      # Setup
      # ──────────────────────────────────────────────────────
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      # ──────────────────────────────────────────────────────
      # Build
      # ──────────────────────────────────────────────────────
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: |
          pnpm --filter @escapeplan/contracts build
          pnpm --filter escapeplan-api build
          pnpm --filter escapeplan-web build

      - name: Run tests
        run: pnpm run test

      # ──────────────────────────────────────────────────────
      # Package
      # ──────────────────────────────────────────────────────
      - name: Build Debian package
        run: |
          chmod +x scripts/build-deb.sh
          ./scripts/build-deb.sh

      - name: Generate checksums
        run: |
          cd dist
          sha256sum escapeplan_*.deb > SHA256SUMS
          cat SHA256SUMS

      # ──────────────────────────────────────────────────────
      # Release
      # ──────────────────────────────────────────────────────
      - name: Extract version
        id: version
        run: |
          if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
            VERSION="${{ github.event.inputs.version }}"
          else
            VERSION="${GITHUB_REF#refs/tags/}"
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Releasing version: $VERSION"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.version }}
          name: EscapePlan ${{ steps.version.outputs.version }}
          body: |
            ## Installation

            Download `escapeplan_${{ steps.version.outputs.version }}_arm64.deb` and verify:

            ```bash
            sha256sum -c SHA256SUMS
            sudo dpkg -i escapeplan_${{ steps.version.outputs.version }}_arm64.deb
            ```

            See [CHANGELOG.md](./CHANGELOG.md) for full details.
          files: |
            dist/escapeplan_*.deb
            dist/SHA256SUMS
          generate_release_notes: true
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # ──────────────────────────────────────────────────────
      # Artifacts
      # ──────────────────────────────────────────────────────
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: debian-package-${{ steps.version.outputs.version }}
          path: |
            dist/escapeplan_*.deb
            dist/SHA256SUMS
          retention-days: 90
```

**Estimated Execution Time:** 8-10 minutes

---

### Shared Workflow Components

**Reusable Setup Action (Future)**

```yaml
# .github/actions/setup-workspace/action.yml
name: Setup Workspace
description: Setup pnpm + Node.js + install dependencies

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '24'
  pnpm-version:
    description: 'pnpm version'
    required: false
    default: '10.12.4'

runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
      with:
        version: ${{ inputs.pnpm-version }}

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'pnpm'

    - shell: bash
      run: pnpm install --frozen-lockfile
```

**Usage in workflows:**
```yaml
- uses: ./.github/actions/setup-workspace
  with:
    node-version: 24
```

**Benefits:**
- DRY principle (reduce duplication)
- Single source of truth for setup steps
- Easier to maintain version updates

---

## Workflow Diagrams

### Complete Pipeline Flow (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    ESCAPEPLAN CI/CD PIPELINE                               │
│                         (End-to-End Flow)                                  │
└────────────────────────────────────────────────────────────────────────────┘

Developer Actions                Automated Workflows              Artifacts
═══════════════════              ════════════════════             ═════════

1. Create feature branch
   │
   ├─> Add changeset
   │   (pnpm changeset add)
   │
   └─> Open Pull Request ────────> [CI WORKFLOW]
                                    ├─> Validate changeset
                                    ├─> Lint (matrix: 3 pkgs)
                                    ├─> Test (matrix: 3 pkgs)
                                    ├─> Build (sequential)
                                    └─> Security audit
                                          │
                                          ├─ PASS ──> Ready to merge
                                          └─ FAIL ──> Block merge

2. Merge PR to main ─────────────> [RELEASE WORKFLOW]
                                    ├─> Detect changesets
                                    ├─> Consume changesets
                                    ├─> Bump versions
                                    ├─> Update CHANGELOG.md
                                    ├─> Sync VERSION file
                                    └─> Create "Version Packages" PR
                                          │
                                          └─> Awaits approval

3. Review & merge Version PR ────> [PUBLISH WORKFLOW]    ┌─────────────────┐
                                    ├─> Git tag created   │ GitHub Release  │
                                    ├─> Build packages    │ ├─ .deb package │
                                    ├─> Run tests         │ ├─ SHA256SUMS   │
                                    ├─> Build .deb (arm64)│ └─ Release notes│
                                    ├─> Generate checksums└─────────────────┘
                                    └─> Create Release
                                          │
                                          └─> Deployment ready

4. Deploy to Raspberry Pi ────────> Manual step
   │                                 (Download .deb, dpkg -i)
   └─> Verify deployment
```

---

### Trigger Condition Table

| Event | Branch | Condition | Triggered Workflows | Approx Duration |
|-------|--------|-----------|---------------------|-----------------|
| PR opened | any → main/develop | Always | CI | 7 min |
| PR updated | any → main/develop | New commits | CI (cancel previous) | 7 min |
| Push to develop | develop | Direct push | CI | 7 min |
| Push to main | main | No changesets | CI only | 7 min |
| Push to main | main | Changesets exist | CI + Release | 9 min |
| Version PR merged | main | Tag created | Publish | 10 min |
| Manual trigger | N/A | workflow_dispatch | Any (based on workflow) | Varies |
| Tag pushed | main | v*.*.* pattern | Publish | 10 min |

---

### Cache Key Strategies

**pnpm Store Cache:**
```
Key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
Path: ~/.local/share/pnpm/store

Restore Keys:
  1. pnpm-store-Linux-<lockfile-hash>     (exact match)
  2. pnpm-store-Linux-                    (partial match)
```

**Build Artifact Cache:**
```
Key: build-${{ github.sha }}
Path:
  - packages/*/dist
  - apps/*/dist
  - apps/*/.svelte-kit

No restore keys (unique per commit)
```

**Turbo Cache (Future):**
```
Key: turbo-${{ runner.os }}-${{ github.sha }}
Path: .turbo

Restore Keys:
  1. turbo-${{ runner.os }}-${{ github.sha }}
  2. turbo-${{ runner.os }}-
```

---

### Estimated Pipeline Execution Times

**Development Branch PR:**
```
Total: ~7 minutes

├─ validate-changesets:    30s   ────┐
├─ lint-and-test:         4m 00s ────┤ (parallel)
├─ security-audit:        1m 00s ────┘
└─ build:                 4m 00s (after lint-and-test)

Timeline: 30s → 4m (parallel) → 4m (build) = ~8.5m total
```

**Main Branch Push (with changesets):**
```
Total: ~9 minutes

├─ CI workflow:           7m 00s
└─ Release workflow:      2m 00s (after CI)

Timeline: 7m (CI) → 2m (Release) = 9m total
```

**Publish (after Version PR merge):**
```
Total: ~10 minutes

├─ Install & build:       4m 00s
├─ Run tests:             3m 00s
├─ Build .deb:            1m 30s
├─ Generate checksums:    10s
└─ Create release:        30s

Timeline: 10m total (sequential)
```

**Monthly Maintenance:**
```
Dependabot PRs:          ~10/month × 7m = 70 CPU minutes
Security scans:          4 × 1m = 4 CPU minutes
Manual releases:         2 × 10m = 20 CPU minutes

Total: ~94 CPU minutes/month (~1.6 hours)
```

---

### Resource Usage Estimates

**GitHub Actions Free Tier:**
- 2,000 minutes/month (public repos: unlimited)
- Private repos: metered

**EscapePlan Projected Usage (Public Repo):**
| Activity | Frequency | Duration | Monthly Cost |
|----------|-----------|----------|--------------|
| PR CI runs | 20 PRs | 7m each | Free |
| Main pushes | 40 commits | 7m each | Free |
| Releases | 4 releases | 10m each | Free |
| Dependabot | 10 PRs | 7m each | Free |
| **Total** | - | - | **$0/month** |

**Storage (Artifacts + Cache):**
- Build artifacts: 7 days retention × ~100 MB = 700 MB avg
- pnpm cache: ~200 MB (persistent)
- Turbo cache: ~500 MB (if implemented)
- **Total:** <2 GB (Free tier: 500 MB, overage: $0.25/GB)

**Estimated Monthly Cost:** $0 (public repo) or $0.50 (if private + caching)

---

## Implementation Checklist

### Phase 1: Basic CI/CD (Week 1)
- [ ] Initialize Changesets: `pnpm add -Dw @changesets/cli && pnpm changeset init`
- [ ] Create `.github/workflows/ci.yml` (basic version: lint + test + build)
- [ ] Create `.github/workflows/release.yml` (Changesets integration)
- [ ] Create `.github/workflows/publish.yml` (manual trigger only)
- [ ] Test CI on sample PR
- [ ] Test Release workflow on main branch with changeset
- [ ] Manually trigger Publish workflow, verify .deb creation

### Phase 2: Enhancements (Week 2)
- [ ] Add changeset validation to CI (enforce on PRs)
- [ ] Implement security audit job
- [ ] Add workflow concurrency cancellation
- [ ] Configure Dependabot for weekly scans
- [ ] Add failure notification comments on PRs
- [ ] Test full flow: feature → PR → merge → release → publish

### Phase 3: Optimizations (Week 3)
- [ ] Implement Turborepo for incremental builds
- [ ] Add job summaries with status tables
- [ ] Configure environment protection rules for production
- [ ] Add retry logic for flaky tests
- [ ] Optimize cache keys for faster restores
- [ ] Document runbook for manual release process

### Phase 4: Monitoring (Week 4)
- [ ] Set up Slack notifications for failures
- [ ] Create dashboard for CI metrics (GitHub Insights)
- [ ] Implement CodeQL weekly scans
- [ ] Add performance benchmarks to CI
- [ ] Document SLAs for pipeline (e.g., 95% success rate)

---

## Rollout Plan

### Stage 1: Shadow Mode (1 week)
- Deploy workflows to feature branch
- Run CI on sample PRs without blocking
- Validate .deb package builds correctly on Ubuntu
- Test manual release process end-to-end

### Stage 2: CI Enforcement (1 week)
- Merge workflows to main branch
- Enable required status checks: CI must pass before merge
- Train team on changeset workflow (`pnpm changeset add`)
- Monitor for false positives in security scans

### Stage 3: Automated Releases (1 week)
- Transition from manual tags to Changesets-managed versions
- Perform first automated release (0.2.0)
- Verify .deb package installs on Raspberry Pi test device
- Document rollback procedures

### Stage 4: Full Production (Ongoing)
- All releases flow through CI/CD pipeline
- Monthly reviews of pipeline performance
- Quarterly updates to GitHub Actions versions
- Continuous improvement based on team feedback

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **CI Pass Rate** | ≥95% | GitHub Actions insights |
| **Mean Time to Feedback** | <10 min | PR open → CI complete |
| **False Positive Rate** | <5% | Failed checks that required override |
| **Deployment Frequency** | 2-4/month | Releases created |
| **Changeset Compliance** | 100% | PRs with changesets / total PRs |
| **Security Scan Coverage** | 100% of dependencies | npm audit + Dependabot |
| **Pipeline Downtime** | <1 hour/month | Time when CI is broken |

---

## Maintenance Guidelines

### Weekly Tasks
- [ ] Review Dependabot PRs, merge security patches
- [ ] Check for failed CI runs, investigate patterns
- [ ] Monitor cache hit rates, clear stale caches if needed

### Monthly Tasks
- [ ] Review pipeline duration, identify slow steps
- [ ] Update workflow action versions (`uses: foo@v4` → `v5`)
- [ ] Audit GitHub Actions usage, optimize costs
- [ ] Review security scan findings, suppress false positives

### Quarterly Tasks
- [ ] Upgrade pnpm version across all workflows
- [ ] Upgrade Node.js LTS version
- [ ] Review and update Changesets presets
- [ ] Conduct DR test: simulate repository corruption, restore from releases

---

## Appendix: Reference Commands

### Local Testing

**Simulate CI locally:**
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run lint (all packages)
pnpm run lint

# Run tests (all packages)
pnpm run test

# Build (sequential, mimics CI)
pnpm --filter @escapeplan/contracts build
pnpm --filter escapeplan-api build
pnpm --filter escapeplan-web build

# Build .deb package
./scripts/build-deb.sh
```

**Changesets workflow:**
```bash
# Add changeset (prompts for package + semver + description)
pnpm changeset add

# Preview version bumps
pnpm changeset version --snapshot test

# Consume changesets (done by Release workflow)
pnpm changeset version
```

**Manual release simulation:**
```bash
# Bump versions manually
npm version patch -m "chore: release v%s"

# Build and package
pnpm run build
./scripts/build-deb.sh

# Create GitHub release (via gh CLI)
gh release create v0.2.0 dist/escapeplan_0.2.0_arm64.deb --title "EscapePlan v0.2.0" --notes "See CHANGELOG.md"
```

---

## Conclusion

This CI/CD pipeline architecture provides EscapePlan with:
1. **Quality Gates:** Automated linting, testing, and security scanning
2. **Version Management:** Changesets-driven semantic versioning
3. **Distribution:** Production-ready .deb packages for Raspberry Pi
4. **Observability:** Clear status checks, notifications, and metrics
5. **Developer Experience:** Fast feedback (<10 min), minimal manual steps

**Next Steps:**
1. Review this design document with team
2. Implement Phase 1 (Basic CI/CD) in feature branch
3. Test workflows with sample PRs and releases
4. Iterate based on feedback and performance data
5. Deploy to production with monitoring in place

**Estimated Implementation Time:** 3-4 weeks (1 week per phase)
**Maintenance Overhead:** <2 hours/week after stabilization
**ROI:** Eliminates manual build errors, enables safe automated deployments

---

**Document Version:** 1.0
**Last Updated:** 2025-10-04
**Author:** System Architect
**Status:** Ready for Implementation
