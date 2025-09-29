import { nanoid } from 'nanoid';
import argon2 from 'argon2';
import { runMigrations, sqlite } from './db/client.js';
import {
  emitCommandAck,
  emitDashboardUpdate,
  emitSessionUpdate,
  emitTimerUpdate
} from './realtime.js';
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
  GameRoomDefinition,
  GamePuzzleDefinition,
  GameSessionDetails,
  NetworkHealth,
  NetworkProfile,
  OperatorProfile,
  OperatorSummary,
  ResetOperatorPasswordRequest,
  SaveGameRequest,
  TimerBroadcast,
  UpdateNetworkProfileRequest,
  UpdateOperatorRequest,
  UpdateOwnProfileRequest
} from '@escapeplan/contracts';
import { normalizePermissions, permissionsForRole } from './security.js';

runMigrations();

type OperatorRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  permissions: string | null;
  password_hash: string;
  email: string | null;
  must_reset_password: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
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
  game_id: string;
  game_name: string;
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
  created_at: string;
  updated_at: string;
};

type GamePuzzleRow = {
  id: string;
  game_id: string;
  title: string;
  description: string | null;
  solution: string | null;
  media_asset: string | null;
  operator_actions: string | null;
  display_order: number;
};

type NetworkProfileRow = {
  id: string;
  name: string;
  ssid: string;
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
  game_id: string;
  name: string;
  is_mobile_capable: number;
  theme_token: string | null;
};

function mapOperator(row: OperatorRow | undefined): OperatorProfile | undefined {
  if (!row) return undefined;
  const permissions = normalizePermissions(row.role as OperatorProfile['role'], row.permissions);
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as OperatorProfile['role'],
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    permissions,
    email: row.email ?? undefined
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
  `SELECT id, name, ssid, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated
   FROM network_profiles WHERE id = ? LIMIT 1`
);

const gameByIdStmt = sqlite.prepare(
  `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
          min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at
   FROM games WHERE id = ? LIMIT 1`
);

const listGamesStmt = sqlite.prepare(
  `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
          min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at
   FROM games ORDER BY name ASC`
);

const puzzlesByGameStmt = sqlite.prepare(
  `SELECT id, game_id, title, description, solution, media_asset, operator_actions, display_order
   FROM game_puzzles WHERE game_id = ? ORDER BY display_order ASC`
);

const roomsByGameStmt = sqlite.prepare(
  `SELECT id, game_id, name, is_mobile_capable, theme_token
   FROM rooms WHERE game_id = ? ORDER BY name ASC`
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
      `INSERT INTO network_profiles (id, name, ssid, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
       VALUES (@id, @name, @ssid, @description, @band, @channel, @security, @broadcast_enabled, @status, @status_message, @details, @last_updated)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         ssid = excluded.ssid,
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
    title: puzzle.title,
    description: puzzle.description ?? undefined,
    solution: puzzle.solution ?? undefined,
    mediaAsset: puzzle.media_asset ?? undefined,
    operatorActions: puzzle.operator_actions ?? undefined,
    displayOrder: puzzle.display_order
  }));
  const rooms: GameRoomDefinition[] = roomRows.map((room) => ({
    id: room.id,
    name: room.name,
    isMobileCapable: Boolean(room.is_mobile_capable),
    themeToken: room.theme_token ?? undefined
  }));
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    puzzles,
    rooms
  };
}

export function listGameDetails(): GameDetails[] {
  const rows = listGamesStmt.all() as GameRow[];
  return rows.map(mapGameDetailsRow);
}

export function getGameDetails(gameId: string): GameDetails | undefined {
  const row = gameByIdStmt.get(gameId) as GameRow | undefined;
  if (!row) return undefined;
  return mapGameDetailsRow(row);
}

function normalizePuzzleInput(puzzle: GamePuzzleDefinition, index: number): GamePuzzleDefinition {
  const id = puzzle.id && puzzle.id.trim().length > 0 ? puzzle.id : `gpz-${nanoid(12)}`;
  return {
    id,
    title: puzzle.title,
    description: puzzle.description,
    solution: puzzle.solution,
    mediaAsset: puzzle.mediaAsset,
    operatorActions: puzzle.operatorActions,
    displayOrder: puzzle.displayOrder ?? index + 1
  };
}

function normalizeRoomInput(room: GameRoomDefinition, index: number): GameRoomDefinition {
  const id = room.id && room.id.trim().length > 0 ? room.id : `room-${nanoid(10)}`;
  return {
    id,
    name: room.name,
    isMobileCapable: room.isMobileCapable,
    themeToken: room.themeToken,
    // ensure order stable by index when returning - stored order is alphabetical by query
  };
}

function persistGameRelations(gameId: string, rooms: GameRoomDefinition[], puzzles: GamePuzzleDefinition[]) {
  const deleteRooms = sqlite.prepare(`DELETE FROM rooms WHERE game_id = ?`);
  const deletePuzzles = sqlite.prepare(`DELETE FROM game_puzzles WHERE game_id = ?`);
  const insertRoom = sqlite.prepare(
    `INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token)
     VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token)`
  );
  const insertPuzzle = sqlite.prepare(
    `INSERT INTO game_puzzles (id, game_id, title, description, solution, media_asset, operator_actions, display_order)
     VALUES (@id, @game_id, @title, @description, @solution, @media_asset, @operator_actions, @display_order)`
  );

  deleteRooms.run(gameId);
  deletePuzzles.run(gameId);

  for (const room of rooms) {
    insertRoom.run({
      id: room.id,
      game_id: gameId,
      name: room.name,
      is_mobile_capable: room.isMobileCapable ? 1 : 0,
      theme_token: room.themeToken ?? null
    });
  }

  for (const puzzle of puzzles) {
    insertPuzzle.run({
      id: puzzle.id,
      game_id: gameId,
      title: puzzle.title,
      description: puzzle.description ?? null,
      solution: puzzle.solution ?? null,
      media_asset: puzzle.mediaAsset ?? null,
      operator_actions: puzzle.operatorActions ?? null,
      display_order: puzzle.displayOrder
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
  sqlite
    .prepare(
      `INSERT INTO games (id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories,
                          min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at)
       VALUES (@id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty, @pricing_model, @category, @categories,
               @min_players, @max_players, @price_per_player_cents, @resources_required, @validation_notes, @created_at, @updated_at)`
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

function getOperatorRow(id: string): OperatorRow | undefined {
  return sqlite.prepare(`SELECT * FROM operators WHERE id = ? LIMIT 1`).get(id) as OperatorRow | undefined;
}

export async function createOperatorAccount(input: CreateOperatorRequest): Promise<OperatorSummary> {
  const existing = sqlite
    .prepare(`SELECT id FROM operators WHERE username = ? LIMIT 1`)
    .get(input.username) as { id: string } | undefined;
  if (existing) {
    throw new Error('Username already exists');
  }
  const id = `op-${nanoid(12)}`;
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const permissions = permissionsForRole(input.role);
  const now = new Date().toISOString();
  const avatarUrl = input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;
  const bio = input.bio?.trim() ? input.bio.trim() : null;
  sqlite
    .prepare(
      `INSERT INTO operators (id, username, name, role, avatar_url, bio, permissions, password_hash, email, must_reset_password, created_at, updated_at)
       VALUES (@id, @username, @name, @role, @avatar_url, @bio, @permissions, @password_hash, @email, @must_reset_password, @created_at, @updated_at)`
    )
    .run({
      id,
      username: input.username,
      name: input.name,
      role: input.role,
      avatar_url: avatarUrl,
      bio,
      permissions: JSON.stringify(permissions),
      password_hash: passwordHash,
      email: input.email ?? null,
      must_reset_password: input.mustResetPassword ? 1 : 0,
      created_at: now,
      updated_at: now
    });

  const row = getOperatorRow(id);
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
  const nextRole = input.role ?? (row.role as CreateOperatorRequest['role']);
  const permissions = JSON.stringify(permissionsForRole(nextRole));
  const mustReset =
    typeof input.mustResetPassword === 'boolean' ? (input.mustResetPassword ? 1 : 0) : row.must_reset_password;
  const name = input.name?.trim();
  const email = input.email?.trim();
  const avatarUrl =
    input.avatarUrl === undefined ? row.avatar_url : input.avatarUrl?.trim() ? input.avatarUrl.trim() : null;
  const bio = input.bio === undefined ? row.bio : input.bio?.trim() ? input.bio.trim() : null;
  sqlite
    .prepare(
      `UPDATE operators
       SET name = @name,
           role = @role,
           email = @email,
           avatar_url = @avatar_url,
           bio = @bio,
           permissions = @permissions,
           must_reset_password = @must_reset_password,
           updated_at = @updated_at
       WHERE id = @id`
    )
    .run({
      id,
      name: name ?? row.name,
      role: nextRole,
      email: input.email === undefined ? row.email : email || null,
      avatar_url: avatarUrl,
      bio,
      permissions,
      must_reset_password: mustReset,
      updated_at: new Date().toISOString()
    });

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
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const mustReset = input.forceReset ?? true;
  sqlite
    .prepare(`UPDATE operators SET password_hash = ?, must_reset_password = ?, updated_at = ? WHERE id = ?`)
    .run(passwordHash, mustReset ? 1 : 0, new Date().toISOString(), id);
  const updated = getOperatorRow(id);
  if (!updated) {
    throw new Error('Unable to read operator');
  }
  return mapOperatorSummary(updated);
}

export async function changeOwnPassword(operatorId: string, payload: ChangeOwnPasswordRequest): Promise<void> {
  const row = getOperatorRow(operatorId);
  if (!row) {
    throw new Error('Operator not found');
  }
  const valid = await argon2.verify(row.password_hash, payload.currentPassword);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }
  const passwordHash = await argon2.hash(payload.newPassword, { type: argon2.argon2id });
  sqlite
    .prepare(`UPDATE operators SET password_hash = ?, must_reset_password = 0, updated_at = ? WHERE id = ?`)
    .run(passwordHash, new Date().toISOString(), operatorId);
}

export function updateOwnProfile(operatorId: string, payload: UpdateOwnProfileRequest): OperatorProfile {
  const row = getOperatorRow(operatorId);
  if (!row) {
    throw new Error('Operator not found');
  }
  const name = payload.name?.trim() ?? row.name;
  const email = payload.email === undefined ? row.email : payload.email?.trim() || null;
  const avatarUrl =
    payload.avatarUrl === undefined ? row.avatar_url : payload.avatarUrl?.trim() ? payload.avatarUrl.trim() : null;
  const bio = payload.bio === undefined ? row.bio : payload.bio?.trim() ? payload.bio.trim() : null;

  sqlite
    .prepare(
      `UPDATE operators SET name = ?, email = ?, avatar_url = ?, bio = ?, updated_at = ? WHERE id = ?`
    )
    .run(name, email, avatarUrl, bio, new Date().toISOString(), operatorId);

  const updated = getOperatorRow(operatorId);
  const profile = mapOperator(updated);
  if (!profile) {
    throw new Error('Unable to load updated profile');
  }
  return profile;
}

export function deleteOperatorAccount(id: string) {
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
  sqlite.prepare(`DELETE FROM operators WHERE id = ?`).run(id);
}

export function findOperatorByUsername(
  username: string
): (OperatorProfile & { passwordHash: string; mustResetPassword: boolean }) | undefined {
  const stmt = sqlite.prepare(`SELECT * FROM operators WHERE username = ? LIMIT 1`);
  const row = stmt.get(username) as OperatorRow | undefined;
  if (!row) return undefined;
  const profile = mapOperator(row);
  if (!profile) return undefined;
  return { ...profile, passwordHash: row.password_hash, mustResetPassword: Boolean(row.must_reset_password) };
}

export function findOperatorById(id: string): OperatorProfile | undefined {
  const stmt = sqlite.prepare(`SELECT * FROM operators WHERE id = ? LIMIT 1`);
  const row = stmt.get(id) as OperatorRow | undefined;
  return mapOperator(row);
}

export function listOperatorSummaries(): OperatorSummary[] {
  const rows = sqlite
    .prepare(`SELECT * FROM operators ORDER BY created_at ASC`)
    .all() as OperatorRow[];
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
    roomName: row.room_name,
    startedAt: row.started_at,
    scheduledEnd: row.scheduled_end,
    status: row.session_status as GameSessionDetails['status'],
    players: row.party_size,
    isMobile: Boolean(row.is_mobile),
    timer: {
      totalSeconds: row.timer_total_seconds,
      remainingSeconds: row.timer_remaining_seconds,
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
              s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
              s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
              b.party_size, b.is_mobile, b.start_time, b.end_time,
              g.id AS game_id, g.name AS game_name,
              r.name AS room_name
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

export function getSessionById(id: string): GameSessionDetails | undefined {
  const stmt = sqlite.prepare(
    `SELECT s.id AS session_id, s.booking_id, s.status AS session_status, s.timer_total_seconds, s.timer_remaining_seconds,
            s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
            s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
            b.party_size, b.is_mobile,
            g.id AS game_id, g.name AS game_name,
            r.name AS room_name
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
            s.timer_status, s.started_at, s.scheduled_end, s.hints_used, s.stream_thumbnail_url, s.background_audio_track,
            s.background_audio_is_playing, s.crew_primary, s.crew_support, s.recent_alert,
            b.party_size, b.is_mobile,
            g.id AS game_id, g.name AS game_name,
            r.name AS room_name
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
      detailsUrl: '/admin/network'
    },
    activeSessions: active.sessions,
    alerts: active.sessions
      .filter((s) => s.recentAlert)
      .map((s) => ({
        id: `${s.id}-alert`,
        level: 'warning',
        message: s.recentAlert!,
        createdAt: new Date().toISOString()
      })),
    upcomingBookings: upcoming
  };
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
      break;
    case 'pause_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'paused', status = 'paused', recent_alert = 'Timer paused by operator' WHERE id = ?`).run(sessionId);
      break;
    case 'resume_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running', recent_alert = 'Timer resumed' WHERE id = ?`).run(sessionId);
      break;
    case 'reset_timer':
      sqlite
        .prepare(`UPDATE sessions SET timer_status = 'idle', timer_remaining_seconds = timer_total_seconds, recent_alert = 'Timer reset' WHERE id = ?`)
        .run(sessionId);
      break;
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
        .prepare(`UPDATE sessions SET hints_used = hints_used + 1, recent_alert = 'New hint delivered' WHERE id = ?`)
        .run(sessionId);
      break;
    }
    case 'mark_puzzle': {
      const puzzleId = String(command.payload?.puzzleId ?? '').trim();
      const status = String(command.payload?.status ?? '').trim();
      if (!puzzleId || !status) {
        throw new Error('Puzzle and status required');
      }
      sqlite.prepare(`UPDATE session_puzzles SET status = ? WHERE id = ? AND session_id = ?`).run(status, puzzleId, sessionId);
      sqlite.prepare(`UPDATE sessions SET recent_alert = 'Puzzle status updated' WHERE id = ?`).run(sessionId);
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

export function rotateAdminCredentials() {
  const newPassword = nanoid(12);
  sqlite.prepare(`UPDATE operators SET password = ? WHERE username = 'admin'`).run(newPassword);
  return { username: 'admin', password: newPassword };
}
