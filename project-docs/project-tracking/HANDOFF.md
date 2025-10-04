# Project Handoff Template (AI-Friendly)

Use this file to orient any contributor—human or AI—before they touch the project. Replace highlighted placeholders as soon as you know the answers.

## Project Snapshot
| Field | Value |
| ----- | ----- |
| Project name | `EscapePlan` |
| Primary goal | Ship a Pi-hosted MVP that lets operators manage bookings and run games with reliable video, timers, and hints entirely offline. |
| Current phase | `PHASE_1` (MVP development with cloud-ready schema) |
| Contact / escalation | _Not required (single maintainer)_ |
| Environments | Local dev via Docker/Podman; production on Raspberry Pi 5 + USB AC600M Wi-Fi AP. |
| Key differentiators | Offline-first Pi appliance, mobile-ready catalog flag, unified game runner with live video + room branding. |
| Last major update | Session 53: Architecture decision (Hybrid A), cloud growth roadmap, Session 52: Auth system refactor docs |

## Current System Status (Updated 2025-10-03)

### Production-Ready Components
- **Authentication System**: Better Auth v1.3.24+ integrated with database-driven RBAC
  - User types: `operator` | `customer` (segmented in `user` table)
  - System roles: `admin`, `manager`, `game_master`, `customer`
  - 27 granular permissions with user_type scoping
  - 5 security triggers enforcing user_type/role boundaries
  - Session enrichment with permissions, role, user_type
  - All documentation updated (Session 52)

- **Database Schema**: Drizzle ORM with SQLite WAL mode
  - 23 interconnected tables (push-only workflow, no migrations)
  - Cloud-ready schema planned (not yet implemented)
  - Security triggers active and tested

### Session 53 Architecture Decision Summary

**Decision:** Hybrid A - "Schema NOW, Features LATER" ✅ ACCEPTED

**What This Means:**
- Add minimal cloud sync metadata fields (16 columns) to core tables during MVP development
- Defer organization tables and full multi-tenant features to post-MVP cloud phase
- No Better Auth organization plugin integration (incompatible with offline-first architecture)

**Key Metrics:**
- Best ROI: 37.6% (vs -71.1% for full defer approach)
- MVP Delay: 2 weeks (vs 13-14 weeks for full multi-tenant)
- Total Effort: 380 hours across all phases (lowest of all alternatives)
- Migration Risk: None (schema correct from day 1)

**MVP Schema Additions (Planned):**
- `cloud_id` TEXT (nullable) added to 8 core tables
- `cloud_hub_id` TEXT (nullable) added to same 8 tables
- Single-column index on `cloud_id` for each table
- `hub_config` table with cloud registration placeholders
- All fields nullable, unused until cloud phase (6-12 months post-MVP)

**Cloud Growth Roadmap (4 Phases):**

1. **Phase 0 - MVP (16-18 weeks):** Single-tenant Pi appliance with cloud-ready schema
   - All core features work offline (bookings, sessions, game runner, cameras)
   - Cloud metadata present but unused (null values)
   - Deliverable: Production-ready single-location system

2. **Phase 1 - Cloud Prep (6-8 weeks):** License key system, monetization foundation
   - License key generation/validation with hardware fingerprinting
   - Hub registration system (no cloud dependency)
   - Support renewal tracking and feature gating
   - Deliverable: Monetization-ready system

3. **Phase 2 - Cloud Launch (10-12 weeks):** Sync engine, Cloud Control subscription
   - Bidirectional sync for bookings/sessions
   - Remote dashboard access ($129/mo base subscription)
   - Nightly backups to cloud storage
   - Deliverable: Cloud-connected optional add-on

4. **Phase 3 - Multi-Hub Scale (14-16 weeks):** Organization management, enterprise features
   - Organization management for multi-location brands
   - Additional hub billing (+$35/mo per hub)
   - Cross-hub analytics and aggregated dashboards
   - Deliverable: Enterprise-ready multi-hub platform

**Total Timeline to Multi-Hub:** 46-54 weeks (~11-13 months)

**Reference Documents:**
- Architecture Decision: `/project-docs/research/claude-auth/ARCHITECTURE_DECISION_RECORD.md` (ADR-001)
- Growth Roadmap: `/project-docs/research/claude-auth/CLOUD_GROWTH_ROADMAP.md`
- Research Foundation: 10,000+ lines across 10 analysis documents (Phase 1-3)

## Session 54 Prerequisites

**Before starting Session 54, the following must be completed:**

### Schema Implementation (8-12 hours)
- [ ] Add cloud metadata fields to schema.ts (16 columns across 8 tables)
- [ ] Create `hub_config` table with cloud registration placeholders
- [ ] Add single-column indexes on `cloud_id` for each table
- [ ] Rebuild contracts package: `pnpm --filter @escapeplan/contracts build`
- [ ] Apply schema via `drizzle-kit push` (no migrations)

### Testing & Validation (4-6 hours)
- [ ] Write 16 unit tests for cloud field nullability and compatibility
- [ ] Run existing test suite (expect 186 tests + 16 new = 202 total to pass)
- [ ] Benchmark INSERT/SELECT performance (<10% degradation target)
- [ ] Validate backward compatibility (zero breaking changes)

### Documentation (2-3 hours)
- [ ] Update `DATABASE_SYSTEM.md` with cloud field descriptions
- [ ] Update `API_CONTRACTS_SCHEMA_MANAGEMENT.md` with new columns
- [ ] Create `/project-docs/cloud-sync-plan.md` documenting Phase 2 roadmap
- [ ] Add inline comments in schema.ts explaining cloud readiness

### Acceptance Criteria
- [ ] All 8 core tables have `cloud_id` and `cloud_hub_id` columns (nullable)
- [ ] `hub_config` table exists with `cloud_organization_id`, `cloud_hub_id`, `sync_enabled` fields
- [ ] All cloud fields default to NULL in MVP
- [ ] Zero breaking changes detected by automated tests
- [ ] Performance degradation <10% for INSERT, <15% for SELECT
- [ ] All documentation updated and accurate

**Estimated Total Effort:** 14-21 hours (2-week timeline impact)

**Success Metric:** MVP ships with cloud-ready schema, zero customer-facing changes, no migration pain later.

## Session Flow
### Start-of-session checklist
1. Read the newest session note in `project-docs/project-tracking/sessions/` and you can read more if needed
2. Review active tasks in `TODO.json` for the current phase.
3. Cross-check linked user stories to understand acceptance criteria (start with epic(s) tied to the current phase).
4. Run baseline validation (the tracker **must** run with `project-docs/project-tracking/` as the working directory so it can locate the JSON files):
   ```bash
   (cd project-docs/project-tracking && ./project-tracker validate)
   ```
5. If anything fails, log it in the session note before continuing.

### During the session
- Work only on tasks that match the current phase unless a decision is documented.
- Update task status immediately when progress changes.
- Capture decisions, blockers, or new risks in the session note template.
- Keep commands reproducible—note any extra steps you run.

### End-of-session checklist
1. Update `TODO.json` (status, assignee, notes, timestamps if you track them).
2. Summarize outcomes and next steps in the session note.
3. Re-run `./project-tracker validate` and any project-specific tests.
4. Commit with a descriptive message referencing task/story IDs.
5. Ping the next collaborator with the session summary.

## Setup Pointers
- For **new clones**, run `pnpm install` inside both repos (`platform/escapeplan-base`, `apps/escapeplan-web`) after they exist, then sync seeds with `pnpm run db:seed` (backend).
- Keep `project.yaml`, `TODO.json`, and `USER_STORIES.json` in sync—`./project-tracker init-config --config project-docs/project-tracking/project.yaml` is the source of truth.
- Review DaisyUI 5.1.25 SvelteKit setup notes at [daisyui.com/docs/install/sveltekit/](https://daisyui.com/docs/install/sveltekit/) before touching frontend scaffolding.
- Tailor `qualityGateRequirements` in `TODO.json` only after confirming team capacity; default is 80% coverage + security/documentation gates.
- Keep `escapeplan.local` hostname/self-signed cert workflow in mind—export bundle via `escapeplan cert-export` and walk operators through trusting it on iOS/macOS/Windows.

## Command Reference
```bash
./project-tracker validate     # Schema + consistency checks
./project-tracker quick-check  # Health summary for humans/AI
./project-tracker new-session  # Create guided session notes
./project-tracker report markdown  # Shareable status snapshot

# Project-specific commands
./project-tracker validate (validate)
./project-tracker quick-check (quick_check)
cd platform/escapeplan-base && pnpm run build:image (base_image_build)
cd platform/escapeplan-base && pnpm run lint (base_image_test#1)
cd platform/escapeplan-base && pnpm run test (base_image_test#2)
cd apps/escapeplan-web && pnpm run dev --host (webapp_dev)
cd apps/escapeplan-web && pnpm run build (webapp_build)
cd apps/escapeplan-api && pnpm run test (webapp_test#1)
cd apps/escapeplan-web && pnpm run test (webapp_test#2)
cd platform/escapeplan-base && ./scripts/package-deb.sh (package_deb)
# Upcoming (after repos exist)
cd apps/escapeplan-api && pnpm run db:seed              # Seed with real data (backend)
cd apps/escapeplan-web && pnpm run test:e2e             # PWA end-to-end tests (Playwright)
cd platform/escapeplan-base && pnpm run check:health    # Aggregated health diagnostics
avahi-browse -art | grep escapeplan                     # Confirm mDNS advertisement
```

Customize or add project-specific commands below once they exist (tests, builds, deployment scripts).

## Incident Basics
Fill these in when the project becomes operational:
- Severity-1 response target: _e.g. “Acknowledge within 15 minutes.”_
- Urgent communication channel: _Slack channel / pager / email_
- Incident log location: _Link or path_

## MVP Phase Cheat Sheet
- **PHASE_1 – Discovery & Architecture**: finalize MVP scope, domain model, DaisyUI theme, and dual-repo workflows (`P1-001`..`P1-007`).
- **PHASE_2 – Platform Base Image**: build pi-gen pipeline, Wi-Fi AP automation, hardening, backups (`P2-001`..`P2-006`).
- **PHASE_3 – Backend Core**: Drizzle schema + seeds, RBAC, bookings, sessions, camera orchestration (`P3-001`..`P3-010`).
- **PHASE_4 – Operator PWA**: SvelteKit/DaisyUI shell, dashboard, game runner, bookings UI, PWA offline support (`P4-001`..`P4-009`).
- **PHASE_5 – Mobile Ops & Analytics (Roadmap)**: mobile catalog tagging, logistics notes, offline sync, reporting, alerts (`P5-001`..`P5-006`).
- **PHASE_6 – QA, Pilot, Launch**: E2E tests, load, security review, training, pilot, release packaging (`P6-001`..`P6-007`).

## Metrics to Watch
- **Live session uptime** (target ≥ 99% during pilot week).
- **Dashboard latency** (timer/hint round-trip ≤ 500 ms under load).
- **Mobile booking readiness** (location notes & deposits confirmed 24 h before departure).
- **Backup success rate** (automated nightly backups succeeding ≥ 95%).
- **Pilot feedback resolution** (action items closed within 3 working days).

## Key Risks (see `TODO.json` risk register)
- Pi streaming capacity may limit concurrent rooms—track mitigation in `P2-002`, `P3-008`, `P6-002`.
- Competitor feature pressure—ensure differentiators documented via `P1-001`, `P1-002`, `P6-007`.
- Hardware scarcity for AC600M adapters—procurement plan attached to `P1-003`, `P2-002`.
- Mobile scope creep—guard timeboxes using `P5-002`, `P5-003` priorities.
- Browser trust friction—export and install the self-signed cert bundle before pilot.

## Seed Data Covenant
- No mock placeholders. All seeds must reflect real games, rooms, and kit names used by the business.
- Store seed sources in repo with date/time provenance (e.g., `seeds/games/@pirate-mutiny.txt`). Update seeds whenever rooms change.
- Validate seeds via `pnpm run db:seed && pnpm run test` before every release candidate.

---
Keep this document lean. If a section stops helping, trim or replace it.
