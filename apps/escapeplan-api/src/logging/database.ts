import { nanoid } from 'nanoid';
import { sqlite } from '../db/client.js';
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

    sqlite.prepare(
      `INSERT INTO system_logs (id, level, category, message, context, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      level,
      category,
      message,
      context ? JSON.stringify(context) : null,
      timestamp,
      timestamp
    );

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
  const { level, category, limit = 100, offset = 0 } = options;

  let query = 'SELECT * FROM system_logs WHERE 1=1';
  const params: any[] = [];

  if (level) {
    query += ' AND level = ?';
    params.push(level);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = sqlite.prepare(query).all(...params);
  const total = sqlite.prepare('SELECT COUNT(*) as count FROM system_logs').get() as { count: number };

  return { logs, total: total.count };
}
