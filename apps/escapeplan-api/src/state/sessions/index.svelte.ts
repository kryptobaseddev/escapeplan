/**
 * Sessions domain state management
 *
 * This module provides session CRUD operations using a class-based state pattern
 * inspired by Svelte 5 runes. All functions maintain existing behavior from
 * the original state.ts implementation.
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../../db/client.js';
import {
  emitSessionUpdate,
  emitDashboardUpdate,
  emitTimerUpdate,
  emitBookingsUpdate
} from '../../realtime.js';
import type {
  ActiveSessionsResponse,
  GameSessionDetails,
  GameHintDefinition,
  GameBookingRules,
  GameMilestone,
  GameMilestoneTriggerConfig,
  MilestoneMediaType,
  MilestoneType,
  MilestoneTriggerType,
  QuickStartSessionRequest,
  QuickStartSessionResponse,
  TimerBroadcast,
  RoomDisplayPlaybackStatus
} from '@escapeplan/contracts';
import type { SessionRow } from './types.js';
import type { GameRow, GamePuzzleRow, GameMilestoneRow } from '../games/types.js';

/**
 * In-memory map tracking current room display playback status per session
 * Key: sessionId, Value: current media playback state
 */
const roomDisplayPlaybackState = new Map<string, {
  mediaType: 'text' | 'image' | 'audio' | 'video';
  source: 'hint' | 'milestone';
  status: RoomDisplayPlaybackStatus;
  triggeredAt: string;
} | null>();

/**
 * Update room display playback state for a session
 */
export function updateRoomDisplayPlayback(
  sessionId: string,
  state: {
    mediaType: 'text' | 'image' | 'audio' | 'video';
    source: 'hint' | 'milestone';
    status: RoomDisplayPlaybackStatus;
    triggeredAt: string;
  } | null
): void {
  if (state === null) {
    roomDisplayPlaybackState.delete(sessionId);
  } else {
    roomDisplayPlaybackState.set(sessionId, state);
  }
}

/**
 * Get current room display playback state for a session
 */
export function getRoomDisplayPlayback(sessionId: string): {
  mediaType: 'text' | 'image' | 'audio' | 'video';
  source: 'hint' | 'milestone';
  status: RoomDisplayPlaybackStatus;
  triggeredAt: string;
} | null {
  return roomDisplayPlaybackState.get(sessionId) ?? null;
}

/**
 * Helper function to safely parse JSON from database
 */
function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Prepared statements for efficient database queries
 */
const puzzlesStmt = sqlite.prepare(
  `SELECT id, session_id, puzzle_id, title, description, solution, status, display_order, hints FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`
);

const hintsStmt = sqlite.prepare(
  `SELECT id, session_id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`
);

const timerSlugBySessionStmt = sqlite.prepare(
  `SELECT slug, narrative FROM timer_slugs WHERE session_id = ?`
);

const gameByIdStmt = sqlite.prepare(
  `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, game_type, pricing_model, category, categories,
          min_players, max_players, price_per_player_cents, resources_required, validation_notes, default_volume, camera_ids,
          media_config, room_display_config, pricing_config, booking_rules_config,
          created_at, updated_at, archived_at, archived_by, archived_reason
   FROM games
   WHERE id = ?`
);

const puzzlesByGameStmt = sqlite.prepare(
  `SELECT id, game_id, title, description, solution, media_asset, operator_actions, display_order, hints, media_asset_meta
   FROM game_puzzles WHERE game_id = ? ORDER BY display_order ASC`
);

const milestonesByGameStmt = sqlite.prepare(
  `SELECT id, game_id, type, name, media_type, content, asset_id, volume_level, display_order, trigger_type, trigger_config, enabled, created_at, updated_at
   FROM game_milestones WHERE game_id = ? ORDER BY display_order ASC`
);

const triggeredMilestonesStmt = sqlite.prepare(
  `SELECT milestone_id FROM session_milestones WHERE session_id = ?`
);

/**
 * Populates availableMilestones for a session
 * This should be called for all session detail responses to ensure milestones
 * are visible regardless of timer state (stopped, paused, running)
 */
function populateMilestones(sessionId: string, gameId: string): GameMilestone[] {
  const triggeredMilestones = triggeredMilestonesStmt.all(sessionId) as { milestone_id: string }[];
  const triggeredIds = new Set(triggeredMilestones.map(m => m.milestone_id));

  const gameMilestones = milestonesByGameStmt.all(gameId) as GameMilestoneRow[];
  return gameMilestones
    .filter(m => m.enabled)
    .map(m => ({
      id: m.id,
      gameId: m.game_id,
      type: m.type as MilestoneType,
      name: m.name,
      mediaType: (m.media_type as MilestoneMediaType) ?? null,
      content: m.content ?? null,
      assetId: m.asset_id ?? null,
      volumeLevel: m.volume_level,
      displayOrder: m.display_order,
      triggerType: m.trigger_type as MilestoneTriggerType,
      triggerConfig: m.trigger_config ? (JSON.parse(m.trigger_config) as GameMilestoneTriggerConfig) : null,
      enabled: Boolean(m.enabled),
      triggered: triggeredIds.has(m.id),
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));
}

/**
 * Maps a database SessionRow to a GameSessionDetails domain object
 */
function mapSessionRow(row: SessionRow): GameSessionDetails {
  const playbackState = getRoomDisplayPlayback(row.session_id);
  return {
    id: row.session_id,
    gameId: row.game_id,
    gameName: row.game_name,
    gameSlug: row.game_slug,
    roomName: row.room_name,
    startedAt: row.started_at,
    scheduledEnd: row.scheduled_end,
    status: row.session_status as GameSessionDetails['status'],
    players: row.party_size,
    isMobile: Boolean(row.is_mobile),
    isAdhoc: Boolean(row.is_adhoc),
    timer: {
      totalSeconds: row.timer_total_seconds,
      remainingSeconds: row.timer_remaining_seconds,
      totalElapsedSeconds: row.timer_total_elapsed_seconds,
      status: row.timer_status as GameSessionDetails['timer']['status'],
      startedAt: row.started_at,
      updatedAt: new Date().toISOString()
    },
    hintsUsed: row.hints_used,
    streamThumbnailUrl: row.stream_thumbnail_url ?? undefined,
    puzzles: [],
    hintLog: [],
    backgroundAudio: row.background_audio_track
      ? {
          trackName: row.background_audio_track,
          url: row.background_audio_track,
          isPlaying: Boolean(row.background_audio_is_playing)
        }
      : undefined,
    crew: {
      primary: row.crew_primary,
      support: row.crew_support ?? undefined
    },
    currentRoomDisplayMedia: playbackState
  };
}

/**
 * Class-based state management for sessions domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class SessionsState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  activeSessions: GameSessionDetails[] = [];
  selectedSession: GameSessionDetails | undefined = undefined;

  // Derived state (in Svelte this would be $derived)
  get activeCount(): number {
    return this.activeSessions.length;
  }

  /**
   * Lists all active sessions (running or paused)
   */
  listActiveSessions(): ActiveSessionsResponse {
    const rows = sqlite
      .prepare(
        `SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
                s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
                s.background_audio_is_playing, s.crew_primary, s.crew_support,
                b.party_size, b.is_mobile, b.is_adhoc, b.start_time, b.end_time,
                g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
                g.name AS room_name
         FROM sessions s
         JOIN bookings b ON b.id = s.booking_id
         JOIN games g ON g.id = b.game_id
         WHERE s.status IN ('running', 'paused')
         ORDER BY s.started_at DESC`
      )
      .all() as SessionRow[];

    const sessions = rows.map((row) => {
      const details = mapSessionRow(row);
      const puzzleRows = puzzlesStmt.all(row.session_id) as {
        id: string;
        session_id: string;
        puzzle_id: string | null;
        title: string;
        description: string | null;
        solution: string | null;
        status: string;
        display_order: number;
        hints: string | null
      }[];
      details.puzzles = puzzleRows.map((puzzle) => ({
        id: puzzle.id,
        puzzleId: puzzle.puzzle_id ?? undefined,
        title: puzzle.title,
        description: puzzle.description ?? undefined,
        solution: puzzle.solution ?? undefined,
        status: puzzle.status as GameSessionDetails['puzzles'][number]['status'],
        order: puzzle.display_order,
        hints: puzzle.hints ? (JSON.parse(puzzle.hints) as GameHintDefinition[]) : undefined
      }));
      const hints = hintsStmt.all(row.session_id) as {
        id: string;
        session_id: string;
        type: string;
        message: string;
        asset_url: string | null;
        delivered_by: string;
        delivered_at: string
      }[];
      details.hintLog = hints.map((hint) => ({
        id: hint.id,
        type: hint.type as GameSessionDetails['hintLog'][number]['type'],
        message: hint.message,
        assetUrl: hint.asset_url ?? undefined,
        deliveredBy: hint.delivered_by,
        deliveredAt: hint.delivered_at
      }));
      // Populate milestones for all sessions regardless of timer state
      details.availableMilestones = populateMilestones(row.session_id, row.game_id);
      return details;
    });

    return {
      generatedAt: new Date().toISOString(),
      sessions
    };
  }

  /**
   * Lists sessions with optional filters
   */
  listSessions(filters?: {
    status?: string;
    search?: string;
    sortBy?: 'date' | 'game' | 'location';
    sortOrder?: 'asc' | 'desc';
  }): ActiveSessionsResponse {
    let whereConditions: string[] = [];
    let params: any[] = [];

    // Status filter
    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        whereConditions.push(`s.status IN ('running', 'paused')`);
      } else {
        whereConditions.push(`s.status = ?`);
        params.push(filters.status);
      }
    }

    // Search filter
    if (filters?.search) {
      whereConditions.push(`(g.name LIKE ? OR b.id LIKE ?)`);
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Sort order
    let orderBy = 's.started_at DESC';
    if (filters?.sortBy === 'game') {
      orderBy = `g.name ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (filters?.sortBy === 'location') {
      orderBy = `g.name ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (filters?.sortBy === 'date') {
      orderBy = `s.started_at ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    }

    const query = `
      SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
             s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
             s.background_audio_is_playing, s.crew_primary, s.crew_support,
             b.party_size, b.is_mobile, b.is_adhoc, b.start_time, b.end_time,
             g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
             g.name AS room_name
      FROM sessions s
      JOIN bookings b ON b.id = s.booking_id
      JOIN games g ON g.id = b.game_id
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    const rows = sqlite.prepare(query).all(...params) as SessionRow[];

    const sessions = rows.map((row) => {
      const details = mapSessionRow(row);
      const puzzleRows = puzzlesStmt.all(row.session_id) as {
        id: string;
        session_id: string;
        puzzle_id: string | null;
        title: string;
        description: string | null;
        solution: string | null;
        status: string;
        display_order: number;
        hints: string | null
      }[];
      details.puzzles = puzzleRows.map((puzzle) => ({
        id: puzzle.id,
        puzzleId: puzzle.puzzle_id ?? undefined,
        title: puzzle.title,
        description: puzzle.description ?? undefined,
        solution: puzzle.solution ?? undefined,
        status: puzzle.status as GameSessionDetails['puzzles'][number]['status'],
        order: puzzle.display_order,
        hints: puzzle.hints ? (JSON.parse(puzzle.hints) as GameHintDefinition[]) : undefined
      }));
      const hints = hintsStmt.all(row.session_id) as {
        id: string;
        session_id: string;
        type: string;
        message: string;
        asset_url: string | null;
        delivered_by: string;
        delivered_at: string
      }[];
      details.hintLog = hints.map((hint) => ({
        id: hint.id,
        type: hint.type as GameSessionDetails['hintLog'][number]['type'],
        message: hint.message,
        assetUrl: hint.asset_url ?? undefined,
        deliveredBy: hint.delivered_by,
        deliveredAt: hint.delivered_at
      }));
      // Populate milestones for all sessions regardless of timer state
      details.availableMilestones = populateMilestones(row.session_id, row.game_id);
      return details;
    });

    return {
      generatedAt: new Date().toISOString(),
      sessions
    };
  }

  /**
   * Gets a single session by ID
   */
  getSessionById(id: string): GameSessionDetails | undefined {
    const stmt = sqlite.prepare(
      `SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
              s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
              s.background_audio_is_playing, s.crew_primary, s.crew_support,
              b.party_size, b.is_mobile, b.is_adhoc,
              g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
              g.name AS room_name
       FROM sessions s
       JOIN bookings b ON b.id = s.booking_id
       JOIN games g ON g.id = b.game_id
       WHERE s.id = ? LIMIT 1`
    );
    const row = stmt.get(id) as SessionRow | undefined;
    if (!row) return undefined;
    const details = mapSessionRow(row);
    const puzzleRows = sqlite
      .prepare(`SELECT id, puzzle_id, title, description, solution, status, display_order, hints FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`)
      .all(id) as {
        id: string;
        puzzle_id: string | null;
        title: string;
        description: string | null;
        solution: string | null;
        status: string;
        display_order: number;
        hints: string | null
      }[];
    details.puzzles = puzzleRows.map((p) => ({
      id: p.id,
      puzzleId: p.puzzle_id ?? undefined,
      title: p.title,
      description: p.description ?? undefined,
      solution: p.solution ?? undefined,
      status: p.status as GameSessionDetails['puzzles'][number]['status'],
      order: p.display_order,
      hints: p.hints ? (JSON.parse(p.hints) as GameHintDefinition[]) : undefined
    }));
    const hintRows = sqlite
      .prepare(`SELECT id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`)
      .all(id) as {
        id: string;
        type: string;
        message: string;
        asset_url: string | null;
        delivered_by: string;
        delivered_at: string
      }[];
    details.hintLog = hintRows.map((hint) => ({
      id: hint.id,
      type: hint.type as GameSessionDetails['hintLog'][number]['type'],
      message: hint.message,
      assetUrl: hint.asset_url ?? undefined,
      deliveredBy: hint.delivered_by,
      deliveredAt: hint.delivered_at
    }));

    // Populate milestones for all sessions regardless of timer state
    details.availableMilestones = populateMilestones(id, row.game_id);

    return details;
  }

  /**
   * Gets a session by its public timer slug
   */
  getSessionBySlug(slug: string): { session: GameSessionDetails; slug: string; narrative?: string } | undefined {
    const stmt = sqlite.prepare(
      `SELECT t.slug, t.narrative,
              s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
              s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
              s.background_audio_is_playing, s.crew_primary, s.crew_support,
              b.party_size, b.is_mobile, b.is_adhoc,
              g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
              g.name AS room_name
       FROM timer_slugs t
       JOIN sessions s ON s.id = t.session_id
       JOIN bookings b ON b.id = s.booking_id
       JOIN games g ON g.id = b.game_id
       WHERE t.slug = ? LIMIT 1`
    );
    const row = stmt.get(slug) as (SessionRow & { slug: string; narrative: string | null }) | undefined;
    if (!row) return undefined;
    const details = mapSessionRow(row);
    const puzzleRows = sqlite
      .prepare(`SELECT id, puzzle_id, title, description, solution, status, display_order, hints FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`)
      .all(row.session_id) as {
        id: string;
        puzzle_id: string | null;
        title: string;
        description: string | null;
        solution: string | null;
        status: string;
        display_order: number;
        hints: string | null
      }[];
    details.puzzles = puzzleRows.map((p) => ({
      id: p.id,
      puzzleId: p.puzzle_id ?? undefined,
      title: p.title,
      description: p.description ?? undefined,
      solution: p.solution ?? undefined,
      status: p.status as GameSessionDetails['puzzles'][number]['status'],
      order: p.display_order,
      hints: p.hints ? (JSON.parse(p.hints) as GameHintDefinition[]) : undefined
    }));
    const hintRows = sqlite
      .prepare(`SELECT id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`)
      .all(row.session_id) as {
        id: string;
        type: string;
        message: string;
        asset_url: string | null;
        delivered_by: string;
        delivered_at: string
      }[];
    details.hintLog = hintRows.map((hint) => ({
      id: hint.id,
      type: hint.type as GameSessionDetails['hintLog'][number]['type'],
      message: hint.message,
      assetUrl: hint.asset_url ?? undefined,
      deliveredBy: hint.delivered_by,
      deliveredAt: hint.delivered_at
    }));
    // Populate milestones for all sessions regardless of timer state
    details.availableMilestones = populateMilestones(row.session_id, row.game_id);
    return { session: details, slug: row.slug, narrative: row.narrative ?? undefined };
  }

  /**
   * Converts session details to a timer broadcast format
   */
  toTimerBroadcast(slug: string, details: GameSessionDetails, narrative?: string): TimerBroadcast {
    const gameRow = gameByIdStmt.get(details.gameId) as GameRow | undefined;
    const roomConfig = gameRow ? safeParse<import('@escapeplan/contracts').RoomDisplayConfig>(gameRow.room_display_config) : undefined;

    // Determine background based on room display config
    let background: { type: 'image' | 'video'; url: string };

    if (roomConfig?.backgroundType === 'asset' && roomConfig.backgroundAssetId) {
      // Use configured asset - look up the file_path from the database
      const assetRow = sqlite.prepare('SELECT file_path, asset_type FROM assets WHERE id = ?').get(roomConfig.backgroundAssetId) as { file_path: string; asset_type: string } | undefined;
      if (assetRow) {
        background = {
          type: assetRow.asset_type === 'video' ? 'video' : 'image',
          url: `/assets/${assetRow.file_path}`
        };
      } else {
        // Asset not found, fallback to dark gradient
        background = {
          type: 'image',
          url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIHZpZXdCb3g9IjAgMCAxMjAwIDgwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMWExYTFhO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJkMmQyZDtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIC8+PC9zdmc+'
        };
      }
    } else {
      // Fallback to dark gradient (NO camera stream)
      background = {
        type: 'image',
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIHZpZXdCb3g9IjAgMCAxMjAwIDgwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMWExYTFhO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzJkMmQyZDtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIGZpbGw9InVybCgjZykiIC8+PC9zdmc+'
      };
    }

    return {
      slug,
      sessionId: details.id,
      gameName: details.gameName,
      roomName: details.roomName,
      narrative,
      background,
      timer: details.timer,
      roomConfig
      // hintBanner removed - using room-display:media event instead
    };
  }

  /**
   * Quick start a new session (creates ad-hoc booking and session)
   */
  quickStartSession(
    payload: QuickStartSessionRequest,
    operatorId: string
  ): QuickStartSessionResponse {
    const gameRow = gameByIdStmt.get(payload.gameId) as GameRow | undefined;
    if (!gameRow) {
      throw new Error('Game not found');
    }

    if (payload.partySize < gameRow.min_players || payload.partySize > gameRow.max_players) {
      throw new Error('Party size outside allowed range for this game');
    }

    const durationMinutes = payload.durationMinutes && payload.durationMinutes > 0
      ? payload.durationMinutes
      : gameRow.duration_minutes;

    const now = new Date();
    const nowIso = now.toISOString();
    const totalSeconds = durationMinutes * 60;
    const scheduledEndIso = new Date(now.getTime() + totalSeconds * 1000).toISOString();

    const bookingId = randomUUID();
    const sessionId = randomUUID();
    const bookingCode = `ADHOC-${now.getTime()}`;

    const bookingRules = safeParse<GameBookingRules>(gameRow.booking_rules_config);

    // Import findOperatorById from operators module
    const operatorStmt = sqlite.prepare(`SELECT id, name FROM user WHERE id = ?`);
    const operator = operatorStmt.get(operatorId) as { id: string; name: string } | undefined;
    const crewPrimary = operator?.name ?? 'Quick Start';

    sqlite
      .prepare(
        `INSERT INTO bookings (
           id, booking_code, game_id, start_time, end_time, status,
           party_size, deposit_due_cents, total_due_cents, price_tier, discount_code,
           is_mobile, is_adhoc, location_note, notes, contact_name, contact_phone
         ) VALUES (
           @id, @booking_code, @game_id, @start_time, @end_time, @status,
           @party_size, @deposit_due_cents, @total_due_cents, @price_tier, @discount_code,
           @is_mobile, @is_adhoc, @location_note, @notes, @contact_name, @contact_phone
         )`
      )
      .run({
        id: bookingId,
        booking_code: bookingCode,
        game_id: payload.gameId,
        start_time: nowIso,
        end_time: scheduledEndIso,
        status: 'ADHOC',
        party_size: payload.partySize,
        deposit_due_cents: 0,
        total_due_cents: 0,
        price_tier: 'standard',
        discount_code: null,
        is_mobile: 0,
        is_adhoc: 1,
        location_note: bookingRules?.locationNotes ?? null,
        notes: payload.notes ?? null,
        contact_name: 'Walk-in',
        contact_phone: 'N/A'
      });

    // Determine initial timer status based on autoStartTimer flag
    const initialTimerStatus = payload.autoStartTimer === true ? 'running' : 'idle';

    sqlite
      .prepare(
        `INSERT INTO sessions (
           id, booking_id, status, timer_total_seconds, timer_remaining_seconds, timer_total_elapsed_seconds, timer_status,
           started_at, scheduled_end, hints_used, stream_thumbnail_url,
           background_audio_track, background_audio_is_playing, crew_primary, crew_support
         ) VALUES (
           @id, @booking_id, 'running', @timer_total_seconds, @timer_total_seconds, 0, @timer_status,
           @started_at, @scheduled_end, 0, NULL, NULL, 0, @crew_primary, NULL
         )`
      )
      .run({
        id: sessionId,
        booking_id: bookingId,
        timer_total_seconds: totalSeconds,
        timer_status: initialTimerStatus,
        started_at: nowIso,
        scheduled_end: scheduledEndIso,
        crew_primary: crewPrimary
      });

    const basePuzzles = puzzlesByGameStmt.all(payload.gameId) as GamePuzzleRow[];
    const insertSessionPuzzle = sqlite.prepare(
      `INSERT INTO session_puzzles (id, session_id, puzzle_id, title, description, solution, status, display_order, hints)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    basePuzzles.forEach((puzzle, index) => {
      insertSessionPuzzle.run(
        randomUUID(),
        sessionId,
        puzzle.id, // puzzle_id reference
        puzzle.title,
        puzzle.description,
        puzzle.solution,
        'available', // All puzzles are available from the start (no gating)
        puzzle.display_order ?? index + 1,
        puzzle.hints // Already a JSON string from database
      );
    });

    // Copy milestones to session (only enabled ones with auto-triggers)
    const gameMilestones = milestonesByGameStmt.all(payload.gameId) as GameMilestoneRow[];
    const enabledAutoMilestones = gameMilestones.filter(m => m.enabled && m.trigger_type !== 'manual');

    // Note: Auto-triggered milestones will be added to session_milestones when they trigger
    // Manual milestones can be triggered via game runner UI

    sqlite
      .prepare(
        `INSERT INTO timer_slugs (slug, session_id, narrative)
         VALUES (@slug, @session_id, @narrative)
         ON CONFLICT(slug) DO UPDATE SET session_id = excluded.session_id, narrative = excluded.narrative`
      )
      .run({
        slug: gameRow.slug,
        session_id: sessionId,
        narrative: payload.notes ?? bookingRules?.locationNotes ?? null
      });

    const sessionDetails = this.getSessionById(sessionId);
    if (!sessionDetails) {
      throw new Error('Failed to initialize session');
    }

    emitSessionUpdate(sessionDetails);

    // Import getDashboard - we'll need to create a circular dependency workaround
    // For now, we'll emit dashboard update from the caller
    // emitDashboardUpdate(getDashboard());

    this.broadcastTimerSessions(sessionId, sessionDetails);

    const bookingDate = nowIso.slice(0, 10);

    // Import getBookingsByDate - we'll need to handle this circular dependency
    // For now, we'll emit bookings update from the caller
    // emitBookingsUpdate(getBookingsByDate(bookingDate, 'all'));

    return { session: sessionDetails };
  }

  /**
   * Broadcasts timer updates for a session
   */
  private broadcastTimerSessions(sessionId: string, details: GameSessionDetails): void {
    const rows = timerSlugBySessionStmt.all(sessionId) as { slug: string; narrative: string | null }[];
    for (const row of rows) {
      emitTimerUpdate(this.toTimerBroadcast(row.slug, details, row.narrative ?? undefined));
    }
  }
}

/**
 * Singleton instance of the sessions state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const sessionsState = new SessionsState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const listActiveSessions = () => sessionsState.listActiveSessions();
export const listSessions = (filters?: {
  status?: string;
  search?: string;
  sortBy?: 'date' | 'game' | 'location';
  sortOrder?: 'asc' | 'desc';
}) => sessionsState.listSessions(filters);
export const getSessionById = (id: string) => sessionsState.getSessionById(id);
export const getSessionBySlug = (slug: string) => sessionsState.getSessionBySlug(slug);
export const toTimerBroadcast = (slug: string, details: GameSessionDetails, narrative?: string) =>
  sessionsState.toTimerBroadcast(slug, details, narrative);
export const quickStartSession = (payload: QuickStartSessionRequest, operatorId: string) =>
  sessionsState.quickStartSession(payload, operatorId);

/**
 * Re-export types for convenience
 */
export type { SessionRow } from './types.js';
