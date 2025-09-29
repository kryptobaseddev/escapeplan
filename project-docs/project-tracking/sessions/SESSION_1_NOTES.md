# Session 1 Notes - MVP Scope & Architecture Alignment
**Date**: 2025-09-29  
**Duration**: 2.5 hours  
**Participants**: Keaton (Product Owner), Codex (AI planning agent)  
**Session Type**: Planning / Architecture  
**Project Version**: 0.1.0-planning

---

## Session Goals
1. Finalize MVP scope, success metrics, and deferred backlog for EscapePlan.
2. Document hardware/network baseline, domain & service contexts, and DaisyUI UX direction.
3. Sync tracker artifacts (TODOs, user stories, handoff) so Phase 2+ work can begin smoothly.

## Tasks Completed

### ✅ Primary Tasks
- [x] **P1-001**: Competitive analysis and differentiators recorded in `project-docs/project-overview.md` §1.1.1; risk register updated (RISK-002).
- [x] **P1-002**: MVP scope, metrics, constraints, and roadmap clarified (§§1.4–1.7, §17) with deferred features listed.
- [x] **P1-003**: Hardware/network baseline (Pi 5, AC600M, mDNS, self-signed HTTPS) captured in §§2.4–2.5 and `.env` defaults.
- [x] **P1-004**: Domain/service breakdown plus schema updates (mobile flag, deposits, discount codes, room branding) documented (§§3.2–3.4, API contract).
- [x] **P1-005**: DaisyUI theme tokens, typography, room background/audio expectations defined (§8.6) and reflected in handoff + stories.

### 🔄 Partial Completions
- [~] **P1-006**: Delivery workflow outline drafted; detailed CI/CD diagram postponed until repos exist next session.

## Decisions Made

### Technical Decisions
1. **Stack confirmation**: Fastify 5 (TS), Drizzle/SQLite, SvelteKit 2 + DaisyUI 5.1.25 remain core—lightweight for Pi, rapid PWA delivery.
2. **Networking defaults**: Ship with `escapeplan.local` mDNS, WPA2 SSID `EscapePlan`, self-signed HTTPS bundle; SSH disabled by default.
3. **Booking model**: MVP supports discount codes + 30% configurable deposits; Square integration deferred to roadmap.

### Process Decisions
- Adopt “webapp-first” implementation next session before Pi image work.  
- Require session notes + tracker sync at end of each working block.

## Architecture & Design Changes
- Schema extended with `is_mobile`, room theme/background assets, deposit/discount columns.  
- Booking & timer API endpoints updated to support deposits, slug pages, multimedia hints.  
- Added cert-export CLI and Avahi/mDNS requirements to platform deliverables.

## Blockers & Risks Identified
- **Current blockers**: None.
- **RISK-005** (Medium/Medium): Device trust of self-signed certs—mitigate with cert-export CLI + onboarding runbook before pilot.

## Quality Metrics
- Documentation alignment achieved (PRD, TODO, USER_STORIES, HANDOFF).  
- Tracker summary: 5/45 tasks completed (11.1%), Phase 1 progress 71.4%.  
- No code/tests yet—build status pending repo scaffold.

## User Story Progress
- **Completed/Ready**: US-001 (competitor insights), US-002 (MVP boundaries).  
- **Updated for implementation**: US-010, US-012, US-013, US-014, US-017 capture deposits/discounts, room branding, multimedia hints; US-018/US-019 repositioned for mobile catalog & logistics.

## Team Collaboration
- Stakeholder alignment reached on MVP scope, mobile terminology (`is_mobile`) and priority order.  
- Next sync scheduled to focus on webapp scaffolding (SvelteKit + DaisyUI) before platform work.

## Environment & Tooling
- `.env` template expanded with hostname, Wi-Fi defaults, deposit rate, cert directory.  
- Installation checklist updated for mDNS + cert generation via CLI.

## Lessons Learned
- Structured tracker + PRD workflow kept decisions consistent; continue updating both simultaneously.
- Clarifying “mobile kit” semantics early avoided unnecessary MVP scope—using catalog flag plus logistics notes is sufficient for v0.1.0.

## Next Session Focus
1. Scaffold SvelteKit workspace (Tailwind/DaisyUI theme, auth shell, navigation) and set up pnpm workspaces.  
2. Implement core UI flows: bookings, dashboard, game runner, public slug timer with room background/audio cues.  
3. Stub Fastify endpoints/mocks required for frontend development; defer Pi image tasks to following session once UI/API baseline exists.

---
