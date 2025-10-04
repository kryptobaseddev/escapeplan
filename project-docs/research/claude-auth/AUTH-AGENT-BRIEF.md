# Auth System Optimization - Agent Brief

**Session Type:** Full System Refactor (Initial Development)
**Assignee:** CLAUDE Agent
**Estimated Effort:** 2-3 days (16-20 hours)
**Status:** Ready to start

---

## 📋 Your Mission

Refactor the EscapePlan auth system to align with Better Auth v1.3.24+ best practices and prepare for customer portal features. This is **initial development** - no backward compatibility, no migration concerns, full clean-slate refactor.

---

## 🎯 TODO Items You're Completing

This work consolidates and supersedes multiple TODO items:

### Primary:
- **P3-AUTH-REFACTOR** (new) - Complete auth system modernization

### Related (will be marked complete):
- P3-RBAC-001 ✅ Already complete (database schema exists)
- P3-RBAC-002 ✅ Already complete (contracts updated)
- P3-RBAC-003 ✅ Already complete (APIs implemented)

---

## 📚 Required Reading (In Order)

1. **@escapeplan-app/project-docs/project-tracking/prompt-claude.txt** - Your operating instructions
2. **@escapeplan-app/project-docs/project-tracking/HANDOFF.md** - Project snapshot
3. **@escapeplan-app/project-docs/research/claude-auth/AUTH-OPTIMIZATION-PLAN.md** - Your complete execution plan
4. **@escapeplan-app/CLAUDE.md** - Codebase reference
5. **@escapeplan-app/project-docs/project-tracking/TODO.json** - Validate you understand P3-RBAC-* completion status

---

## 🚀 Execution Steps

### Phase 0: Setup (30 min)

1. **Read all required documents above**
2. **Determine your session number:**
   ```bash
   cd /mnt/projects/escape-plan/escapeplan-app/project-docs/project-tracking/sessions
   ls -t SESSION_*_NOTES.md | head -1
   # If latest is SESSION_46_NOTES.md, you are SESSION_47
   ```
3. **Create your session notes:**
   ```bash
   # Use the session number you determined
   cp SESSION_TEMPLATE.md SESSION_47_NOTES.md
   ```
4. **Update session header:**
   - Session #: 47 (or your actual number)
   - Date: 2025-10-03
   - Focus: "Auth System Optimization - Better Auth v1.3.24+ Alignment"
   - Agent: CLAUDE
   - Status: IN_PROGRESS

### Phase 1-6: Follow AUTH-OPTIMIZATION-PLAN.md

Execute all phases from AUTH-OPTIMIZATION-PLAN.md in sequence:
- ✅ Phase 1: Schema Refactor (3 hours)
- ✅ Phase 2: Better Auth Configuration (2 hours)
- ✅ Phase 3: API Layer Refactor (4 hours)
- ✅ Phase 4: Frontend Refactor (4 hours)
- ✅ Phase 5: Testing & Validation (3 hours)
- ✅ Phase 6: Documentation Updates (1 hour)

**After each phase:**
1. Check the phase completion checklist in AUTH-OPTIMIZATION-PLAN.md
2. Document progress in your session notes
3. Run validation commands:
   ```bash
   cd project-docs/project-tracking
   ./project-tracker validate
   ```

---

## 🎯 Success Criteria (Acceptance)

Your work is complete when:

### Database Layer:
- [ ] `user` table exists (not `operators`)
- [ ] `session`, `account`, `verification` tables exist (singular, not plural)
- [ ] `user_type` field exists with default 'operator'
- [ ] `user_type_scope` field exists on `roles` and `permissions` tables
- [ ] All foreign keys reference `user.id` (not `operators.id`)
- [ ] 5 security triggers exist and function correctly
- [ ] No orphaned records (run integrity checks from AUTH-OPTIMIZATION-PLAN.md Phase 5.4)

### Better Auth:
- [ ] `auth-config.ts` uses native table names (no `modelName` overrides)
- [ ] `additionalFields` configured for `user_type`, `role_id`, custom fields
- [ ] `input: false` set for server-managed fields (`user_type`, `role_id`)
- [ ] Session enrichment derives permissions from database
- [ ] Login works and returns session with `user_type`, `role_id`, `permissions`

### API Layer:
- [ ] `/api/admin/users` endpoints work (not `/admin/operators`)
- [ ] `state.ts` uses `user`, `session`, `account`, `verification` imports
- [ ] Permission checks use `requirePermission()` helper
- [ ] `getUserPermissions()` queries database (not JSON field)
- [ ] All API tests pass: `pnpm --filter escapeplan-api test`

### Frontend:
- [ ] Type imports use `UserProfile` (not `OperatorProfile`)
- [ ] API client uses `/api/admin/users` endpoints
- [ ] Route guards check `session.user.user_type`
- [ ] `/admin/users` route exists (not `/admin/operators`)
- [ ] All components render without TypeScript errors
- [ ] `pnpm --filter escapeplan-web check` passes

### Seeds & Tests:
- [ ] Seed scripts use `user` table with `user_type: 'operator'`
- [ ] Roles seeded with `user_type_scope`
- [ ] Permissions seeded with `user_type_scope`
- [ ] All unit tests pass
- [ ] Database triggers tested and working

### Documentation:
- [ ] CLAUDE.md updated with new auth architecture
- [ ] DATABASE_SYSTEM.md updated with `user` table docs
- [ ] API_CONTRACTS_SCHEMA_MANAGEMENT.md has examples

---

## 🔍 Validation Commands

Run these after completing all phases:

```bash
# 1. Database schema check
cd apps/escapeplan-api
sqlite3 data/escapeplan.db ".schema user"
sqlite3 data/escapeplan.db "SELECT name FROM sqlite_master WHERE type='trigger';"

# 2. Test trigger (should fail with appropriate error)
sqlite3 data/escapeplan.db <<EOF
INSERT INTO user (id, user_type, role_id, username, name, emailVerified, createdAt, updatedAt)
VALUES ('test-1', 'customer', 'role-admin', 'test', 'Test', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
EOF

# 3. API tests
pnpm --filter escapeplan-api test

# 4. Frontend type check
pnpm --filter escapeplan-web check

# 5. Project tracker validation
cd ../../project-docs/project-tracking
./project-tracker validate

# 6. Integration test
curl http://localhost:4000/api/admin/users \
  -H "Cookie: better-auth.session_token=..."
```

---

## 📝 Session Notes Template

Use this structure in your `SESSION_{#}_NOTES.md`:

```markdown
# Session {#} - Auth System Optimization

**Date:** 2025-10-03
**Focus:** Better Auth v1.3.24+ Alignment & User Type Separation
**Agent:** CLAUDE
**Status:** IN_PROGRESS

---

## Session Goals
- [ ] Complete Phase 1: Schema Refactor
- [ ] Complete Phase 2: Better Auth Config
- [ ] Complete Phase 3: API Layer Refactor
- [ ] Complete Phase 4: Frontend Refactor
- [ ] Complete Phase 5: Testing & Validation
- [ ] Complete Phase 6: Documentation Updates

---

## Work Completed

### Phase 1: Schema Refactor (3h)
- [x] Updated `packages/contracts/src/schema.ts` with new user table
- [x] Renamed auth tables to singular
- [x] Added `user_type` field
- [x] Created database triggers
- [x] Dropped old database and regenerated
- [x] Applied triggers and seeds
- **Files Changed:** schema.ts, triggers.sql, 0001_*.sql
- **Validation:** `sqlite3 data/escapeplan.db ".tables"` shows new tables

### Phase 2: Better Auth Config (2h)
- [x] Refactored `auth-config.ts`
- [x] Removed `modelName` overrides
- [x] Added `additionalFields` for `user_type`, `role_id`
- [x] Implemented permission derivation in `customSession`
- **Files Changed:** auth-config.ts
- **Validation:** Login returns session with permissions

### Phase 3: API Layer (4h)
[Continue documenting...]

---

## Issues Encountered

### Issue 1: [Describe any blockers]
**Resolution:** [How you fixed it]

---

## Testing Evidence

### Database Schema
\`\`\`
sqlite3 data/escapeplan.db ".schema user"
[Paste output]
\`\`\`

### API Test Results
\`\`\`
pnpm --filter escapeplan-api test
[Paste output]
\`\`\`

---

## Next Steps
1. [What remains]
2. [Follow-up items]

---

## Files Modified
- packages/contracts/src/schema.ts
- apps/escapeplan-api/src/auth-config.ts
- apps/escapeplan-api/src/state.ts
- apps/escapeplan-api/src/index.ts
[Full list...]

---

## Hours Logged: [X] hours
```

---

## 🚨 Important Reminders

### DO:
✅ Follow AUTH-OPTIMIZATION-PLAN.md phases in order
✅ Drop and recreate database (initial dev, no migration needed)
✅ Test each phase before moving to next
✅ Document all changes in session notes
✅ Run validation commands after each phase
✅ Update TODO.json when complete

### DON'T:
❌ Create backward compatibility aliases (not needed for initial dev)
❌ Create redirects for old endpoints (clean break)
❌ Worry about downtime (no production users)
❌ Preserve existing data (regenerate from seeds)
❌ Skip testing phases
❌ Forget to update documentation

---

## 🔗 Quick Reference Links

- **Main Plan:** `project-docs/research/claude-auth/AUTH-OPTIMIZATION-PLAN.md`
- **Session Notes:** `project-docs/project-tracking/sessions/SESSION_{#}_NOTES.md`
- **TODO Tracking:** `project-docs/project-tracking/TODO.json`
- **Schema File:** `packages/contracts/src/schema.ts`
- **Auth Config:** `apps/escapeplan-api/src/auth-config.ts`
- **API State:** `apps/escapeplan-api/src/state.ts`

---

## 📞 Escalation

If you encounter blockers:
1. Document the issue in session notes
2. Mark task as BLOCKED in TODO.json
3. Propose alternative approaches
4. Continue with non-blocked work if possible

---

## 🎓 Context: Why This Refactor?

**Current Problems:**
- Table names don't match Better Auth conventions (`operators` vs `user`)
- Dual role/permission systems (string + database)
- No `user_type` field for operator/customer separation
- Missing Better Auth `additionalFields` configuration

**After Refactor:**
- Clean Better Auth integration (native singular tables)
- Single source of truth for roles/permissions (database only)
- Future-ready for customer portal (`user_type` field)
- Type-safe custom fields in sessions

---

**Ready to begin? Start with Phase 0 setup, then proceed through AUTH-OPTIMIZATION-PLAN.md phases 1-6.**

**Good luck! 🚀**

---

**Last Updated:** 2025-10-03
**Document Version:** 1.0
**Author:** Project Lead + Claude Code
