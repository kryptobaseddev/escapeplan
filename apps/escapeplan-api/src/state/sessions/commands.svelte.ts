/**
 * Session Commands domain state management
 *
 * This module provides command handling for session operations using a class-based
 * state pattern inspired by Svelte 5 runes. It processes all command types that
 * modify session state, including timer controls, hints, and milestone triggers.
 *
 * Key features:
 * - Centralized command handling with type-safe dispatch
 * - Timer control commands (start, pause, resume, reset)
 * - Hint delivery with media support
 * - Puzzle status tracking
 * - Milestone triggering with room display integration
 * - Real-time broadcasting to connected clients
 * - Alert system integration
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../../db/client.js';
import {
  emitSessionUpdate,
  emitDashboardUpdate,
  emitCommandAck,
  emitRoomDisplayMedia
} from '../../realtime.js';
import { logToDatabase } from '../../logging/index.js';
import { evaluateAlertRules, autoDismissAlerts } from '../../logging/alerts.js';
import { getDashboard } from '../dashboard/index.svelte.js';
import { getSessionById, updateRoomDisplayPlayback } from './index.svelte.js';
import { getGameDetails } from '../games/index.svelte.js';
import type { CommandRequest, CommandResponse, GameSessionDetails } from '@escapeplan/contracts';
import type { GameMilestoneRow } from '../games/types.js';

/**
 * Prepared statement for getting timer slugs by session
 */
const timerSlugBySessionStmt = sqlite.prepare(`SELECT slug, narrative FROM timer_slugs WHERE session_id = ?`);

/**
 * Class-based state management for session commands domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 *
 * In Svelte 5, command state would be managed with:
 * - $state for tracking command history
 * - $derived for computing command effects
 * - Reactive updates to UI on command execution
 */
class CommandsState {
  /**
   * Applies a command to a session and returns the updated session state
   *
   * This is the main command handler that processes all session commands:
   * - start_timer: Starts the session timer
   * - pause_timer: Pauses the running timer
   * - resume_timer: Resumes a paused timer
   * - reset_timer: Resets the timer to initial state
   * - send_hint: Sends a hint to the room display
   * - mark_puzzle: Updates puzzle status
   * - trigger_milestone: Triggers a game milestone
   *
   * @param sessionId - The session ID to apply the command to
   * @param command - The command request with type and payload
   * @returns CommandResponse with updated session state
   * @throws Error if session not found or command fails
   */
  async applyCommand(sessionId: string, command: CommandRequest): Promise<CommandResponse> {
    const session = getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const nowIso = new Date().toISOString();

    switch (command.command) {
      case 'start_timer':
        this.handleStartTimer(sessionId, session);
        break;

      case 'pause_timer':
        this.handlePauseTimer(sessionId, session);
        break;

      case 'resume_timer':
        this.handleResumeTimer(sessionId, session);
        break;

      case 'reset_timer':
        this.handleResetTimer(sessionId, session);
        break;

      case 'stop_session':
        this.handleStopSession(sessionId, session);
        break;

      case 'send_hint':
        this.handleSendHint(sessionId, session, command.payload, nowIso);
        break;

      case 'mark_puzzle':
        this.handleMarkPuzzle(sessionId, command.payload);
        break;

      case 'trigger_milestone':
        this.handleTriggerMilestone(sessionId, session, command.payload, nowIso);
        break;

      case 'reset_milestone':
        this.handleResetMilestone(sessionId, session, command.payload);
        break;

      default:
        throw new Error('Unsupported command');
    }

    const updated = getSessionById(sessionId);
    if (!updated) {
      throw new Error('Unable to load session after command');
    }

    const response: CommandResponse = {
      status: 'ok',
      session: updated,
      message: 'Session updated'
    };

    emitSessionUpdate(updated);
    emitCommandAck(response);
    emitDashboardUpdate(getDashboard());
    await this.broadcastTimerSessions(sessionId, updated);

    return response;
  }

  /**
   * Handles start_timer command
   */
  private handleStartTimer(sessionId: string, session: GameSessionDetails): void {
    sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running' WHERE id = ?`).run(sessionId);
    logToDatabase('info', 'session', 'Timer started', {
      sessionId,
      gameName: session.gameName,
      roomName: session.roomName
    });
  }

  /**
   * Handles pause_timer command
   */
  private handlePauseTimer(sessionId: string, session: GameSessionDetails): void {
    sqlite.prepare(`UPDATE sessions SET timer_status = 'paused', status = 'paused' WHERE id = ?`).run(sessionId);
    logToDatabase('info', 'session', 'Timer paused by operator', {
      sessionId,
      gameName: session.gameName,
      roomName: session.roomName
    });
    evaluateAlertRules('timer_paused', {
      sessionId,
      gameName: session.gameName,
      roomName: session.roomName,
      time: new Date().toLocaleTimeString()
    });
  }

  /**
   * Handles resume_timer command
   */
  private handleResumeTimer(sessionId: string, session: GameSessionDetails): void {
    sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running' WHERE id = ?`).run(sessionId);
    logToDatabase('info', 'session', 'Timer resumed by operator', {
      sessionId,
      gameName: session.gameName,
      roomName: session.roomName
    });
    autoDismissAlerts('timer_resume', { sessionId });
  }

  /**
   * Handles reset_timer command
   */
  private handleResetTimer(sessionId: string, session: GameSessionDetails): void {
    // Calculate elapsed time before reset
    const beforeReset = sqlite
      .prepare(
        `SELECT timer_total_seconds, timer_remaining_seconds, timer_total_elapsed_seconds FROM sessions WHERE id = ?`
      )
      .get(sessionId) as
      | { timer_total_seconds: number; timer_remaining_seconds: number; timer_total_elapsed_seconds: number }
      | undefined;

    if (beforeReset) {
      const elapsedThisRound = beforeReset.timer_total_seconds - beforeReset.timer_remaining_seconds;
      const newTotalElapsed = beforeReset.timer_total_elapsed_seconds + elapsedThisRound;

      sqlite
        .prepare(
          `UPDATE sessions
           SET timer_status = 'idle',
               timer_remaining_seconds = timer_total_seconds,
               timer_total_elapsed_seconds = ?
           WHERE id = ?`
        )
        .run(newTotalElapsed, sessionId);
    }
    logToDatabase('info', 'session', 'Timer reset by operator', {
      sessionId,
      gameName: session.gameName,
      roomName: session.roomName
    });
  }

  /**
   * Handles stop_session command
   * Ends the game session by setting timer to zero and status to completed
   */
  private handleStopSession(sessionId: string, session: GameSessionDetails): void {
    try {
      // Set timer to zero and mark session as completed
      sqlite
        .prepare(
          `UPDATE sessions
           SET timer_remaining_seconds = 0,
               timer_status = 'completed',
               status = 'completed'
           WHERE id = ?`
        )
        .run(sessionId);

      logToDatabase('info', 'session', 'Session stopped by operator', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });

      evaluateAlertRules('session_stopped', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName,
        time: new Date().toLocaleTimeString()
      });
    } catch (error) {
      logToDatabase('error', 'session', 'Failed to stop session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Handles send_hint command
   */
  private handleSendHint(
    sessionId: string,
    session: GameSessionDetails,
    payload: Record<string, unknown> | undefined,
    nowIso: string
  ): void {
    const medium = String(payload?.medium ?? 'text');
    const message = String(payload?.message ?? '').trim();
    const assetUrl = payload?.assetUrl ? String(payload.assetUrl).trim() : null;
    const volumeLevel = payload?.volumeLevel ? Number(payload.volumeLevel) : null;
    const puzzleId = payload?.puzzleId ? String(payload.puzzleId) : null;
    const displayDurationSeconds = payload?.displayDurationSeconds ? Number(payload.displayDurationSeconds) : undefined;
    const loop = payload?.loop ? Boolean(payload.loop) : false;
    const loopCount = payload?.loopCount ? Number(payload.loopCount) : undefined;

    // Validate based on medium type
    if (medium === 'text') {
      // Text hints require non-empty message
      if (!message || message.length === 0) {
        throw new Error('Hint message required for text hints');
      }
    } else if (medium === 'audio' || medium === 'image' || medium === 'video') {
      // Audio/image/video hints require assetUrl
      if (!assetUrl || assetUrl.length === 0) {
        throw new Error(`Asset URL required for ${medium} hints`);
      }
    } else {
      throw new Error(`Invalid hint medium: ${medium}`);
    }

    // Store hint in session_hints
    sqlite
      .prepare(
        `INSERT INTO session_hints
        (id, session_id, puzzle_id, type, message, asset_url, volume_level, delivered_by, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`hint-${Date.now()}`, sessionId, puzzleId, medium, message, assetUrl, volumeLevel, 'Console Operator', nowIso);

    // Only increment hints_used if countAsHint is not explicitly false (defaults to true)
    const countAsHint = payload?.countAsHint !== false;
    if (countAsHint) {
      sqlite.prepare(`UPDATE sessions SET hints_used = hints_used + 1 WHERE id = ?`).run(sessionId);
    }

    // Set playback state to 'playing'
    updateRoomDisplayPlayback(sessionId, {
      mediaType: medium as 'text' | 'image' | 'audio' | 'video',
      source: 'hint',
      status: 'playing',
      triggeredAt: nowIso
    });

    // Emit to Room Display
    const timerSlugs = timerSlugBySessionStmt.all(sessionId) as { slug: string }[];
    const game = getGameDetails(session.gameId);

    for (const { slug } of timerSlugs) {
      emitRoomDisplayMedia({
        slug,
        sessionId,
        mediaType: medium as 'text' | 'image' | 'audio' | 'video',
        content: assetUrl ?? message,
        volumeLevel: volumeLevel ?? game?.defaultVolume ?? 80,
        loop,
        loopCount,
        autoDismiss: medium !== 'text',
        displayDurationSeconds,
        triggeredAt: nowIso,
        source: 'hint',
        textHintColors:
          medium === 'text'
            ? {
                textColor: game?.roomDisplayConfig?.textHintTextColor ?? '#000000',
                backgroundColor: game?.roomDisplayConfig?.textHintBackgroundColor ?? '#FFA500'
              }
            : undefined
      });
    }

    logToDatabase('info', 'session', `Hint sent: ${message.substring(0, 50)}`, {
      sessionId,
      gameName: session.gameName,
      medium,
      hasAsset: !!assetUrl
    });

    evaluateAlertRules('hint_sent', { sessionId, gameName: session.gameName });
  }

  /**
   * Handles mark_puzzle command
   */
  private handleMarkPuzzle(sessionId: string, payload: Record<string, unknown> | undefined): void {
    const puzzleId = String(payload?.puzzleId ?? '').trim();
    const status = String(payload?.status ?? '').trim();
    if (!puzzleId || !status) {
      throw new Error('Puzzle and status required');
    }
    sqlite.prepare(`UPDATE session_puzzles SET status = ? WHERE id = ? AND session_id = ?`).run(status, puzzleId, sessionId);
  }

  /**
   * Handles trigger_milestone command
   */
  private handleTriggerMilestone(
    sessionId: string,
    session: GameSessionDetails,
    payload: Record<string, unknown> | undefined,
    nowIso: string
  ): void {
    const milestoneId = String(payload?.milestoneId ?? '').trim();
    if (!milestoneId) {
      throw new Error('Milestone ID required');
    }

    // Get milestone details
    const milestone = sqlite.prepare('SELECT * FROM game_milestones WHERE id = ?').get(milestoneId) as
      | GameMilestoneRow
      | undefined;
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    // Check if already triggered
    const alreadyTriggered = sqlite
      .prepare('SELECT id FROM session_milestones WHERE session_id = ? AND milestone_id = ?')
      .get(sessionId, milestoneId);

    if (alreadyTriggered) {
      throw new Error('Milestone already triggered');
    }

    // Look up asset file_path if asset_id exists
    let assetUrl: string | null = null;
    if (milestone.asset_id) {
      const asset = sqlite.prepare('SELECT file_path FROM assets WHERE id = ?').get(milestone.asset_id) as
        | { file_path: string }
        | undefined;
      if (asset) {
        assetUrl = `/assets/${asset.file_path}`;
      } else {
        logToDatabase('warn', 'session', `Milestone asset not found: ${milestone.asset_id}`, {
          milestoneId: milestone.id,
          assetId: milestone.asset_id
        });
      }
    }

    // Insert milestone trigger record
    sqlite
      .prepare(
        `INSERT INTO session_milestones (
          id, session_id, milestone_id, milestone_type, milestone_name,
          media_type, content, asset_url, volume_level, triggered_at, triggered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        sessionId,
        milestoneId,
        milestone.type,
        milestone.name,
        milestone.media_type,
        milestone.content,
        assetUrl,
        milestone.volume_level,
        nowIso,
        payload?.operatorId ?? null
      );

    // Set playback state to 'playing'
    updateRoomDisplayPlayback(sessionId, {
      mediaType: (milestone.media_type ?? 'text') as 'text' | 'image' | 'audio' | 'video',
      source: 'milestone',
      status: 'playing',
      triggeredAt: nowIso
    });

    // Emit to Room Display
    const timerSlugs = timerSlugBySessionStmt.all(sessionId) as { slug: string }[];
    const game = getGameDetails(session.gameId);

    for (const { slug } of timerSlugs) {
      emitRoomDisplayMedia({
        slug,
        sessionId,
        mediaType: (milestone.media_type ?? 'text') as 'text' | 'image' | 'audio' | 'video',
        content: assetUrl ?? milestone.content ?? '',
        volumeLevel: milestone.volume_level ?? game?.defaultVolume ?? 80,
        loop: Boolean(milestone.loop),
        loopCount: milestone.loop_count ?? undefined,
        autoDismiss: Boolean(milestone.auto_dismiss),
        displayDurationSeconds: milestone.display_duration_seconds ?? undefined,
        triggeredAt: nowIso,
        source: 'milestone',
        textHintColors:
          milestone.media_type === 'text'
            ? {
                textColor: game?.roomDisplayConfig?.textHintTextColor ?? '#000000',
                backgroundColor: game?.roomDisplayConfig?.textHintBackgroundColor ?? '#FFA500'
              }
            : undefined
      });
    }

    logToDatabase('info', 'session', `Milestone triggered: ${milestone.name}`, {
      sessionId,
      gameName: session.gameName,
      milestoneType: milestone.type
    });
  }

  /**
   * Handles reset_milestone command
   * Removes the milestone trigger record from session_milestones table,
   * making the milestone available to trigger again in the session.
   */
  private handleResetMilestone(
    sessionId: string,
    session: GameSessionDetails,
    payload: Record<string, unknown> | undefined
  ): void {
    const milestoneId = String(payload?.milestoneId ?? '').trim();
    if (!milestoneId) {
      throw new Error('Milestone ID required');
    }

    // Verify milestone exists and was triggered
    const existingTrigger = sqlite
      .prepare('SELECT id, milestone_name FROM session_milestones WHERE session_id = ? AND milestone_id = ?')
      .get(sessionId, milestoneId) as { id: string; milestone_name: string } | undefined;

    if (!existingTrigger) {
      throw new Error('Milestone not triggered in this session');
    }

    // Delete the trigger record to make milestone available again
    sqlite
      .prepare('DELETE FROM session_milestones WHERE session_id = ? AND milestone_id = ?')
      .run(sessionId, milestoneId);

    logToDatabase('info', 'session', `Milestone reset: ${existingTrigger.milestone_name}`, {
      sessionId,
      gameName: session.gameName,
      milestoneId
    });
  }

  /**
   * Broadcasts timer updates for a session to all timer display clients
   * This is called after every command to keep timer displays in sync
   *
   * @param sessionId - The session ID to broadcast
   * @param details - The session details to broadcast
   */
  private async broadcastTimerSessions(sessionId: string, details: GameSessionDetails): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { emitTimerUpdate } = await import('../../realtime.js');
    const { toTimerBroadcast } = await import('./index.svelte.js');

    const rows = timerSlugBySessionStmt.all(sessionId) as { slug: string; narrative: string | null }[];
    for (const row of rows) {
      emitTimerUpdate(toTimerBroadcast(row.slug, details, row.narrative ?? undefined));
    }
  }
}

/**
 * Singleton instance of the commands state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const commandsState = new CommandsState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const applyCommand = async (sessionId: string, command: CommandRequest) => await commandsState.applyCommand(sessionId, command);
