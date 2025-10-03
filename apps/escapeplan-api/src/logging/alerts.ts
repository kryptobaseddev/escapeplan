import { nanoid } from 'nanoid';
import { eq, and, isNull, count, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, alertRules, sessionHints } from '@escapeplan/contracts';
import { logToDatabase } from './database.js';
import type { AlertLevel, AlertCategory } from './categories.js';

export interface CreateAlertOptions {
  sessionId?: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  message: string;
  context?: Record<string, any>;
}

/**
 * Create a new alert in the database
 */
export function createAlert(options: CreateAlertOptions): string {
  const id = `alert-${nanoid(12)}`;
  const now = new Date().toISOString();

  // Insert using Drizzle ORM (JSON mode handles stringify automatically)
  db.insert(alerts).values({
    id,
    session_id: options.sessionId ?? null,
    level: options.level,
    category: options.category,
    title: options.title,
    message: options.message,
    context: options.context ?? null,
    created_at: now,
    dismissed_at: null,
    dismissed_by: null
  }).run();

  // Log the alert creation
  logToDatabase('info', 'system', `Alert created: ${options.title}`, {
    alertId: id,
    sessionId: options.sessionId,
    level: options.level
  });

  // Note: Dashboard updates are emitted by the caller (state.ts) to avoid circular dependencies

  return id;
}

/**
 * Dismiss an alert
 */
export function dismissAlert(alertId: string, operatorId: string): void {
  const now = new Date().toISOString();

  // Update using Drizzle ORM
  db.update(alerts)
    .set({
      dismissed_at: now,
      dismissed_by: operatorId
    })
    .where(and(
      eq(alerts.id, alertId),
      isNull(alerts.dismissed_at)
    ))
    .run();

  logToDatabase('info', 'system', `Alert dismissed: ${alertId}`, {
    alertId,
    dismissedBy: operatorId
  });

  // Note: Dashboard updates are emitted by the caller to avoid circular dependencies
}

/**
 * Auto-dismiss all alerts for a session (e.g., on session completion)
 */
export function dismissAlertsBySession(sessionId: string, reason: string): void {
  const now = new Date().toISOString();

  // Update using Drizzle ORM (use null for system dismissals to avoid FK constraint)
  db.update(alerts)
    .set({
      dismissed_at: now,
      dismissed_by: null
    })
    .where(and(
      eq(alerts.session_id, sessionId),
      isNull(alerts.dismissed_at)
    ))
    .run();

  logToDatabase('info', 'system', `Auto-dismissed alerts for session: ${reason}`, {
    sessionId,
    reason
  });
}

/**
 * Auto-dismiss alerts based on event type
 */
export function autoDismissAlerts(event: string, context: any): void {
  // Get all active alerts with their associated rules using Drizzle ORM
  const activeAlertsWithRules = db.select({
    auto_dismiss_on: alertRules.auto_dismiss_on
  })
    .from(alerts)
    .innerJoin(alertRules, eq(alertRules.category, alerts.category))
    .where(and(
      isNull(alerts.dismissed_at),
      sql`${alertRules.auto_dismiss_on} IS NOT NULL`
    ))
    .all();

  // Get unique auto_dismiss_on values (Drizzle parses JSON automatically)
  const uniqueRules = [...new Set(activeAlertsWithRules.map(r => r.auto_dismiss_on))].filter(v => v !== null && v !== undefined);

  for (const autoDismissOn of uniqueRules) {
    const dismissEvents = autoDismissOn as any[];
    if (Array.isArray(dismissEvents) && dismissEvents.includes(event)) {
      // Dismiss alerts matching this event
      if (context.sessionId) {
        dismissAlertsBySession(context.sessionId, `Event: ${event}`);
      }
    }
  }
}

/**
 * Evaluate alert rules and create alerts if conditions match
 */
export function evaluateAlertRules(event: string, context: any): void {
  // Get all enabled rules using Drizzle ORM
  const rules = db.select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true))
    .all();

  for (const rule of rules) {
    const conditions = rule.conditions as any;

    // Check if event matches
    if (conditions.event !== event) continue;

    // Check threshold conditions if present
    if (conditions.threshold) {
      if (!meetsThreshold(conditions.threshold, context)) {
        continue;
      }
    }

    // Check for duplicate alerts (prevent spam)
    if (context.sessionId && shouldPreventDuplicate(rule, context.sessionId)) {
      continue;
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

  // Check for auto-dismiss triggers
  autoDismissAlerts(event, context);
}

/**
 * Check if threshold conditions are met
 */
function meetsThreshold(threshold: any, context: any): boolean {
  // Handle count-based thresholds (e.g., excessive hints)
  if (threshold.count !== undefined && threshold.window_minutes !== undefined) {
    // Query session_hints table for hint count in time window using Drizzle ORM
    if (context.sessionId) {
      const cutoffTime = new Date(Date.now() - threshold.window_minutes * 60000).toISOString();

      const [result] = db.select({ count: count() })
        .from(sessionHints)
        .where(and(
          eq(sessionHints.session_id, context.sessionId),
          sql`${sessionHints.delivered_at} > ${cutoffTime}`
        ))
        .all();

      // Update context with actual count for use in alert message
      context.count = result.count;
      context.window_minutes = threshold.window_minutes;

      return result.count >= threshold.count;
    }
    // Fallback: check if count is provided in context
    if (context.count !== undefined) {
      return context.count >= threshold.count;
    }
    return false;
  }

  // Handle field comparisons (e.g., remaining_seconds < 300)
  for (const [field, condition] of Object.entries(threshold)) {
    const value = context[field];

    if (typeof condition === 'object' && condition !== null) {
      if ('lt' in condition && !(value < (condition as any).lt)) return false;
      if ('gt' in condition && !(value > (condition as any).gt)) return false;
      if ('eq' in condition && !(value === (condition as any).eq)) return false;
      if ('lte' in condition && !(value <= (condition as any).lte)) return false;
      if ('gte' in condition && !(value >= (condition as any).gte)) return false;
    } else if (typeof condition === 'string') {
      // Handle string equality (e.g., status: "offline")
      if (value !== condition) return false;
    }
  }

  return true;
}

/**
 * Prevent duplicate alerts for the same rule/session
 */
function shouldPreventDuplicate(rule: any, sessionId: string): boolean {
  // Check if there's already an active alert for this rule and session using Drizzle ORM
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();

  const [existing] = db.select({ count: count() })
    .from(alerts)
    .where(and(
      eq(alerts.category, rule.category),
      eq(alerts.session_id, sessionId),
      isNull(alerts.dismissed_at),
      sql`${alerts.created_at} > ${fiveMinutesAgo}`
    ))
    .all();

  return existing.count > 0;
}

/**
 * Interpolate template variables (e.g., {{gameName}} → "Pirate Mutiny")
 */
function interpolateTemplate(template: string, context: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return context[key]?.toString() ?? `{{${key}}}`;
  });
}

export interface AlertRow {
  id: string;
  session_id: string | null;
  level: string;
  category: string;
  title: string;
  message: string;
  context: string | null;
  created_at: string;
  dismissed_at: string | null;
  dismissed_by: string | null;
}

/**
 * Get all active alerts
 */
export function getActiveAlerts(): AlertRow[] {
  return db.select()
    .from(alerts)
    .where(isNull(alerts.dismissed_at))
    .orderBy(desc(alerts.created_at))
    .all() as AlertRow[];
}

/**
 * Get alerts for a specific session
 */
export function getSessionAlerts(sessionId: string) {
  return db.select()
    .from(alerts)
    .where(eq(alerts.session_id, sessionId))
    .orderBy(desc(alerts.created_at))
    .all();
}
