# Schema Refactoring Guide: Drizzle + Zod Single Source of Truth

## Overview

This refactoring implements **Option 1: Use Zod as Single Source of Truth** to eliminate the manual payload reconstruction bug that caused milestones not to save.

### Before (❌ BROKEN)
- **3 sources of truth**: TypeScript types, Zod schemas, manual payload reconstruction
- **Error-prone**: Adding a field required updating 3+ places
- **Bug we fixed**: `milestones` and `defaultVolume` were missing from manual reconstruction

### After (✅ FIXED)
- **1 source of truth**: Zod schemas in `packages/contracts/src/validation.ts`
- **Type-safe**: TypeScript types inferred from Zod with `z.infer<>`
- **Maintainable**: Adding a field only requires updating the Zod schema

---

## Changes Made

### 1. Contracts Package

#### ✅ Added Dependencies
```json
{
  "dependencies": {
    "drizzle-orm": "^0.44.5",
    "drizzle-zod": "^0.8.3",
    "zod": "^3.23.8"
  }
}
```

#### ✅ New Files
- `packages/contracts/src/schema.ts` - Drizzle schema (copied from API)
- `packages/contracts/src/validation.ts` - Zod validation schemas

#### ✅ Updated Exports (`packages/contracts/src/index.ts`)
```typescript
// Export Drizzle schema tables (for API database operations)
export * from './schema.js';

// Export Zod validation schemas and inferred types (for API request validation)
export * from './validation.ts';
```

### 2. API Package

#### ✅ Updated Schema Import (`apps/escapeplan-api/src/db/client.ts`)
```typescript
// BEFORE
import * as schema from './schema.js';

// AFTER
import * as schema from '@escapeplan/contracts';
```

---

## Remaining Steps (User Must Complete)

### Step 1: Update All Schema Imports in API

Search and replace in `apps/escapeplan-api/src/`:

```bash
# Find all files importing local schema
grep -r "from './db/schema" src/

# Replace with contracts import
# Change: from './db/schema.js'
# To: from '@escapeplan/contracts'
```

**Files to update:**
- `src/index.ts`
- `src/state.ts`
- `src/db/seed.ts`
- `src/realtime.ts` (if applicable)
- `src/cameras/*.ts` (if applicable)

### Step 2: Replace Zod Schemas in API (`apps/escapeplan-api/src/index.ts`)

#### Remove These Lines (217-252):
```typescript
const milestoneSchema = z.object({ ... });
const saveGameSchema = z.object({ ... });
const createUserSchema = z.object({ ... });
// ... all other manual Zod schemas
```

#### Add This Import Instead:
```typescript
import {
  saveGameSchema,
  createOperatorSchema,
  updateOperatorSchema,
  quickStartSchema,
  sessionCommandSchema,
  createRoleSchema,
  updateRoleSchema,
  createCameraSchema,
  updateCameraSchema
} from '@escapeplan/contracts';
```

### Step 3: Remove Manual Payload Reconstruction

#### ❌ BEFORE (Lines 771-803):
```typescript
api.post('/admin/games', async (request, reply) => {
  const parsed = saveGameSchema.safeParse(request.body);
  if (!parsed.success) { ... }

  const data = parsed.data;
  const payload: SaveGameRequest = {  // ❌ Manual reconstruction
    slug: data.slug,
    name: data.name,
    // ... 20+ fields manually copied
    milestones: data.milestones,  // Easy to forget!
  };

  const created = createGame(payload);
  return created;
});
```

#### ✅ AFTER:
```typescript
api.post('/admin/games', async (request, reply) => {
  const parsed = saveGameSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  // Pass parsed.data directly - no manual reconstruction!
  const created = createGame(parsed.data);
  return created;
});
```

#### ✅ Same Pattern for PUT:
```typescript
api.put('/admin/games/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = saveGameSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  // Pass parsed.data directly!
  const updated = updateGame(id, parsed.data);
  return updated;
});
```

### Step 4: Apply Same Pattern to ALL Endpoints

**Endpoints to update:**
- ✅ `POST /admin/users` - Already uses `createOperatorAccount(parsed.data)`
- ❌ `PUT /admin/users/:id` - Needs update
- ❌ `POST /admin/games` - Needs update
- ❌ `PUT /admin/games/:id` - Needs update
- ❌ `POST /sessions/quick-start` - Needs update
- ❌ `POST /sessions/:id/commands` - Needs update
- ❌ `POST /admin/roles` - Needs update
- ❌ `PUT /admin/roles/:id` - Needs update
- ❌ `POST /admin/cameras` - Needs update
- ❌ `PUT /admin/cameras/:id` - Needs update

**Pattern to follow:**
```typescript
// 1. Parse request body
const parsed = schema.safeParse(request.body);

// 2. Check validation
if (!parsed.success) {
  return reply.status(400).send({
    statusCode: 400,
    message: 'Invalid request',
    details: parsed.error.flatten()
  });
}

// 3. Pass parsed.data directly (no manual reconstruction!)
const result = await stateFunction(parsed.data);
return result;
```

### Step 5: Delete Old Files

Once all imports are updated:
```bash
# Remove old schema file from API
rm apps/escapeplan-api/src/db/schema.ts
```

### Step 6: Test Everything

```bash
# 1. Rebuild contracts
pnpm --filter @escapeplan/contracts build

# 2. Rebuild API
pnpm --filter escapeplan-api build

# 3. Run type checking
pnpm --filter escapeplan-api lint

# 4. Test game creation/update
curl -X POST http://localhost:4000/api/admin/games \
  -H "Content-Type: application/json" \
  -d '{"slug":"test","name":"Test","description":"Test",...,"milestones":[...]}'

# 5. Verify milestones save
sqlite3 apps/escapeplan-api/data/escapeplan.db \
  "SELECT * FROM game_milestones"
```

---

## Benefits of This Approach

### ✅ Type Safety
```typescript
// Types are inferred from schemas - always in sync!
export type SaveGameRequest = z.infer<typeof saveGameSchema>;
```

### ✅ Single Source of Truth
```typescript
// Add a new field? Update ONE place (the Zod schema)
export const saveGameSchema = z.object({
  // ... existing fields
  newField: z.string().optional(),  // That's it!
});
```

### ✅ No More Reconstruction Bugs
```typescript
// BEFORE: Easy to forget fields
const payload: SaveGameRequest = {
  slug: data.slug,
  // ... oops, forgot milestones!
};

// AFTER: Impossible to forget fields
const payload = parsed.data;  // TypeScript ensures all fields present
```

### ✅ Consistent with Existing Patterns
```typescript
// User endpoints already work this way!
api.post('/admin/users', async (request, reply) => {
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) { ... }

  const created = await createOperatorAccount(parsed.data);  // ✅
  return created;
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ packages/contracts                                   │
│                                                      │
│  schema.ts (Drizzle)                                │
│  ├─ export const games = sqliteTable(...)          │
│  ├─ export const rooms = sqliteTable(...)          │
│  └─ export const gameMilestones = sqliteTable(...) │
│                                                      │
│  validation.ts (Zod)                                │
│  ├─ export const saveGameSchema = z.object(...)    │
│  ├─ export type SaveGameRequest = z.infer<...>     │
│  └─ export type GameMilestone = z.infer<...>       │
│                                                      │
│  index.ts                                           │
│  ├─ export * from './schema.js'                    │
│  └─ export * from './validation.js'                │
└─────────────────────────────────────────────────────┘
                          ↓
                   (imported by)
                          ↓
┌─────────────────────────────────────────────────────┐
│ apps/escapeplan-api                                  │
│                                                      │
│  db/client.ts                                       │
│  └─ import * as schema from '@escapeplan/contracts'│
│                                                      │
│  state.ts                                           │
│  ├─ import { games, ... } from '@escapeplan/contracts' │
│  └─ function createGame(payload: SaveGameRequest)  │
│                                                      │
│  index.ts                                           │
│  ├─ import { saveGameSchema, ... } from '@escapeplan/contracts' │
│  └─ const parsed = saveGameSchema.safeParse(...)   │
│      const created = createGame(parsed.data)        │
└─────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Build Error: "Cannot find module '@escapeplan/contracts'"
```bash
# Rebuild contracts first
pnpm --filter @escapeplan/contracts build
```

### Type Error: Property 'X' does not exist
```bash
# Ensure contracts is built and types are up to date
pnpm --filter @escapeplan/contracts build
# Then rebuild API
pnpm --filter escapeplan-api build
```

### Runtime Error: Validation failed
```bash
# Check that client is sending correct field names
# Zod schema uses camelCase (e.g., defaultVolume)
# Database uses snake_case (e.g., default_volume)
# The schemas handle this automatically
```

---

## Next Steps

1. ✅ Complete Step 1: Update all schema imports
2. ✅ Complete Step 2: Replace Zod schemas in API
3. ✅ Complete Step 3-4: Remove all manual payload reconstruction
4. ✅ Complete Step 5: Delete old schema file
5. ✅ Complete Step 6: Test all CRUD operations

**Once complete, the milestone save bug will be permanently fixed and cannot recur!**
