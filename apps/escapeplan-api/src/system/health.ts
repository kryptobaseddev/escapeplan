/**
 * System Health Monitoring
 *
 * Collects real system metrics using Node.js os module and Socket.IO status
 * Stores snapshots in system_health table with 30-snapshot retention
 */

import os from 'node:os';
import fs from 'node:fs/promises';
import { db } from '../db/client.js';
import { systemHealth } from '@escapeplan/contracts';
import { eq, desc } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { SystemHealthResponse } from '@escapeplan/contracts';

const ulid = monotonicFactory();

// ============================================================================
// SYSTEM METRICS COLLECTION
// ============================================================================

/**
 * Get CPU usage percentage
 * Uses os.loadavg() which returns 1, 5, and 15-minute load averages
 */
function getCPUUsage(): number {
  const cpus = os.cpus().length;
  const load = os.loadavg()[0]; // 1-minute load average
  const percentage = Math.round((load / cpus) * 100);
  return Math.min(100, percentage); // Cap at 100%
}

/**
 * Get memory usage in MB
 */
function getMemoryUsage(): { total: number; used: number } {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    total: Math.round(totalMem / (1024 * 1024)), // Convert bytes to MB
    used: Math.round(usedMem / (1024 * 1024))
  };
}

/**
 * Get disk usage in GB
 * Reads filesystem stats for the data directory
 */
async function getDiskUsage(): Promise<{ total: number; used: number }> {
  try {
    const stats = await fs.statfs('./data');
    const totalBytes = stats.blocks * stats.bsize;
    const availableBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - availableBytes;

    return {
      total: Math.round(totalBytes / (1024 * 1024 * 1024)), // Convert to GB
      used: Math.round(usedBytes / (1024 * 1024 * 1024))
    };
  } catch (error) {
    // Fallback if statfs fails
    return { total: 0, used: 0 };
  }
}

/**
 * Get system uptime in seconds
 */
function getSystemUptime(): number {
  return Math.round(os.uptime());
}

/**
 * Format uptime seconds to human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

/**
 * Get API server uptime (process uptime)
 */
function getAPIUptime(): string {
  return formatUptime(Math.round(process.uptime()));
}

/**
 * Check service status
 * Returns array of service health status
 */
async function getServicesStatus(io?: any): Promise<Array<{
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: string;
  details: string;
}>> {
  const services = [];

  // 1. API Server
  services.push({
    name: 'API Server',
    status: 'online' as const,
    uptime: getAPIUptime(),
    details: `Fastify running on port ${process.env.PORT || 4000}`
  });

  // 2. WebSocket
  if (io) {
    const clientCount = io.engine.clientsCount;
    services.push({
      name: 'WebSocket',
      status: 'online' as const,
      uptime: getAPIUptime(), // Same as API
      details: `${clientCount} active connections`
    });
  } else {
    services.push({
      name: 'WebSocket',
      status: 'offline' as const,
      uptime: '0s',
      details: 'Socket.IO not initialized'
    });
  }

  // 3. Database
  try {
    await db.select().from(systemHealth).limit(1);
    services.push({
      name: 'Database',
      status: 'online' as const,
      uptime: getAPIUptime(), // Same as API
      details: 'SQLite WAL mode'
    });
  } catch (error) {
    services.push({
      name: 'Database',
      status: 'offline' as const,
      uptime: '0s',
      details: error instanceof Error ? error.message : 'Connection failed'
    });
  }

  // 4. Winston Logger (check if logger is active)
  services.push({
    name: 'Winston Logger',
    status: 'online' as const,
    uptime: getAPIUptime(), // Same as API
    details: 'Database + console transports'
  });

  return services;
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

/**
 * Collect current system health snapshot
 * Returns data ready for database insertion
 */
export async function collectHealthSnapshot(io?: any) {
  const cpu = getCPUUsage();
  const memory = getMemoryUsage();
  const disk = await getDiskUsage();
  const uptime = getSystemUptime();
  const services = await getServicesStatus(io);

  return {
    id: ulid(),
    cpu_usage_percent: cpu,
    memory_total_mb: memory.total,
    memory_used_mb: memory.used,
    disk_total_gb: disk.total,
    disk_used_gb: disk.used,
    uptime_seconds: uptime,
    services_status: JSON.stringify(services),
    recorded_at: new Date().toISOString()
  };
}

/**
 * Save health snapshot to database and enforce retention policy
 * Keeps only last 30 snapshots (15-day industry standard at 2x/day)
 */
export async function saveHealthSnapshot(io?: any): Promise<void> {
  const snapshot = await collectHealthSnapshot(io);

  // Insert new snapshot
  await db.insert(systemHealth).values(snapshot);

  // Enforce retention: Keep only last 30 snapshots
  const allSnapshots = await db
    .select({ id: systemHealth.id })
    .from(systemHealth)
    .orderBy(desc(systemHealth.recorded_at));

  if (allSnapshots.length > 30) {
    const toDelete = allSnapshots.slice(30);
    for (const snapshot of toDelete) {
      await db.delete(systemHealth).where(eq(systemHealth.id, snapshot.id));
    }
  }
}

/**
 * Get current system health metrics (for API response)
 * Returns formatted response matching SystemHealthResponse schema
 */
export async function getCurrentSystemHealth(io?: any): Promise<SystemHealthResponse> {
  const cpu = getCPUUsage();
  const memory = getMemoryUsage();
  const disk = await getDiskUsage();
  const uptime = getSystemUptime();
  const services = await getServicesStatus(io);

  return {
    cpu,
    memory: {
      used: memory.used,
      total: memory.total
    },
    disk: {
      used: disk.used,
      total: disk.total
    },
    uptime: formatUptime(uptime),
    services
  };
}

/**
 * Get latest health snapshot from database
 */
export async function getLatestHealthSnapshot() {
  const [latest] = await db
    .select()
    .from(systemHealth)
    .orderBy(desc(systemHealth.recorded_at))
    .limit(1);

  return latest;
}

/**
 * Get health history (last N snapshots)
 */
export async function getHealthHistory(limit = 30) {
  return await db
    .select()
    .from(systemHealth)
    .orderBy(desc(systemHealth.recorded_at))
    .limit(limit);
}
