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
│ Tool: drizzle-kit push for direct schema sync          │
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
└── drizzle.config.ts    # Drizzle configuration for push command
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

> **IMPORTANT (Session 35):** This project uses **push-only workflow** with NO migration files. All migration scripts were removed in Session 35. Schema changes are applied directly to the database using `drizzle-kit push`.

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

### 2. Update Zod Validation Schema

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

### 3. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

**Why:** API and Web apps import from contracts, need updated types.

### 4. Apply Schema Changes to Database

```bash
cd apps/escapeplan-api
npx drizzle-kit push
```

**What this does:**
- Compares current schema with database state
- Applies changes directly to the database (NO migration files)
- Uses runtime-detected database path automatically
- Prompts for confirmation before applying changes

> **Note:** Drizzle automatically uses the correct database path based on runtime environment detection. See **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md#path-resolution)** for how paths are resolved in development vs production.

### 5. Test Changes

```bash
pnpm --filter escapeplan-api test
```

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

## Working with Better Auth Tables

### Native Table Names
Better Auth v1.3.24+ expects these exact singular table names:
- `user` - Main user table
- `session` - Session tokens
- `account` - OAuth accounts
- `verification` - Email verification

**DO NOT** use `modelName` or `fields` overrides in auth config - let Better Auth use native names.

### Custom Fields on user Table
Use `additionalFields` in auth-config.ts:

```typescript
user: {
  additionalFields: {
    user_type: {
      type: 'string',
      fieldName: 'user_type',
      required: true,
      returned: true,
      input: false,  // Server-managed only
      defaultValue: 'operator'
    },
    role_id: {
      type: 'string',
      fieldName: 'role_id',
      required: true,
      returned: true,
      input: false,  // Server-managed only
      defaultValue: 'role-manager'
    }
  }
}
```

### Field Naming Convention
- **Better Auth core fields:** camelCase (`emailVerified`, `createdAt`, `updatedAt`)
- **Custom application fields:** snake_case (`user_type`, `role_id`)
- **Drizzle schema:** Match database column names exactly

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

#### 2. Update Zod Schema

`packages/contracts/src/validation.ts`:
```typescript
export const saveGameSchema = z.object({
  // ... existing fields
  estimatedSetupMinutes: z.number().int().positive().default(15),
});
```

#### 3. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

#### 4. Apply Schema Changes

```bash
cd apps/escapeplan-api
npx drizzle-kit push
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

#### 2. Create Zod Validation Schemas

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

#### 3. Export from Contracts

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

#### 4. Rebuild Contracts

```bash
pnpm --filter @escapeplan/contracts build
```

#### 5. Apply Schema Changes

```bash
cd apps/escapeplan-api
npx drizzle-kit push
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

### Schema Push Error: "Column already exists"

**Cause:** Schema change already applied but Drizzle state out of sync

**Fix:**
```bash
cd apps/escapeplan-api

# Check current schema
sqlite3 data/escapeplan.db ".schema TABLE_NAME"

# Force push (DANGER: development only!)
npx drizzle-kit push --force

# Or reset database and reseed
rm -f data/escapeplan.db*
pnpm db:seed
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
- [ ] Update Zod schema in `packages/contracts/src/validation.ts`
- [ ] Run `pnpm --filter @escapeplan/contracts build`
- [ ] Run `cd apps/escapeplan-api && npx drizzle-kit push` to apply schema changes
- [ ] Run `pnpm --filter escapeplan-api test` to verify changes
- [ ] Rebuild API: `pnpm --filter escapeplan-api build`
- [ ] Update UI components to use new field

When adding a new entity:

- [ ] Define Drizzle table in `packages/contracts/src/schema.ts`
- [ ] Create Zod schemas in `packages/contracts/src/validation.ts`
- [ ] Export from `packages/contracts/src/index.ts`
- [ ] Run `pnpm --filter @escapeplan/contracts build`
- [ ] Run `cd apps/escapeplan-api && npx drizzle-kit push` to create table
- [ ] Run `pnpm --filter escapeplan-api test` to verify changes
- [ ] Add state functions in `apps/escapeplan-api/src/state.ts`
- [ ] Add API endpoints in `apps/escapeplan-api/src/index.ts`
- [ ] Create UI components in `apps/escapeplan-web`

### Essential Commands

```bash
# Apply schema changes to database (NO migrations - push only!)
cd apps/escapeplan-api && npx drizzle-kit push

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
5. **Schema changes applied via push** (`drizzle-kit push` - NO migrations)

**Session 35 Architectural Decision:**
- ✅ **Push-only workflow** - Direct schema sync with `drizzle-kit push`
- ❌ **NO migration files** - All migration scripts removed in Session 35
- ❌ **NO drizzle-kit generate** - Not used in this project
- ❌ **NO drizzle-kit migrate** - Not used in this project

**Follow this guide religiously** and you will never experience:
- ❌ Missing fields in payloads
- ❌ Type mismatches between layers
- ❌ Validation drift
- ❌ Duplicate type definitions
- ❌ Migration file conflicts

**The milestone save bug is permanently fixed** and cannot recur when following this pattern.

---

## Room Display Media System

### Room Display Configuration

**Schema:** `games.room_display_config` (JSON)

```typescript
interface RoomDisplayConfig {
  backgroundType: 'asset' | 'solid' | 'gradient';
  backgroundAssetId?: string;
  backgroundColor?: string; // hex
  gradientFrom?: string; // hex
  gradientTo?: string; // hex
  gradientDirection?: 'to-b' | 'to-t' | 'to-r' | 'to-l' | 'to-br' | 'to-tl' | 'radial';
  backgroundOpacity: number; // 0-100
  defaultMediaScale: number; // 10-100
  showTimer: boolean;
  timerPosition: 'center' | 'top' | 'bottom';
  textHintTextColor?: string; // hex
  textHintBackgroundColor?: string; // hex
}
```

**Defaults:**
- `backgroundType`: 'solid'
- `backgroundOpacity`: 40
- `defaultMediaScale`: 90
- `showTimer`: true
- `timerPosition`: 'center'
- `textHintTextColor`: '#000000'
- `textHintBackgroundColor`: '#FFA500'

**Example:**
```json
{
  "backgroundType": "gradient",
  "gradientFrom": "#0a1929",
  "gradientTo": "#1e3a5f",
  "gradientDirection": "to-br",
  "backgroundOpacity": 40,
  "defaultMediaScale": 90,
  "showTimer": true,
  "timerPosition": "center",
  "textHintTextColor": "#ffffff",
  "textHintBackgroundColor": "#FFA500"
}
```

### Hint Display Settings

**Schema:** `game_puzzles.hints` (JSON array)

Each hint object now includes:
```typescript
{
  uuid: string;
  type: 'text' | 'image' | 'audio' | 'video';
  content: string;
  assetUrl?: string;
  volumeLevel?: number; // 0-100
  order: number;
  penaltySeconds?: number; // existing
  penaltyEnabled?: boolean; // existing
  countAsHint?: boolean; // existing
  displayDurationSeconds?: number; // NEW - required for images
  loop?: boolean; // NEW - default false
  loopCount?: number; // NEW - undefined = infinite
  autoDismiss?: boolean; // NEW - default true
}
```

**Validation:**
- Image hints: `displayDurationSeconds` REQUIRED
- Audio/Video hints: `displayDurationSeconds` optional (auto-detect from media)
- Text hints: display settings ignored

### Milestone Display Settings

**Schema:** `game_milestones` table

New columns:
- `display_duration_seconds`: INTEGER (optional)
- `loop`: INTEGER/BOOLEAN (default 0)
- `loop_count`: INTEGER (optional, null = infinite)
- `auto_dismiss`: INTEGER/BOOLEAN (default 1)

**Migration:**
```sql
ALTER TABLE game_milestones ADD COLUMN display_duration_seconds INTEGER;
ALTER TABLE game_milestones ADD COLUMN loop INTEGER DEFAULT 0;
ALTER TABLE game_milestones ADD COLUMN loop_count INTEGER;
ALTER TABLE game_milestones ADD COLUMN auto_dismiss INTEGER DEFAULT 1;
```

### WebSocket Events

**New Event:** `room-display:media`

```typescript
interface RoomDisplayMediaEvent {
  slug: string;
  sessionId: string;
  mediaType: 'text' | 'image' | 'audio' | 'video';
  content: string; // Text content OR asset URL
  volumeLevel?: number; // 0-100
  loop?: boolean;
  loopCount?: number;
  autoDismiss?: boolean;
  displayDurationSeconds?: number;
  triggeredAt: string;
  source: 'hint' | 'milestone';
  textHintColors?: {
    textColor: string;
    backgroundColor: string;
  };
}
```

**Emitted when:**
- Operator sends hint via Game Runner
- Milestone is triggered (manual or automatic)

**Consumed by:**
- Room Display page (`/room/[slug]`)

### Deprecated Fields

**REMOVED:**
- `media_config.roomScreenAssetId` (replaced by `room_display_config.backgroundAssetId`)

**Migration path:**
```typescript
// If old field exists, migrate to new structure
if (game.media?.roomScreenAssetId) {
  game.roomDisplayConfig = {
    backgroundType: 'asset',
    backgroundAssetId: game.media.roomScreenAssetId,
    // ... other defaults
  };
  delete game.media.roomScreenAssetId;
}
```

---

## Related Documentation

### Core System Docs
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Environment detection, database path resolution
- **[Database System](./DATABASE_SYSTEM.md)** - Complete database schema reference, all 20+ tables

### Integration Docs
- **[Asset Storage Architecture](./ASSET_STORAGE_ARCHITECTURE.md)** - Asset schema and file upload validation
- **[RBAC System](./RBAC_SYSTEM.md)** - Roles, permissions, and access control tables
- **[Logging & Alerting System](./LOGGING_ALERTING_SYSTEM.md)** - System logs and alert rules schema
