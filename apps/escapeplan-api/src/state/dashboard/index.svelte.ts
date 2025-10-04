/**
 * Dashboard domain state management
 *
 * This module provides dashboard data aggregation using a class-based state pattern
 * inspired by Svelte 5 runes. It aggregates data from all other domain modules to
 * provide a unified dashboard view.
 *
 * Key features:
 * - Cross-domain data aggregation
 * - Network profile integration
 * - Active sessions summary
 * - Upcoming bookings list
 * - Active alerts tracking
 * - Derived metrics and counts
 */

import { getNetworkProfile } from '../network/index.svelte.js';
import { listUpcomingBookings } from '../bookings/index.svelte.js';
import { listActiveSessions } from '../sessions/index.svelte.js';
import { getActiveAlerts } from '../../logging/index.js';
import type { DashboardResponse } from '@escapeplan/contracts';

/**
 * Class-based state management for dashboard domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class DashboardState {
  // Cache for performance - In Svelte 5, this would use $state rune
  cachedData: DashboardResponse | undefined = undefined;
  lastRefresh: string | undefined = undefined;

  // Derived aggregations - In Svelte 5, these would use $derived rune
  get sessionCount(): number {
    return this.cachedData?.activeSessions.length ?? 0;
  }

  get alertCount(): number {
    return this.cachedData?.alerts.length ?? 0;
  }

  get upcomingBookingCount(): number {
    return this.cachedData?.upcomingBookings.length ?? 0;
  }

  get hasActiveSessions(): boolean {
    return this.sessionCount > 0;
  }

  get hasAlerts(): boolean {
    return this.alertCount > 0;
  }

  get hasUpcomingBookings(): boolean {
    return this.upcomingBookingCount > 0;
  }

  get networkStatus(): 'online' | 'degraded' | 'offline' {
    return this.cachedData?.network.status ?? 'offline';
  }

  get isNetworkOnline(): boolean {
    return this.networkStatus === 'online';
  }

  /**
   * Gets the dashboard data by aggregating from all domains
   * This is the main aggregation function that pulls data from:
   * - Network profile (getNetworkProfile)
   * - Upcoming bookings (listUpcomingBookings)
   * - Active sessions (listActiveSessions)
   * - Active alerts (getActiveAlerts)
   */
  getDashboard(): DashboardResponse {
    // Aggregate data from all domains
    const networkProfile = getNetworkProfile();
    const upcoming = listUpcomingBookings(240); // 4 hours window
    const active = listActiveSessions();
    const alerts = getActiveAlerts();

    // Build dashboard response
    const dashboard: DashboardResponse = {
      generatedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      network: {
        status: networkProfile.status,
        message:
          networkProfile.statusMessage ??
          (networkProfile.status === 'offline'
            ? 'Network controller has not reported status yet.'
            : 'Network status available'),
        lastChecked: networkProfile.lastUpdated,
        ssid: networkProfile.ssid,
        password: networkProfile.password,
        broadcastEnabled: networkProfile.broadcastEnabled,
        detailsUrl: '/admin/network'
      },
      activeSessions: active.sessions,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        sessionId: alert.session_id ?? undefined,
        level: alert.level as any,
        category: alert.category as any,
        title: alert.title,
        message: alert.message,
        createdAt: alert.created_at
      })),
      upcomingBookings: upcoming
    };

    // Update cache
    this.cachedData = dashboard;
    this.lastRefresh = dashboard.generatedAt;

    return dashboard;
  }

  /**
   * Gets the cached dashboard data without re-aggregating
   * Useful for derived computations that don't need fresh data
   */
  getCached(): DashboardResponse | undefined {
    return this.cachedData;
  }

  /**
   * Invalidates the cache, forcing next getDashboard() to re-aggregate
   */
  invalidateCache(): void {
    this.cachedData = undefined;
    this.lastRefresh = undefined;
  }

  /**
   * Checks if the cache is fresh (less than specified seconds old)
   */
  isCacheFresh(maxAgeSeconds: number = 5): boolean {
    if (!this.lastRefresh) return false;
    const age = Date.now() - new Date(this.lastRefresh).getTime();
    return age < maxAgeSeconds * 1000;
  }
}

/**
 * Singleton instance of the dashboard state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const dashboardState = new DashboardState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const getDashboard = () => dashboardState.getDashboard();
export const getCachedDashboard = () => dashboardState.getCached();
export const invalidateDashboardCache = () => dashboardState.invalidateCache();

/**
 * Re-export types for convenience
 */
export type { DashboardResponse };
