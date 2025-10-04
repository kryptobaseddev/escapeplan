/**
 * Dashboard state management types
 *
 * This module defines types for dashboard operations including:
 * - Dashboard data aggregation
 * - Real-time updates and broadcasting
 * - Session and booking summaries
 * - System health and status
 */

import type {
  DashboardResponse,
  ActiveSessionSummary,
  BookingSummary
} from '@escapeplan/contracts';

/**
 * Re-export contract types for convenience
 */
export type {
  DashboardResponse,
  ActiveSessionSummary,
  BookingSummary
};

/**
 * Dashboard data with real-time updates
 */
export interface DashboardData {
  generatedAt: string;
  timezone: string;
  activeSessions: ActiveSessionSummary[];
  upcomingBookings: BookingSummary[];
  systemHealth: DashboardSystemHealth;
}

/**
 * System health summary for dashboard
 */
export interface DashboardSystemHealth {
  network: {
    status: 'online' | 'degraded' | 'offline';
    clientCount: number;
    signalStrength?: number;
  };
  storage: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  cameras: {
    totalCameras: number;
    activeCameras: number;
    failedCameras: number;
  };
  services: {
    api: boolean;
    websocket: boolean;
    database: boolean;
  };
}

/**
 * Dashboard filters
 */
export interface DashboardFilters {
  includeCompletedSessions?: boolean;
  upcomingBookingsWindowMinutes?: number;
  timezone?: string;
}

/**
 * Dashboard update event
 */
export interface DashboardUpdateEvent {
  type: 'session' | 'booking' | 'health' | 'full';
  timestamp: string;
  data: Partial<DashboardData>;
}

/**
 * Dashboard statistics
 */
export interface DashboardStatistics {
  todayStats: {
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalBookings: number;
    revenue: number;
  };
  weekStats: {
    totalSessions: number;
    completedSessions: number;
    totalBookings: number;
    revenue: number;
  };
  monthStats: {
    totalSessions: number;
    completedSessions: number;
    totalBookings: number;
    revenue: number;
  };
}

/**
 * Dashboard real-time metrics
 */
export interface DashboardRealtimeMetrics {
  activeSessionCount: number;
  upcomingBookingCount: number;
  averageSessionDuration: number;
  systemLoad: number;
  lastUpdate: string;
}

/**
 * Dashboard operation errors
 */
export enum DashboardErrorCode {
  DATA_AGGREGATION_FAILED = 'DATA_AGGREGATION_FAILED',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',
}

export interface DashboardError {
  code: DashboardErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
