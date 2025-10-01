import { nanoid } from 'nanoid';
import { sqlite } from '../db/client.js';
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

  sqlite.prepare(
    `INSERT INTO alerts (id, session_id, level, category, title, message, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    options.sessionId ?? null,
    options.level,
    options.category,
    options.title,
    options.message,
    options.context ? JSON.stringify(options.context) : null,
    now
  );

  // Log the alert creation
  logToDatabase('info', 'system', `Alert created: ${options.title}`, {
    alertId: id,
    sessionId: options.sessionId,
    level: options.level
  });

  return id;
}

/**
 * Dismiss an alert
 */
export function dismissAlert(alertId: string, operatorId: string): void {
  const now = new Date().toISOString();

  sqlite.prepare(
    `UPDATE alerts
     SET dismissed_at = ?, dismissed_by = ?
     WHERE id = ? AND dismissed_at IS NULL`
  ).run(now, operatorId, alertId);

  logToDatabase('info', 'system', `Alert dismissed: ${alertId}`, {
    alertId,
    dismissedBy: operatorId
  });
}

/**
 * Auto-dismiss all alerts for a session (e.g., on session completion)
 */
export function dismissAlertsBySession(sessionId: string, reason: string): void {
  sqlite.prepare(
    `UPDATE alerts
     SET dismissed_at = CURRENT_TIMESTAMP, dismissed_by = 'system'
     WHERE session_id = ? AND dismissed_at IS NULL`
  ).run(sessionId);

  logToDatabase('info', 'system', `Auto-dismissed alerts for session: ${reason}`, {
    sessionId
  });
}

/**
 * Auto-dismiss alerts based on event type
 */
export function autoDismissAlerts(event: string, context: any): void {
  // Get all active alerts that should be dismissed by this event
  const rules = sqlite.prepare(
    `SELECT DISTINCT ar.auto_dismiss_on
     FROM alerts a
     JOIN alert_rules ar ON ar.category = a.category
     WHERE a.dismissed_at IS NULL AND ar.auto_dismiss_on IS NOT NULL`
  ).all() as any[];

  for (const rule of rules) {
    if (!rule.auto_dismiss_on) continue;

    const dismissEvents = JSON.parse(rule.auto_dismiss_on);
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
  const rules = sqlite.prepare(
    `SELECT * FROM alert_rules WHERE enabled = 1`
  ).all() as any[];

  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions);

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
      level: rule.level,
      category: rule.category,
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
    // This requires historical data - for now, we'll check if count is in context
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
  // Check if there's already an active alert for this rule and session
  const existing = sqlite.prepare(
    `SELECT COUNT(*) as count FROM alerts
     WHERE category = ? AND session_id = ? AND dismissed_at IS NULL
     AND created_at > datetime('now', '-5 minutes')`
  ).get(rule.category, sessionId) as { count: number };

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

/**
 * Get all active alerts
 */
export function getActiveAlerts() {
  return sqlite.prepare(
    `SELECT * FROM alerts WHERE dismissed_at IS NULL ORDER BY created_at DESC`
  ).all();
}

/**
 * Get alerts for a specific session
 */
export function getSessionAlerts(sessionId: string) {
  return sqlite.prepare(
    `SELECT * FROM alerts WHERE session_id = ? ORDER BY created_at DESC`
  ).all(sessionId);
}
