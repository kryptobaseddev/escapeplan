import { nanoid } from 'nanoid';
import { runMigrations, sqlite } from './db/client.js';
import {
  emitBookingsUpdate,
  emitCommandAck,
  emitDashboardUpdate,
  emitSessionUpdate,
  emitTimerUpdate
} from './realtime.js';
import {
  logToDatabase,
  evaluateAlertRules,
  dismissAlertsBySession,
  autoDismissAlerts,
  getActiveAlerts
} from './logging/index.js';
import type {
  ActiveSessionsResponse,
  BookingCalendarResponse,
  BookingSummary,
  ChangeOwnPasswordRequest,
  CommandRequest,
  CommandResponse,
  CreateOperatorRequest,
  DashboardResponse,
  GameDetails,
  GameBookingRules,
  GameRoomDefinition,
  GamePuzzleDefinition,
  GameHintDefinition,
  GameMediaConfig,
  GamePricingConfig,
  GameSessionDetails,
  NetworkHealth,
  NetworkProfile,
  OperatorProfile,
  OperatorSummary,
  QuickStartSessionRequest,
  QuickStartSessionResponse,
  ResetOperatorPasswordRequest,
  SaveGameRequest,
  TimerBroadcast,
  UpdateNetworkProfileRequest,
  UpdateOperatorRequest,
  UpdateOwnProfileRequest
} from '@escapeplan/contracts';
import { auth } from './auth.js';
import { normalizePermissions, permissionsForRole, normalizeRole } from './security.js';

runMigrations();

const authContextPromise = auth.$context;

async function getAuthContext() {
  return authContextPromise;
}

async function getInternalAdapter() {
  const context = await getAuthContext();
  return context.internalAdapter;
}

function safeParse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

type OperatorRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar_config: string | Record<string, unknown> | null; // string from raw SQLite, object from Drizzle with mode: 'json'
  bio: string | null;
  permissions: string | Record<string, unknown> | null; // string from raw SQLite, object from Drizzle with mode: 'json'
  email: string;
  email_verified: number;
  must_reset_password: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  banned: number | null;
  ban_reason: string | null;
  ban_expires: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
};

type BookingRow = {
  id: string;
  booking_code: string;
  game_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  status: string;
  party_size: number;
  deposit_due_cents: number;
  total_due_cents: number;
  price_tier: 'standard' | 'premier' | 'offsite' | string;
  discount_code: string | null;
  is_mobile: number;
  is_adhoc: number;
  notes: string | null;
  location_note: string | null;
  contact_name: string;
  contact_phone: string;
  game_name?: string;
  room_name?: string;
  conflict?: number;
};

type SessionRow = {
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
  recent_alert: string | null;
  party_size: number;
  is_mobile: number;
  is_adhoc: number;
  game_id: string;
  game_name: string;
  game_slug: string;
  room_id: string;
  room_uuid: string | null;
  room_name: string;
};

type GameRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  story_intro: string | null;
  duration_minutes: number;
  difficulty: string;
  pricing_model: string;
  category: string | null;
  categories: string | null;
  min_players: number;
  max_players: number;
  price_per_player_cents: number;
  resources_required: number;
  validation_notes: string | null;
  media_config: string | null;
  pricing_config: string | null;
  booking_rules_config: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
};

type GamePuzzleRow = {
  id: string;
  uuid: string | null;
  game_id: string;
  title: string;
  description: string | null;
  solution: string | null;
  media_asset: string | null;
  operator_actions: string | null;
  display_order: number;
  hints: string | null;
  media_asset_meta: string | null;
};

type NetworkProfileRow = {
  id: string;
  name: string;
  ssid: string;
  password: string | null;
  description: string | null;
  band: string | null;
  channel: number | null;
  security: string | null;
  broadcast_enabled: number;
  status: string;
  status_message: string | null;
  details: string | null;
  last_updated: string;
};

type RoomRow = {
  id: string;
  uuid: string | null;
  game_id: string;
  name: string;
  is_mobile_capable: number;
  theme_token: string | null;
  description: string | null;
  slug: string | null;
  capacity: number | null;
};

function mapOperator(row: OperatorRow | undefined): OperatorProfile | undefined {
  if (!row) return undefined;
  const resolvedRole = normalizeRole(row.role);
  if (row.role !== resolvedRole) {
    sqlite
      .prepare(`UPDATE operators SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(resolvedRole, row.id);
  }
  // Handle permissions: can be string (raw SQLite) or already parsed (Drizzle with mode: 'json')
  const permissionsValue = typeof row.permissions === 'string' ? row.permissions : JSON.stringify(row.permissions);
  const permissions = normalizePermissions(resolvedRole, permissionsValue);

  // Handle avatar_config: can be string (raw SQLite) or already parsed (Drizzle with mode: 'json')
  let avatarConfig;
  if (row.avatar_config) {
    try {
      avatarConfig = typeof row.avatar_config === 'string'
        ? JSON.parse(row.avatar_config)
        : row.avatar_config;
    } catch {
      avatarConfig = undefined;
    }
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: resolvedRole,
    avatarConfig,
    bio: row.bio ?? undefined,
    permissions,
    email: row.email ?? undefined,
    emailVerified: Boolean(row.email_verified),
    banned: row.banned ? Boolean(row.banned) : undefined,
    banReason: row.ban_reason ?? undefined,
    banExpires: row.ban_expires ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    archivedReason: row.archived_reason ?? undefined
  };
}

function mapOperatorSummary(row: OperatorRow): OperatorSummary {
  const profile = mapOperator(row);
  if (!profile) {
    throw new Error('Unable to map operator row');
  }
  return {
    ...profile,
    mustResetPassword: Boolean(row.must_reset_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined
  };
}

const networkProfileStmt = sqlite.prepare(
  `SELECT id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated
   FROM network_profiles WHERE id = ? LIMIT 1`
);

const gameByIdStmt = sqlite.prepare(
  `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
          min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at,
          archived_at, archived_by, archived_reason
   FROM games WHERE id = ? LIMIT 1`
);

const puzzlesByGameStmt = sqlite.prepare(
  `SELECT id, uuid, game_id, title, description, solution, media_asset, operator_actions, display_order, hints, media_asset_meta
   FROM game_puzzles WHERE game_id = ? ORDER BY display_order ASC`
);

const roomsByGameStmt = sqlite.prepare(
  `SELECT id, uuid, game_id, name, is_mobile_capable, theme_token, description, slug, capacity
   FROM rooms WHERE game_id = ? ORDER BY name ASC`
);

const roomByIdStmt = sqlite.prepare(
  `SELECT r.id, r.uuid, r.game_id, r.name, r.is_mobile_capable, r.theme_token, r.description, r.slug, r.capacity,
          g.slug AS game_slug
   FROM rooms r
   JOIN games g ON g.id = r.game_id
   WHERE r.id = ? LIMIT 1`
);

const activeSessionsByRoomStmt = sqlite.prepare(
  `SELECT COUNT(1) as count
   FROM sessions s
   JOIN bookings b ON b.id = s.booking_id
   WHERE b.room_id = ? AND s.status IN ('running', 'paused')`
);

function mapNetworkProfile(row: NetworkProfileRow | undefined): NetworkProfile {
  if (!row) {
    return {
      id: 'primary',
      name: 'EscapePlan Control Network',
      ssid: 'escapeplan_net',
      broadcastEnabled: false,
      status: 'offline',
      lastUpdated: new Date().toISOString()
    };
  }
  return {
    id: row.id,
    name: row.name,
    ssid: row.ssid,
    password: row.password ?? undefined,
    description: row.description ?? undefined,
    band: row.band ?? undefined,
    channel: row.channel ?? undefined,
    security: row.security ?? undefined,
    broadcastEnabled: Boolean(row.broadcast_enabled),
    status: (row.status ?? 'offline') as NetworkHealth,
    statusMessage: row.status_message ?? undefined,
    details: row.details ?? undefined,
    lastUpdated: row.last_updated
  };
}

export function getNetworkProfile(): NetworkProfile {
  const row = networkProfileStmt.get('primary') as NetworkProfileRow | undefined;
  return mapNetworkProfile(row);
}

export function updateNetworkProfile(input: UpdateNetworkProfileRequest): NetworkProfile {
  const existing = getNetworkProfile();
  const now = new Date().toISOString();
  const payload = {
    id: 'primary',
    name: input.name ?? existing.name,
    ssid: input.ssid ?? existing.ssid,
    password: input.password ?? existing.password ?? null,
    description: input.description ?? existing.description ?? null,
    band: input.band ?? existing.band ?? null,
    channel: input.channel ?? existing.channel ?? null,
    security: input.security ?? existing.security ?? null,
    broadcast_enabled: typeof input.broadcastEnabled === 'boolean' ? (input.broadcastEnabled ? 1 : 0) : existing.broadcastEnabled ? 1 : 0,
    status: input.status ?? existing.status,
    status_message: input.statusMessage ?? existing.statusMessage ?? null,
    details: input.details ?? existing.details ?? null,
    last_updated: now
  };

  sqlite
    .prepare(
      `INSERT INTO network_profiles (id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
       VALUES (@id, @name, @ssid, @password, @description, @band, @channel, @security, @broadcast_enabled, @status, @status_message, @details, @last_updated)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         ssid = excluded.ssid,
         password = excluded.password,
         description = excluded.description,
         band = excluded.band,
         channel = excluded.channel,
         security = excluded.security,
         broadcast_enabled = excluded.broadcast_enabled,
         status = excluded.status,
         status_message = excluded.status_message,
         details = excluded.details,
         last_updated = excluded.last_updated`
    )
    .run(payload);

  return getNetworkProfile();
}

function mapGameDetailsRow(row: GameRow): GameDetails {
  const categories = row.categories ? (JSON.parse(row.categories) as string[]) : [];
  const puzzleRows = puzzlesByGameStmt.all(row.id) as GamePuzzleRow[];
  const roomRows = roomsByGameStmt.all(row.id) as RoomRow[];
  const puzzles: GamePuzzleDefinition[] = puzzleRows.map((puzzle) => ({
    id: puzzle.id,
    uuid: puzzle.uuid ?? puzzle.id,
    title: puzzle.title,
    description: puzzle.description ?? undefined,
    solution: puzzle.solution ?? undefined,
    mediaAsset: puzzle.media_asset ?? undefined,
    operatorActions: puzzle.operator_actions ?? undefined,
    displayOrder: puzzle.display_order,
    hints: puzzle.hints ? (JSON.parse(puzzle.hints) as GameHintDefinition[]) : undefined,
    mediaMeta: puzzle.media_asset_meta ? (JSON.parse(puzzle.media_asset_meta) as Record<string, unknown>) : undefined
  }));
  const rooms: GameRoomDefinition[] = roomRows.map((room) => ({
    id: room.id,
    uuid: room.uuid ?? room.id,
    name: room.name,
    isMobileCapable: Boolean(room.is_mobile_capable),
    themeToken: room.theme_token ?? undefined,
    description: room.description ?? undefined,
    slug: room.slug ?? undefined,
    capacity: room.capacity ?? undefined
  }));
  const mediaConfig = safeParse<GameMediaConfig>(row.media_config);
  const pricingConfig = safeParse<GamePricingConfig>(row.pricing_config);
  const bookingRulesConfig = safeParse<GameBookingRules>(row.booking_rules_config);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    storyIntro: row.story_intro ?? undefined,
    durationMinutes: row.duration_minutes,
    difficulty: row.difficulty,
    pricingModel: row.pricing_model,
    categories: categories.length ? categories : row.category ? [row.category] : [],
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    pricePerPlayerCents: row.price_per_player_cents,
    resourcesRequired: row.resources_required,
    validationNotes: row.validation_notes ?? undefined,
    media: mediaConfig
      ? {
          thumbnailAssetId: mediaConfig.thumbnailAssetId ?? null,
          roomScreenAssetId: mediaConfig.roomScreenAssetId ?? null,
          galleryAssetIds: mediaConfig.galleryAssetIds ?? []
        }
      : undefined,
    pricing: pricingConfig
      ? {
          model: pricingConfig.model ?? (row.pricing_model as GamePricingConfig['model']),
          tiers: pricingConfig.tiers ?? [],
          deposit: pricingConfig.deposit,
          discounts: pricingConfig.discounts ?? []
        }
      : undefined,
    bookingRules: bookingRulesConfig
      ? {
          isMobile: bookingRulesConfig.isMobile ?? undefined,
          locationNotes: bookingRulesConfig.locationNotes ?? null,
          travelBufferMinutes: bookingRulesConfig.travelBufferMinutes ?? null,
          equipmentChecklist: bookingRulesConfig.equipmentChecklist ?? [],
          reservationStyle: bookingRulesConfig.reservationStyle ?? 'public',
          cancellationPolicy: bookingRulesConfig.cancellationPolicy ?? null,
          customFields: bookingRulesConfig.customFields ?? []
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
    archivedReason: row.archived_reason ?? undefined,
    puzzles,
    rooms
  };
}

export interface GameListFilters {
  search?: string;
  status?: 'active' | 'archived' | 'all';
  category?: string;
}

export function listGameDetails(filters: GameListFilters = {}): GameDetails[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const status = filters.status ?? 'active';
  if (status === 'active') {
    conditions.push('archived_at IS NULL');
  } else if (status === 'archived') {
    conditions.push('archived_at IS NOT NULL');
  }

  if (filters.search && filters.search.trim().length) {
    const normalized = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(COALESCE(description, "")) LIKE ?)' 
    );
    params.push(normalized, normalized, normalized);
  }

  if (filters.category && filters.category.trim().length) {
    const normalizedCategory = filters.category.trim().toLowerCase();
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(COALESCE(categories, '[]')) WHERE LOWER(value) = ?)`
    );
    params.push(normalizedCategory);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const stmt = sqlite.prepare(
    `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
            min_players, max_players, price_per_player_cents, resources_required, validation_notes,
            media_config, pricing_config, booking_rules_config,
            created_at, updated_at, archived_at, archived_by, archived_reason
     FROM games
     ${whereClause}
     ORDER BY CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END, name COLLATE NOCASE ASC`
  );

  const rows = stmt.all(...params) as GameRow[];
  return rows.map(mapGameDetailsRow);
}

export function getGameDetails(gameId: string): GameDetails | undefined {
  const row = gameByIdStmt.get(gameId) as GameRow | undefined;
  if (!row) return undefined;
  return mapGameDetailsRow(row);
}

function normalizePuzzleInput(puzzle: GamePuzzleDefinition, index: number): GamePuzzleDefinition {
  const id = puzzle.id && puzzle.id.trim().length > 0 ? puzzle.id : `gpz-${nanoid(12)}`;
  const uuid = puzzle.uuid && puzzle.uuid.trim().length > 0 ? puzzle.uuid : nanoid();
  return {
    id,
    uuid,
    title: puzzle.title,
    description: puzzle.description,
    solution: puzzle.solution,
    mediaAsset: puzzle.mediaAsset,
    operatorActions: puzzle.operatorActions,
    displayOrder: puzzle.displayOrder ?? index + 1,
    hints: puzzle.hints ?? [],
    mediaMeta: puzzle.mediaMeta ?? null
  };
}

function normalizeRoomInput(room: GameRoomDefinition, index: number): GameRoomDefinition {
  const id = room.id && room.id.trim().length > 0 ? room.id : `room-${nanoid(10)}`;
  const uuid = room.uuid && room.uuid.trim().length > 0 ? room.uuid : nanoid();
  return {
    id,
    uuid,
    name: room.name,
    isMobileCapable: room.isMobileCapable,
    themeToken: room.themeToken,
    description: room.description,
    slug: room.slug,
    capacity: room.capacity,
    // ensure order stable by index when returning - stored order is alphabetical by query
  };
}

function persistGameRelations(gameId: string, rooms: GameRoomDefinition[], puzzles: GamePuzzleDefinition[]) {
  const deleteRooms = sqlite.prepare(`DELETE FROM rooms WHERE game_id = ?`);
  const deletePuzzles = sqlite.prepare(`DELETE FROM game_puzzles WHERE game_id = ?`);
  const insertRoom = sqlite.prepare(
    `INSERT INTO rooms (id, uuid, game_id, name, is_mobile_capable, theme_token, description, slug, capacity)
     VALUES (@id, @uuid, @game_id, @name, @is_mobile_capable, @theme_token, @description, @slug, @capacity)`
  );
  const insertPuzzle = sqlite.prepare(
    `INSERT INTO game_puzzles (id, uuid, game_id, title, description, solution, media_asset, operator_actions, display_order, hints, media_asset_meta)
     VALUES (@id, @uuid, @game_id, @title, @description, @solution, @media_asset, @operator_actions, @display_order, @hints, @media_asset_meta)`
  );

  deleteRooms.run(gameId);
  deletePuzzles.run(gameId);

  for (const room of rooms) {
    insertRoom.run({
      id: room.id,
      uuid: room.uuid ?? room.id,
      game_id: gameId,
      name: room.name,
      is_mobile_capable: room.isMobileCapable ? 1 : 0,
      theme_token: room.themeToken ?? null,
      description: room.description ?? null,
      slug: room.slug ?? null,
      capacity: room.capacity ?? null
    });
  }

  for (const puzzle of puzzles) {
    insertPuzzle.run({
      id: puzzle.id,
      uuid: puzzle.uuid ?? puzzle.id,
      game_id: gameId,
      title: puzzle.title,
      description: puzzle.description ?? null,
      solution: puzzle.solution ?? null,
      media_asset: puzzle.mediaAsset ?? null,
      operator_actions: puzzle.operatorActions ?? null,
      display_order: puzzle.displayOrder,
      hints: puzzle.hints && puzzle.hints.length ? JSON.stringify(puzzle.hints) : null,
      media_asset_meta: puzzle.mediaMeta ? JSON.stringify(puzzle.mediaMeta) : null
    });
  }
}

export function createGame(payload: SaveGameRequest): GameDetails {
  const now = new Date().toISOString();
  const slugCheck = sqlite.prepare(`SELECT id FROM games WHERE slug = ?`).get(payload.slug) as { id: string } | undefined;
  if (slugCheck) {
    throw new Error('Slug already in use');
  }
  const gameId = `game-${payload.slug}`;
  const categories = JSON.stringify(payload.categories ?? []);
  const mediaConfig = payload.media ? JSON.stringify(payload.media) : null;
  const pricingConfig = payload.pricing ? JSON.stringify(payload.pricing) : null;
  const bookingRulesConfig = payload.bookingRules ? JSON.stringify(payload.bookingRules) : null;
  sqlite
    .prepare(
      `INSERT INTO games (id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
                          min_players, max_players, price_per_player_cents, resources_required, validation_notes,
                          media_config, pricing_config, booking_rules_config,
                          created_at, updated_at, archived_at, archived_by, archived_reason)
       VALUES (@id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty, @pricing_model, @category, @categories,
               @min_players, @max_players, @price_per_player_cents, @resources_required, @validation_notes,
               @media_config, @pricing_config, @booking_rules_config,
               @created_at, @updated_at, NULL, NULL, NULL)`
    )
    .run({
      id: gameId,
      slug: payload.slug,
      name: payload.name,
      description: payload.description,
      story_intro: payload.storyIntro ?? null,
      duration_minutes: payload.durationMinutes,
      difficulty: payload.difficulty,
      pricing_model: payload.pricingModel,
      category: payload.categories?.[0] ?? null,
      categories,
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      price_per_player_cents: payload.pricePerPlayerCents,
      resources_required: payload.resourcesRequired,
      validation_notes: payload.validationNotes ?? null,
      media_config: mediaConfig,
      pricing_config: pricingConfig,
      booking_rules_config: bookingRulesConfig,
      created_at: now,
      updated_at: now
    });

  const normalizedRooms = (payload.rooms ?? []).map(normalizeRoomInput);
  const normalizedPuzzles = (payload.puzzles ?? []).map(normalizePuzzleInput);

  persistGameRelations(gameId, normalizedRooms, normalizedPuzzles);

  return getGameDetails(gameId)!;
}

export function updateGame(gameId: string, payload: SaveGameRequest): GameDetails {
  const existing = gameByIdStmt.get(gameId) as GameRow | undefined;
  if (!existing) {
    throw new Error('Game not found');
  }
  const slugConflict = sqlite
    .prepare(`SELECT id FROM games WHERE slug = ? AND id != ?`)
    .get(payload.slug, gameId) as { id: string } | undefined;
  if (slugConflict) {
    throw new Error('Another game already uses that slug');
  }

  const now = new Date().toISOString();
  const mediaConfig = payload.media ? JSON.stringify(payload.media) : null;
  const pricingConfig = payload.pricing ? JSON.stringify(payload.pricing) : null;
  const bookingRulesConfig = payload.bookingRules ? JSON.stringify(payload.bookingRules) : null;
  sqlite
    .prepare(
      `UPDATE games
       SET slug = @slug,
           name = @name,
           description = @description,
           story_intro = @story_intro,
           duration_minutes = @duration_minutes,
           difficulty = @difficulty,
           pricing_model = @pricing_model,
           category = @category,
           categories = @categories,
           min_players = @min_players,
           max_players = @max_players,
           price_per_player_cents = @price_per_player_cents,
           resources_required = @resources_required,
           validation_notes = @validation_notes,
           media_config = @media_config,
           pricing_config = @pricing_config,
           booking_rules_config = @booking_rules_config,
           updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id: gameId,
      slug: payload.slug,
      name: payload.name,
      description: payload.description,
      story_intro: payload.storyIntro ?? null,
      duration_minutes: payload.durationMinutes,
      difficulty: payload.difficulty,
      pricing_model: payload.pricingModel,
      category: payload.categories?.[0] ?? null,
      categories: JSON.stringify(payload.categories ?? []),
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      price_per_player_cents: payload.pricePerPlayerCents,
      resources_required: payload.resourcesRequired,
      validation_notes: payload.validationNotes ?? null,
      media_config: mediaConfig,
      pricing_config: pricingConfig,
      booking_rules_config: bookingRulesConfig,
      updated_at: now
    });

  const normalizedRooms = (payload.rooms ?? []).map(normalizeRoomInput);
  const normalizedPuzzles = (payload.puzzles ?? []).map(normalizePuzzleInput);

  persistGameRelations(gameId, normalizedRooms, normalizedPuzzles);

  return getGameDetails(gameId)!;
}

export function deleteGame(gameId: string) {
  persistGameRelations(gameId, [], []);
  sqlite.prepare(`DELETE FROM games WHERE id = ?`).run(gameId);
}

export function archiveGame(gameId: string, actorId: string, reason?: string | null): GameDetails {
  const existing = gameByIdStmt.get(gameId) as GameRow | undefined;
  if (!existing) {
    throw new Error('Game not found');
  }

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `UPDATE games
       SET archived_at = @archived_at,
           archived_by = @archived_by,
           archived_reason = @archived_reason,
           updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id: gameId,
      archived_at: now,
      archived_by: actorId,
      archived_reason: reason ?? null,
      updated_at: now
    });

  const details = getGameDetails(gameId);
  if (!details) {
    throw new Error('Unable to load archived game');
  }
  return details;
}

export function unarchiveGame(gameId: string): GameDetails {
  const existing = gameByIdStmt.get(gameId) as GameRow | undefined;
  if (!existing) {
    throw new Error('Game not found');
  }

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `UPDATE games
       SET archived_at = NULL,
           archived_by = NULL,
           archived_reason = NULL,
           updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id: gameId,
      updated_at: now
    });

  const details = getGameDetails(gameId);
  if (!details) {
    throw new Error('Unable to load restored game');
  }
  return details;
}

function getOperatorRow(id: string): OperatorRow | undefined {
  return sqlite.prepare(`SELECT * FROM operators WHERE id = ? LIMIT 1`).get(id) as OperatorRow | undefined;
}

export async function createOperatorAccount(input: CreateOperatorRequest): Promise<OperatorSummary> {
  const username = input.username.trim();
  const existing = sqlite
    .prepare(`SELECT id FROM operators WHERE username = ? LIMIT 1`)
    .get(username) as { id: string } | undefined;
  if (existing) {
    throw new Error('Username already exists');
  }

  const email = input.email?.trim();

  const role = normalizeRole(input.role);
  const permissions = permissionsForRole(role);
  const context = await getAuthContext();
  const adapter = await getInternalAdapter();

  if (email) {
    const existingByEmail = await adapter.findUserByEmail(email);
    if (existingByEmail) {
      throw new Error('Email already exists');
    }
  }

  const trimmedName = input.name.trim();
  const trimmedBio = input.bio?.trim() ?? null;
  // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
  // Drizzle will automatically JSON.stringify the object, so pass it directly
  const avatarImage = input.avatarConfig;

  const hashedPassword = await context.password.hash(input.password);

  const user = await adapter.createUser({
    email: email ?? undefined,
    name: trimmedName,
    username,
    role,
    bio: trimmedBio ?? undefined,
    image: avatarImage,
    mustResetPassword: input.mustResetPassword ?? false,
    emailVerified: Boolean(email),
    passwordHash: hashedPassword,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null
  });

  await adapter.createAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hashedPassword
  });

  // Update permissions after creation (Better-Auth doesn't include this in createUser)
  // permissions column has mode: 'json', so Drizzle will automatically stringify the array
  await adapter.updateUser(user.id, {
    permissions: permissions
  });

  const row = getOperatorRow(user.id);
  if (!row) {
    throw new Error('Failed to load created operator');
  }
  return mapOperatorSummary(row);
}

export async function updateOperatorAccount(id: string, input: UpdateOperatorRequest): Promise<OperatorSummary> {
  const row = getOperatorRow(id);
  if (!row) {
    throw new Error('Operator not found');
  }

  const roleValue = input.role ?? row.role;
  const resolvedRole = normalizeRole(roleValue);
  const permissions = permissionsForRole(resolvedRole);
  const context = await getAuthContext();
  const adapter = await getInternalAdapter();

  // permissions column has mode: 'json', so Drizzle will automatically stringify the array
  const updates: Record<string, unknown> = {
    role: resolvedRole,
    permissions: permissions
  };

  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }
  if (input.email !== undefined) {
    updates.email = input.email?.trim();
  }
  if (input.avatarConfig !== undefined) {
    // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
    // Drizzle will automatically JSON.stringify the object, so pass it directly
    updates.image = input.avatarConfig ?? null;
  }
  if (input.bio !== undefined) {
    const trimmed = input.bio?.trim();
    updates.bio = trimmed && trimmed.length > 0 ? trimmed : null;
  }
  if (input.mustResetPassword !== undefined) {
    updates.mustResetPassword = input.mustResetPassword;
  }

  await adapter.updateUser(id, updates);

  const updated = getOperatorRow(id);
  if (!updated) {
    throw new Error('Unable to load updated operator');
  }
  return mapOperatorSummary(updated);
}

export async function resetOperatorPassword(
  id: string,
  input: ResetOperatorPasswordRequest
): Promise<OperatorSummary> {
  const row = getOperatorRow(id);
  if (!row) {
    throw new Error('Operator not found');
  }

  const context = await getAuthContext();
  const adapter = await getInternalAdapter();
  const hashedPassword = await context.password.hash(input.password);

  const accounts = await adapter.findAccounts(id);
  const credential = accounts.find((account) => account.providerId === 'credential');
  if (!credential) {
    await adapter.createAccount({
      userId: id,
      providerId: 'credential',
      accountId: id,
      password: hashedPassword
    });
  } else {
    await adapter.updatePassword(id, hashedPassword);
  }

  const mustReset = input.forceReset ?? true;
  await adapter.updateUser(id, { mustResetPassword: mustReset, passwordHash: hashedPassword });

  const updated = getOperatorRow(id);
  if (!updated) {
    throw new Error('Unable to read operator');
  }
  return mapOperatorSummary(updated);
}

export async function changeOwnPassword(operatorId: string, payload: ChangeOwnPasswordRequest): Promise<void> {
  const context = await getAuthContext();
  const adapter = await getInternalAdapter();
  const accounts = await adapter.findAccounts(operatorId);
  const credential = accounts.find((account) => account.providerId === 'credential');
  if (!credential || !credential.password) {
    throw new Error('Credential account not configured for this user');
  }

  const valid = await context.password.verify({ password: payload.currentPassword, hash: credential.password });
  if (!valid) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await context.password.hash(payload.newPassword);
  await adapter.updatePassword(operatorId, hashedPassword);
  await adapter.updateUser(operatorId, { mustResetPassword: false, passwordHash: hashedPassword });
}

export async function updateOwnProfile(operatorId: string, payload: UpdateOwnProfileRequest): Promise<OperatorProfile> {
  const row = getOperatorRow(operatorId);
  if (!row) {
    throw new Error('Operator not found');
  }

  // Build updates object for Better-Auth adapter
  const updates: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    updates.name = payload.name.trim();
  }
  if (payload.email !== undefined) {
    updates.email = payload.email?.trim();
  }
  if (payload.avatarConfig !== undefined) {
    // Better-Auth uses 'image' field which maps to 'avatar_config' column
    updates.image = payload.avatarConfig ? JSON.stringify(payload.avatarConfig) : null;
  }
  if (payload.bio !== undefined) {
    const trimmed = payload.bio?.trim();
    updates.bio = trimmed || null;
  }

  // Use Better-Auth adapter to update
  const adapter = await getInternalAdapter();
  await adapter.updateUser(operatorId, updates);

  const updated = getOperatorRow(operatorId);
  const profile = mapOperator(updated);
  if (!profile) {
    throw new Error('Unable to load updated profile');
  }
  return profile;
}

export async function deleteOperatorAccount(id: string) {
  const row = getOperatorRow(id);
  if (!row) return;
  if (row.role === 'admin') {
    const adminCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM operators WHERE role = 'admin'`)
      .get() as { count: number };
    if (adminCount.count <= 1) {
      throw new Error('Cannot remove the final admin account');
    }
  }
  const adapter = await getInternalAdapter();
  await adapter.deleteUser(id);
}

export async function archiveOperatorAccount(
  id: string,
  actorId: string,
  reason?: string | null
): Promise<OperatorSummary> {
  const row = getOperatorRow(id);
  if (!row) {
    throw new Error('Operator not found');
  }

  if (row.role === 'admin') {
    const adminCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM operators WHERE role = 'admin' AND archived_at IS NULL`)
      .get() as { count: number };
    if (adminCount.count <= 1) {
      throw new Error('Cannot archive the final active admin');
    }
  }

  const now = new Date().toISOString();
  const adapter = await getInternalAdapter();
  await adapter.updateUser(id, {
    archivedAt: now,
    archivedBy: actorId,
    archivedReason: reason ?? null
  });

  sqlite.prepare(`DELETE FROM operator_auth_sessions WHERE user_id = ?`).run(id);

  const updated = getOperatorRow(id);
  if (!updated) {
    throw new Error('Unable to read archived operator');
  }
  return mapOperatorSummary(updated);
}

export async function unarchiveOperatorAccount(id: string): Promise<OperatorSummary> {
  const row = getOperatorRow(id);
  if (!row) {
    throw new Error('Operator not found');
  }

  const adapter = await getInternalAdapter();
  await adapter.updateUser(id, {
    archivedAt: null,
    archivedBy: null,
    archivedReason: null
  });

  const updated = getOperatorRow(id);
  if (!updated) {
    throw new Error('Unable to read restored operator');
  }
  return mapOperatorSummary(updated);
}

export function findOperatorById(id: string): OperatorProfile | undefined {
  const stmt = sqlite.prepare(`SELECT * FROM operators WHERE id = ? LIMIT 1`);
  const row = stmt.get(id) as OperatorRow | undefined;
  return mapOperator(row);
}

export interface OperatorListFilters {
  search?: string;
  role?: OperatorRole | 'all';
  status?: 'active' | 'archived' | 'all';
}

export function listOperatorSummaries(filters: OperatorListFilters = {}): OperatorSummary[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status === 'archived') {
    conditions.push('archived_at IS NOT NULL');
  } else if (filters.status === 'active') {
    conditions.push('archived_at IS NULL');
  }

  if (filters.role && filters.role !== 'all') {
    conditions.push('role = ?');
    params.push(filters.role);
  }

  if (filters.search && filters.search.trim().length) {
    const normalized = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(username) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(email, "")) LIKE ?)'
    );
    params.push(normalized, normalized, normalized);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = sqlite
    .prepare(
      `SELECT *
       FROM operators
       ${whereClause}
       ORDER BY CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
                name COLLATE NOCASE ASC`
    )
    .all(...params) as OperatorRow[];
  return rows.map(mapOperatorSummary);
}

export function updateOperatorLoginTimestamp(id: string, iso: string) {
  sqlite.prepare(`UPDATE operators SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(iso, iso, id);
}

function mapBooking(row: BookingRow): BookingSummary {
  return {
    id: row.id,
    bookingCode: row.booking_code,
    gameId: row.game_id,
    gameName: row.game_name ?? '',
    roomName: row.room_name ?? '',
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status as BookingSummary['status'],
    partySize: row.party_size,
    depositDue: row.deposit_due_cents / 100,
    totalDue: row.total_due_cents / 100,
    priceTier: row.price_tier as BookingSummary['priceTier'],
    discountCode: row.discount_code ?? undefined,
    isMobile: Boolean(row.is_mobile),
    isAdhoc: Boolean(row.is_adhoc),
    notes: row.notes ?? undefined,
    locationNote: row.location_note ?? undefined,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    conflict: Boolean(row.conflict)
  };
}

function mapSessionRow(row: SessionRow): GameSessionDetails {
  return {
    id: row.session_id,
    gameId: row.game_id,
    gameName: row.game_name,
    gameSlug: row.game_slug,
    roomName: row.room_name,
    roomId: row.room_id,
    roomUuid: row.room_uuid ?? undefined,
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
    recentAlert: row.recent_alert ?? undefined,
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
    }
  };
}

const puzzlesStmt = sqlite.prepare(
  `SELECT id, session_id, title, status, display_order FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`
);
const hintsStmt = sqlite.prepare(
  `SELECT id, session_id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`
);
const timerSlugBySessionStmt = sqlite.prepare(
  `SELECT slug, narrative FROM timer_slugs WHERE session_id = ?`
);

export function listActiveSessions(): ActiveSessionsResponse {
  const rows = sqlite
    .prepare(
      `SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
              s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
              s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
              b.party_size, b.is_mobile, b.is_adhoc, b.start_time, b.end_time,
              g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
              r.id AS room_id, r.uuid AS room_uuid, r.name AS room_name
       FROM sessions s
       JOIN bookings b ON b.id = s.booking_id
       JOIN games g ON g.id = b.game_id
       JOIN rooms r ON r.id = b.room_id
       WHERE s.status IN ('running', 'paused')
       ORDER BY s.started_at DESC`
    )
    .all() as SessionRow[];

  const sessions = rows.map((row) => {
    const details = mapSessionRow(row);
    const puzzleRows = puzzlesStmt.all(row.session_id) as { id: string; session_id: string; title: string; status: string; display_order: number }[];
    details.puzzles = puzzleRows.map((puzzle) => ({
      id: puzzle.id,
      title: puzzle.title,
      status: puzzle.status as GameSessionDetails['puzzles'][number]['status'],
      order: puzzle.display_order
    }));
    const hints = hintsStmt.all(row.session_id) as { id: string; session_id: string; type: string; message: string; asset_url: string | null; delivered_by: string; delivered_at: string }[];
    details.hintLog = hints.map((hint) => ({
      id: hint.id,
      type: hint.type as GameSessionDetails['hintLog'][number]['type'],
      message: hint.message,
      assetUrl: hint.asset_url ?? undefined,
      deliveredBy: hint.delivered_by,
      deliveredAt: hint.delivered_at
    }));
    return details;
  });

  return {
    generatedAt: new Date().toISOString(),
    sessions
  };
}

export function listSessions(filters?: {
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
    whereConditions.push(`(g.name LIKE ? OR r.name LIKE ? OR b.id LIKE ?)`);
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Sort order
  let orderBy = 's.started_at DESC';
  if (filters?.sortBy === 'game') {
    orderBy = `g.name ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (filters?.sortBy === 'location') {
    orderBy = `r.name ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (filters?.sortBy === 'date') {
    orderBy = `s.started_at ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  }

  const query = `
    SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
           s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
           s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
           b.party_size, b.is_mobile, b.is_adhoc, b.start_time, b.end_time,
           g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
           r.id AS room_id, r.uuid AS room_uuid, r.name AS room_name
    FROM sessions s
    JOIN bookings b ON b.id = s.booking_id
    JOIN games g ON g.id = b.game_id
    JOIN rooms r ON r.id = b.room_id
    ${whereClause}
    ORDER BY ${orderBy}
  `;

  const rows = sqlite.prepare(query).all(...params) as SessionRow[];

  const sessions = rows.map((row) => {
    const details = mapSessionRow(row);
    const puzzleRows = puzzlesStmt.all(row.session_id) as { id: string; session_id: string; title: string; status: string; display_order: number }[];
    details.puzzles = puzzleRows.map((puzzle) => ({
      id: puzzle.id,
      title: puzzle.title,
      status: puzzle.status as GameSessionDetails['puzzles'][number]['status'],
      order: puzzle.display_order
    }));
    const hints = hintsStmt.all(row.session_id) as { id: string; session_id: string; type: string; message: string; asset_url: string | null; delivered_by: string; delivered_at: string }[];
    details.hintLog = hints.map((hint) => ({
      id: hint.id,
      type: hint.type as GameSessionDetails['hintLog'][number]['type'],
      message: hint.message,
      assetUrl: hint.asset_url ?? undefined,
      deliveredBy: hint.delivered_by,
      deliveredAt: hint.delivered_at
    }));
    return details;
  });

  return {
    generatedAt: new Date().toISOString(),
    sessions
  };
}

export function getSessionById(id: string): GameSessionDetails | undefined {
  const stmt = sqlite.prepare(
    `SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
            s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
            s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
            b.party_size, b.is_mobile, b.is_adhoc,
            g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
            r.id AS room_id, r.uuid AS room_uuid, r.name AS room_name
     FROM sessions s
     JOIN bookings b ON b.id = s.booking_id
     JOIN games g ON g.id = b.game_id
     JOIN rooms r ON r.id = b.room_id
     WHERE s.id = ? LIMIT 1`
  );
  const row = stmt.get(id) as SessionRow | undefined;
  if (!row) return undefined;
  const details = mapSessionRow(row);
  const puzzleRows = sqlite
    .prepare(`SELECT id, title, status, display_order FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`)
    .all(id) as { id: string; title: string; status: string; display_order: number }[];
  details.puzzles = puzzleRows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status as GameSessionDetails['puzzles'][number]['status'],
    order: p.display_order
  }));
  const hintRows = sqlite
    .prepare(`SELECT id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`)
    .all(id) as { id: string; type: string; message: string; asset_url: string | null; delivered_by: string; delivered_at: string }[];
  details.hintLog = hintRows.map((hint) => ({
    id: hint.id,
    type: hint.type as GameSessionDetails['hintLog'][number]['type'],
    message: hint.message,
    assetUrl: hint.asset_url ?? undefined,
    deliveredBy: hint.delivered_by,
    deliveredAt: hint.delivered_at
  }));
  return details;
}

export function getSessionBySlug(slug: string): { session: GameSessionDetails; slug: string; narrative?: string } | undefined {
  const stmt = sqlite.prepare(
    `SELECT t.slug, t.narrative,
            s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
            s.timer_total_elapsed_seconds, s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
            s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
            b.party_size, b.is_mobile, b.is_adhoc,
            g.id AS game_id, g.name AS game_name, g.slug AS game_slug,
            r.id AS room_id, r.uuid AS room_uuid, r.name AS room_name
     FROM timer_slugs t
     JOIN sessions s ON s.id = t.session_id
     JOIN bookings b ON b.id = s.booking_id
     JOIN games g ON g.id = b.game_id
     JOIN rooms r ON r.id = b.room_id
     WHERE t.slug = ? LIMIT 1`
  );
  const row = stmt.get(slug) as (SessionRow & { slug: string; narrative: string | null }) | undefined;
  if (!row) return undefined;
  const details = mapSessionRow(row);
  const puzzleRows = sqlite
    .prepare(`SELECT id, title, status, display_order FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`)
    .all(row.session_id) as { id: string; title: string; status: string; display_order: number }[];
  details.puzzles = puzzleRows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status as GameSessionDetails['puzzles'][number]['status'],
    order: p.display_order
  }));
  const hintRows = sqlite
    .prepare(`SELECT id, type, message, asset_url, delivered_by, delivered_at FROM session_hints WHERE session_id = ? ORDER BY delivered_at ASC`)
    .all(row.session_id) as { id: string; type: string; message: string; asset_url: string | null; delivered_by: string; delivered_at: string }[];
  details.hintLog = hintRows.map((hint) => ({
    id: hint.id,
    type: hint.type as GameSessionDetails['hintLog'][number]['type'],
    message: hint.message,
    assetUrl: hint.asset_url ?? undefined,
    deliveredBy: hint.delivered_by,
    deliveredAt: hint.delivered_at
  }));
  return { session: details, slug: row.slug, narrative: row.narrative ?? undefined };
}

export function listUpcomingBookings(windowMinutes = 240): BookingSummary[] {
  const now = new Date();
  const end = new Date(now.getTime() + windowMinutes * 60 * 1000);
  const stmt = sqlite.prepare(
    `SELECT b.*, g.name AS game_name, r.name AS room_name, 0 AS conflict
     FROM bookings b
     JOIN games g ON g.id = b.game_id
     JOIN rooms r ON r.id = b.room_id
     WHERE b.start_time BETWEEN ? AND ?
     ORDER BY b.start_time ASC`
  );
  const rows = stmt.all(now.toISOString(), end.toISOString()) as BookingRow[];
  return rows.map(mapBooking);
}

export function getDashboard(): DashboardResponse {
  const networkProfile = getNetworkProfile();
  const upcoming = listUpcomingBookings(240);
  const active = listActiveSessions();

  return {
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
    alerts: getActiveAlerts().map((alert) => ({
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
}

export function quickStartSession(
  payload: QuickStartSessionRequest,
  operatorId: string
): QuickStartSessionResponse {
  const room = roomByIdStmt.get(payload.roomId) as (RoomRow & { game_slug: string }) | undefined;
  if (!room) {
    throw new Error('Room not found');
  }
  if (room.game_id !== payload.gameId) {
    throw new Error('Room does not belong to selected game');
  }

  const gameRow = gameByIdStmt.get(payload.gameId) as GameRow | undefined;
  if (!gameRow) {
    throw new Error('Game not found');
  }

  if (payload.partySize < gameRow.min_players || payload.partySize > gameRow.max_players) {
    throw new Error('Party size outside allowed range for this game');
  }

  const active = activeSessionsByRoomStmt.get(room.id) as { count: number };
  if (active.count > 0) {
    throw new Error('Room already has an active session');
  }

  const durationMinutes = payload.durationMinutes && payload.durationMinutes > 0
    ? payload.durationMinutes
    : gameRow.duration_minutes;

  const now = new Date();
  const nowIso = now.toISOString();
  const totalSeconds = durationMinutes * 60;
  const scheduledEndIso = new Date(now.getTime() + totalSeconds * 1000).toISOString();

  const bookingId = `booking-${nanoid(12)}`;
  const sessionId = `session-${nanoid(12)}`;
  const bookingCode = `ADHOC-${now.getTime()}`;

  const bookingRules = safeParse<GameBookingRules>(gameRow.booking_rules_config);
  const operator = findOperatorById(operatorId);
  const crewPrimary = operator?.name ?? 'Quick Start';

  sqlite
    .prepare(
      `INSERT INTO bookings (
         id, booking_code, game_id, room_id, start_time, end_time, status,
         party_size, deposit_due_cents, total_due_cents, price_tier, discount_code,
         is_mobile, is_adhoc, location_note, notes, contact_name, contact_phone
       ) VALUES (
         @id, @booking_code, @game_id, @room_id, @start_time, @end_time, @status,
         @party_size, @deposit_due_cents, @total_due_cents, @price_tier, @discount_code,
         @is_mobile, @is_adhoc, @location_note, @notes, @contact_name, @contact_phone
       )`
    )
    .run({
      id: bookingId,
      booking_code: bookingCode,
      game_id: payload.gameId,
      room_id: payload.roomId,
      start_time: nowIso,
      end_time: scheduledEndIso,
      status: 'ADHOC',
      party_size: payload.partySize,
      deposit_due_cents: 0,
      total_due_cents: 0,
      price_tier: 'standard',
      discount_code: null,
      is_mobile: room.is_mobile_capable ? 1 : 0,
      is_adhoc: 1,
      location_note: bookingRules?.locationNotes ?? null,
      notes: payload.notes ?? null,
      contact_name: 'Walk-in',
      contact_phone: 'N/A'
    });

  sqlite
    .prepare(
      `INSERT INTO sessions (
         id, booking_id, status, timer_total_seconds, timer_remaining_seconds, timer_total_elapsed_seconds, timer_status,
         started_at, scheduled_end, hints_used, stream_thumbnail_url,
         background_audio_track, background_audio_is_playing, crew_primary, crew_support, recent_alert
       ) VALUES (
         @id, @booking_id, 'running', @timer_total_seconds, @timer_total_seconds, 0, 'running',
         @started_at, @scheduled_end, 0, NULL, NULL, 0, @crew_primary, NULL, NULL
       )`
    )
    .run({
      id: sessionId,
      booking_id: bookingId,
      timer_total_seconds: totalSeconds,
      started_at: nowIso,
      scheduled_end: scheduledEndIso,
      crew_primary: crewPrimary
    });

  const basePuzzles = puzzlesByGameStmt.all(payload.gameId) as GamePuzzleRow[];
  const insertSessionPuzzle = sqlite.prepare(
    `INSERT INTO session_puzzles (id, session_id, title, status, display_order)
     VALUES (?, ?, ?, ?, ?)`
  );
  basePuzzles.forEach((puzzle, index) => {
    insertSessionPuzzle.run(
      `spz-${nanoid(10)}`,
      sessionId,
      puzzle.title,
      index === 0 ? 'available' : 'locked',
      puzzle.display_order ?? index + 1
    );
  });

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

  const sessionDetails = getSessionById(sessionId);
  if (!sessionDetails) {
    throw new Error('Failed to initialize session');
  }

  emitSessionUpdate(sessionDetails);
  emitDashboardUpdate(getDashboard());
  broadcastTimerSessions(sessionId, sessionDetails);

  const bookingDate = nowIso.slice(0, 10);
  emitBookingsUpdate(getBookingsByDate(bookingDate, 'all'));

  return { session: sessionDetails };
}

export function getBookingsByDate(date: string, scope: 'all' | 'storefront' | 'mobile'): BookingCalendarResponse {
  const like = `${date}%`;
  const rows = sqlite
    .prepare(
      `SELECT b.*, g.name AS game_name, r.name AS room_name
       FROM bookings b
       JOIN games g ON g.id = b.game_id
       JOIN rooms r ON r.id = b.room_id
       WHERE b.start_time LIKE ?
       ORDER BY b.start_time ASC`
    )
    .all(like) as BookingRow[];

  const filtered = rows.filter((row) => {
    if (scope === 'all') return true;
    return scope === 'mobile' ? Boolean(row.is_mobile) : !row.is_mobile;
  });

  // conflict detection
  for (let i = 0; i < filtered.length; i += 1) {
    const current = filtered[i];
    current.conflict = 0;
    for (let j = i + 1; j < filtered.length; j += 1) {
      const other = filtered[j];
      if (current.room_id !== other.room_id) continue;
      if (current.end_time <= other.start_time) break;
      current.conflict = 1;
      other.conflict = 1;
    }
  }

  const bookings = filtered.map(mapBooking);
  const conflicts = bookings
    .filter((b) => b.conflict)
    .map((booking) => ({ bookingIds: [booking.id], reason: `Conflict detected for ${booking.roomName}` }));

  return {
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    scope,
    bookings,
    conflicts
  };
}

export function toTimerBroadcast(slug: string, details: GameSessionDetails, narrative?: string): TimerBroadcast {
  return {
    slug,
    sessionId: details.id,
    gameName: details.gameName,
    roomName: details.roomName,
    narrative,
    background: {
      type: 'image',
      url: details.streamThumbnailUrl ?? 'https://placehold.co/1200x800?text=EscapePlan'
    },
    timer: details.timer,
    hintBanner: details.hintLog.length
      ? {
          message: details.hintLog[details.hintLog.length - 1]!.message,
          shownAt: details.hintLog[details.hintLog.length - 1]!.deliveredAt
        }
      : undefined
  };
}

function broadcastTimerSessions(sessionId: string, details: GameSessionDetails) {
  const rows = timerSlugBySessionStmt.all(sessionId) as { slug: string; narrative: string | null }[];
  for (const row of rows) {
    emitTimerUpdate(toTimerBroadcast(row.slug, details, row.narrative ?? undefined));
  }
}

export function applyCommand(sessionId: string, command: CommandRequest): CommandResponse {
  const session = getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const nowIso = new Date().toISOString();

  switch (command.command) {
    case 'start_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running', recent_alert = NULL WHERE id = ?`).run(sessionId);
      logToDatabase('info', 'session', 'Timer started', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });
      break;
    case 'pause_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'paused', status = 'paused', recent_alert = ? WHERE id = ?`).run(`⏸ Game paused - ${session.gameName}`, sessionId);
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
      break;
    case 'resume_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running', recent_alert = NULL WHERE id = ?`).run(sessionId);
      logToDatabase('info', 'session', 'Timer resumed by operator', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });
      autoDismissAlerts('timer_resume', { sessionId });
      break;
    case 'reset_timer': {
      // Calculate elapsed time before reset
      const beforeReset = sqlite.prepare(
        `SELECT timer_total_seconds, timer_remaining_seconds, timer_total_elapsed_seconds FROM sessions WHERE id = ?`
      ).get(sessionId) as { timer_total_seconds: number; timer_remaining_seconds: number; timer_total_elapsed_seconds: number } | undefined;

      if (beforeReset) {
        const elapsedThisRound = beforeReset.timer_total_seconds - beforeReset.timer_remaining_seconds;
        const newTotalElapsed = beforeReset.timer_total_elapsed_seconds + elapsedThisRound;

        sqlite.prepare(
          `UPDATE sessions
           SET timer_status = 'idle',
               timer_remaining_seconds = timer_total_seconds,
               timer_total_elapsed_seconds = ?,
               recent_alert = NULL
           WHERE id = ?`
        ).run(newTotalElapsed, sessionId);
      }
      logToDatabase('info', 'session', 'Timer reset by operator', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });
      break;
    }
    case 'send_hint': {
      const message = String(command.payload?.message ?? '').trim();
      if (!message) {
        throw new Error('Hint message required');
      }
      const medium = String(command.payload?.medium ?? 'text');
      sqlite
        .prepare(`INSERT INTO session_hints (id, session_id, type, message, asset_url, delivered_by, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(`hint-${Date.now()}`, sessionId, medium, message, null, 'Console Operator', nowIso);
      sqlite
        .prepare(`UPDATE sessions SET hints_used = hints_used + 1 WHERE id = ?`)
        .run(sessionId);
      logToDatabase('info', 'session', `Hint sent: ${message.substring(0, 50)}`, {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName,
        medium
      });
      evaluateAlertRules('hint_sent', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });
      break;
    }
    case 'mark_puzzle': {
      const puzzleId = String(command.payload?.puzzleId ?? '').trim();
      const status = String(command.payload?.status ?? '').trim();
      if (!puzzleId || !status) {
        throw new Error('Puzzle and status required');
      }
      sqlite.prepare(`UPDATE session_puzzles SET status = ? WHERE id = ? AND session_id = ?`).run(status, puzzleId, sessionId);
      break;
    }
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
  broadcastTimerSessions(sessionId, updated);

  return response;
}


// =============================================================================
// Server-Side Countdown Ticker
// =============================================================================

/**
 * Timer ticker that runs every second to decrement remaining time
 * for all sessions with timer_status = "running"
 */
function tickTimers() {
  try {
    // Get all running timers
    const runningSessions = sqlite.prepare(
      `SELECT id, timer_remaining_seconds, timer_total_elapsed_seconds
       FROM sessions
       WHERE timer_status = 'running' AND timer_remaining_seconds > 0`
    ).all() as Array<{ id: string; timer_remaining_seconds: number; timer_total_elapsed_seconds: number }>;

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
          sqlite.prepare(
            `UPDATE sessions SET timer_status = 'completed', status = 'completed' WHERE id = ?`
          ).run(session.id);
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
        broadcastTimerSessions(session.id, updated);
      }
    }

    // Emit dashboard update if any timers changed
    if (runningSessions.length > 0) {
      emitDashboardUpdate(getDashboard());
    }
  } catch (error) {
    console.error("[Timer Ticker] Error:", error);
  }
}

// Start the ticker - runs every 1000ms (1 second)
const timerInterval = setInterval(tickTimers, 1000);

// Ensure ticker stops if module unloads (for dev server restarts)
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => clearInterval(timerInterval));
  process.on("SIGINT", () => clearInterval(timerInterval));
}

console.log("[Timer Ticker] Started - running every 1 second");

