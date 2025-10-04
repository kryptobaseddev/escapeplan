# Organization & Hub Relationship Model

**Document Purpose:** Design a complete organization and hub relationship model that allows multi-location escape room owners to manage multiple Pi appliances under a single cloud account.

**Target Techstack:** Better Auth v1.3.24+, Drizzle ORM, SQLite WAL (hub), PostgreSQL (cloud), Fastify 5, SvelteKit 2

**Architecture Pattern:** Offline-first Pi appliance, single-tenant MVP, future cloud sync

**Analysis Date:** 2025-10-03

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Better Auth Organization Plugin Research](#2-better-auth-organization-plugin-research)
3. [Architecture Principles](#3-architecture-principles)
4. [Organization Schema Design (Cloud-Side)](#4-organization-schema-design-cloud-side)
5. [Hub Registration & Linking Mechanism](#5-hub-registration--linking-mechanism)
6. [Multi-Hub Data Sharing Patterns](#6-multi-hub-data-sharing-patterns)
7. [Hub-to-Organization Foreign Key Relationships](#7-hub-to-organization-foreign-key-relationships)
8. [Hub Identity & Authentication to Cloud](#8-hub-identity--authentication-to-cloud)
9. [Organization Hierarchy Model](#9-organization-hierarchy-model)
10. [Database Schema Reference](#10-database-schema-reference)
11. [API Endpoints](#11-api-endpoints)
12. [Error Handling & Edge Cases](#12-error-handling--edge-cases)
13. [Test Strategy](#13-test-strategy)
14. [Migration Path from Single-Tenant to Multi-Hub](#14-migration-path-from-single-tenant-to-multi-hub)
15. [Validation Checklist](#15-validation-checklist)

---

## 1. Executive Summary

### 1.1 Problem Statement

EscapePlan currently operates as a **single-tenant, offline-first** escape room management system on Raspberry Pi. Multi-location escape room brands need:

1. **Centralized customer database** - Share customer profiles, loyalty points, and booking history across all locations
2. **Multi-hub billing** - $129/mo base + $35/mo per additional hub under single cloud account
3. **Hub autonomy** - Each hub must function independently without cloud (offline-first)
4. **Organization-level analytics** - Aggregate performance metrics across all locations
5. **Centralized user management** - Operators can work at multiple locations with single credentials

### 1.2 Solution Architecture

- **Cloud Database (PostgreSQL):** Stores organizations, members, hubs, shared customer data, and cloud-specific metadata
- **Hub Database (SQLite WAL):** Retains all local operational data, remains fully functional offline
- **Organization Concept:** Cloud-only; NOT stored on hub database
- **Hub Registration:** API key-based authentication + JWT-based session tokens for cloud sync
- **Data Sharing:** Selective bidirectional sync for customers, bookings, and operator accounts
- **Single-Tenant at Hub Level:** Each hub serves one escape room business; multi-tenancy exists only at cloud organization level

### 1.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Organization stored cloud-side only | Hubs remain single-tenant; organization is a cloud billing/grouping construct |
| Hub uses API keys for authentication | Allows machine-to-machine auth without operator login, supports automatic sync |
| Customer data syncs to cloud | Enables shared loyalty programs and cross-location booking history |
| Operator accounts remain hub-local by default | Operators explicitly granted access to multiple hubs via organization membership |
| Hub registration is one-time, manual | Prevents unauthorized hubs from joining organization; owner approves each hub |

---

## 2. Better Auth Organization Plugin Research

### 2.1 Organization Plugin Overview

Better Auth provides an **organization plugin** (v1.3.24+) with the following capabilities:

**Core Features:**
- Multi-tenant organization management with member roles
- Invitation system with email-based onboarding
- Role-based access control (owner, admin, member, guest)
- Dynamic role creation with custom permissions
- Team support for departmental grouping within organizations

**Key Database Tables (from Context7 Research):**

```typescript
// Better Auth organization schema (cloud-side)
organization {
  id: string (PK)
  name: string
  slug: string (unique)
  logo?: string
  metadata?: object
  createdAt: Date
}

member {
  id: string (PK)
  userId: string (FK → user.id)
  organizationId: string (FK → organization.id)
  role: string
  createdAt: Date
  teamId?: string (FK → team.id)
}

invitation {
  id: string (PK)
  email: string
  inviterId: string (FK → user.id)
  organizationId: string (FK → organization.id)
  role: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  expiresAt: Date
  teamId?: string (FK → team.id)
}
```

### 2.2 Extending Better Auth Organization Plugin for Hubs

**Required Extensions:**

1. **Hub Entity:** Add `hub` table to track individual Pi appliances within organization
2. **Hub-Member Relationship:** Track which operators have access to which specific hubs
3. **Hub Authentication:** API key system for machine-to-machine authentication
4. **Billing Integration:** Link hub count to Stripe subscription for usage-based billing

**Schema Additions (Beyond Better Auth Defaults):**

```typescript
// EXTENSION: Hub table (cloud-side only)
hub {
  id: string (PK)
  organizationId: string (FK → organization.id)
  name: string
  location: string
  api_key_hash: string
  hardware_fingerprint: string (unique)
  license_key: string (FK → license.id)
  status: 'active' | 'suspended' | 'decommissioned'
  last_seen_at: Date
  created_at: Date
  metadata?: object
}

// EXTENSION: Hub member access (cloud-side only)
hub_member {
  id: string (PK)
  hub_id: string (FK → hub.id)
  user_id: string (FK → user.id)
  role: string ('admin' | 'manager' | 'game_master')
  granted_at: Date
  granted_by: string (FK → user.id)
}
```

### 2.3 Better Auth Organization Plugin Hooks

Better Auth provides lifecycle hooks for organization and invitation events:

**Invitation Hooks (from Context7):**
- `beforeCreateInvitation` - Custom validation, set expiration logic
- `afterCreateInvitation` - Send custom invitation email, track metrics
- `beforeAcceptInvitation` - Additional validation before acceptance
- `afterAcceptInvitation` - Setup user account, assign default resources
- `beforeRejectInvitation` / `afterRejectInvitation` - Log rejection, notify inviter
- `beforeCancelInvitation` / `afterCancelInvitation` - Verify permissions, log cancellation

**Hub Registration Hooks (Custom Implementation):**
- `beforeHubRegistration` - Validate license key, check hardware fingerprint uniqueness
- `afterHubRegistration` - Generate API key, provision cloud sync queue, send welcome email
- `beforeHubDecommission` - Archive hub data, revoke API keys
- `afterHubDecommission` - Trigger billing adjustment, notify organization owner

### 2.4 Role-Based Access Control Integration

Better Auth organization plugin supports **custom access control** via `createAccessControl()`:

```typescript
// Extending Better Auth AC for hub-specific permissions
const statement = {
  // Better Auth defaults
  organization: ["create", "update", "delete"],
  member: ["invite", "update_role", "remove"],

  // EscapePlan custom resources
  hub: ["register", "decommission", "configure", "view_analytics"],
  customer: ["create", "update", "merge", "export"],
  booking: ["create", "update", "cancel", "refund"]
} as const;

const ac = createAccessControl(statement);

const owner = ac.newRole({
  organization: ["create", "update", "delete"],
  member: ["invite", "update_role", "remove"],
  hub: ["register", "decommission", "configure", "view_analytics"],
  customer: ["create", "update", "merge", "export"],
  booking: ["create", "update", "cancel", "refund"]
});

const admin = ac.newRole({
  member: ["invite", "update_role"],
  hub: ["configure", "view_analytics"],
  customer: ["create", "update", "export"],
  booking: ["create", "update", "cancel", "refund"]
});

const manager = ac.newRole({
  hub: ["configure"],
  customer: ["create", "update"],
  booking: ["create", "update", "cancel"]
});
```

**Permission Enforcement Pattern:**

```typescript
// Server-side permission check (Fastify route)
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    organization({
      ac,
      roles: { owner, admin, manager }
    })
  ]
});

// API route protection
fastify.post('/api/org/hub/register', async (request, reply) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const hasPermission = await auth.organization.checkPermission({
    userId: session.user.id,
    organizationId: request.body.organizationId,
    resource: 'hub',
    action: 'register'
  });

  if (!hasPermission) {
    return reply.code(403).send({ error: 'Forbidden: Insufficient permissions' });
  }

  // Proceed with hub registration...
});
```

---

## 3. Architecture Principles

### 3.1 Core Constraints

1. **Offline-First at Hub Level**
   - Hubs MUST operate fully without cloud connectivity
   - Organization concept does NOT exist in hub database
   - All core features (booking, sessions, game runner) remain hub-local

2. **Single-Tenant at Hub Level**
   - Each hub serves exactly one escape room business
   - No multi-tenancy within hub database
   - Organization is a cloud-side grouping/billing construct only

3. **Cloud as Optional Enhancement**
   - Cloud subscription unlocks: centralized customer DB, remote dashboards, backups, analytics
   - Cloud outage MUST NOT impact hub operations
   - Hub→Cloud sync is queued and replayed on reconnect

4. **Data Ownership**
   - Hub owns operational data (bookings, sessions, game state)
   - Cloud stores organizational metadata, billing, and shared customer profiles
   - Customer merges happen cloud-side; hub receives canonical customer IDs

### 3.2 Data Residency Patterns

| Data Type | Hub Database | Cloud Database | Sync Direction |
|-----------|--------------|----------------|----------------|
| Organizations | ❌ | ✅ | N/A (cloud-only) |
| Organization Members | ❌ | ✅ | N/A (cloud-only) |
| Hub Metadata | Basic info only | ✅ Full details | Hub → Cloud (status updates) |
| Operators (Global) | ❌ | ✅ | Cloud → Hub (on permission grant) |
| Operators (Local) | ✅ | ❌ | Hub-only (default mode) |
| Customers (Shared) | ✅ Cached copy | ✅ Canonical | Bidirectional |
| Customers (Local-only) | ✅ | ❌ | Hub-only (pre-cloud era) |
| Bookings | ✅ | ✅ Mirror | Bidirectional (conflict resolution) |
| Sessions | ✅ | ✅ Mirror | Hub → Cloud (read-only cloud copy) |
| Games | ✅ | ❌ | Hub-only (location-specific) |
| Settings (Network, etc.) | ✅ | ❌ | Hub-only |

### 3.3 Sync Queue Architecture

**Hub-Side Queue (SQLite):**

```typescript
// Hub database schema addition (in SQLite)
export const sync_queue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  entity_type: text('entity_type').notNull(), // 'customer' | 'booking' | 'session'
  entity_id: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
  payload: text('payload', { mode: 'json' }).notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  synced_at: text('synced_at'),
  sync_status: text('sync_status').notNull().default('pending'), // 'pending' | 'synced' | 'failed'
  retry_count: integer('retry_count').notNull().default(0),
  last_error: text('last_error')
});
```

**Cloud-Side Sync Metadata (PostgreSQL):**

```typescript
// Cloud database schema (in PostgreSQL)
export const sync_metadata = pgTable('sync_metadata', {
  id: uuid('id').primaryKey(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  last_synced_at: timestamp('last_synced_at').notNull(),
  hub_version: text('hub_version'), // For conflict resolution
  cloud_version: text('cloud_version')
});
```

---

## 4. Organization Schema Design (Cloud-Side)

### 4.1 Core Tables (Better Auth + Extensions)

**Organization Table (Better Auth Default):**

```typescript
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const organization = pgTable('organization', {
  // Better Auth core fields
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),

  // EscapePlan extensions
  billing_email: text('billing_email').notNull(),
  subscription_status: text('subscription_status').notNull().default('active'), // 'active' | 'suspended' | 'cancelled'
  subscription_tier: text('subscription_tier').notNull().default('cloud_control'), // 'cloud_control' | 'cloud_control_priority'
  stripe_customer_id: text('stripe_customer_id').unique(),
  stripe_subscription_id: text('stripe_subscription_id').unique(),
  hub_limit: integer('hub_limit').notNull().default(10), // Max hubs allowed
  active_hub_count: integer('active_hub_count').notNull().default(0), // Denormalized for billing
  archived_at: timestamp('archived_at')
});
```

**Member Table (Better Auth Default):**

```typescript
export const member = pgTable('member', {
  // Better Auth core fields
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner' | 'admin' | 'manager' | 'game_master'
  createdAt: timestamp('created_at').notNull().defaultNow(),

  // EscapePlan extensions
  teamId: uuid('team_id').references(() => team.id, { onDelete: 'set null' }),
  access_all_hubs: boolean('access_all_hubs').notNull().default(false), // If true, has access to all hubs in org
  invited_by: uuid('invited_by').references(() => user.id),
  last_active_at: timestamp('last_active_at')
});
```

**Invitation Table (Better Auth Default):**

```typescript
export const invitation = pgTable('invitation', {
  // Better Auth core fields
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  inviterId: uuid('inviter_id').notNull().references(() => user.id),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'cancelled'
  expiresAt: timestamp('expires_at').notNull(),

  // EscapePlan extensions
  teamId: uuid('team_id').references(() => team.id, { onDelete: 'set null' }),
  hub_access: jsonb('hub_access'), // Array of hub IDs user will have access to (if not access_all_hubs)
  created_at: timestamp('created_at').notNull().defaultNow(),
  accepted_at: timestamp('accepted_at'),
  rejected_at: timestamp('rejected_at')
});
```

### 4.2 Hub Tables (EscapePlan Custom)

**Hub Table (Cloud-Side):**

```typescript
export const hub = pgTable('hub', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),

  // Hub identification
  name: text('name').notNull(), // e.g., "Downtown Seattle Location"
  location: text('location').notNull(), // Physical address
  hardware_fingerprint: text('hardware_fingerprint').notNull().unique(), // Pi CPU serial + MAC

  // Authentication
  api_key_hash: text('api_key_hash').notNull(), // bcrypt hash of API key
  api_key_last_rotated: timestamp('api_key_last_rotated').notNull().defaultNow(),

  // License integration
  license_key: text('license_key').notNull(), // From monetization model (Starter, Expansion, Multi-Site)
  license_type: text('license_type').notNull(), // 'starter' | 'expansion' | 'multi_site'
  room_capacity: integer('room_capacity').notNull(), // 4, 8, or 12 based on license

  // Status tracking
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'decommissioned'
  online_status: text('online_status').notNull().default('offline'), // 'online' | 'offline'
  last_seen_at: timestamp('last_seen_at'),
  last_sync_at: timestamp('last_sync_at'),

  // Metadata
  software_version: text('software_version'),
  pi_model: text('pi_model'), // e.g., "Raspberry Pi 4 Model B"
  metadata: jsonb('metadata'), // Arbitrary hub-specific config

  // Lifecycle
  registered_at: timestamp('registered_at').notNull().defaultNow(),
  registered_by: uuid('registered_by').notNull().references(() => user.id),
  decommissioned_at: timestamp('decommissioned_at'),
  decommissioned_by: uuid('decommissioned_by').references(() => user.id)
}, (table) => ({
  orgIdx: index('idx_hub_organization').on(table.organization_id),
  fingerprintIdx: index('idx_hub_fingerprint').on(table.hardware_fingerprint),
  statusIdx: index('idx_hub_status').on(table.status)
}));
```

**Hub Member Access Table (EscapePlan Custom):**

```typescript
export const hub_member = pgTable('hub_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

  // Access control
  role: text('role').notNull(), // 'admin' | 'manager' | 'game_master'

  // Metadata
  granted_at: timestamp('granted_at').notNull().defaultNow(),
  granted_by: uuid('granted_by').notNull().references(() => user.id),
  last_access_at: timestamp('last_access_at')
}, (table) => ({
  uniqueHubUser: unique('unique_hub_user').on(table.hub_id, table.user_id),
  hubIdx: index('idx_hub_member_hub').on(table.hub_id),
  userIdx: index('idx_hub_member_user').on(table.user_id)
}));
```

### 4.3 Shared Customer Table (Cloud-Side)

**Cloud Customer Table:**

```typescript
export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),

  // Identity
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),

  // Hub-specific customer IDs (for merging)
  hub_customer_mappings: jsonb('hub_customer_mappings'), // { "hub-id-1": "local-customer-id-1", "hub-id-2": "local-customer-id-2" }

  // Loyalty
  loyalty_points: integer('loyalty_points').notNull().default(0),
  lifetime_bookings: integer('lifetime_bookings').notNull().default(0),

  // Preferences
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: boolean('marketing_opted_in').notNull().default(false),

  // Metadata
  notes: text('notes'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),

  // Lifecycle
  archived_at: timestamp('archived_at')
}, (table) => ({
  orgIdx: index('idx_customer_organization').on(table.organization_id),
  emailIdx: index('idx_customer_email').on(table.email)
}));
```

---

## 5. Hub Registration & Linking Mechanism

### 5.1 Registration Flow

**Step 1: Organization Owner Initiates Registration**

```typescript
// API: POST /api/org/hub/initiate-registration
{
  organizationId: "org-123",
  hubName: "Downtown Seattle Location",
  location: "123 Main St, Seattle WA 98101",
  licenseKey: "STARTER-ABCD-1234-EFGH"
}

// Response:
{
  registrationToken: "reg-token-xyz", // Single-use token, expires in 1 hour
  registrationInstructions: "https://docs.escapeplan.io/hub-registration"
}
```

**Server-Side Processing:**
1. Validate user has `hub:register` permission in organization
2. Verify license key is valid and not already claimed
3. Check organization hasn't exceeded hub limit
4. Generate single-use registration token (JWT with 1-hour expiry)
5. Store pending registration in Redis/database

**Step 2: Hub Completes Registration**

On the hub (Raspberry Pi), operator runs:

```bash
# Hub-side CLI command
sudo escapeplan hub register --token reg-token-xyz
```

**Hub-Side Processing:**
1. Collect hardware fingerprint (CPU serial, MAC address, SD card UUID)
2. Send registration request to cloud API

```typescript
// API: POST /api/org/hub/complete-registration
{
  registrationToken: "reg-token-xyz",
  hardwareFingerprint: "sha256:abcdef1234567890",
  hubMetadata: {
    piModel: "Raspberry Pi 4 Model B",
    softwareVersion: "0.2.0",
    networkSsid: "EscapePlan-Downtown"
  }
}

// Response:
{
  hubId: "hub-456",
  apiKey: "ep_live_abc123xyz789", // Show ONCE, never returned again
  organizationId: "org-123",
  syncEndpoint: "https://sync.escapeplan.io",
  dashboardUrl: "https://app.escapeplan.io/orgs/org-123/hubs/hub-456"
}
```

**Server-Side Processing:**
1. Validate registration token (single-use, not expired)
2. Check hardware fingerprint uniqueness across all hubs
3. Validate license key hasn't been used (or supports multi-site add-on)
4. Generate API key (cryptographically random, prefixed `ep_live_`)
5. Create hub record in database
6. Increment organization's `active_hub_count`
7. Trigger billing update (Stripe subscription quantity +1)
8. Send confirmation email to organization owner
9. Invalidate registration token

**Step 3: Hub Stores Credentials**

```typescript
// Hub stores API key in local config file (restricted permissions)
// File: /etc/escapeplan/cloud-config.json
{
  "hubId": "hub-456",
  "organizationId": "org-123",
  "apiKey": "ep_live_abc123xyz789",
  "syncEndpoint": "https://sync.escapeplan.io",
  "lastSync": null
}

// File permissions: 0600 (owner read/write only)
```

### 5.2 API Key Management

**API Key Format:**
- Prefix: `ep_live_` (production) or `ep_test_` (sandbox)
- Length: 32 characters (base62 encoding)
- Example: `ep_live_K7mP3xQ9vR2wN8jY4hT6sL1bF5cZ0dA`

**Storage:**
- Hub: Stored in `/etc/escapeplan/cloud-config.json` (file permissions 0600)
- Cloud: bcrypt hash stored in `hub.api_key_hash` column

**Rotation Policy:**
1. API keys auto-rotate every 365 days
2. 30-day grace period where both old and new keys work
3. Hub automatically fetches new key on next sync
4. Manual rotation available via API endpoint

**Revocation:**

```typescript
// API: POST /api/org/hub/:hubId/revoke-api-key
{
  reason: "Security incident" // Required for audit log
}

// Response:
{
  revokedAt: "2025-10-03T14:30:00Z",
  message: "API key revoked. Hub will be unable to sync until new key is issued."
}
```

### 5.3 Hardware Fingerprinting

**Collection Method (Hub-Side):**

```bash
#!/bin/bash
# Script: /usr/local/bin/escapeplan-fingerprint

# Raspberry Pi CPU serial
CPU_SERIAL=$(cat /proc/cpuinfo | grep Serial | cut -d ' ' -f 2)

# Primary network interface MAC address
MAC_ADDR=$(cat /sys/class/net/wlan0/address)

# SD card UUID
SD_UUID=$(blkid -s UUID -o value /dev/mmcblk0p2)

# Generate SHA-256 fingerprint
echo -n "${CPU_SERIAL}:${MAC_ADDR}:${SD_UUID}" | sha256sum | cut -d ' ' -f 1
```

**Validation (Cloud-Side):**

```typescript
// Function: validateHardwareFingerprint()
async function validateHardwareFingerprint(fingerprint: string): Promise<boolean> {
  // Check uniqueness across all hubs
  const existingHub = await db.query.hub.findFirst({
    where: eq(hub.hardware_fingerprint, fingerprint)
  });

  if (existingHub) {
    throw new Error('Hardware fingerprint already registered to another hub');
  }

  // Validate format (SHA-256 hex string)
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('Invalid hardware fingerprint format');
  }

  return true;
}
```

**Edge Cases:**
- **SD Card Replacement:** Hub must re-register with new fingerprint (support ticket required to decommission old fingerprint)
- **Network Interface Change:** Fingerprint changes; requires manual approval
- **Pi Hardware Swap:** Treated as new hub registration; old hub must be decommissioned first

---

## 6. Multi-Hub Data Sharing Patterns

### 6.1 Shared Entities

**Customers (Bidirectional Sync):**

**Cloud → Hub (Initial Sync):**
1. On hub registration, cloud sends all existing customers for organization
2. Hub stores customers with `cloud_customer_id` foreign key reference
3. Local customer ID retained for backward compatibility

**Hub → Cloud (Create/Update):**
1. Hub creates/updates customer locally
2. Change added to `sync_queue` table
3. On next sync, hub sends customer data to cloud
4. Cloud performs duplicate detection (email/phone matching)
5. Cloud returns canonical `cloud_customer_id`
6. Hub updates local customer record with cloud ID

**Conflict Resolution:**
- **Last-write-wins** for most fields (name, phone, email)
- **Additive merge** for loyalty points (cloud aggregates across all hubs)
- **Cloud authoritative** for `archived_at` (deletions must originate from cloud dashboard)

**Schema Mapping:**

```typescript
// Hub-side customer table (SQLite)
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(), // Local UUID
  cloud_customer_id: text('cloud_customer_id'), // UUID from cloud (null if never synced)
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  loyalty_points: integer('loyalty_points').default(0), // Local points only
  cloud_loyalty_points: integer('cloud_loyalty_points').default(0), // Synced from cloud (read-only)
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: integer('marketing_opted_in', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  synced_at: text('synced_at'), // Last successful sync to cloud
  archived_at: text('archived_at')
});
```

**Bookings (Bidirectional Sync):**

**Cloud → Hub (Read-Only Reference):**
- Cloud stores all bookings for analytics and multi-hub visibility
- Hub receives booking updates from other hubs (customer history view)
- Other hubs' bookings shown as read-only in customer detail screen

**Hub → Cloud (Operational Data):**
- Hub creates booking locally (authoritative)
- Booking synced to cloud for organization-wide reporting
- Cloud CANNOT modify hub bookings (except soft-delete for GDPR)

**Conflict Resolution:**
- **Hub authoritative** for booking details (time, game, pricing)
- **Cloud cannot override** hub booking data
- Cloud can add metadata (tags, notes) in separate `booking_metadata` table

**Schema Mapping:**

```typescript
// Hub-side booking table (SQLite)
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  cloud_booking_id: text('cloud_booking_id'), // UUID from cloud
  customer_id: text('customer_id').notNull().references(() => customers.id),
  game_id: text('game_id').notNull().references(() => games.id),
  booking_date: text('booking_date').notNull(),
  start_time: text('start_time').notNull(),
  duration_minutes: integer('duration_minutes').notNull(),
  party_size: integer('party_size').notNull(),
  status: text('status').notNull(), // 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price_paid: integer('price_paid'),
  payment_method: text('payment_method'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  synced_at: text('synced_at')
});

// Cloud-side booking table (PostgreSQL)
export const booking = pgTable('booking', {
  id: uuid('id').primaryKey(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id),
  organization_id: uuid('organization_id').notNull().references(() => organization.id),
  customer_id: uuid('customer_id').notNull().references(() => customer.id),
  hub_booking_id: text('hub_booking_id').notNull(), // Original hub-side ID
  game_name: text('game_name').notNull(), // Denormalized for reporting
  booking_date: date('booking_date').notNull(),
  start_time: time('start_time').notNull(),
  duration_minutes: integer('duration_minutes').notNull(),
  party_size: integer('party_size').notNull(),
  status: text('status').notNull(),
  price_paid: integer('price_paid'),
  created_at: timestamp('created_at').notNull(),
  synced_at: timestamp('synced_at').notNull().defaultNow()
}, (table) => ({
  orgIdx: index('idx_booking_organization').on(table.organization_id),
  hubIdx: index('idx_booking_hub').on(table.hub_id),
  customerIdx: index('idx_booking_customer').on(table.customer_id),
  dateIdx: index('idx_booking_date').on(table.booking_date)
}));
```

**Sessions (Hub → Cloud, Read-Only):**

**Flow:**
1. Hub creates session locally (authoritative)
2. Session state updates streamed to cloud in real-time (WebSocket)
3. Cloud stores read-only copy for analytics and remote dashboard
4. Cloud CANNOT send commands to modify session (future feature: remote pause/hint)

**Schema Mapping:**

```typescript
// Cloud-side session table (PostgreSQL, read-only mirror)
export const session_history = pgTable('session_history', {
  id: uuid('id').primaryKey(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id),
  organization_id: uuid('organization_id').notNull().references(() => organization.id),
  hub_session_id: text('hub_session_id').notNull(), // Original hub-side ID
  booking_id: uuid('booking_id').references(() => booking.id),
  game_name: text('game_name').notNull(),
  started_at: timestamp('started_at').notNull(),
  ended_at: timestamp('ended_at'),
  duration_seconds: integer('duration_seconds'),
  hints_sent: integer('hints_sent').notNull().default(0),
  puzzles_completed: integer('puzzles_completed').notNull().default(0),
  final_status: text('final_status'), // 'completed' | 'failed' | 'abandoned'
  synced_at: timestamp('synced_at').notNull().defaultNow()
}, (table) => ({
  orgIdx: index('idx_session_organization').on(table.organization_id),
  hubIdx: index('idx_session_hub').on(table.hub_id),
  startedIdx: index('idx_session_started').on(table.started_at)
}));
```

### 6.2 Hub-Local Entities (No Cloud Sync)

**Games:**
- Remain hub-local; each location has unique game configurations
- Cloud does NOT store game definitions (future: game template library)

**Operators (Hub-Local):**
- Default mode: operators created hub-side remain local
- Cloud-granted operators synced to hub as read-only (managed via organization membership)

**Settings:**
- Network configuration (SSID, channel) remains hub-local
- System settings (timezone, camera config) remain hub-local

**Rooms:**
- Room definitions remain hub-local (each location has unique room layout)

### 6.3 Operator Account Sharing

**Global Operators (Cloud-Managed):**

**Flow:**
1. Organization owner invites operator via Better Auth invitation system
2. Operator accepts invitation, joins organization
3. Owner grants operator access to specific hubs (or all hubs)
4. Cloud syncs operator account to granted hubs
5. Hub creates local operator account (read-only, managed via cloud)

**Schema:**

```typescript
// Hub-side operator table addition
export const user = sqliteTable('user', {
  // ... existing fields
  cloud_user_id: text('cloud_user_id'), // UUID from cloud (null for hub-local operators)
  is_cloud_managed: integer('is_cloud_managed', { mode: 'boolean' }).default(false),
  cloud_synced_at: text('cloud_synced_at')
});
```

**Permissions:**
- Cloud-managed operators: role/permissions set cloud-side, synced to hub as read-only
- Hub-local operators: role/permissions managed hub-side (default mode pre-cloud)
- Cloud-managed operators CANNOT be edited hub-side (UI shows "Managed via Cloud Account")

**Password Management:**
- Cloud-managed operators: password stored cloud-side, authenticated via cloud API
- Hub-local operators: password stored hub-side (bcrypt hash in SQLite)
- Hybrid auth flow: hub checks `is_cloud_managed` flag, redirects to cloud auth if true

---

## 7. Hub-to-Organization Foreign Key Relationships

### 7.1 Cloud-Side Relationships

**Organization → Hubs (One-to-Many):**

```typescript
// Drizzle ORM relationship definition
export const organizationRelations = relations(organization, ({ many }) => ({
  hubs: many(hub),
  members: many(member),
  customers: many(customer),
  invitations: many(invitation)
}));

export const hubRelations = relations(hub, ({ one, many }) => ({
  organization: one(organization, {
    fields: [hub.organization_id],
    references: [organization.id]
  }),
  members: many(hub_member),
  bookings: many(booking),
  sessions: many(session_history)
}));
```

**Cascade Behavior:**

| Parent | Child | Delete Action | Rationale |
|--------|-------|---------------|-----------|
| organization | hub | CASCADE | When org deleted, all hubs decommissioned |
| organization | member | CASCADE | Org deletion removes all memberships |
| organization | customer | CASCADE | GDPR compliance; org deletion purges all customer data |
| hub | hub_member | CASCADE | Hub decommission revokes all operator access |
| hub | booking | CASCADE | Hub decommission archives all bookings |
| member | hub_member | CASCADE | Member removal revokes hub-specific access |

**Constraint Enforcement:**

```sql
-- PostgreSQL constraints (applied via Drizzle migrations)
ALTER TABLE hub
  ADD CONSTRAINT fk_hub_organization
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE hub_member
  ADD CONSTRAINT fk_hub_member_hub
  FOREIGN KEY (hub_id) REFERENCES hub(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_hub_member_user
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE booking
  ADD CONSTRAINT fk_booking_hub
  FOREIGN KEY (hub_id) REFERENCES hub(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_booking_organization
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
```

### 7.2 Hub-Side Relationships (Minimal Cloud References)

**Hub Database Cloud References:**

```typescript
// Hub SQLite schema - minimal cloud references
export const hub_config = sqliteTable('hub_config', {
  id: text('id').primaryKey(),
  cloud_organization_id: text('cloud_organization_id'), // UUID from cloud (nullable)
  cloud_hub_id: text('cloud_hub_id'), // UUID from cloud (nullable)
  sync_enabled: integer('sync_enabled', { mode: 'boolean' }).default(false),
  last_sync_at: text('last_sync_at')
});

// Customer table references cloud customer ID
export const customers = sqliteTable('customers', {
  // ... existing fields
  cloud_customer_id: text('cloud_customer_id') // UUID from cloud (nullable)
});

// User table references cloud user ID for cloud-managed operators
export const user = sqliteTable('user', {
  // ... existing fields
  cloud_user_id: text('cloud_user_id') // UUID from cloud (nullable)
});
```

**No Foreign Key Constraints:**
- Hub does NOT enforce foreign key constraints to cloud IDs
- Cloud IDs stored as plain text UUIDs for reference only
- Hub remains fully functional if cloud is unreachable

---

## 8. Hub Identity & Authentication to Cloud

### 8.1 Authentication Methods

**API Key Authentication (Primary Method):**

**Flow:**
1. Hub includes API key in `Authorization` header for every cloud API request
2. Cloud validates API key hash against `hub.api_key_hash`
3. Cloud loads hub context (organization_id, hub_id, permissions)
4. Request proceeds with hub identity attached

**Request Format:**

```bash
curl -X POST https://sync.escapeplan.io/api/sync/customers \
  -H "Authorization: Bearer ep_live_K7mP3xQ9vR2wN8jY4hT6sL1bF5cZ0dA" \
  -H "Content-Type: application/json" \
  -d '{"customers": [...]}'
```

**Server-Side Validation (Fastify Hook):**

```typescript
// Fastify hook: validateHubApiKey
fastify.addHook('onRequest', async (request, reply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ep_live_')) {
    return reply.code(401).send({ error: 'Invalid API key format' });
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer "

  // Hash API key and lookup hub
  const apiKeyHash = await bcrypt.hash(apiKey, 10);
  const hub = await db.query.hub.findFirst({
    where: eq(hub.api_key_hash, apiKeyHash),
    with: {
      organization: true
    }
  });

  if (!hub) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }

  if (hub.status !== 'active') {
    return reply.code(403).send({ error: 'Hub suspended or decommissioned' });
  }

  // Attach hub context to request
  request.hub = hub;
  request.organizationId = hub.organization_id;
});
```

**JWT Session Tokens (Future Enhancement):**

For real-time WebSocket connections, API keys are not ideal (logged in plain text, no expiry). Future implementation:

1. Hub authenticates with API key
2. Cloud issues short-lived JWT (1-hour expiry)
3. Hub uses JWT for WebSocket connection
4. JWT includes hub_id, organization_id, permissions
5. JWT auto-refreshed before expiry

**JWT Payload:**

```typescript
{
  "sub": "hub-456", // Hub ID
  "org": "org-123", // Organization ID
  "type": "hub",
  "permissions": ["sync:read", "sync:write", "dashboard:read"],
  "iat": 1728000000,
  "exp": 1728003600 // 1 hour from iat
}
```

### 8.2 Certificate-Based Authentication (Optional, Future)

For high-security environments, support mTLS (mutual TLS):

**Flow:**
1. During hub registration, cloud generates X.509 certificate for hub
2. Hub stores certificate in `/etc/escapeplan/certs/hub-cert.pem`
3. Hub uses certificate for HTTPS client authentication
4. Cloud validates certificate against CA (certificate authority)
5. Certificate embedded with hub_id in Subject Alternative Name (SAN)

**Benefits:**
- No API key storage (certificate-based authentication)
- Auto-rotation via ACME protocol (Let's Encrypt)
- Stronger security posture (private key never transmitted)

**Drawbacks:**
- Complex certificate management
- Requires PKI infrastructure
- Not supported by all cloud load balancers

**Decision:** Defer to future release; API key + JWT sufficient for MVP.

### 8.3 API Key Rotation

**Automatic Rotation (Annual):**

```typescript
// Cron job: Check for API keys older than 365 days
async function rotateExpiredApiKeys() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const hubs = await db.query.hub.findMany({
    where: and(
      eq(hub.status, 'active'),
      lte(hub.api_key_last_rotated, oneYearAgo)
    )
  });

  for (const hub of hubs) {
    // Generate new API key
    const newApiKey = generateApiKey(); // ep_live_...
    const newApiKeyHash = await bcrypt.hash(newApiKey, 10);

    // Update hub with new key (grace period: old key still valid for 30 days)
    await db.update(hub)
      .set({
        api_key_hash_pending: newApiKeyHash,
        api_key_rotation_started_at: new Date()
      })
      .where(eq(hub.id, hub.id));

    // Notify hub of new API key (via sync response header)
    await notifyHubOfKeyRotation(hub.id, newApiKey);

    // Email organization owner
    await sendEmail({
      to: hub.organization.billing_email,
      subject: 'Hub API Key Rotation Required',
      body: `API key for hub "${hub.name}" has been rotated. The new key has been delivered to the hub automatically.`
    });
  }
}
```

**Hub-Side Auto-Update:**

```typescript
// Hub sync client: Check for X-API-Key-Rotation header
async function syncToCloud() {
  const response = await fetch('https://sync.escapeplan.io/api/sync/status', {
    headers: {
      'Authorization': `Bearer ${currentApiKey}`
    }
  });

  const newApiKey = response.headers.get('X-API-Key-Rotation');
  if (newApiKey) {
    // Update local config with new API key
    await updateCloudConfig({ apiKey: newApiKey });
    logger.info('API key rotated successfully');
  }
}
```

**Manual Rotation (Security Incident):**

```typescript
// API: POST /api/org/hub/:hubId/rotate-api-key
{
  reason: "Security incident - key compromised"
}

// Response:
{
  newApiKey: "ep_live_NEW_KEY_HERE", // Shown ONCE
  rotatedAt: "2025-10-03T14:30:00Z",
  gracePeriodEnds: "2025-11-02T14:30:00Z" // 30 days
}
```

---

## 9. Organization Hierarchy Model

### 9.1 Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       ORGANIZATION                          │
│  (Cloud-Only Concept)                                       │
│  - id: org-123                                              │
│  - name: "Escape Quest Multi-Location"                     │
│  - subscription_tier: "cloud_control"                      │
│  - active_hub_count: 3                                     │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  HUB 1   │    │  HUB 2   │    │  HUB 3   │
    │ Seattle  │    │ Portland │    │ Tacoma   │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Hub DB   │    │ Hub DB   │    │ Hub DB   │
    │ (SQLite) │    │ (SQLite) │    │ (SQLite) │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
              ┌─────────────────────────┐
              │   CLOUD DATABASE        │
              │   (PostgreSQL)          │
              │                         │
              │ - Organizations         │
              │ - Hubs                  │
              │ - Members               │
              │ - Shared Customers      │
              │ - Aggregated Bookings   │
              │ - Session History       │
              └─────────────────────────┘
```

### 9.2 Roles & Permissions Hierarchy

**Organization-Level Roles:**

| Role | Permissions | Description |
|------|-------------|-------------|
| **Owner** | All permissions | Creator of organization; billing access; can delete org |
| **Admin** | All except billing, org delete | Can manage hubs, invite members, view all analytics |
| **Manager** | Hub-specific permissions | Can configure assigned hubs, view analytics for assigned hubs |
| **Game Master** | Operational only | Can run sessions, send hints; no admin access |

**Hub-Level Roles:**

| Role | Permissions | Description |
|------|-------------|-------------|
| **Hub Admin** | All hub operations | Can configure hub settings, manage local operators |
| **Hub Manager** | Bookings, sessions, games | Can create bookings, run sessions, edit games |
| **Hub Game Master** | Session operations only | Can run sessions, send hints; read-only for bookings |

**Permission Matrix:**

| Action | Owner | Admin | Manager | Game Master |
|--------|-------|-------|---------|-------------|
| Create organization | ✅ | ❌ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| Register hub | ✅ | ✅ | ❌ | ❌ |
| Decommission hub | ✅ | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Grant hub access | ✅ | ✅ | ❌ | ❌ |
| View all analytics | ✅ | ✅ | ❌ | ❌ |
| View assigned hub analytics | ✅ | ✅ | ✅ | ❌ |
| Configure hub settings | ✅ | ✅ | ✅ | ❌ |
| Create bookings | ✅ | ✅ | ✅ | ❌ |
| Run sessions | ✅ | ✅ | ✅ | ✅ |
| Send hints | ✅ | ✅ | ✅ | ✅ |

### 9.3 Member Invitation Flow

**Step 1: Owner/Admin Invites Member**

```typescript
// API: POST /api/org/members/invite
{
  organizationId: "org-123",
  email: "jane@example.com",
  role: "manager",
  hubAccess: ["hub-1", "hub-2"], // Specific hubs (if not access_all_hubs)
  accessAllHubs: false
}

// Response:
{
  invitationId: "inv-456",
  email: "jane@example.com",
  expiresAt: "2025-10-10T14:30:00Z",
  invitationLink: "https://app.escapeplan.io/invitations/inv-456"
}
```

**Step 2: Invitation Email Sent**

```
Subject: You've been invited to join Escape Quest Multi-Location

Hi Jane,

John Doe has invited you to join Escape Quest Multi-Location as a Manager.

As a manager, you'll have access to:
- Downtown Seattle Location
- Bellevue Location

Click here to accept: https://app.escapeplan.io/invitations/inv-456

This invitation expires on October 10, 2025.
```

**Step 3: Recipient Accepts Invitation**

```typescript
// API: POST /api/org/invitations/:invitationId/accept
{
  invitationId: "inv-456"
}

// Response:
{
  memberId: "mem-789",
  organizationId: "org-123",
  role: "manager",
  hubAccess: ["hub-1", "hub-2"],
  message: "You are now a member of Escape Quest Multi-Location"
}
```

**Step 4: Member Record Created**

```sql
INSERT INTO member (
  id, user_id, organization_id, role, access_all_hubs, invited_by
) VALUES (
  'mem-789', 'user-123', 'org-123', 'manager', false, 'user-owner'
);

INSERT INTO hub_member (id, hub_id, user_id, role, granted_by)
VALUES
  ('hm-1', 'hub-1', 'user-123', 'manager', 'user-owner'),
  ('hm-2', 'hub-2', 'user-123', 'manager', 'user-owner');
```

**Step 5: User Synced to Hubs**

Cloud triggers sync to Hub 1 and Hub 2:

```typescript
// Sync payload sent to each hub
{
  operation: "sync_user",
  user: {
    id: "user-123",
    name: "Jane Doe",
    email: "jane@example.com",
    username: "jane.doe",
    role: "manager",
    cloud_user_id: "user-123",
    is_cloud_managed: true
  }
}
```

Hub creates local user account (read-only, cloud-managed).

---

## 10. Database Schema Reference

### 10.1 Cloud Database Schema (PostgreSQL)

**Complete Schema with Drizzle ORM:**

```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, date, time, index, unique } from 'drizzle-orm/pg-core';

// ============================================================================
// BETTER AUTH CORE TABLES
// ============================================================================

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// ============================================================================
// BETTER AUTH ORGANIZATION TABLES (with extensions)
// ============================================================================

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),

  // EscapePlan extensions
  billing_email: text('billing_email').notNull(),
  subscription_status: text('subscription_status').notNull().default('active'),
  subscription_tier: text('subscription_tier').notNull().default('cloud_control'),
  stripe_customer_id: text('stripe_customer_id').unique(),
  stripe_subscription_id: text('stripe_subscription_id').unique(),
  hub_limit: integer('hub_limit').notNull().default(10),
  active_hub_count: integer('active_hub_count').notNull().default(0),
  archived_at: timestamp('archived_at')
});

export const member = pgTable('member', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),

  // EscapePlan extensions
  teamId: uuid('team_id'),
  access_all_hubs: boolean('access_all_hubs').notNull().default(false),
  invited_by: uuid('invited_by').references(() => user.id),
  last_active_at: timestamp('last_active_at')
}, (table) => ({
  uniqueUserOrg: unique('unique_user_org').on(table.userId, table.organizationId)
}));

export const invitation = pgTable('invitation', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  inviterId: uuid('inviter_id').notNull().references(() => user.id),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),

  // EscapePlan extensions
  teamId: uuid('team_id'),
  hub_access: jsonb('hub_access'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  accepted_at: timestamp('accepted_at'),
  rejected_at: timestamp('rejected_at')
});

// ============================================================================
// ESCAPEPLAN CUSTOM TABLES
// ============================================================================

export const hub = pgTable('hub', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location').notNull(),
  hardware_fingerprint: text('hardware_fingerprint').notNull().unique(),
  api_key_hash: text('api_key_hash').notNull(),
  api_key_last_rotated: timestamp('api_key_last_rotated').notNull().defaultNow(),
  license_key: text('license_key').notNull(),
  license_type: text('license_type').notNull(),
  room_capacity: integer('room_capacity').notNull(),
  status: text('status').notNull().default('active'),
  online_status: text('online_status').notNull().default('offline'),
  last_seen_at: timestamp('last_seen_at'),
  last_sync_at: timestamp('last_sync_at'),
  software_version: text('software_version'),
  pi_model: text('pi_model'),
  metadata: jsonb('metadata'),
  registered_at: timestamp('registered_at').notNull().defaultNow(),
  registered_by: uuid('registered_by').notNull().references(() => user.id),
  decommissioned_at: timestamp('decommissioned_at'),
  decommissioned_by: uuid('decommissioned_by').references(() => user.id)
}, (table) => ({
  orgIdx: index('idx_hub_organization').on(table.organization_id),
  fingerprintIdx: index('idx_hub_fingerprint').on(table.hardware_fingerprint),
  statusIdx: index('idx_hub_status').on(table.status)
}));

export const hub_member = pgTable('hub_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  granted_at: timestamp('granted_at').notNull().defaultNow(),
  granted_by: uuid('granted_by').notNull().references(() => user.id),
  last_access_at: timestamp('last_access_at')
}, (table) => ({
  uniqueHubUser: unique('unique_hub_user').on(table.hub_id, table.user_id),
  hubIdx: index('idx_hub_member_hub').on(table.hub_id),
  userIdx: index('idx_hub_member_user').on(table.user_id)
}));

export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  hub_customer_mappings: jsonb('hub_customer_mappings'),
  loyalty_points: integer('loyalty_points').notNull().default(0),
  lifetime_bookings: integer('lifetime_bookings').notNull().default(0),
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: boolean('marketing_opted_in').notNull().default(false),
  notes: text('notes'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
  archived_at: timestamp('archived_at')
}, (table) => ({
  orgIdx: index('idx_customer_organization').on(table.organization_id),
  emailIdx: index('idx_customer_email').on(table.email)
}));

export const booking = pgTable('booking', {
  id: uuid('id').primaryKey().defaultRandom(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id, { onDelete: 'cascade' }),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  customer_id: uuid('customer_id').notNull().references(() => customer.id),
  hub_booking_id: text('hub_booking_id').notNull(),
  game_name: text('game_name').notNull(),
  booking_date: date('booking_date').notNull(),
  start_time: time('start_time').notNull(),
  duration_minutes: integer('duration_minutes').notNull(),
  party_size: integer('party_size').notNull(),
  status: text('status').notNull(),
  price_paid: integer('price_paid'),
  created_at: timestamp('created_at').notNull(),
  synced_at: timestamp('synced_at').notNull().defaultNow()
}, (table) => ({
  orgIdx: index('idx_booking_organization').on(table.organization_id),
  hubIdx: index('idx_booking_hub').on(table.hub_id),
  customerIdx: index('idx_booking_customer').on(table.customer_id),
  dateIdx: index('idx_booking_date').on(table.booking_date)
}));

export const session_history = pgTable('session_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id, { onDelete: 'cascade' }),
  organization_id: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  hub_session_id: text('hub_session_id').notNull(),
  booking_id: uuid('booking_id').references(() => booking.id),
  game_name: text('game_name').notNull(),
  started_at: timestamp('started_at').notNull(),
  ended_at: timestamp('ended_at'),
  duration_seconds: integer('duration_seconds'),
  hints_sent: integer('hints_sent').notNull().default(0),
  puzzles_completed: integer('puzzles_completed').notNull().default(0),
  final_status: text('final_status'),
  synced_at: timestamp('synced_at').notNull().defaultNow()
}, (table) => ({
  orgIdx: index('idx_session_organization').on(table.organization_id),
  hubIdx: index('idx_session_hub').on(table.hub_id),
  startedIdx: index('idx_session_started').on(table.started_at)
}));

export const sync_metadata = pgTable('sync_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  hub_id: uuid('hub_id').notNull().references(() => hub.id, { onDelete: 'cascade' }),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  last_synced_at: timestamp('last_synced_at').notNull(),
  hub_version: text('hub_version'),
  cloud_version: text('cloud_version')
});
```

### 10.2 Hub Database Schema (SQLite)

**Minimal Cloud References:**

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// HUB CONFIGURATION (Cloud Integration)
// ============================================================================

export const hub_config = sqliteTable('hub_config', {
  id: text('id').primaryKey(),
  cloud_organization_id: text('cloud_organization_id'),
  cloud_hub_id: text('cloud_hub_id'),
  sync_enabled: integer('sync_enabled', { mode: 'boolean' }).default(false),
  last_sync_at: text('last_sync_at'),
  api_key_encrypted: text('api_key_encrypted') // AES-256 encrypted, key in secure element
});

// ============================================================================
// SYNC QUEUE (Outbound Changes to Cloud)
// ============================================================================

export const sync_queue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  operation: text('operation').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  synced_at: text('synced_at'),
  sync_status: text('sync_status').notNull().default('pending'),
  retry_count: integer('retry_count').notNull().default(0),
  last_error: text('last_error')
});

// ============================================================================
// CUSTOMERS (with cloud reference)
// ============================================================================

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  cloud_customer_id: text('cloud_customer_id'), // UUID from cloud
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  loyalty_points: integer('loyalty_points').default(0),
  cloud_loyalty_points: integer('cloud_loyalty_points').default(0),
  preferred_difficulty: text('preferred_difficulty'),
  marketing_opted_in: integer('marketing_opted_in', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  synced_at: text('synced_at'),
  archived_at: text('archived_at')
});

// ============================================================================
// USERS (with cloud reference for cloud-managed operators)
// ============================================================================

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  cloud_user_id: text('cloud_user_id'), // UUID from cloud
  is_cloud_managed: integer('is_cloud_managed', { mode: 'boolean' }).default(false),

  // ... existing user fields from schema.ts
  name: text('name').notNull(),
  email: text('email').unique(),
  username: text('username').notNull().unique(),
  user_type: text('user_type').notNull().default('operator'),
  role_id: text('role_id').notNull(),

  // ... rest of fields
  cloud_synced_at: text('cloud_synced_at')
});
```

---

## 11. API Endpoints

### 11.1 Organization Management

**POST /api/org/create**

Creates a new organization and assigns the creator as owner.

**Request:**
```json
{
  "name": "Escape Quest Multi-Location",
  "slug": "escape-quest",
  "billing_email": "billing@escapequest.com"
}
```

**Response:**
```json
{
  "organizationId": "org-123",
  "name": "Escape Quest Multi-Location",
  "slug": "escape-quest",
  "role": "owner",
  "createdAt": "2025-10-03T14:30:00Z"
}
```

**GET /api/org/:organizationId**

Retrieves organization details (requires membership).

**Response:**
```json
{
  "id": "org-123",
  "name": "Escape Quest Multi-Location",
  "slug": "escape-quest",
  "billing_email": "billing@escapequest.com",
  "subscription_status": "active",
  "subscription_tier": "cloud_control",
  "active_hub_count": 3,
  "hub_limit": 10,
  "createdAt": "2025-10-01T10:00:00Z"
}
```

**PATCH /api/org/:organizationId**

Updates organization details (owner/admin only).

**Request:**
```json
{
  "name": "Escape Quest Northwest",
  "billing_email": "newbilling@escapequest.com"
}
```

**DELETE /api/org/:organizationId**

Deletes organization and all hubs (owner only, requires confirmation).

**Request:**
```json
{
  "confirmation": "DELETE Escape Quest Multi-Location"
}
```

### 11.2 Hub Management

**POST /api/org/:organizationId/hub/initiate-registration**

Initiates hub registration process (owner/admin only).

**Request:**
```json
{
  "hubName": "Downtown Seattle Location",
  "location": "123 Main St, Seattle WA 98101",
  "licenseKey": "STARTER-ABCD-1234-EFGH"
}
```

**Response:**
```json
{
  "registrationToken": "reg-token-xyz",
  "expiresAt": "2025-10-03T15:30:00Z",
  "instructions": "https://docs.escapeplan.io/hub-registration"
}
```

**POST /api/hub/complete-registration**

Completes hub registration (called from hub).

**Request:**
```json
{
  "registrationToken": "reg-token-xyz",
  "hardwareFingerprint": "sha256:abcdef1234567890",
  "hubMetadata": {
    "piModel": "Raspberry Pi 4 Model B",
    "softwareVersion": "0.2.0",
    "networkSsid": "EscapePlan-Downtown"
  }
}
```

**Response:**
```json
{
  "hubId": "hub-456",
  "apiKey": "ep_live_abc123xyz789",
  "organizationId": "org-123",
  "syncEndpoint": "https://sync.escapeplan.io",
  "dashboardUrl": "https://app.escapeplan.io/orgs/org-123/hubs/hub-456"
}
```

**GET /api/org/:organizationId/hubs**

Lists all hubs in organization (requires membership).

**Response:**
```json
{
  "hubs": [
    {
      "id": "hub-1",
      "name": "Downtown Seattle",
      "location": "123 Main St, Seattle WA",
      "status": "active",
      "online_status": "online",
      "last_seen_at": "2025-10-03T14:25:00Z",
      "room_capacity": 4,
      "software_version": "0.2.0"
    },
    {
      "id": "hub-2",
      "name": "Bellevue",
      "location": "456 Elm St, Bellevue WA",
      "status": "active",
      "online_status": "offline",
      "last_seen_at": "2025-10-03T12:00:00Z",
      "room_capacity": 8,
      "software_version": "0.2.0"
    }
  ]
}
```

**POST /api/org/hub/:hubId/decommission**

Decommissions a hub (owner/admin only).

**Request:**
```json
{
  "reason": "Location closed",
  "archiveData": true
}
```

**Response:**
```json
{
  "hubId": "hub-456",
  "status": "decommissioned",
  "decommissioned_at": "2025-10-03T14:30:00Z",
  "data_archived": true
}
```

### 11.3 Member Management

**POST /api/org/:organizationId/members/invite**

Invites a user to join organization (owner/admin only).

**Request:**
```json
{
  "email": "jane@example.com",
  "role": "manager",
  "hubAccess": ["hub-1", "hub-2"],
  "accessAllHubs": false
}
```

**Response:**
```json
{
  "invitationId": "inv-456",
  "email": "jane@example.com",
  "expiresAt": "2025-10-10T14:30:00Z",
  "invitationLink": "https://app.escapeplan.io/invitations/inv-456"
}
```

**GET /api/org/:organizationId/members**

Lists all organization members.

**Response:**
```json
{
  "members": [
    {
      "id": "mem-1",
      "user": {
        "id": "user-1",
        "name": "John Doe",
        "email": "john@escapequest.com"
      },
      "role": "owner",
      "access_all_hubs": true,
      "last_active_at": "2025-10-03T14:00:00Z"
    },
    {
      "id": "mem-2",
      "user": {
        "id": "user-2",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "role": "manager",
      "access_all_hubs": false,
      "hub_count": 2,
      "last_active_at": "2025-10-03T13:00:00Z"
    }
  ]
}
```

**DELETE /api/org/:organizationId/members/:memberId**

Removes a member from organization (owner/admin only).

### 11.4 Sync Endpoints (Hub Authentication)

**POST /api/sync/customers**

Syncs customers from hub to cloud.

**Request (Hub API Key Authentication):**
```json
{
  "customers": [
    {
      "hub_customer_id": "cust-local-1",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "phone": "+1-206-555-0100",
      "loyalty_points": 150,
      "created_at": "2025-09-15T10:00:00Z",
      "updated_at": "2025-10-03T14:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "synced": [
    {
      "hub_customer_id": "cust-local-1",
      "cloud_customer_id": "customer-cloud-1",
      "action": "created",
      "merged_with": null
    }
  ]
}
```

**GET /api/sync/customers**

Fetches all customers for organization (hub pulls).

**Response:**
```json
{
  "customers": [
    {
      "cloud_customer_id": "customer-cloud-1",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "phone": "+1-206-555-0100",
      "loyalty_points": 350,
      "hub_customer_mappings": {
        "hub-1": "cust-local-1",
        "hub-2": "cust-local-5"
      },
      "updated_at": "2025-10-03T14:00:00Z"
    }
  ]
}
```

**POST /api/sync/heartbeat**

Hub sends heartbeat to update online status.

**Request:**
```json
{
  "software_version": "0.2.0",
  "online_status": "online",
  "metadata": {
    "active_sessions": 2,
    "bookings_today": 8
  }
}
```

**Response:**
```json
{
  "last_seen_at": "2025-10-03T14:30:00Z",
  "api_key_rotation": null,
  "sync_required": false
}
```

---

## 12. Error Handling & Edge Cases

### 12.1 Hub Registration Errors

| Error | HTTP Code | Cause | Resolution |
|-------|-----------|-------|------------|
| `REGISTRATION_TOKEN_EXPIRED` | 400 | Registration token expired (>1 hour) | Re-initiate registration from cloud dashboard |
| `REGISTRATION_TOKEN_INVALID` | 400 | Invalid or already-used token | Re-initiate registration |
| `HARDWARE_FINGERPRINT_EXISTS` | 409 | Fingerprint already registered | Contact support to decommission old hub |
| `LICENSE_KEY_INVALID` | 400 | License key not found or invalid format | Verify license key with support |
| `LICENSE_KEY_ALREADY_USED` | 409 | License key already claimed by another hub | Check if multi-site add-on purchased |
| `HUB_LIMIT_EXCEEDED` | 403 | Organization at max hub count | Upgrade subscription or decommission old hub |
| `ORGANIZATION_SUSPENDED` | 403 | Billing issue, subscription suspended | Update payment method |

### 12.2 Sync Errors

| Error | HTTP Code | Cause | Resolution |
|-------|-----------|-------|------------|
| `API_KEY_INVALID` | 401 | API key not found or revoked | Rotate API key from dashboard |
| `API_KEY_EXPIRED` | 401 | API key past rotation grace period | Rotate API key |
| `HUB_SUSPENDED` | 403 | Hub decommissioned or suspended | Contact support |
| `SYNC_CONFLICT` | 409 | Cloud and hub have conflicting data | Manual merge required |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many sync requests | Backoff and retry |
| `CLOUD_UNAVAILABLE` | 503 | Cloud service down | Queue changes, retry later |

### 12.3 Edge Case Handling

**Scenario: Hub Offline for Extended Period (>90 days)**

1. Hub attempts sync after extended offline period
2. Cloud checks `hub.last_sync_at` timestamp
3. If >90 days, cloud triggers **full reconciliation** instead of delta sync
4. Cloud sends all customers, hub compares and merges
5. Hub sends all bookings since last sync, cloud detects duplicates via `hub_booking_id`

**Scenario: Customer Duplicate Detection**

1. Hub syncs customer `{ email: "alice@example.com", name: "Alice J" }`
2. Cloud finds existing customer `{ email: "alice@example.com", name: "Alice Johnson" }`
3. Cloud merges records:
   - Updates `hub_customer_mappings` to include new hub's local ID
   - Aggregates loyalty points: `cloud_loyalty_points = sum(all hub points)`
   - Chooses longer name variant: "Alice Johnson" (heuristic)
4. Cloud returns `cloud_customer_id` to hub
5. Hub updates local customer with cloud ID

**Scenario: Organization Deletion**

1. Owner initiates organization deletion
2. Cloud prompts for confirmation: "Type 'DELETE Escape Quest Multi-Location'"
3. On confirmation, cloud:
   - Revokes all hub API keys
   - Sends decommission signal to online hubs
   - Cancels Stripe subscription
   - Archives all customer data (GDPR: 90-day retention)
   - Soft-deletes organization record (`archived_at` timestamp)
4. Hubs receive decommission signal, disable cloud sync, remain operational locally

**Scenario: Operator Removed from Organization**

1. Admin removes operator from organization members
2. Cloud deletes `member` and `hub_member` records
3. Cloud sends operator revocation signal to affected hubs
4. Hubs check if operator is cloud-managed (`is_cloud_managed = true`)
5. If cloud-managed, hub marks operator as archived (cannot delete due to FK constraints)
6. If hub-local, no action taken (hub retains local operator)

---

## 13. Test Strategy

### 13.1 Unit Tests

**Organization CRUD:**
- ✅ Create organization with valid data
- ✅ Prevent duplicate slugs
- ✅ Validate billing email format
- ✅ Update organization as owner
- ✅ Reject update as non-member
- ✅ Delete organization (cascade behavior)

**Hub Registration:**
- ✅ Initiate registration with valid license key
- ✅ Reject registration with invalid license key
- ✅ Prevent duplicate hardware fingerprint
- ✅ Complete registration with valid token
- ✅ Reject expired registration token
- ✅ Increment organization hub count on registration

**Member Management:**
- ✅ Invite member with specific hub access
- ✅ Invite member with access_all_hubs
- ✅ Accept invitation (create member + hub_member records)
- ✅ Reject invitation (update status, send notification)
- ✅ Remove member (cascade to hub_member)

### 13.2 Integration Tests

**Multi-Hub Sync:**
- ✅ Hub 1 creates customer, syncs to cloud
- ✅ Cloud assigns cloud_customer_id
- ✅ Hub 2 syncs customers, receives Hub 1's customer
- ✅ Hub 2 creates booking for shared customer
- ✅ Both hubs see customer's cross-location booking history

**Conflict Resolution:**
- ✅ Hub 1 updates customer (name change) while offline
- ✅ Hub 2 updates same customer (phone change) while offline
- ✅ Both hubs sync to cloud
- ✅ Cloud merges changes (last-write-wins for name, additive for phone)
- ✅ Both hubs receive merged customer on next sync

**Operator Sync:**
- ✅ Owner invites operator to organization
- ✅ Operator granted access to Hub 1 and Hub 2
- ✅ Cloud syncs operator to both hubs
- ✅ Operator logs into Hub 1 (cloud authentication)
- ✅ Owner revokes Hub 2 access
- ✅ Hub 2 archives operator account

### 13.3 E2E Tests (Playwright)

**Full Hub Registration Flow:**
1. Owner creates organization in cloud dashboard
2. Owner navigates to "Add Hub" screen
3. Owner enters hub details, initiates registration
4. Owner copies registration token
5. (Simulated) Hub CLI runs registration command with token
6. Hub appears in organization's hub list
7. Owner grants operator access to new hub
8. Operator sees new hub in hub switcher dropdown

**Cross-Hub Customer Booking:**
1. Operator at Hub 1 creates customer "Alice"
2. Alice books game at Hub 1
3. (Simulated) Sync to cloud completes
4. Operator at Hub 2 searches for "Alice"
5. Alice appears in search results (cloud-synced)
6. Operator sees Alice's booking history from Hub 1
7. Operator creates booking for Alice at Hub 2
8. (Simulated) Sync to cloud completes
9. Operator at Hub 1 refreshes Alice's profile
10. Hub 1 operator sees Hub 2 booking in history

### 13.4 Performance Tests

**Sync Throughput:**
- Target: 1000 customers synced in <30 seconds
- Target: 100 bookings synced in <5 seconds
- Measure: API response time under load (100 concurrent hubs)

**Conflict Resolution:**
- Simulate 10 hubs updating same customer simultaneously
- Verify all changes merged correctly
- Verify no data loss

---

## 14. Migration Path from Single-Tenant to Multi-Hub

### 14.1 Pre-Cloud State (Current MVP)

**Existing Hubs:**
- Standalone Pi appliances with local SQLite database
- No cloud integration, no organization concept
- Operators and customers are hub-local only

### 14.2 Migration Phases

**Phase 1: Cloud Account Creation (Opt-In)**

1. Existing hub owners visit cloud dashboard
2. Create organization account (free tier or paid Cloud Control)
3. Receive organization ID, no changes to hub yet

**Phase 2: Hub Registration**

1. Owner initiates hub registration from cloud dashboard
2. Hub CLI command adds cloud config to local database:
   ```sql
   INSERT INTO hub_config (id, cloud_organization_id, cloud_hub_id, sync_enabled)
   VALUES ('config-1', 'org-123', 'hub-456', 0); -- sync disabled by default
   ```
3. Hub stores API key in `/etc/escapeplan/cloud-config.json`
4. Hub remains fully functional locally (sync_enabled = 0)

**Phase 3: Enable Cloud Sync (Manual Trigger)**

1. Operator enables cloud sync in hub settings UI
2. Hub updates `hub_config.sync_enabled = 1`
3. Hub performs initial sync:
   - Uploads all customers to cloud (local IDs mapped to cloud IDs)
   - Uploads all bookings (linked to cloud customer IDs)
   - Uploads all sessions (read-only history)
4. Cloud stores data, returns acknowledgment
5. Hub UI shows "Cloud Sync Active" badge

**Phase 4: Multi-Hub Operations**

1. Owner registers additional hubs (Hub 2, Hub 3)
2. All hubs sync to shared cloud customer database
3. Operators can switch between hubs in cloud dashboard
4. Cross-location analytics available in cloud dashboard

### 14.3 Rollback Strategy

**Disable Cloud Sync:**
1. Operator disables cloud sync in hub settings
2. Hub sets `sync_enabled = 0` in `hub_config`
3. Hub continues operating with local data
4. No data deleted; cloud copy retained for future re-sync

**Decommission Hub from Organization:**
1. Owner decommissions hub from cloud dashboard
2. Cloud revokes API key
3. Hub receives decommission signal, disables cloud sync
4. Hub continues operating locally (single-tenant mode)
5. Cloud archives hub data (90-day retention)

---

## 15. Validation Checklist

### 15.1 Acceptance Criteria

- [x] **Organization schema documented with Drizzle ORM types**
  - Section 4: Complete PostgreSQL schema with Better Auth + EscapePlan extensions
  - Section 10.1: Full Drizzle ORM schema reference

- [x] **Hub linking mechanism designed (registration flow, API keys)**
  - Section 5.1: 3-step registration flow (initiate → complete → store credentials)
  - Section 5.2: API key format, storage, rotation policy
  - Section 5.3: Hardware fingerprinting collection and validation

- [x] **Data sharing patterns specified (which data syncs cross-hub)**
  - Section 6.1: Customer, booking, session sync patterns with conflict resolution
  - Section 6.2: Hub-local entities (games, settings, rooms)
  - Section 6.3: Operator account sharing (cloud-managed vs hub-local)

- [x] **Hub-to-org relationships documented with FK constraints**
  - Section 7.1: Cloud-side relationships with cascade behavior table
  - Section 7.2: Hub-side minimal cloud references (no FK constraints)

- [x] **Context7 research on Better Auth organization plugin included**
  - Section 2: Better Auth organization plugin research with schema, hooks, RBAC

- [x] **Hub authentication to cloud designed**
  - Section 8.1: API key authentication (primary), JWT session tokens (future)
  - Section 8.2: Certificate-based authentication (optional future)
  - Section 8.3: API key rotation (automatic annual + manual)

- [x] **Organization hierarchy clearly defined**
  - Section 9.1: Hierarchy diagram (organization → hubs → databases)
  - Section 9.2: Roles & permissions matrix (owner, admin, manager, game master)
  - Section 9.3: Member invitation flow (5-step process)

- [x] **All 8 QA checks pass:**
  1. ✅ **No placeholders:** No TODO, FIXME, STUB, TBD markers
  2. ✅ **Error handling:** Section 12 documents error cases for registration, sync, edge cases
  3. ✅ **Type hints:** All schemas include Drizzle ORM types (uuid, text, timestamp, etc.)
  4. ✅ **Tests:** Section 13 documents test strategy (unit, integration, E2E, performance)
  5. ✅ **Architecture:** Hub remains single-tenant, organization is cloud-only (Section 3)
  6. ✅ **Techstack:** Compatible with Better Auth v1.3.24+, Drizzle, SQLite (hub) + PostgreSQL (cloud)
  7. ✅ **Code quality:** Clear, well-structured design with schema examples
  8. ✅ **Documentation:** All sections complete with schema examples, API endpoints, test strategy

### 15.2 Better Auth Integration Points

- [x] Organization plugin schema extended with EscapePlan fields (Section 4.1)
- [x] Organization hooks identified for hub lifecycle events (Section 2.3)
- [x] Access control integration for hub-specific permissions (Section 2.4)
- [x] Member invitation system leveraging Better Auth defaults (Section 9.3)
- [x] Cloud user table follows Better Auth singular naming (user, session, account)

### 15.3 Monetization Alignment

- [x] Hub registration validates license key (Starter, Expansion, Multi-Site)
- [x] Organization tracks `active_hub_count` for billing ($129 + $35/hub)
- [x] Hub limit enforcement prevents exceeding subscription tier
- [x] Stripe integration points identified (subscription creation, usage updates)
- [x] Support tier validation (Priority requires Cloud Control subscription)

### 15.4 Offline-First Compliance

- [x] Hub database remains fully functional without cloud (Section 3.1)
- [x] Organization concept does NOT exist in hub database (Section 3.2)
- [x] Sync queue ensures no data loss during cloud outages (Section 3.3)
- [x] Cloud outage does not impact core hub operations (Section 12.2)
- [x] Rollback strategy allows disabling cloud sync without data loss (Section 14.3)

---

## Document Status

**Status:** ✅ Complete - Ready for Implementation

**Validation Results:**
- All 8 QA checks passed
- All acceptance criteria met
- Better Auth Context7 research completed
- Multi-hub billing model aligned with monetization requirements
- Offline-first architecture preserved
- Test strategy documented (unit, integration, E2E, performance)
- Migration path from single-tenant to multi-hub defined

**Next Steps:**
1. Implement cloud database schema using Drizzle ORM (PostgreSQL)
2. Build hub registration API endpoints (initiate, complete, decommission)
3. Implement API key authentication middleware (Fastify hooks)
4. Build sync engine (customer, booking, session sync)
5. Create cloud dashboard UI (organization management, hub list, analytics)
6. Implement Better Auth organization plugin integration
7. Build member invitation system (invite, accept, revoke)
8. Implement billing integration (Stripe subscription, usage tracking)

**Dependencies:**
- Better Auth v1.3.24+ (organization plugin)
- Drizzle ORM (PostgreSQL adapter for cloud, SQLite for hub)
- Fastify 5 (cloud API server)
- SvelteKit 2 (cloud dashboard UI)
- Stripe API (billing integration)
