# EscapePlan Auth Schema Transition Research (2025-10-03)

## 1. Current Ground Truth
- **Drizzle schema** (`packages/contracts/src/schema.ts:43`) still defines `operators` plus `operator_auth_sessions`, `operator_accounts`, and `operator_verifications` with the legacy string `role` column, JSON `permissions`, and no `user_type` field.
- **SQLite migrations** (`apps/escapeplan-api/drizzle/0000_steep_agent_zero.sql`) reference `operators.id` across foreign keys (alerts, assets, backups, role permissions), confirming the shipped database remains operator-centric.
- **API/Auth code** imports the legacy tables (`apps/escapeplan-api/src/auth-config.ts:8`, `index.ts:258`, `state.ts:1032`) and Better Auth is configured via `modelName: 'operators'` without `additionalFields` for `user_type` or `role_id`.
- **Operational docs** such as `apps/DOCS/DATABASE_SYSTEM.md:255` still document the operator schema, so official guidance has not caught up with the new users-table recommendation.

## 2. Target Architecture (Context7 Guidance)
- Move to a singular `users` table with enforced `user_type` (`'operator' | 'customer'`) per `project-docs/architecture/CUSTOMER_OPERATOR_SEPARATION_ANALYSIS.md:205`.
- Align Better Auth with singular table names and declare `additionalFields` for `role_id`, `user_type`, `permissions`, etc. (`project-docs/research/claude-auth/02-BETTER_AUTH_BEST_PRACTICES.md:25`, `:95`).
- Add database triggers to keep operator/customer boundaries intact (`CUSTOMER_OPERATOR_SEPARATION_ANALYSIS.md:378`).

## 3. Gap Analysis
| Area | Current State | Target State | Work Required |
|------|---------------|--------------|---------------|
| Table Naming | `operators`, `operator_auth_sessions`, … | `users`, `user_sessions`, … | SQLite rename/recreate migrations, Drizzle schema update |
| User Segmentation | No `user_type` column | `user_type` with CHECK + default `'operator'` | Add column, backfill, enforce triggers |
| RBAC Fields | Dual system: string `role`, JSON `permissions`, FK `role_id` | Standardized `role_id` + typed permissions | Decide deprecation path, adjust code |
| Better Auth Config | Plural overrides, no `additionalFields` | Native naming plus typed server fields | Refactor `auth-config.ts`, update adapter |
| Application Code | CRUD, seeds, tests use `operators` | Everything references `users`; guards rely on `user_type` | Refactor imports, add middleware, regenerate contracts |
| Documentation | Operator-focused specs | Updated to users-based architecture | Rewrite database/API docs post-migration |

## 4. Migration Blueprint
1. **Pre-checks**
   - Snapshot live DB; ensure Drizzle journal matches `escapeplan.db`.
   - Inventory all FK touchpoints to `operators.id` (rolePermissions, assets, alerts, backups, etc.).
2. **Schema Changes**
   - Rename tables (`operators` → `users`, etc.) using recreate pattern to preserve FK constraints in SQLite.
   - Introduce `user_type TEXT NOT NULL DEFAULT 'operator'` with CHECK constraint and backfill existing rows.
   - Create triggers barring `user_type = 'customer'` from operator-only roles (`CUSTOMER_OPERATOR_SEPARATION_ANALYSIS.md:378`).
3. **Better Auth Alignment**
   - Update adapter to use singular tables; drop `modelName` override post-rename.
   - Register `additionalFields` for `role_id`, `user_type`, `permissions`, `avatar_config`, etc., controlling input/return flags.
   - Confirm session/account/verification rename strategy preserves active sessions (or plan forced reauth).
4. **Application Refactor**
   - Replace Drizzle imports across API modules (auth, state, logging, seeds, integrations) with `users` and new session/account tables.
   - Add `requireOperator`/`isCustomer` helpers keyed off `user_type` as described in prior analysis.
   - Ensure seeds set `user_type` appropriately; default new staff to `'operator'`.
   - Address lingering dependencies on string `role` or JSON `permissions` (decide on alias vs removal).
5. **Contracts & Validation**
   - Regenerate contracts package after schema updates; expose new types with temporary backward-compatible aliases.
   - Update Zod validation to surface/guard `user_type` for admin flows.
6. **Testing & Verification**
   - Run Vitest suites plus targeted auth/session tests; add regression coverage for `user_type` enforcement.
   - Dry-run migration on a copied SQLite file to validate table recreation and trigger behavior.
7. **Docs & Rollout**
   - Refresh `DATABASE_SYSTEM.md`, `API_CONTRACTS_SCHEMA_MANAGEMENT.md`, and related specs once code lands.
   - Coordinate with web team on `(customer)` route group enablement and feature flag strategy.

## 5. Open Questions & Risks
- Should legacy `role`/`permissions` fields remain during transition, or be deprecated immediately?
- How to handle active Better Auth sessions during table renames—do we enforce a re-login window?
- Are there external scripts/integrations expecting `operators` table names?
- Timing for customer account creation relative to portal/kiosk phases.
- Trigger logic must avoid locking out operators while still blocking privilege escalation.

## 6. Immediate Next Steps
- Circulate this analysis for confirmation from DB/auth owners.
- Draft exact migration SQL with rollback steps and test plan.
- Schedule migration rehearsal using current `escapeplan.db` snapshot.
- Begin documentation outlines so updates can ship concurrently with the migration.

