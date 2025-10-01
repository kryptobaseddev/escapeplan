import { nanoid } from 'nanoid';
import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { systemLogs } from '../db/schema.js';
import logger from '../logger.js';
import type { LogLevel, LogCategory, LogContext } from './categories.js';

/**
 * Log an event to both Winston files and the database
 */
export function logToDatabase(
  level: LogLevel,
  category: LogCategory,
  message: string,
  context?: LogContext
): void {
  try {
    const id = `log-${nanoid(12)}`;
    const timestamp = new Date().toISOString();

    // Insert using Drizzle ORM (JSON mode handles stringify automatically)
    db.insert(systemLogs).values({
      id,
      level,
      category,
      message,
      context: context ?? null,
      timestamp,
      created_at: timestamp
    }).run();

    // Also log to Winston
    logger.log(level, message, { category, ...context });
  } catch (error) {
    // Fallback to Winston only if DB fails
    logger.error('Failed to write to system_logs table', {
      error: error instanceof Error ? error.message : String(error),
      message,
      category
    });
  }
}

/**
 * Query system logs from database
 */
export function queryLogs(options: {
  level?: LogLevel;
  category?: LogCategory;
  limit?: number;
  offset?: number;
}) {
  const { level, category, limit: limitParam = 100, offset: offsetParam = 0 } = options;

  // Build where conditions using Drizzle operators
  const conditions = [];
  if (level) {
    conditions.push(eq(systemLogs.level, level));
  }
  if (category) {
    conditions.push(eq(systemLogs.category, category));
  }

  // Query logs using Drizzle ORM
  const logs = db.select()
    .from(systemLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemLogs.timestamp))
    .limit(limitParam)
    .offset(offsetParam)
    .all();

  // Get total count using Drizzle count aggregation
  const [totalResult] = db.select({ count: count() })
    .from(systemLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  return { logs, total: totalResult.count };
}
