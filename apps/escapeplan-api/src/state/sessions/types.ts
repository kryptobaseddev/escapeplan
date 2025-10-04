/**
 * Sessions state management types
 *
 * This module defines types for session operations including:
 * - Session creation, updating, and lifecycle management
 * - Timer state and control
 * - Session commands (hints, pause, resume, etc.)
 * - Active session tracking
 * - Session-related broadcasting
 */

import type {
  GameSessionDetails,
  ActiveSessionSummary,
  ActiveSessionsResponse,
  SessionStatus,
  TimerStatus,
  TimerState,
  TimerBroadcast,
  CommandRequest,
  CommandResponse,
  QuickStartSessionRequest,
  QuickStartSessionResponse
} from '@escapeplan/contracts';

/**
 * Re-export contract types for convenience
 */
export type {
  GameSessionDetails,
  ActiveSessionSummary,
  ActiveSessionsResponse,
  SessionStatus,
  TimerStatus,
  TimerState,
  TimerBroadcast,
  CommandRequest,
  CommandResponse,
  QuickStartSessionRequest,
  QuickStartSessionResponse
};

/**
 * Database row representation of a session
 */
export interface SessionRow {
  session_id: string;
  booking_id: string;
  session_status: string;
  timer_total_seconds: number;
  timer_remaining_seconds: number;
  timer_total_elapsed_seconds: number;
  timer_status: string;
  started_at: string;
  scheduled_end: string;
  hints_used: number;
  stream_thumbnail_url: string | null;
  background_audio_track: string | null;
  background_audio_is_playing: number;
  crew_primary: string;
  crew_support: string | null;
  party_size: number;
  is_mobile: number;
  is_adhoc: number;
  game_id: string;
  game_name: string;
  game_slug: string;
  room_name: string;
}

/**
 * Filters for listing sessions
 */
export interface SessionListFilters {
  status?: SessionStatus;
  gameId?: string;
  isMobile?: boolean;
  isAdhoc?: boolean;
  startDate?: string;
  endDate?: string;
  crewMember?: string;
}

/**
 * Session with timer state
 */
export interface SessionWithTimer {
  session: GameSessionDetails;
  timer: TimerState;
}

/**
 * Timer tick result
 */
export interface TimerTickResult {
  sessionId: string;
  timerState: TimerState;
  sessionCompleted: boolean;
  broadcastRequired: boolean;
}

/**
 * Session command types
 */
export type SessionCommandType =
  | 'start_session'
  | 'pause_timer'
  | 'resume_timer'
  | 'add_time'
  | 'subtract_time'
  | 'send_hint'
  | 'complete_session'
  | 'abort_session'
  | 'update_crew'
  | 'toggle_audio';

/**
 * Session state update
 */
export interface SessionStateUpdate {
  sessionId: string;
  updates: Partial<{
    status: SessionStatus;
    timerStatus: TimerStatus;
    remainingSeconds: number;
    hintsUsed: number;
    backgroundAudioPlaying: boolean;
    crewPrimary: string;
    crewSupport: string | null;
  }>;
  timestamp: string;
}

/**
 * Session completion result
 */
export interface SessionCompletionResult {
  sessionId: string;
  completedAt: string;
  finalTime: number;
  hintsUsed: number;
  success: boolean;
}

/**
 * Session operation errors
 */
export enum SessionErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_ALREADY_STARTED = 'SESSION_ALREADY_STARTED',
  SESSION_ALREADY_COMPLETED = 'SESSION_ALREADY_COMPLETED',
  SESSION_NOT_RUNNING = 'SESSION_NOT_RUNNING',
  INVALID_COMMAND = 'INVALID_COMMAND',
  TIMER_EXHAUSTED = 'TIMER_EXHAUSTED',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  CREW_MEMBER_NOT_FOUND = 'CREW_MEMBER_NOT_FOUND',
}

export interface SessionError {
  code: SessionErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Active session tracking
 */
export interface ActiveSessionTracker {
  sessionId: string;
  gameId: string;
  startedAt: string;
  lastTick: string;
  timerStatus: TimerStatus;
  remainingSeconds: number;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageDuration: number;
  averageHintsUsed: number;
  successRate: number;
}
