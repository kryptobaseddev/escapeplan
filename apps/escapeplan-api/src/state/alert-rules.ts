/**
 * Alert Rules State Management
 *
 * Manages CRUD operations for alert rules that trigger automated alerts
 * when specific conditions are met during sessions.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alertRules } from '@escapeplan/contracts';

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  level: string;
  enabled: boolean;
  conditions: any; // JSON parsed
  title_template: string;
  message_template: string;
  auto_dismiss_on: any; // JSON parsed array or null
  created_at: string;
  updated_at: string;
}

export interface UpdateAlertRuleData {
  name?: string;
  description?: string;
  category?: string;
  level?: string;
  enabled?: boolean;
  conditions?: any;
  title_template?: string;
  message_template?: string;
  auto_dismiss_on?: any;
}

/**
 * List all alert rules
 */
export function listAlertRules(): AlertRule[] {
  const rules = db.select()
    .from(alertRules)
    .all();

  return rules as AlertRule[];
}

/**
 * Get alert rule by ID
 */
export function getAlertRule(id: string): AlertRule | undefined {
  const rule = db.select()
    .from(alertRules)
    .where(eq(alertRules.id, id))
    .get();

  return rule as AlertRule | undefined;
}

/**
 * Update existing alert rule
 */
export function updateAlertRule(id: string, data: UpdateAlertRuleData): AlertRule {
  const existing = getAlertRule(id);
  if (!existing) {
    throw new Error(`Alert rule ${id} not found`);
  }

  const now = new Date().toISOString();

  // Build update object with only provided fields
  const updates: any = {
    updated_at: now
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.category !== undefined) updates.category = data.category;
  if (data.level !== undefined) updates.level = data.level;
  if (data.enabled !== undefined) updates.enabled = data.enabled;
  if (data.conditions !== undefined) updates.conditions = data.conditions;
  if (data.title_template !== undefined) updates.title_template = data.title_template;
  if (data.message_template !== undefined) updates.message_template = data.message_template;
  if (data.auto_dismiss_on !== undefined) updates.auto_dismiss_on = data.auto_dismiss_on;

  db.update(alertRules)
    .set(updates)
    .where(eq(alertRules.id, id))
    .run();

  const updated = getAlertRule(id);
  if (!updated) {
    throw new Error('Failed to update alert rule');
  }

  return updated;
}
