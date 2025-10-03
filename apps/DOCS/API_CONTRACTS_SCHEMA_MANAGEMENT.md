# API Contracts & Schema Management Guide

**Single Source of Truth: Drizzle + Zod for Type-Safe CRUD Operations**

This is the **BIBLE** for maintaining database schemas, API contracts, and validation in the EscapePlan system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Single Source of Truth Pattern](#the-single-source-of-truth-pattern)
3. [Schema Management Workflow](#schema-management-workflow)
4. [Adding New Fields](#adding-new-fields)
5. [Adding New Entities](#adding-new-entities)
6. [API Endpoint Pattern](#api-endpoint-pattern)
7. [Validation Best Practices](#validation-best-practices)
8. [Testing Schema Changes](#testing-schema-changes)
9. [Troubleshooting](#troubleshooting)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Architecture Overview

### The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: DATABASE SCHEMA (Drizzle)                      │
│ Location: packages/contracts/src/schema.ts              │
│ Purpose: SQLite table definitions, relationships        │
│ Tool: drizzle-kit for migrations                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: VALIDATION SCHEMAS (Zod)                       │
│ Location: packages/contracts/src/validation.ts          │
│ Purpose: API request/response validation                │
│ Tool: Zod runtime validation + TypeScript inference     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: API ENDPOINTS (Fastify)                        │
│ Location: apps/escapeplan-api/src/index.ts              │
│ Purpose: HTTP handlers using validated data             │
│ Pattern: Parse → Validate → Pass to State Functions     │
└─────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/contracts/
├── src/
│   ├── schema.ts        # Drizzle database schema (SQLite tables)
│   ├── validation.ts    # Zod validation schemas + inferred types
│   └── index.ts         # Exports all schemas and types
├── package.json         # Dependencies: drizzle-orm, zod
└── tsconfig.json

apps/escapeplan-api/
├── src/
│   ├── db/
│   │   └── client.ts    # Drizzle connection (imports schema from contracts)
│   ├── state.ts         # Business logic (uses types from contracts)
│   └── index.ts         # API routes (uses validation from contracts)
├── drizzle/             # Generated migrations
│   ├── meta/
│   └── *.sql
└── drizzle.config.ts    # Migration configuration
```

---

## The Single Source of Truth Pattern

### Problem We Solved

**Before (❌ BROKEN - 3 sources of truth):**
1. Drizzle schema defines database columns
2. Zod schema validates API requests
3. TypeScript types define function signatures
4. **MANUAL RECONSTRUCTION** copies fields in API endpoints

**Result:** Easy to forget fields (e.g., `milestones` bug), type mismatches, maintenance nightmare.

### Solution (✅ CORRECT - 1 source of truth)

```typescript
// 1. Define Zod schema ONCE
export const saveGameSchema = z.object({
  name: z.string().min(1),
  milestones: z.array(milestoneSchema).default([]),
  // ... all fields
});

// 2. Infer TypeScript type (always in sync!)
export type SaveGameRequest = z.infer<typeof saveGameSchema>;

// 3. Use in API endpoint (no reconstruction!)
const parsed = saveGameSchema.safeParse(request.body);
if (!parsed.success) { return error; }
const created = createGame(parsed.data); // ✅ All fields guaranteed present
```

**Benefits:**
- ✅ **Type-safe:** TypeScript types auto-generated from schemas
- ✅ **DRY:** Add field once, works everywhere
- ✅ **Runtime validation:** Zod catches invalid data
- ✅ **Compile-time checks:** TypeScript catches type errors
- ✅ **No manual work:** Impossible to forget fields

---

## Schema Management Workflow

### 1. Update Drizzle Schema

Edit `packages/contracts/src/schema.ts`:

```typescript
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Add new column
  newField: text('new_field'),
  // ... existing columns
});
```

### 2. Generate Migration

```bash
cd apps/escapeplan-api
npx drizzle-kit generate
```

**What this does:**
- Compares current schema with database state
- Generates SQL migration in `drizzle/*.sql`
- Updates metadata in `drizzle/meta/_journal.json`

**Output:**
```
✔ Your SQL migration file ➜ drizzle/0004_new_field.sql
```

### 3. Apply Migration

**Development:**
```bash
# Migrations auto-apply on dev server restart
pnpm --filter escapeplan-api dev
```

**Production:**
```bash
npx drizzle-kit migrate
```

### 4. Update Zod Validation Schema

Edit `packages/contracts/src/validation.ts`:

```typescript
export const saveGameSchema = z.object({
  name: z.string().min(1),
  newField: z.string().optional(), // ✅ Add here
  // ... existing fields
});

// Type automatically updates!
export type SaveGameRequest = z.infer<typeof saveGameSchema>;
```

### 5. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

**Why:** API and Web apps import from contracts, need updated types.

### 6. Use in API/Web

**API** (`apps/escapeplan-api/src/index.ts`):
```typescript
// Already using parsed.data - NEW FIELD WORKS AUTOMATICALLY!
api.post('/admin/games', async (request, reply) => {
  const parsed = saveGameSchema.safeParse(request.body);
  if (!parsed.success) { return reply.status(400).send(...); }

  // parsed.data now includes newField - TypeScript knows about it!
  const created = createGame(parsed.data);
  return created;
});
```

**Web** (`apps/escapeplan-web/src/lib/components/games/GameModal.svelte`):
```typescript
import type { SaveGameRequest } from '@escapeplan/contracts';

// Type now includes newField
const payload: SaveGameRequest = {
  name: workingGame.name,
  newField: workingGame.newField, // ✅ TypeScript autocomplete!
  // ... all fields
};
```

---

## Adding New Fields

### Step-by-Step Example: Adding `estimatedSetupMinutes` to Games

#### 1. Update Drizzle Schema

`packages/contracts/src/schema.ts`:
```typescript
export const games = sqliteTable('games', {
  // ... existing columns
  estimatedSetupMinutes: integer('estimated_setup_minutes').default(15),
});
```

#### 2. Generate Migration

```bash
cd apps/escapeplan-api
npx drizzle-kit generate
```

#### 3. Update Zod Schema

`packages/contracts/src/validation.ts`:
```typescript
export const saveGameSchema = z.object({
  // ... existing fields
  estimatedSetupMinutes: z.number().int().positive().default(15),
});
```

#### 4. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

#### 5. Use in UI

`apps/escapeplan-web/src/lib/components/games/GameModal.svelte`:
```svelte
<label>
  <span>Setup Time (minutes)</span>
  <input type="number" bind:value={workingGame.estimatedSetupMinutes} />
</label>
```

**That's it!** No changes needed to:
- API endpoints (already pass `parsed.data`)
- State functions (TypeScript types updated automatically)
- Database queries (Drizzle schema updated)

---

## Adding New Entities

### Step-by-Step Example: Adding `Equipment` Table

#### 1. Define Drizzle Schema

`packages/contracts/src/schema.ts`:
```typescript
export const equipment = sqliteTable('equipment', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  quantity: integer('quantity').notNull().default(1),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
```

#### 2. Generate Migration

```bash
cd apps/escapeplan-api
npx drizzle-kit generate
# Creates: drizzle/0005_equipment_table.sql
```

#### 3. Create Zod Validation Schemas

`packages/contracts/src/validation.ts`:
```typescript
export const createEquipmentSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  category: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  isAvailable: z.boolean().default(true),
  notes: z.string().max(500).optional()
});

export const updateEquipmentSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().max(500).optional()
});

export type CreateEquipmentRequest = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentRequest = z.infer<typeof updateEquipmentSchema>;
```

#### 4. Export from Contracts

`packages/contracts/src/index.ts`:
```typescript
export {
  equipment,
  // ... existing exports
} from './schema.js';

export {
  createEquipmentSchema,
  updateEquipmentSchema,
  type CreateEquipmentRequest,
  type UpdateEquipmentRequest,
  // ... existing exports
} from './validation.js';
```

#### 5. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

#### 6. Create State Functions

`apps/escapeplan-api/src/state.ts`:
```typescript
import {
  equipment,
  type CreateEquipmentRequest,
  type UpdateEquipmentRequest
} from '@escapeplan/contracts';
import { randomUUID } from 'node:crypto';

export function createEquipment(data: CreateEquipmentRequest) {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.insert(equipment).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now
  }).run();

  return getEquipmentById(id);
}

export function updateEquipment(id: string, data: UpdateEquipmentRequest) {
  const now = new Date().toISOString();

  db.update(equipment)
    .set({ ...data, updatedAt: now })
    .where(eq(equipment.id, id))
    .run();

  return getEquipmentById(id);
}

export function getEquipmentById(id: string) {
  return db.query.equipment.findFirst({
    where: eq(equipment.id, id)
  });
}

export function listEquipment() {
  return db.query.equipment.findMany({
    orderBy: [asc(equipment.category), asc(equipment.name)]
  });
}

export function deleteEquipment(id: string) {
  db.delete(equipment).where(eq(equipment.id, id)).run();
}
```

#### 7. Create API Endpoints

`apps/escapeplan-api/src/index.ts`:
```typescript
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  type CreateEquipmentRequest,
  type UpdateEquipmentRequest
} from '@escapeplan/contracts';

// GET /api/admin/equipment
api.get('/admin/equipment', async (request, reply) => {
  const equipment = listEquipment();
  return equipment;
});

// POST /api/admin/equipment
api.post('/admin/equipment', async (request, reply) => {
  const parsed = createEquipmentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const created = createEquipment(parsed.data);
  return created;
});

// PUT /api/admin/equipment/:id
api.put('/admin/equipment/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = updateEquipmentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const updated = updateEquipment(id, parsed.data);
  return updated;
});

// DELETE /api/admin/equipment/:id
api.delete('/admin/equipment/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  deleteEquipment(id);
  return { success: true };
});
```

---

## API Endpoint Pattern

### The Golden Rule

**ALWAYS use this pattern for ALL mutating endpoints (POST, PUT, PATCH):**

```typescript
api.post('/api/resource', async (request, reply) => {
  // 1. Parse and validate request body
  const parsed = resourceSchema.safeParse(request.body);

  // 2. Handle validation errors
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  // 3. Pass parsed.data DIRECTLY to state function
  const result = createResource(parsed.data);

  // 4. Return result
  return result;
});
```

### What NOT to Do

**❌ NEVER manually reconstruct payloads:**

```typescript
// ❌ BAD - Easy to forget fields
const payload: SaveGameRequest = {
  slug: data.slug,
  name: data.name,
  // ... oops, forgot milestones!
};
const created = createGame(payload);

// ✅ GOOD - Impossible to forget fields
const created = createGame(parsed.data);
```

### Pattern for Different Operations

#### CREATE (POST)

```typescript
import { createResourceSchema } from '@escapeplan/contracts';

api.post('/api/resources', async (request, reply) => {
  const parsed = createResourceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const created = createResource(parsed.data);
  return created;
});
```

#### UPDATE (PUT)

```typescript
import { updateResourceSchema } from '@escapeplan/contracts';

api.put('/api/resources/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = updateResourceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      message: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const updated = updateResource(id, parsed.data);
  return updated;
});
```

#### DELETE

```typescript
api.delete('/api/resources/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  deleteResource(id);
  return { success: true };
});
```

#### READ (GET)

```typescript
// List all
api.get('/api/resources', async (request, reply) => {
  const resources = listResources();
  return resources;
});

// Get one
api.get('/api/resources/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const resource = getResourceById(id);
  if (!resource) {
    return reply.status(404).send({
      statusCode: 404,
      message: 'Resource not found'
    });
  }
  return resource;
});
```

---

## Validation Best Practices

### Zod Schema Design

#### Use Descriptive Error Messages

```typescript
// ✅ GOOD
z.string().min(1, 'Game name is required')

// ❌ BAD
z.string().min(1)
```

#### Provide Sensible Defaults

```typescript
export const saveGameSchema = z.object({
  difficulty: z.string().default('Medium'),
  minPlayers: z.number().int().positive().default(1),
  categories: z.array(z.string()).default([])
});
```

#### Use Enums for Fixed Values

```typescript
export const milestoneSchema = z.object({
  type: z.enum(['intro', 'escaped', 'failed', 'custom']),
  mediaType: z.enum(['text', 'image', 'audio', 'video']).nullable().optional()
});
```

#### Validate Formats

```typescript
export const saveGameSchema = z.object({
  slug: z.string().regex(
    /^[a-z0-9-]+$/,
    'Slug must contain only lowercase letters, numbers, and hyphens'
  )
});

export const createOperatorSchema = z.object({
  email: z.string().email().optional().or(z.literal(''))
});
```

#### Handle Nullable vs Optional

```typescript
// Use .optional() for fields that may not be present
content: z.string().optional()

// Use .nullable() for fields that can be explicitly null
assetId: z.string().nullable()

// Use both for fields that may be absent OR null
notes: z.string().nullable().optional()
```

#### Validate Nested Objects

```typescript
export const saveGameSchema = z.object({
  // ... scalar fields

  // Nested arrays of objects
  rooms: z.array(roomSchema).min(1, 'At least one room is required'),
  puzzles: z.array(puzzleSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),

  // Nested config objects
  media: mediaConfigSchema.optional(),
  pricing: pricingConfigSchema.optional()
});
```

### Type Inference

#### Always Infer Types from Schemas

```typescript
// ✅ GOOD - Single source of truth
export const saveGameSchema = z.object({ ... });
export type SaveGameRequest = z.infer<typeof saveGameSchema>;

// ❌ BAD - Two sources of truth (will drift!)
export const saveGameSchema = z.object({ ... });
export interface SaveGameRequest { ... }
```

#### Use Inferred Types in Functions

```typescript
import type { SaveGameRequest } from '@escapeplan/contracts';

// ✅ Type parameter matches validation schema exactly
export function createGame(data: SaveGameRequest) {
  // ...
}
```

---

## Testing Schema Changes

### 1. Build Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

**Check:** No TypeScript errors

### 2. Rebuild API

```bash
pnpm --filter escapeplan-api build
```

**Check:** No TypeScript errors, especially in:
- `src/state.ts` (state functions)
- `src/index.ts` (API endpoints)

### 3. Run Unit Tests

```bash
pnpm --filter escapeplan-api test
```

**Check:** All tests pass

### 4. Test CRUD Flow Manually

#### Create
```bash
curl -X POST http://localhost:4000/api/admin/games \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{
    "slug": "test-game",
    "name": "Test Game",
    "description": "Test description",
    "rooms": [{"name": "Main Room"}],
    "milestones": [{
      "type": "intro",
      "name": "Welcome",
      "triggerType": "manual"
    }]
  }'
```

#### Verify in Database
```bash
sqlite3 apps/escapeplan-api/data/escapeplan.db

SELECT * FROM games WHERE slug = 'test-game';
SELECT * FROM game_milestones WHERE game_id = (SELECT id FROM games WHERE slug = 'test-game');
```

#### Update
```bash
curl -X PUT http://localhost:4000/api/admin/games/{id} \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" \
  -d '{
    "name": "Updated Name",
    "milestones": [{
      "type": "intro",
      "name": "Updated Welcome",
      "triggerType": "manual"
    }]
  }'
```

#### Verify Update
```bash
sqlite3 apps/escapeplan-api/data/escapeplan.db

SELECT * FROM games WHERE id = '{id}';
SELECT * FROM game_milestones WHERE game_id = '{id}';
```

### 5. Test in UI

1. Start dev servers:
   ```bash
   pnpm --filter escapeplan-api dev
   pnpm --filter escapeplan-web dev
   ```

2. Navigate to `/admin/games`
3. Click "Add Game"
4. Fill in all fields including new field
5. Save
6. Verify data appears in UI
7. Edit game
8. Verify changes save

---

## Troubleshooting

### Build Error: "Cannot find module '@escapeplan/contracts'"

**Cause:** Contracts package not built

**Fix:**
```bash
pnpm --filter @escapeplan/contracts build
```

### Type Error: "Property 'X' does not exist on type 'Y'"

**Cause:** Types out of sync between contracts and API

**Fix:**
```bash
# Rebuild contracts
pnpm --filter @escapeplan/contracts build

# Restart TypeScript server in IDE
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Validation Error: "Invalid request"

**Cause:** Request body doesn't match Zod schema

**Fix:**
1. Check browser console for validation errors
2. Compare request body with schema definition
3. Ensure field names match (camelCase in API, snake_case in DB)

### Migration Error: "Column already exists"

**Cause:** Migration already applied but journal out of sync

**Fix:**
```bash
cd apps/escapeplan-api

# Check current schema version
sqlite3 data/escapeplan.db ".schema migrations"

# Reset migrations (DANGER: development only!)
rm -rf drizzle/
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Runtime Error: "Cannot read property 'X' of undefined"

**Cause:** Missing field in manual payload reconstruction

**Fix:**
**DON'T manually reconstruct!** Use `parsed.data` directly:

```typescript
// ❌ BAD
const payload = { slug: data.slug, name: data.name };

// ✅ GOOD
const result = createGame(parsed.data);
```

---

## Anti-Patterns to Avoid

### ❌ Manual Payload Reconstruction

**NEVER DO THIS:**
```typescript
const data = parsed.data;
const payload: SaveGameRequest = {
  slug: data.slug,
  name: data.name,
  description: data.description,
  // ... 20 more fields
};
const created = createGame(payload);
```

**ALWAYS DO THIS:**
```typescript
const parsed = saveGameSchema.safeParse(request.body);
if (!parsed.success) { return error; }
const created = createGame(parsed.data);
```

### ❌ Defining Types Separately from Schemas

**NEVER DO THIS:**
```typescript
// Two sources of truth - will drift!
export const saveGameSchema = z.object({ ... });
export interface SaveGameRequest { ... }
```

**ALWAYS DO THIS:**
```typescript
// Single source of truth
export const saveGameSchema = z.object({ ... });
export type SaveGameRequest = z.infer<typeof saveGameSchema>;
```

### ❌ Skipping Validation

**NEVER DO THIS:**
```typescript
api.post('/api/resource', async (request, reply) => {
  const data = request.body as CreateResourceRequest;
  const created = createResource(data); // ❌ No validation!
  return created;
});
```

**ALWAYS DO THIS:**
```typescript
api.post('/api/resource', async (request, reply) => {
  const parsed = createResourceSchema.safeParse(request.body);
  if (!parsed.success) { return error; }
  const created = createResource(parsed.data);
  return created;
});
```

### ❌ Importing Schema from API in Contracts

**NEVER DO THIS:**
```typescript
// In contracts/src/validation.ts
import { games } from '../../../apps/escapeplan-api/src/db/schema.js';
```

**Contracts is the foundation layer** - it should never import from API.

### ❌ Hardcoding Validation in Multiple Places

**NEVER DO THIS:**
```typescript
// In API
const isValidSlug = /^[a-z0-9-]+$/.test(data.slug);

// In Web
const isValidSlug = /^[a-z0-9-]+$/.test(workingGame.slug);
```

**ALWAYS DO THIS:**
```typescript
// In contracts/src/validation.ts - ONCE
export const saveGameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format')
});

// Use everywhere via validation
```

---

## Quick Reference

### Workflow Checklist

When adding a new field:

- [ ] Update Drizzle schema in `packages/contracts/src/schema.ts`
- [ ] Run `npx drizzle-kit generate` to create migration
- [ ] Update Zod schema in `packages/contracts/src/validation.ts`
- [ ] Run `pnpm --filter @escapeplan/contracts build`
- [ ] Rebuild API: `pnpm --filter escapeplan-api build`
- [ ] Test CRUD operations
- [ ] Update UI components to use new field

When adding a new entity:

- [ ] Define Drizzle table in `packages/contracts/src/schema.ts`
- [ ] Run `npx drizzle-kit generate`
- [ ] Create Zod schemas in `packages/contracts/src/validation.ts`
- [ ] Export from `packages/contracts/src/index.ts`
- [ ] Run `pnpm --filter @escapeplan/contracts build`
- [ ] Add state functions in `apps/escapeplan-api/src/state.ts`
- [ ] Add API endpoints in `apps/escapeplan-api/src/index.ts`
- [ ] Create UI components in `apps/escapeplan-web`

### Essential Commands

```bash
# Generate migration from schema changes
cd apps/escapeplan-api && npx drizzle-kit generate

# Apply migrations
cd apps/escapeplan-api && npx drizzle-kit migrate

# Rebuild contracts
pnpm --filter @escapeplan/contracts build

# Rebuild API
pnpm --filter escapeplan-api build

# Run API tests
pnpm --filter escapeplan-api test

# Check SQLite database
sqlite3 apps/escapeplan-api/data/escapeplan.db
```

---

## Summary

This guide establishes the **SINGLE SOURCE OF TRUTH** pattern for EscapePlan:

1. **Drizzle defines the database** (`packages/contracts/src/schema.ts`)
2. **Zod defines validation** (`packages/contracts/src/validation.ts`)
3. **Types are inferred** (`z.infer<typeof schema>`)
4. **API endpoints pass validated data directly** (no manual reconstruction)

**Follow this guide religiously** and you will never experience:
- ❌ Missing fields in payloads
- ❌ Type mismatches between layers
- ❌ Validation drift
- ❌ Duplicate type definitions

**The milestone save bug is permanently fixed** and cannot recur when following this pattern.
