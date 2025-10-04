# Changesets

This directory contains pending version bumps for the next release.

## Developer Usage

When making changes, always add a changeset:

```bash
pnpm changeset
```

This creates a new file here describing your changes. Commit it with your PR.

### Changeset Types

- **patch**: Bug fixes, refactors, minor improvements (0.1.0 → 0.1.1)
- **minor**: New features, enhancements (0.1.0 → 0.2.0)
- **major**: Breaking changes (0.1.0 → 1.0.0)

### Example Workflow

```bash
# 1. Create feature branch
git checkout -b feat/new-feature

# 2. Implement your changes
# ... make code changes ...

# 3. Add changeset
pnpm changeset
# Select: minor (for new feature)
# Summary: "Add awesome new feature"

# 4. Commit everything together
git add .
git commit -m "feat: add awesome new feature"

# 5. Push and create PR
git push -u origin feat/new-feature
```

## Maintainer Usage

To release a new version:

```bash
# 1. Review pending changesets
pnpm changeset:status

# 2. Bump versions and update CHANGELOGs
pnpm version

# 3. Review changes
git diff

# 4. Commit version bump
git add .
git commit -m "chore: release vX.Y.Z"

# 5. Tag and push
git tag vX.Y.Z
git push origin main --tags

# 6. Build release package
pnpm release
```

## Files in This Directory

- `config.json` - Changesets configuration (unified versioning)
- `*.md` files - Pending changesets (auto-deleted on version bump)

## Unified Versioning

EscapePlan uses **fixed packages** - all packages always share the same version:
- Shared contracts (`@escapeplan/contracts`)
- API backend (`escapeplan-api`)
- Web frontend (`escapeplan-web`)

When you add a changeset, all packages are selected automatically.

## Notes

- All PRs require at least one changeset
- Changesets are consumed during version bump (deleted after processing)
- CHANGELOG.md files are auto-generated from changeset summaries
- VERSION file is automatically synced with package.json versions
