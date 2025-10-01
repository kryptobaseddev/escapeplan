# Project Handoff Template (AI-Friendly)

Use this file to orient any contributor—human or AI—before they touch the project. Replace highlighted placeholders as soon as you know the answers.

## Project Snapshot
| Field | Value |
| ----- | ----- |
| Project name | `EscapePlan` |
| Primary goal | Ship a Pi-hosted MVP that lets operators manage bookings and run games with reliable video, timers, and hints entirely offline. |
| Current phase | `PHASE_1` |
| Contact / escalation | _Not required (single maintainer)_ |
| Environments | Local dev via Docker/Podman; production on Raspberry Pi 5 + USB AC600M Wi-Fi AP. |
| Key differentiators | Offline-first Pi appliance, mobile-ready catalog flag, unified game runner with live video + room branding. |

## Session Flow
### Start-of-session checklist
1. Read the newest session note in `project-docs/project-tracking/sessions/` (currently: SESSION_31_NOTES.md).
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
