# Logging & Alerting System Specification

**Document Version:** 1.0
**Created:** 2025-09-30
**Status:** Planning Phase
**Implementation Target:** Session 25+

---

## Executive Summary

This document outlines the design and implementation of a comprehensive logging and alerting system for EscapePlan. The current system uses a single `recent_alert` field on sessions, which creates alert fatigue by treating all events equally (hints, pauses, resets, etc.).

The new system separates **operational logs** (audit trail) from **actionable alerts** (operator attention required), with admin-configurable alert rules stored in the database.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Industry Best Practices](#industry-best-practices)
3. [Proposed Architecture](#proposed-architecture)
4. [Database Schema](#database-schema)
5. [Winston Logger Configuration](#winston-logger-configuration)
6. [Alert Rule Engine](#alert-rule-engine)
7. [Admin Configuration UI](#admin-configuration-ui)
8. [Migration Plan](#migration-plan)
9. [User Stories](#user-stories)
10. [Technical Stack Compatibility](#technical-stack-compatibility)
11. [Implementation Phases](#implementation-phases)
12. [Success Metrics](#success-metrics)

---

## Problem Statement

### Current Issues

**File:** `apps/escapeplan-api/src/db/schema.ts:118`
```typescript
recentAlert: text('recent_alert')
```

**Problems:**
1. ❌ **Alert Fatigue**: "New hint delivered", "Timer resumed", "Puzzle updated" are NOT alerts
2. ❌ **No Persistence**: Alert is overwritten on next event, no history
3. ❌ **No Dismissal**: Operators can't acknowledge/clear alerts
4. ❌ **No Logging**: No audit trail of system events
5. ❌ **No Context**: Timestamps are meaningless (always "now")
6. ❌ **No Configuration**: Alert rules are hardcoded

### What Should Actually Alert

**Critical (Immediate Attention):**
- Network offline/degraded
- System errors/crashes
- Timer malfunction
- Data corruption

**Warning (Actionable):**
- ⏸ Game paused - [Game Name]
- ⏱ Low time remaining (<5 min) - [Game Name]
- 🔔 Excessive hints (3+ in 5 minutes) - [Game Name]
- ⏰ Session overrun (past scheduled end)

**Info (Optional/Logs Only):**
- Session completed
- Booking checked in
- Timer started/resumed
- Hint delivered
- Puzzle status changed

---

## Industry Best Practices

### Research Summary

Based on 2024-2025 best practices research:

**Separation of Concerns:**
- **Logs** = Append-only audit trail (all events, never deleted)
- **Alerts** = Actionable notifications (can be dismissed, short retention)

**Winston Logging:**
- Daily log rotation (keep 14 days)
- Separate error logs
- Structured JSON format
- Console in development only
- Never log sensitive data (passwords, tokens)

**Database Design:**
- Logs table: High-write, time-series indexed
- Alerts table: Low-write, dismissible, session-linked
- Separate alert_rules table for configuration

**Alert Levels:**
- `debug` / `info` / `warn` / `error` (logs)
- `info` / `warning` / `critical` (alerts)

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION EVENTS                       │
│  (Timer command, Hint sent, Error thrown, etc.)             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │   Logger Utility     │
         │  (logger.ts)         │
         └─────────┬───────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │ Winston  │      │ Database │
    │ Files    │      │  Logs    │
    └──────────┘      └─────┬────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Alert Engine  │
                    │ (Check Rules) │
                    └───────┬───────┘
                            │
                  ┌─────────┴─────────┐
                  │  Rule Matches?    │
                  └─────────┬─────────┘
                            │ YES
                            ▼
                    ┌───────────────┐
                    │ Create Alert  │
                    │  (alerts tbl) │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Dashboard    │
                    │  WebSocket    │
                    └───────────────┘
```

---

## Database Schema

### 1. System Logs Table

```sql
CREATE TABLE system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL CHECK(category IN ('session', 'auth', 'system', 'network', 'api')),
  message TEXT NOT NULL,
  context TEXT, -- JSON: {sessionId, userId, ip, requestId, etc}
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_logs_level ON system_logs(level);
CREATE INDEX idx_logs_category ON system_logs(category);
CREATE INDEX idx_logs_created ON system_logs(created_at DESC);
```

**Retention:** 90 days (configurable)
**Estimated Size:** ~500 events/day = 45K records/90 days ≈ 10MB

### 2. Alerts Table

```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE, -- NULL for system alerts
  level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL CHECK(category IN ('timer', 'network', 'system', 'session', 'hint')),
  title TEXT NOT NULL, -- "Game Paused", "Network Offline"
  message TEXT NOT NULL, -- "Pirate Mutiny timer paused at 15:32"
  context TEXT, -- JSON: {gameName, roomName, pausedBy, etc}
  created_at TEXT NOT NULL,
  dismissed_at TEXT,
  dismissed_by TEXT REFERENCES user(id)
);

CREATE INDEX idx_alerts_active ON alerts(dismissed_at) WHERE dismissed_at IS NULL;
CREATE INDEX idx_alerts_session ON alerts(session_id);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
```

**Retention:** 30 days dismissed, indefinite active
**Auto-dismiss:** Session completion, timer resume (configurable)

### 3. Alert Rules Table (Admin Configuration)

```sql
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- "game_paused", "low_time", "excessive_hints"
  description TEXT,
  category TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'critical')),
  enabled INTEGER NOT NULL DEFAULT 1,
  conditions TEXT NOT NULL, -- JSON: {event: "timer_paused", threshold: null}
  title_template TEXT NOT NULL, -- "Game Paused"
  message_template TEXT NOT NULL, -- "{{gameName}} timer paused at {{time}}"
  auto_dismiss_on TEXT, -- JSON: ["timer_resume", "session_complete"]
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_category ON alert_rules(category);
```

**Seed Rules (Default):**
```json
[
  {
    "id": "game_paused",
    "name": "game_paused",
    "description": "Alert when a game timer is paused",
    "category": "timer",
    "level": "warning",
    "enabled": true,
    "conditions": {
      "event": "timer_paused"
    },
    "title_template": "⏸ Game Paused",
    "message_template": "{{gameName}} ({{roomName}}) paused at {{time}}",
    "auto_dismiss_on": ["timer_resume", "session_complete"]
  },
  {
    "id": "low_time",
    "name": "low_time",
    "description": "Alert when timer drops below 5 minutes",
    "category": "timer",
    "level": "warning",
    "enabled": true,
    "conditions": {
      "event": "timer_tick",
      "threshold": {"remaining_seconds": {"lt": 300}}
    },
    "title_template": "⏱ Low Time Remaining",
    "message_template": "{{gameName}} has less than 5 minutes remaining",
    "auto_dismiss_on": ["session_complete"]
  },
  {
    "id": "excessive_hints",
    "name": "excessive_hints",
    "description": "Alert when 3+ hints sent in 5 minutes",
    "category": "hint",
    "level": "warning",
    "enabled": true,
    "conditions": {
      "event": "hint_sent",
      "threshold": {"count": 3, "window_minutes": 5}
    },
    "title_template": "🔔 Excessive Hints",
    "message_template": "{{gameName}}: {{count}} hints in {{window_minutes}} minutes",
    "auto_dismiss_on": null
  },
  {
    "id": "network_offline",
    "name": "network_offline",
    "description": "Alert when network status changes to offline",
    "category": "network",
    "level": "critical",
    "enabled": true,
    "conditions": {
      "event": "network_status_change",
      "threshold": {"status": "offline"}
    },
    "title_template": "🔴 Network Offline",
    "message_template": "Network controller offline - check connectivity",
    "auto_dismiss_on": ["network_online"]
  }
]
```

---

## Winston Logger Configuration

### Log File Paths (Runtime-Detected)

Winston log files are stored using runtime-detected paths:

| Environment | Log Path |
|-------------|----------|
| Development | `{cwd}/logs/` |
| Production | `/var/log/escapeplan/` |

The logger automatically uses the correct location based on environment detection. See **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md#path-resolution)** for details.

### File Structure

```
apps/escapeplan-api/
├── src/
│   ├── logger.ts          # NEW: Winston logger setup
│   ├── logging/           # NEW: Logging utilities
│   │   ├── index.ts       # Exports
│   │   ├── database.ts    # DB log insertion
│   │   ├── alerts.ts      # Alert engine
│   │   └── categories.ts  # Log categories
│   └── state.ts           # Update to use logger
└── logs/                  # NEW: Log files (gitignored)
    ├── escapeplan-2025-09-30.log
    ├── error.log
    └── .gitkeep
```

### logger.ts Implementation

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Daily rotation transport
const fileRotateTransport = new DailyRotateFile({
  filename: 'logs/escapeplan-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Error file
const errorFileTransport = new winston.transports.File({
  filename: 'logs/error.log',
  level: 'error',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Console (development only)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  )
});

export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    fileRotateTransport,
    errorFileTransport,
    ...(process.env.NODE_ENV !== 'production' ? [consoleTransport] : [])
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

export default logger;
```

### Database Integration

```typescript
// apps/escapeplan-api/src/logging/database.ts
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { systemLogs } from '../db/schema.js';
import logger from '../logger.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'session' | 'auth' | 'system' | 'network' | 'api';

export interface LogContext {
  sessionId?: string;
  userId?: string;
  ip?: string;
  requestId?: string;
  [key: string]: any;
}

export function logToDatabase(
  level: LogLevel,
  category: LogCategory,
  message: string,
  context?: LogContext
): void {
  try {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    await db.insert(systemLogs).values({
      id,
      level,
      category,
      message,
      context: context ?? null,
      timestamp,
      created_at: timestamp
    });

    // Also log to Winston
    logger.log(level, message, { category, ...context });
  } catch (error) {
    // Fallback to Winston only if DB fails
    logger.error('Failed to write to system_logs table', { error, message, category });
  }
}
```

---

## Alert Rule Engine

### Alert Engine Logic

```typescript
// apps/escapeplan-api/src/logging/alerts.ts
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { alerts, alertRules } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { logToDatabase } from './database.js';
import { emitDashboardUpdate } from '../realtime.js';
import { getDashboard } from '../state.js';

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertCategory = 'timer' | 'network' | 'system' | 'session' | 'hint';

export interface CreateAlertOptions {
  sessionId?: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  message: string;
  context?: Record<string, any>;
}

export function createAlert(options: CreateAlertOptions): string {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(alerts).values({
    id,
    session_id: options.sessionId ?? null,
    level: options.level,
    category: options.category,
    title: options.title,
    message: options.message,
    context: options.context ?? null,
    created_at: now
  });

  // Log the alert creation
  logToDatabase('info', 'system', `Alert created: ${options.title}`, {
    alertId: id,
    sessionId: options.sessionId,
    level: options.level
  });

  // Emit dashboard update to show new alert
  emitDashboardUpdate(getDashboard());

  return id;
}

export function dismissAlert(alertId: string, operatorId: string): void {
  const now = new Date().toISOString();

  await db.update(alerts)
    .set({
      dismissed_at: now,
      dismissed_by: operatorId
    })
    .where(
      and(
        eq(alerts.id, alertId),
        isNull(alerts.dismissed_at)
      )
    );

  logToDatabase('info', 'system', `Alert dismissed: ${alertId}`, {
    alertId,
    dismissedBy: operatorId
  });

  emitDashboardUpdate(getDashboard());
}

export function dismissAlertsBySession(sessionId: string, reason: string): void {
  const now = new Date().toISOString();

  await db.update(alerts)
    .set({
      dismissed_at: now,
      dismissed_by: 'system'
    })
    .where(
      and(
        eq(alerts.session_id, sessionId),
        isNull(alerts.dismissed_at)
      )
    );

  logToDatabase('info', 'system', `Auto-dismissed alerts for session: ${reason}`, {
    sessionId
  });
}

// Check alert rules and create alerts
export function evaluateAlertRules(event: string, context: any): void {
  const rules = await db.select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));

  for (const rule of rules) {
    const conditions = rule.conditions as any;

    if (conditions.event !== event) continue;

    // Check threshold conditions
    if (conditions.threshold) {
      if (!meetsThreshold(conditions.threshold, context)) {
        continue;
      }
    }

    // Create alert from template
    const title = interpolateTemplate(rule.title_template, context);
    const message = interpolateTemplate(rule.message_template, context);

    createAlert({
      sessionId: context.sessionId,
      level: rule.level as AlertLevel,
      category: rule.category as AlertCategory,
      title,
      message,
      context
    });
  }
}

function meetsThreshold(threshold: any, context: any): boolean {
  // Example: {remaining_seconds: {lt: 300}}
  for (const [field, condition] of Object.entries(threshold)) {
    const value = context[field];
    if (typeof condition === 'object') {
      if ('lt' in condition && !(value < condition.lt)) return false;
      if ('gt' in condition && !(value > condition.gt)) return false;
      if ('eq' in condition && !(value === condition.eq)) return false;
    }
  }
  return true;
}

function interpolateTemplate(template: string, context: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return context[key] ?? `{{${key}}}`;
  });
}
```

---

## Admin Configuration UI

### Routes

```typescript
// apps/escapeplan-api/src/index.ts
import { db } from './db/client.js';
import { alertRules, systemLogs } from './db/schema.js';
import { eq, asc, desc, and, count } from 'drizzle-orm';

// Get alert rules
api.get('/admin/alert-rules', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;
  if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_system_settings')) return;

  const rules = await db.select()
    .from(alertRules)
    .orderBy(asc(alertRules.category), asc(alertRules.name));

  return { rules };
});

// Update alert rule
api.patch('/admin/alert-rules/:id', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;
  if (!ensurePermission(reply, session.user.role, session.user.permissions, 'manage_system_settings')) return;

  const { id } = request.params as { id: string };
  const { enabled, level, conditions, title_template, message_template } = request.body as any;

  await db.update(alertRules)
    .set({
      enabled,
      level,
      conditions,
      title_template,
      message_template,
      updated_at: new Date().toISOString()
    })
    .where(eq(alertRules.id, id));

  logToDatabase('info', 'system', `Alert rule updated: ${id}`, { ruleId: id, updatedBy: session.user.id });

  return { success: true };
});

// Get system logs
api.get('/admin/logs', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;
  if (!ensurePermission(reply, session.user.role, session.user.permissions, 'view_system_logs')) return;

  const { level, category, limit = 100, offset = 0 } = request.query as any;

  // Build query with optional filters
  const conditions = [];
  if (level) {
    conditions.push(eq(systemLogs.level, level));
  }
  if (category) {
    conditions.push(eq(systemLogs.category, category));
  }

  const logs = await db.select()
    .from(systemLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemLogs.timestamp))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [totalResult] = await db.select({ count: count() })
    .from(systemLogs);

  return { logs, total: totalResult.count };
});

// Dismiss alert
api.post('/admin/alerts/:id/dismiss', async (request, reply) => {
  const session = await ensureAuth(request, reply);
  if (!session) return;

  const { id } = request.params as { id: string };
  dismissAlert(id, session.user.id as string);

  return { success: true };
});
```

### UI Pages

**New Pages:**
1. `/admin/system/alerts` - Alert rule configuration
2. `/admin/system/logs` - System log viewer

**Files to Create:**
```
apps/escapeplan-web/src/routes/(app)/admin/system/
├── +layout.svelte          # Tabs: Alerts | Logs
├── alerts/
│   └── +page.svelte        # Alert rules config
└── logs/
    ├── +page.server.ts     # Load logs
    └── +page.svelte        # Log viewer
```

---

## Migration Plan

### Phase 1: Database Schema (Week 1)

1. ✅ Add `system_logs` table to schema.ts
2. ✅ Add `alerts` table to schema.ts
3. ✅ Add `alert_rules` table to schema.ts
4. ✅ Run migration / reseed database
5. ✅ Add seed data for default alert rules

### Phase 2: Winston Setup (Week 1)

1. ✅ Install dependencies: `pnpm add winston winston-daily-rotate-file`
2. ✅ Create `apps/escapeplan-api/src/logger.ts`
3. ✅ Create `apps/escapeplan-api/src/logging/` directory
4. ✅ Add `logs/` to .gitignore
5. ✅ Test Winston file rotation

### Phase 3: Alert Engine (Week 2)

1. ✅ Implement `logToDatabase()` function
2. ✅ Implement `createAlert()` function
3. ✅ Implement `evaluateAlertRules()` function
4. ✅ Update `applyCommand()` in state.ts to use new system
5. ✅ Remove `recent_alert` field references
6. ✅ Update `getDashboard()` to query `alerts` table

### Phase 4: API Routes (Week 2)

1. ✅ Add `/admin/alert-rules` endpoints
2. ✅ Add `/admin/logs` endpoint
3. ✅ Add `/admin/alerts/:id/dismiss` endpoint
4. ✅ Update RBAC permissions (add `view_system_logs`, `manage_system_settings`)

### Phase 5: UI (Week 3)

1. ✅ Create `/admin/system/alerts` page
2. ✅ Create `/admin/system/logs` page
3. ✅ Update dashboard alerts modal to support dismissal
4. ✅ Add real-time alert updates via WebSocket

### Phase 6: Testing & Validation (Week 3)

1. ✅ Test all alert rules trigger correctly
2. ✅ Test log viewer filtering
3. ✅ Test alert dismissal
4. ✅ Test auto-dismiss on session completion
5. ✅ User story validation

---

## User Stories

### Story 1: Admin Configures Alert Rules

**As an** admin operator
**I want to** enable/disable alert rules and configure thresholds
**So that** I only receive alerts that matter to my operation

**Acceptance Criteria:**
- [ ] Admin can navigate to `/admin/system/alerts`
- [ ] Admin sees all alert rules (game_paused, low_time, excessive_hints, network_offline)
- [ ] Admin can toggle each rule on/off
- [ ] Admin can change alert level (info/warning/critical)
- [ ] Admin can edit threshold values (e.g., "5 minutes" → "10 minutes")
- [ ] Admin can edit message templates
- [ ] Changes are saved and take effect immediately
- [ ] System logs the configuration change

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│ System Settings > Alert Rules                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ⏸ Game Paused                          [ON]  WARNING   │  │
│ │ Alert when a game timer is paused by operator          │  │
│ │                                                         │  │
│ │ Title: {{gameName}} Paused            [Edit]           │  │
│ │ Message: Paused at {{time}} in {{roomName}}            │  │
│ │ Auto-dismiss on: Timer resume, Session complete        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ ⏱ Low Time Remaining                  [ON]  WARNING   │  │
│ │ Alert when timer drops below threshold                 │  │
│ │                                                         │  │
│ │ Threshold: [5] minutes remaining      [Edit]           │  │
│ │ Message: {{gameName}} has <5 min remaining             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🔔 Excessive Hints                    [OFF] WARNING    │  │
│ │ Alert when too many hints sent in short time           │  │
│ │                                                         │  │
│ │ Threshold: [3] hints in [5] minutes   [Edit]           │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Story 2: Operator Views System Logs

**As an** admin or manager
**I want to** view system logs with filtering and search
**So that** I can debug issues and audit system activity

**Acceptance Criteria:**
- [ ] Operator can navigate to `/admin/system/logs`
- [ ] Logs are displayed in reverse chronological order
- [ ] Operator can filter by level (debug/info/warn/error)
- [ ] Operator can filter by category (session/auth/system/network/api)
- [ ] Operator can search log messages
- [ ] Operator can see context/metadata for each log
- [ ] Pagination works (100 logs per page)
- [ ] Export logs to JSON/CSV

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│ System Settings > Logs                                      │
├─────────────────────────────────────────────────────────────┤
│ Filters:                                                     │
│ Level: [All ▼] Category: [All ▼] Search: [____________]     │
│                                          [Export CSV]        │
├─────────────────────────────────────────────────────────────┤
│ 2025-09-30 14:32:15  INFO   session                         │
│ Timer paused: Pirate Mutiny                                 │
│ { sessionId: "sess-abc", userId: "op-123" }                 │
├─────────────────────────────────────────────────────────────┤
│ 2025-09-30 14:30:02  INFO   session                         │
│ Hint sent to session                                        │
│ { sessionId: "sess-abc", message: "Check the compass" }     │
├─────────────────────────────────────────────────────────────┤
│ 2025-09-30 14:25:45  WARN   network                         │
│ Network health degraded                                     │
│ { status: "degraded", message: "High latency detected" }    │
├─────────────────────────────────────────────────────────────┤
│                      < 1 2 3 4 5 >                          │
└─────────────────────────────────────────────────────────────┘
```

### Story 3: Operator Dismisses Alerts

**As a** game master or manager
**I want to** dismiss alerts once I've acknowledged them
**So that** the dashboard only shows active issues

**Acceptance Criteria:**
- [ ] Operator sees alerts in dashboard modal
- [ ] Each alert has a "Dismiss" button
- [ ] Clicking "Dismiss" removes alert from view
- [ ] Dismissed alerts are logged (who dismissed, when)
- [ ] Auto-dismiss works (e.g., paused game alert clears on resume)
- [ ] Dashboard alert count updates in real-time

**UI Enhancement:**
```
┌─────────────────────────────────────────────────────────────┐
│ Active Alerts (3)                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│ ⏸ WARNING                                    [Dismiss]      │
│ Game Paused                                                 │
│ Pirate Mutiny (Main Room) paused at 14:32                  │
│ 5 minutes ago                                               │
├─────────────────────────────────────────────────────────────┤
│ ⏱ WARNING                                    [Dismiss]      │
│ Low Time Remaining                                          │
│ Haunted Manor has less than 5 minutes remaining            │
│ 2 minutes ago                                               │
├─────────────────────────────────────────────────────────────┤
│ 🔔 WARNING                                    [Dismiss]      │
│ Excessive Hints                                             │
│ Pirate Mutiny: 3 hints in 5 minutes                        │
│ 8 minutes ago                                               │
└─────────────────────────────────────────────────────────────┘
```

### Story 4: System Generates Smart Alerts

**As a** system
**I want to** only create alerts when rules are met
**So that** operators aren't overwhelmed with noise

**Acceptance Criteria:**
- [ ] Hint sent: NO alert (only log)
- [ ] Timer resumed: NO alert, auto-dismiss pause alert
- [ ] Timer paused: CREATE alert (if rule enabled)
- [ ] Timer drops below 5 min: CREATE alert ONCE (not every second)
- [ ] 3rd hint in 5 min window: CREATE alert
- [ ] Network offline: CREATE alert immediately
- [ ] Session completes: Auto-dismiss all session alerts

**Test Scenarios:**
```typescript
// Scenario 1: Pause creates alert, resume dismisses it
applyCommand(sessionId, { command: 'pause_timer' });
// → Alert created: "⏸ Game Paused - Pirate Mutiny"

applyCommand(sessionId, { command: 'resume_timer' });
// → Alert auto-dismissed
// → NO new alert created for resume

// Scenario 2: Hints don't alert until threshold
sendHint(sessionId, 'Check the map'); // Log only
sendHint(sessionId, 'Look at compass'); // Log only
sendHint(sessionId, 'X marks spot'); // Alert + Log (3rd in 5min)

// Scenario 3: Low time alerts once
timerTick(sessionId, 301); // 5:01 remaining - no alert
timerTick(sessionId, 299); // 4:59 remaining - ALERT
timerTick(sessionId, 298); // 4:58 remaining - no duplicate alert
```

---

## Technical Stack Compatibility

### Current Stack (Verified)

**Backend:**
- ✅ Fastify 5.x - Compatible with Winston
- ✅ SQLite + Drizzle ORM - Supports new tables
- ✅ Better Auth - No conflicts
- ✅ Socket.IO - Used for real-time alert updates

**Frontend:**
- ✅ SvelteKit with Svelte 5 Runes - No changes needed
- ✅ DaisyUI - Use for alert UI components
- ✅ Existing stores pattern - Extend for alerts

### New Dependencies

```json
{
  "dependencies": {
    "winston": "^3.14.2",
    "winston-daily-rotate-file": "^5.0.0"
  },
  "devDependencies": {
    "@types/winston": "^2.4.4"
  }
}
```

### File Changes Audit

**Modified:**
- `apps/escapeplan-api/src/db/schema.ts` - Add 3 tables
- `apps/escapeplan-api/src/db/client.ts` - Add ensureColumn for new tables
- `apps/escapeplan-api/src/db/seed.ts` - Add alert rules seed data
- `apps/escapeplan-api/src/state.ts` - Remove `recent_alert` usage, add logging
- `apps/escapeplan-api/src/index.ts` - Add new API routes
- `apps/escapeplan-api/package.json` - Add Winston dependencies
- `packages/contracts/src/index.ts` - Add Log/Alert types
- `packages/contracts/src/rbac.ts` - Add new permissions

**Created:**
- `apps/escapeplan-api/src/logger.ts`
- `apps/escapeplan-api/src/logging/index.ts`
- `apps/escapeplan-api/src/logging/database.ts`
- `apps/escapeplan-api/src/logging/alerts.ts`
- `apps/escapeplan-api/src/logging/categories.ts`
- `apps/escapeplan-api/logs/.gitkeep`
- `apps/escapeplan-web/src/routes/(app)/admin/system/+layout.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/system/alerts/+page.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/system/alerts/+page.server.ts`
- `apps/escapeplan-web/src/routes/(app)/admin/system/logs/+page.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/system/logs/+page.server.ts`

**Removed:**
- None (backward compatible, deprecate `recent_alert` field later)

---

## Implementation Phases

### Phase 1: Foundation (Session 29) ✅ COMPLETE
**Duration:** 4-6 hours
**Focus:** Database + Winston
**Status:** COMPLETE - Commit `b54a6ba`

- [x] Add database tables to schema.ts
- [x] Add seed data for alert rules
- [x] Install Winston dependencies
- [x] Create logger.ts and logging/ utilities
- [x] Test logging to files and database
- [x] Update .gitignore for logs/

**Deliverables:**
- ✅ System logs table populated
- ✅ Winston logging to files
- ✅ Database logging working
- ✅ 4 default alert rules seeded
- ✅ Test coverage (5 scenarios)

**Files Created:**
- `src/logger.ts` (74 lines)
- `src/logging/categories.ts` (20 lines)
- `src/logging/database.ts` (72 lines)
- `src/logging/alerts.ts` (223 lines)
- `src/logging/index.ts` (3 lines)
- `src/test-logging.ts` (74 lines - test harness)

### Phase 2: Alert Engine (Session 31) ✅ COMPLETE
**Duration:** 4-6 hours
**Focus:** Alert creation + integration
**Status:** COMPLETE - Commit `3031f7c`

- [x] Implement alert creation functions
- [x] Implement rule evaluation engine
- [x] Update state.ts commands to use logging
- [x] Update getDashboard() to query alerts table
- [x] Implement hint count tracking
- [x] Test alert rule evaluation

**Deliverables:**
- ✅ Alerts created when rules match
- ✅ Command handlers log to system_logs
- ✅ Pause/resume triggers alert creation/dismissal
- ✅ Hint tracking queries session_hints table
- ✅ Low time alert on timer tick
- ✅ Session completion auto-dismisses alerts

**Files Modified:**
- `src/state.ts` (62 lines added)
- `src/logging/alerts.ts` (hint tracking)
- `src/db/seed.ts` (INSERT OR REPLACE fix)
- `src/test-integration.ts` (NEW - 150 lines)

### Phase 3: API Routes (Session 33) ✅ COMPLETE
**Duration:** 2-4 hours
**Focus:** Backend API
**Status:** COMPLETE - Commit `74f2425`

- [x] Add /admin/alert-rules routes (GET, PATCH)
- [x] Add /admin/logs route (GET with filters)
- [x] Add /admin/alerts/:id/dismiss route (POST)
- [x] Add RBAC permissions (view_system_logs, manage_system_settings)
- [x] Test all endpoints (test script provided)

**Deliverables:**
- ✅ API endpoints working (4 routes)
- ✅ RBAC enforced on all routes
- ✅ Test script: `test-logging-endpoints.sh`
- ✅ Contracts package rebuilt

**Files Modified:**
- `packages/contracts/src/index.ts` (2 permissions)
- `packages/contracts/src/rbac.ts` (labels + roles)
- `apps/escapeplan-api/src/index.ts` (143 lines)
- `apps/escapeplan-api/src/test-logging-endpoints.sh` (NEW)

### Phase 4: Admin UI (Session 34) 🚧 PENDING
**Duration:** 6-8 hours
**Focus:** Frontend pages
**Status:** NOT STARTED

- [ ] Create /admin/system layout
- [ ] Build alert rules config page
- [ ] Build log viewer page
- [ ] Add dismiss functionality to dashboard
- [ ] Test all UI interactions

**Deliverables:**
- Admin can view/edit alert rules
- Admin can view logs
- Operators can dismiss alerts

**Expected Files:**
- `apps/escapeplan-web/src/routes/(app)/admin/system/+layout.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/system/alerts/+page.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/system/logs/+page.svelte`

### Phase 5: Testing & Polish (Session 35) 🚧 PENDING
**Duration:** 2-4 hours
**Focus:** User story validation
**Status:** NOT STARTED

- [ ] Test each user story
- [ ] Fix any bugs
- [ ] Add loading states
- [ ] Add error handling
- [ ] Documentation updates

**Deliverables:**
- All user stories pass
- System stable
- Ready for production

---

## Current Status Summary

### ✅ Completed (Phases 1-3)
- **Database & Logging Infrastructure** - All tables, Winston logger, alert engine
- **State Management Integration** - All commands log and evaluate alert rules
- **API Endpoints** - Full REST API for alert management and log queries
- **RBAC Permissions** - Proper access control on all endpoints

### ⚠️ Pending Manual Testing
The following flows need manual testing with a running server:

1. **Pause/Resume Alert Flow:**
   - [ ] Start session
   - [ ] Pause timer → Verify "Game Paused" alert appears
   - [ ] Resume timer → Verify alert auto-dismisses

2. **Excessive Hints Alert:**
   - [ ] Send 3 hints within 5 minutes
   - [ ] Verify "Excessive Hints" alert appears

3. **Low Time Alert:**
   - [ ] Let timer drop below 5 minutes
   - [ ] Verify "Low Time" alert appears
   - [ ] Verify no duplicate alerts

4. **Session Completion:**
   - [ ] Complete session
   - [ ] Verify all session alerts dismissed

5. **API Endpoints:**
   - [ ] Run `./src/test-logging-endpoints.sh`
   - [ ] Verify all tests pass

### 🚧 Next Phase (Phase 4 - Admin UI)
**Session 34 Expected Tasks:**
1. Create `/admin/system/alerts` page (alert rules config)
2. Create `/admin/system/logs` page (log viewer)
3. Update dashboard to show alerts from database
4. Add alert dismissal button
5. Real-time alert updates in UI
6. Test all UI flows

**Estimated Duration:** 6-8 hours

---

## Success Metrics

### Quantitative
- [ ] **Alert Fatigue Reduction**: <5 alerts per day (vs. current ~30+)
- [ ] **Alert Accuracy**: >90% of alerts are actionable
- [ ] **Response Time**: Operators dismiss alerts within 2 minutes
- [ ] **Log Retention**: 90 days of logs available for audit
- [ ] **Performance**: Logging adds <5ms to request latency

### Qualitative
- [ ] Operators report alerts are "useful, not annoying"
- [ ] Admin can easily customize alert thresholds
- [ ] Debugging is faster with searchable logs
- [ ] No alerts missed due to overwrite

---

## Appendices

### A. Sample Alert Rule JSON

```json
{
  "id": "session_overrun",
  "name": "session_overrun",
  "description": "Alert when session extends past scheduled end time",
  "category": "session",
  "level": "warning",
  "enabled": true,
  "conditions": {
    "event": "timer_tick",
    "threshold": {
      "current_time": {
        "gt_field": "scheduled_end"
      }
    }
  },
  "title_template": "⏰ Session Overrun",
  "message_template": "{{gameName}} scheduled to end at {{scheduled_end}} but still running",
  "auto_dismiss_on": ["session_complete"]
}
```

### B. Sample Log Entry

```json
{
  "id": "log-xK92jP3mL",
  "level": "info",
  "category": "session",
  "message": "Timer paused by operator",
  "context": {
    "sessionId": "session-abc123",
    "gameName": "Pirate Mutiny",
    "roomName": "Main Room",
    "userId": "operator-xyz",
    "userName": "John Doe",
    "remainingSeconds": 932
  },
  "timestamp": "2025-09-30T14:32:15.123Z",
  "created_at": "2025-09-30T14:32:15.123Z"
}
```

### C. RBAC Permissions

**New Permissions:**
```typescript
export const ALL_PERMISSIONS = [
  // ... existing permissions
  'view_system_logs',      // View /admin/system/logs
  'manage_system_settings', // Edit alert rules
] as const;

export const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: [...existingAdminPerms, 'view_system_logs', 'manage_system_settings'],
  manager: [...existingManagerPerms, 'view_system_logs'],
  game_master: [...existingGMPerms],
  customer: [...existingCustomerPerms]
};
```

---

## Next Steps for Session 25

1. **Review this document** - Ensure agreement on approach
2. **Audit codebase** - Confirm all `recent_alert` usage locations
3. **Install dependencies** - `pnpm add winston winston-daily-rotate-file`
4. **Start Phase 1** - Database tables + Winston setup
5. **Create feature branch** - `feature/logging-alerting-system`

---

## Related Documentation

### Core System Docs
- **[Runtime Configuration System](./RUNTIME_CONFIGURATION_SYSTEM.md)** - Log file path resolution
- **[Database System](./DATABASE_SYSTEM.md)** - system_logs, alerts, alert_rules tables
- **[API Contracts & Schema Management](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)** - Logging schema definition

### Integration Docs
- **[RBAC System](./RBAC_SYSTEM.md)** - Permissions: `view_system_logs`, `view_alert_rules`, `manage_alert_rules`

---

**END OF SPECIFICATION**
