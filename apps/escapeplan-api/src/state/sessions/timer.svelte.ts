/**
 * Timer domain state management
 *
 * This module provides timer tick logic using a class-based state pattern
 * inspired by Svelte 5 runes. It manages the server-side countdown ticker
 * that runs every second to update all running session timers.
 *
 * Key features:
 * - Server-side interval-based timer ticking (1 second intervals)
 * - Batch updates for all running sessions
 * - Automatic session completion when timer expires
 * - Real-time broadcasting to connected clients
 * - Alert system integration for low time warnings
 */

import { sqlite } from '../../db/client.js';
import { emitSessionUpdate, emitDashboardUpdate } from '../../realtime.js';
import { logToDatabase } from '../../logging/index.js';
import { evaluateAlertRules, dismissAlertsBySession } from '../../logging/alerts.js';
import { getDashboard } from '../dashboard/index.svelte.js';
import { getSessionById } from './index.svelte.js';

/**
 * Class-based state management for timer domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 *
 * In Svelte 5, this would use:
 * - $state for interval tracking
 * - $effect for automatic cleanup
 * - setInterval/clearInterval within effect teardown
 */
class TimerState {
  // Timer interval handle - In Svelte 5, this would use $state rune
  interval: NodeJS.Timeout | undefined = undefined;

  // Track if timer is running - In Svelte 5, this would use $state rune
  isRunning: boolean = false;

  /**
   * Starts the timer interval that ticks every 1000ms (1 second)
   * This function is safe to call multiple times - it will not create duplicate intervals
   *
   * In Svelte 5, this would be managed by $effect with automatic cleanup:
   * ```
   * $effect(() => {
   *   const interval = setInterval(tickTimers, 1000);
   *   return () => clearInterval(interval);
   * });
   * ```
   */
  startTimerInterval(): void {
    if (this.interval) {
      console.warn('[Timer Ticker] Interval already running, skipping start');
      return;
    }

    this.interval = setInterval(() => this.tickTimers(), 1000);
    this.isRunning = true;
    console.log('[Timer Ticker] Started - running every 1 second');
  }

  /**
   * Stops the timer interval
   * This should be called when the server is shutting down
   */
  stopTimerInterval(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      this.isRunning = false;
      console.log('[Timer Ticker] Stopped');
    }
  }

  /**
   * Timer ticker that runs every second to decrement remaining time
   * for all sessions with timer_status = "running"
   *
   * This function:
   * 1. Finds all sessions with running timers
   * 2. Decrements their remaining time by 1 second
   * 3. Increments their elapsed time by 1 second
   * 4. Marks sessions as completed when timer hits zero
   * 5. Broadcasts updates to all connected clients
   * 6. Evaluates alert rules for low time warnings
   * 7. Updates the dashboard with current state
   */
  tickTimers(): void {
    try {
      // Get all running timers
      const runningSessions = sqlite
        .prepare(
          `SELECT id, timer_remaining_seconds, timer_total_elapsed_seconds
           FROM sessions
           WHERE timer_status = 'running' AND timer_remaining_seconds > 0`
        )
        .all() as Array<{
          id: string;
          timer_remaining_seconds: number;
          timer_total_elapsed_seconds: number;
        }>;

      if (runningSessions.length === 0) {
        return; // No active timers
      }

      // Decrement each timer and update
      const updateStmt = sqlite.prepare(
        `UPDATE sessions
         SET timer_remaining_seconds = ?,
             timer_total_elapsed_seconds = ?
         WHERE id = ?`
      );

      const batchUpdate = sqlite.transaction((sessions: typeof runningSessions) => {
        for (const session of sessions) {
          const newRemaining = Math.max(0, session.timer_remaining_seconds - 1);
          const newElapsed = session.timer_total_elapsed_seconds + 1;
          updateStmt.run(newRemaining, newElapsed, session.id);

          // If timer hits zero, mark as completed
          if (newRemaining === 0) {
            sqlite
              .prepare(`UPDATE sessions SET timer_status = 'completed', status = 'completed' WHERE id = ?`)
              .run(session.id);
          }
        }
      });

      batchUpdate(runningSessions);

      // Emit updates for affected sessions
      for (const session of runningSessions) {
        const updated = getSessionById(session.id);
        if (updated) {
          // Evaluate low time alert
          if (updated.timer.remainingSeconds > 0 && updated.timer.remainingSeconds < 300) {
            evaluateAlertRules('timer_tick', {
              sessionId: updated.id,
              gameName: updated.gameName,
              roomName: updated.roomName,
              remaining_seconds: updated.timer.remainingSeconds
            });
          }

          // If timer completed, dismiss all session alerts
          if (updated.timer.status === 'completed') {
            dismissAlertsBySession(updated.id, 'Session completed');
            logToDatabase('info', 'session', 'Session completed - timer expired', {
              sessionId: updated.id,
              gameName: updated.gameName,
              roomName: updated.roomName
            });
          }

          emitSessionUpdate(updated);
          this.broadcastTimerSessions(session.id, updated);
        }
      }

      // Emit dashboard update if any timers changed
      if (runningSessions.length > 0) {
        emitDashboardUpdate(getDashboard());
      }
    } catch (error) {
      console.error('[Timer Ticker] Error:', error);
    }
  }

  /**
   * Broadcasts timer updates for a session to all timer display clients
   * This is called from the sessions module via the public export
   *
   * @param sessionId - The session ID to broadcast
   * @param details - The session details to broadcast
   */
  private broadcastTimerSessions(sessionId: string, details: import('@escapeplan/contracts').GameSessionDetails): void {
    // Import dynamically to avoid circular dependency
    const { emitTimerUpdate } = require('../../realtime.js');
    const { toTimerBroadcast } = require('./index.svelte.js');

    const timerSlugBySessionStmt = sqlite.prepare(`SELECT slug, narrative FROM timer_slugs WHERE session_id = ?`);

    const rows = timerSlugBySessionStmt.all(sessionId) as { slug: string; narrative: string | null }[];
    for (const row of rows) {
      emitTimerUpdate(toTimerBroadcast(row.slug, details, row.narrative ?? undefined));
    }
  }

  /**
   * Get the current running status
   */
  getStatus(): { isRunning: boolean; hasInterval: boolean } {
    return {
      isRunning: this.isRunning,
      hasInterval: this.interval !== undefined
    };
  }
}

/**
 * Singleton instance of the timer state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const timerState = new TimerState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const startTimerInterval = () => timerState.startTimerInterval();
export const stopTimerInterval = () => timerState.stopTimerInterval();
export const tickTimers = () => timerState.tickTimers();
export const getTimerStatus = () => timerState.getStatus();
