/**
 * @file state.deprecated.ts
 *
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This file has been refactored into a modular domain-driven architecture.
 * All functions have been migrated to the ./state/ directory.
 *
 * Migration completed: 2025-10-04
 *
 * NEW IMPORT PATH: import { ... } from './state/index.js';
 *
 * Domain modules:
 * - ./state/network/      - WiFi management, network profiles
 * - ./state/games/        - Game CRUD, puzzles, pricing
 * - ./state/operators/    - User accounts, roles, permissions
 * - ./state/sessions/     - Active sessions, timer, commands
 * - ./state/bookings/     - Calendar bookings, scheduling
 * - ./state/dashboard/    - Real-time aggregation
 *
 * See ./state/README.md for architecture documentation.
 *
 * This file is kept for reference only and will be removed in a future cleanup.
 */

import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { sqlite } from './db/client.js';
import {
  emitBookingsUpdate,
  emitCommandAck,
  emitDashboardUpdate,
  emitSessionUpdate,
  emitTimerUpdate,
  emitRoomDisplayMedia
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
  GamePuzzleDefinition,
  GameHintDefinition,
  GameMediaConfig,
  GamePricingConfig,
  GameSessionDetails,
  GameMilestone,
  GameMilestoneTriggerConfig,
  MilestoneMediaType,
  MilestoneType,
  MilestoneTriggerType,
  NetworkHealth,
  NetworkProfile,
  OperatorProfile,
  OperatorRole,
  OperatorSummary,
  QuickStartSessionRequest,
  QuickStartSessionResponse,
  ResetOperatorPasswordRequest,
  SaveGameRequest,
  TimerBroadcast,
  UpdateNetworkProfileRequest,
  UpdateOperatorRequest,
  UpdateOwnProfileRequest,
  WiFiNetwork,
  WiFiScanResponse,
  WiFiClientConnectRequest,
  WiFiClientStatus
} from '@escapeplan/contracts';
import { auth } from './auth.js';
import { normalizePermissions, permissionsForRole, normalizeRole, resolveRoleId } from './security.js';

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
  user_type: string;
  role_id: string;
  avatar_config: string | Record<string, unknown> | null; // string from raw SQLite, object from Drizzle with mode: 'json'
  bio: string | null;
  email: string;
  emailVerified: number;
  must_reset_password: number;
  createdAt: string;
  updatedAt: string;
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
  party_size: number;
  is_mobile: number;
  is_adhoc: number;
  game_id: string;
  game_name: string;
  game_slug: string;
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
  game_type: string;
  pricing_model: string;
  category: string | null;
  categories: string | null;
  min_players: number;
  max_players: number;
  price_per_player_cents: number;
  resources_required: number;
  validation_notes: string | null;
  default_volume: number;
  camera_ids: string | null;
  media_config: string | null;
  room_display_config: string | null;
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


type GameMilestoneRow = {
  id: string;
  game_id: string;
  type: string;
  name: string;
  media_type: string | null;
  content: string | null;
  asset_id: string | null;
  volume_level: number;
  display_order: number;
  trigger_type: string;
  trigger_config: string | null;
  enabled: number;
  display_duration_seconds: number | null;
  loop: number;
  loop_count: number | null;
  auto_dismiss: number;
  created_at: string;
  updated_at: string;
};

function mapOperator(row: OperatorRow | undefined): OperatorProfile | undefined {
  if (!row) return undefined;

  // Get role name from role_id
  const roleRecord = sqlite
    .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
    .get(row.role_id) as { name: string } | undefined;

  if (!roleRecord) {
    throw new Error(`Role not found for role_id: ${row.role_id}`);
  }

  const resolvedRole = normalizeRole(roleRecord.name);

  // Get permissions from database via role_id
  const permissions = permissionsForRole(row.role_id);

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
    emailVerified: Boolean(row.emailVerified),
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.last_login_at ?? undefined
  };
}

const networkProfileStmt = sqlite.prepare(
  `SELECT id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated
   FROM network_profiles WHERE id = ? LIMIT 1`
);

const gameByIdStmt = sqlite.prepare(
  `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, game_type, pricing_model, category, categories,
          min_players, max_players, price_per_player_cents, resources_required, validation_notes, default_volume, camera_ids,
          media_config, room_display_config, pricing_config, booking_rules_config,
          created_at, updated_at, archived_at, archived_by, archived_reason
   FROM games WHERE id = ? LIMIT 1`
);

const puzzlesByGameStmt = sqlite.prepare(
  `SELECT id, game_id, title, description, solution, media_asset, operator_actions, display_order, hints, media_asset_meta
   FROM game_puzzles WHERE game_id = ? ORDER BY display_order ASC`
);


const milestonesByGameStmt = sqlite.prepare(
  `SELECT id, game_id, type, name, media_type, content, asset_id, volume_level, display_order, trigger_type, trigger_config, enabled, created_at, updated_at
   FROM game_milestones WHERE game_id = ? ORDER BY display_order ASC`
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

// ============================================================================
// WiFi Client Management
// ============================================================================

export function scanWiFiNetworks(): WiFiScanResponse {
  try {
    // Use nmcli to scan for WiFi networks
    const output = execSync('nmcli -t -f SSID,BSSID,SIGNAL,FREQ,SECURITY,CHAN,IN-USE dev wifi list', {
      encoding: 'utf8',
      timeout: 10000
    });

    const lines = output.trim().split('\n');
    const networks: WiFiNetwork[] = lines
      .map((line) => {
        const parts = line.split(':');
        if (parts.length < 7) return null;

        const [ssid, bssid, signalStr, freqStr, security, chanStr, inUseStr] = parts;

        // Skip empty SSIDs
        if (!ssid || ssid.trim() === '') return null;

        return {
          ssid: ssid.trim(),
          bssid: bssid.trim(),
          signal: parseInt(signalStr, 10) || 0,
          frequency: parseInt(freqStr, 10) || 0,
          security: security.trim() || 'Open',
          channel: parseInt(chanStr, 10) || 0,
          inUse: inUseStr === '*'
        };
      })
      .filter((n): n is WiFiNetwork => n !== null);

    // Remove duplicates (same SSID), keeping the strongest signal
    const uniqueNetworks = new Map<string, WiFiNetwork>();
    for (const network of networks) {
      const existing = uniqueNetworks.get(network.ssid);
      if (!existing || network.signal > existing.signal) {
        uniqueNetworks.set(network.ssid, network);
      }
    }

    return {
      networks: Array.from(uniqueNetworks.values()).sort((a, b) => b.signal - a.signal),
      scannedAt: new Date().toISOString()
    };
  } catch (error) {
    // If nmcli fails, return empty scan (likely not on Linux or nmcli not installed)
    console.error('WiFi scan failed:', error);
    return {
      networks: [],
      scannedAt: new Date().toISOString()
    };
  }
}

export function connectToWiFi(request: WiFiClientConnectRequest): WiFiClientStatus {
  try {
    const { ssid, password, security } = request;

    // First, delete any existing connection with the same name
    try {
      execSync(`nmcli connection delete "${ssid}"`, { encoding: 'utf8', timeout: 5000 });
    } catch {
      // Ignore errors if connection doesn't exist
    }

    // Connect to the network
    if (password) {
      // WPA/WPA2 secured network
      execSync(`nmcli dev wifi connect "${ssid}" password "${password}"`, {
        encoding: 'utf8',
        timeout: 30000
      });
    } else {
      // Open network
      execSync(`nmcli dev wifi connect "${ssid}"`, {
        encoding: 'utf8',
        timeout: 30000
      });
    }

    // Get connection status
    return getWiFiClientStatus();
  } catch (error: any) {
    console.error('WiFi connection failed:', error);
    throw new Error(`Failed to connect to ${request.ssid}: ${error.message}`);
  }
}

export function getWiFiClientStatus(): WiFiClientStatus {
  try {
    // Get active WiFi connection info
    const output = execSync('nmcli -t -f NAME,TYPE,DEVICE connection show --active', {
      encoding: 'utf8',
      timeout: 5000
    });

    const lines = output.trim().split('\n');
    const wifiConnection = lines.find((line) => line.includes('802-11-wireless') || line.includes('wireless'));

    if (!wifiConnection) {
      return { connected: false };
    }

    // Extract connection name (SSID)
    const parts = wifiConnection.split(':');
    const connectionName = parts[0];

    // Get signal strength and IP info
    try {
      const detailsOutput = execSync(`nmcli -t -f GENERAL.STATE,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS connection show "${connectionName}"`, {
        encoding: 'utf8',
        timeout: 5000
      });

      const details = detailsOutput.trim().split('\n');
      const ipAddress = details.find((d) => d.startsWith('IP4.ADDRESS'))?.split(':')[1]?.split('/')[0] || undefined;
      const gateway = details.find((d) => d.startsWith('IP4.GATEWAY'))?.split(':')[1] || undefined;
      const dnsRaw = details.filter((d) => d.startsWith('IP4.DNS')).map((d) => d.split(':')[1]);

      // Try to get signal strength
      let signal: number | undefined;
      try {
        const signalOutput = execSync('nmcli -t -f IN-USE,SIGNAL dev wifi list', {
          encoding: 'utf8',
          timeout: 5000
        });
        const activeNetwork = signalOutput.split('\n').find((line) => line.startsWith('*'));
        if (activeNetwork) {
          const signalStr = activeNetwork.split(':')[1];
          signal = parseInt(signalStr, 10) || undefined;
        }
      } catch {
        // Signal strength unavailable
      }

      return {
        connected: true,
        ssid: connectionName,
        signal,
        ipAddress,
        gateway,
        dns: dnsRaw.length > 0 ? dnsRaw : undefined
      };
    } catch {
      // Basic status without details
      return {
        connected: true,
        ssid: connectionName
      };
    }
  } catch (error) {
    console.error('Failed to get WiFi client status:', error);
    return { connected: false };
  }
}

export function disconnectFromWiFi(): WiFiClientStatus {
  try {
    // Get active WiFi connection
    const status = getWiFiClientStatus();
    if (status.connected && status.ssid) {
      // Disconnect the active connection
      execSync(`nmcli connection down "${status.ssid}"`, {
        encoding: 'utf8',
        timeout: 5000
      });
    }
    return { connected: false };
  } catch (error) {
    console.error('WiFi disconnection failed:', error);
    return getWiFiClientStatus();
  }
}

function mapGameDetailsRow(row: GameRow): GameDetails {
  const categories = row.categories ? (JSON.parse(row.categories) as string[]) : [];
  const puzzleRows = puzzlesByGameStmt.all(row.id) as GamePuzzleRow[];
  const milestoneRows = milestonesByGameStmt.all(row.id) as GameMilestoneRow[];
  const puzzles: GamePuzzleDefinition[] = puzzleRows.map((puzzle) => ({
    id: puzzle.id,
    title: puzzle.title,
    description: puzzle.description ?? undefined,
    solution: puzzle.solution ?? undefined,
    mediaAsset: puzzle.media_asset ?? undefined,
    operatorActions: puzzle.operator_actions ?? undefined,
    displayOrder: puzzle.display_order,
    hints: puzzle.hints ? (JSON.parse(puzzle.hints) as GameHintDefinition[]) : undefined,
    mediaMeta: puzzle.media_asset_meta ? (JSON.parse(puzzle.media_asset_meta) as Record<string, unknown>) : undefined
  }));
  const milestones: GameMilestone[] = milestoneRows.map((milestone) => ({
    id: milestone.id,
    gameId: milestone.game_id,
    type: milestone.type as MilestoneType,
    name: milestone.name,
    mediaType: (milestone.media_type as MilestoneMediaType) ?? null,
    content: milestone.content ?? null,
    assetId: milestone.asset_id ?? null,
    volumeLevel: milestone.volume_level,
    displayOrder: milestone.display_order,
    triggerType: milestone.trigger_type as MilestoneTriggerType,
    triggerConfig: milestone.trigger_config ? (JSON.parse(milestone.trigger_config) as GameMilestoneTriggerConfig) : null,
    enabled: Boolean(milestone.enabled),
    createdAt: milestone.created_at,
    updatedAt: milestone.updated_at
  }));
  const mediaConfig = safeParse<GameMediaConfig>(row.media_config);
  const roomDisplayConfig = safeParse<import('@escapeplan/contracts').RoomDisplayConfig>(row.room_display_config);
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
    gameType: (row.game_type as import('@escapeplan/contracts').GameType) ?? 'storefront',
    pricingModel: row.pricing_model as import('@escapeplan/contracts').PricingModel,
    categories: categories.length ? categories : row.category ? [row.category] : [],
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    pricePerPlayerCents: row.price_per_player_cents,
    resourcesRequired: row.resources_required,
    validationNotes: row.validation_notes ?? undefined,
    defaultVolume: row.default_volume,
    media: mediaConfig
      ? {
          thumbnailAssetId: mediaConfig.thumbnailAssetId ?? undefined,
          galleryAssetIds: mediaConfig.galleryAssetIds ?? []
        }
      : undefined,
    roomDisplayConfig: roomDisplayConfig ?? undefined,
    pricing: pricingConfig
      ? {
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
    cameraIds: row.camera_ids ? (JSON.parse(row.camera_ids) as string[]) : [],
    milestones,
    puzzles
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
    `SELECT id, slug, name, description, story_intro, duration_minutes, difficulty, game_type, pricing_model, category, categories,
            min_players, max_players, price_per_player_cents, resources_required, validation_notes, default_volume, camera_ids,
            media_config, room_display_config, pricing_config, booking_rules_config,
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
  const id = puzzle.id && puzzle.id.trim().length > 0 ? puzzle.id : randomUUID();
  return {
    id,
    title: puzzle.title,
    description: puzzle.description,
    solution: puzzle.solution,
    mediaAsset: puzzle.mediaAsset,
    operatorActions: puzzle.operatorActions,
    displayOrder: puzzle.displayOrder ?? index + 1,
    hints: puzzle.hints ?? [],
    mediaMeta: puzzle.mediaMeta ?? undefined
  };
}


function persistGameMilestones(
  gameId: string,
  milestones: Omit<GameMilestone, 'id' | 'gameId' | 'createdAt' | 'updatedAt'>[]
) {
  const now = new Date().toISOString();

  // Get existing milestone IDs to determine what to delete
  const existingMilestones = sqlite
    .prepare('SELECT id FROM game_milestones WHERE game_id = ?')
    .all(gameId) as { id: string }[];
  const existingIds = new Set(existingMilestones.map(m => m.id));

  // Determine which milestones to upsert
  const milestonesToUpsert = milestones.map(m => ({
    id: ('id' in m && typeof m.id === 'string') ? m.id : randomUUID(),
    ...m
  }));
  const newIds = new Set(milestonesToUpsert.map(m => m.id));

  // Delete milestones that are no longer in the payload
  const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
  for (const id of idsToDelete) {
    sqlite.prepare('DELETE FROM game_milestones WHERE id = ?').run(id);
  }

  // Upsert milestones
  const upsertMilestone = sqlite.prepare(`
    INSERT INTO game_milestones (
      id, game_id, type, name, media_type, content, asset_id, volume_level,
      display_order, trigger_type, trigger_config, enabled, created_at, updated_at
    )
    VALUES (
      @id, @game_id, @type, @name, @media_type, @content, @asset_id, @volume_level,
      @display_order, @trigger_type, @trigger_config, @enabled, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      type = @type,
      name = @name,
      media_type = @media_type,
      content = @content,
      asset_id = @asset_id,
      volume_level = @volume_level,
      display_order = @display_order,
      trigger_type = @trigger_type,
      trigger_config = @trigger_config,
      enabled = @enabled,
      updated_at = @updated_at
  `);

  for (const milestone of milestonesToUpsert) {
    upsertMilestone.run({
      id: milestone.id,
      game_id: gameId,
      type: milestone.type,
      name: milestone.name,
      media_type: milestone.mediaType ?? null,
      content: milestone.content ?? null,
      asset_id: milestone.assetId ?? null,
      volume_level: milestone.volumeLevel,
      display_order: milestone.displayOrder,
      trigger_type: milestone.triggerType,
      trigger_config: milestone.triggerConfig ? JSON.stringify(milestone.triggerConfig) : null,
      enabled: milestone.enabled ? 1 : 0,
      created_at: now,
      updated_at: now
    });
  }
}

function persistGameRelations(gameId: string, puzzles: GamePuzzleDefinition[]) {
  const upsertPuzzle = sqlite.prepare(
    `INSERT INTO game_puzzles (id, game_id, title, description, solution, media_asset, operator_actions, display_order, hints, media_asset_meta)
     VALUES (@id, @game_id, @title, @description, @solution, @media_asset, @operator_actions, @display_order, @hints, @media_asset_meta)
     ON CONFLICT(id) DO UPDATE SET
       title = @title,
       description = @description,
       solution = @solution,
       media_asset = @media_asset,
       operator_actions = @operator_actions,
       display_order = @display_order,
       hints = @hints,
       media_asset_meta = @media_asset_meta`
  );

  // Get current IDs to identify deletions
  const existingPuzzleIds = sqlite.prepare(`SELECT id FROM game_puzzles WHERE game_id = ?`).all(gameId).map((p: any) => p.id);
  const newPuzzleIds = puzzles.map(p => p.id);

  // Delete removed puzzles (safe - no foreign key references)
  const puzzlesToDelete = existingPuzzleIds.filter((id: string) => !newPuzzleIds.includes(id));
  for (const puzzleId of puzzlesToDelete) {
    sqlite.prepare(`DELETE FROM game_puzzles WHERE id = ?`).run(puzzleId);
  }

  // Upsert puzzles
  for (const puzzle of puzzles) {
    console.log(`[DEBUG] Persisting puzzle ${puzzle.id} (${puzzle.title}):`, {
      hintsCount: puzzle.hints?.length || 0,
      hints: puzzle.hints
    });
    upsertPuzzle.run({
      id: puzzle.id,
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
  const gameId = randomUUID();
  const categories = JSON.stringify(payload.categories ?? []);
  const mediaConfig = payload.media ? JSON.stringify(payload.media) : null;
  const pricingConfig = payload.pricing ? JSON.stringify(payload.pricing) : null;
  const bookingRulesConfig = payload.bookingRules ? JSON.stringify(payload.bookingRules) : null;
  const roomDisplayConfig = payload.roomDisplayConfig ? JSON.stringify(payload.roomDisplayConfig) : null;
  sqlite
    .prepare(
      `INSERT INTO games (id, slug, name, description, story_intro, duration_minutes, difficulty, game_type, pricing_model, category, categories,
                          min_players, max_players, price_per_player_cents, resources_required, validation_notes, default_volume,
                          media_config, pricing_config, booking_rules_config, room_display_config,
                          created_at, updated_at, archived_at, archived_by, archived_reason)
       VALUES (@id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty, @game_type, @pricing_model, @category, @categories,
               @min_players, @max_players, @price_per_player_cents, @resources_required, @validation_notes, @default_volume,
               @media_config, @pricing_config, @booking_rules_config, @room_display_config,
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
      game_type: payload.gameType ?? 'storefront',
      pricing_model: null, // DEPRECATED
      category: payload.categories?.[0] ?? null,
      categories,
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      price_per_player_cents: null, // DEPRECATED
      resources_required: payload.resourcesRequired,
      validation_notes: payload.validationNotes ?? null,
      default_volume: payload.defaultVolume ?? 80,
      media_config: mediaConfig,
      pricing_config: pricingConfig,
      booking_rules_config: bookingRulesConfig,
      room_display_config: roomDisplayConfig,
      created_at: now,
      updated_at: now
    });

  const normalizedPuzzles = (payload.puzzles ?? []).map(normalizePuzzleInput);

  persistGameRelations(gameId, normalizedPuzzles);

  // Persist milestones
  if (payload.milestones) {
    persistGameMilestones(gameId, payload.milestones);
  }

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

  console.log('[DEBUG] updateGame called with payload:', {
    gameId,
    puzzlesCount: payload.puzzles?.length || 0,
    puzzles: payload.puzzles?.map(p => ({ id: p.id, title: p.title, hintsCount: p.hints?.length || 0 })),
    media: payload.media,
    roomDisplayConfig: payload.roomDisplayConfig
  });

  const now = new Date().toISOString();
  const mediaConfig = payload.media ? JSON.stringify(payload.media) : null;
  const pricingConfig = payload.pricing ? JSON.stringify(payload.pricing) : null;
  const bookingRulesConfig = payload.bookingRules ? JSON.stringify(payload.bookingRules) : null;
  const roomDisplayConfig = payload.roomDisplayConfig ? JSON.stringify(payload.roomDisplayConfig) : null;

  console.log('[DEBUG] Serialized configs:', {
    mediaConfig,
    roomDisplayConfig
  });
  sqlite
    .prepare(
      `UPDATE games
       SET slug = @slug,
           name = @name,
           description = @description,
           story_intro = @story_intro,
           duration_minutes = @duration_minutes,
           difficulty = @difficulty,
           game_type = @game_type,
           pricing_model = @pricing_model,
           category = @category,
           categories = @categories,
           min_players = @min_players,
           max_players = @max_players,
           price_per_player_cents = @price_per_player_cents,
           resources_required = @resources_required,
           validation_notes = @validation_notes,
           default_volume = @default_volume,
           media_config = @media_config,
           pricing_config = @pricing_config,
           booking_rules_config = @booking_rules_config,
           room_display_config = @room_display_config,
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
      game_type: payload.gameType ?? 'storefront',
      pricing_model: null, // DEPRECATED
      category: payload.categories?.[0] ?? null,
      categories: JSON.stringify(payload.categories ?? []),
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      price_per_player_cents: null, // DEPRECATED
      resources_required: payload.resourcesRequired,
      validation_notes: payload.validationNotes ?? null,
      default_volume: payload.defaultVolume ?? 80,
      media_config: mediaConfig,
      pricing_config: pricingConfig,
      booking_rules_config: bookingRulesConfig,
      room_display_config: roomDisplayConfig,
      updated_at: now
    });

  const normalizedPuzzles = (payload.puzzles ?? []).map(normalizePuzzleInput);

  console.log('[DEBUG] Normalized puzzles before persist:', normalizedPuzzles.map(p => ({
    id: p.id,
    title: p.title,
    hintsCount: p.hints?.length || 0,
    hints: p.hints
  })));

  persistGameRelations(gameId, normalizedPuzzles);

  // Persist milestones
  if (payload.milestones) {
    persistGameMilestones(gameId, payload.milestones);
  }

  const result = getGameDetails(gameId)!;
  console.log('[DEBUG] Game after update:', {
    id: result.id,
    media: result.media,
    roomDisplayConfig: result.roomDisplayConfig,
    puzzles: result.puzzles.map(p => ({ id: p.id, title: p.title, hintsCount: p.hints?.length || 0 }))
  });

  return result;
}

export function deleteGame(gameId: string) {
  persistGameRelations(gameId, []);
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
  return sqlite.prepare(`SELECT * FROM user WHERE id = ? LIMIT 1`).get(id) as OperatorRow | undefined;
}

export async function createOperatorAccount(input: CreateOperatorRequest): Promise<OperatorSummary> {
  const username = input.username.trim();
  const existing = sqlite
    .prepare(`SELECT id FROM user WHERE username = ? LIMIT 1`)
    .get(username) as { id: string } | undefined;
  if (existing) {
    throw new Error('Username already exists');
  }

  const email = input.email?.trim();

  const role = normalizeRole(input.role);
  const roleId = resolveRoleId(role);
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
  const avatarImage = input.avatarConfig ?? undefined;

  const hashedPassword = await context.password.hash(input.password);

  // Create user - password goes in account table, not user table
  const user = await adapter.createUser({
    ...(email ? { email } : {}),
    name: trimmedName,
    username,
    user_type: 'operator',
    role_id: roleId,
    ...(trimmedBio ? { bio: trimmedBio } : {}),
    ...(avatarImage ? { avatar_config: JSON.stringify(avatarImage) } : {}),
    must_reset_password: input.mustResetPassword ?? false,
    emailVerified: Boolean(email),
    archived_at: null,
    archived_by: null,
    archived_reason: null
  } as any) as any;

  await adapter.createAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hashedPassword
  });

  // Note: role_id is already set in createUser via additionalFields
  // Permissions are derived from role_id via database relationships, not stored directly

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

  // Get current role name from role_id if no new role is provided
  let roleValue: string;
  if (input.role !== undefined) {
    roleValue = input.role;
  } else {
    const currentRoleRecord = sqlite
      .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
      .get(row.role_id) as { name: string } | undefined;
    if (!currentRoleRecord) {
      throw new Error(`Role not found for role_id: ${row.role_id}`);
    }
    roleValue = currentRoleRecord.name;
  }

  const resolvedRole = normalizeRole(roleValue);
  const resolvedRoleId = resolveRoleId(resolvedRole);
  const permissions = permissionsForRole(resolvedRole);
  const context = await getAuthContext();
  const adapter = await getInternalAdapter();

  // permissions column has mode: 'json', so Drizzle will automatically stringify the array
  const updates: Record<string, unknown> = {
    role: resolvedRole,
    roleId: resolvedRoleId,
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
    // Better-Auth uses 'image' field which maps to 'avatar_config' column with mode: 'json'
    // Pass the object directly - Better Auth adapter + Drizzle will handle serialization
    updates.image = payload.avatarConfig ?? null;
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

  // Get role name from role_id to check if admin
  const roleRecord = sqlite
    .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
    .get(row.role_id) as { name: string } | undefined;

  if (roleRecord?.name === 'admin') {
    const adminCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM user u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin'`)
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

  // Get role name from role_id to check if admin
  const roleRecord = sqlite
    .prepare(`SELECT name FROM roles WHERE id = ? LIMIT 1`)
    .get(row.role_id) as { name: string } | undefined;

  if (roleRecord?.name === 'admin') {
    const adminCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM user u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' AND u.archived_at IS NULL`)
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

  sqlite.prepare(`DELETE FROM session WHERE userId = ?`).run(id);

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
  const stmt = sqlite.prepare(`SELECT * FROM user WHERE id = ? LIMIT 1`);
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
    conditions.push('u.archived_at IS NOT NULL');
  } else if (filters.status === 'active') {
    conditions.push('u.archived_at IS NULL');
  }

  if (filters.role && filters.role !== 'all') {
    conditions.push('r.name = ?');
    params.push(filters.role);
  }

  if (filters.search && filters.search.trim().length) {
    const normalized = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(u.username) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(COALESCE(u.email, \'\')) LIKE ?)'
    );
    params.push(normalized, normalized, normalized);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = sqlite
    .prepare(
      `SELECT u.*
       FROM user u
       JOIN roles r ON u.role_id = r.id
       ${whereClause}
       ORDER BY CASE WHEN u.archived_at IS NULL THEN 0 ELSE 1 END,
                u.name COLLATE NOCASE ASC`
    )
    .all(...params) as OperatorRow[];
  return rows.map(mapOperatorSummary);
}

export function updateOperatorLoginTimestamp(id: string, iso: string) {
  sqlite.prepare(`UPDATE user SET last_login_at = ?, updatedAt = ? WHERE id = ?`).run(iso, iso, id);
}

/**
 * Get all permissions for a user by querying their role's permissions
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const result = sqlite.prepare(`
    SELECT DISTINCT p.name
    FROM user u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = ?
  `).all(userId) as { name: string }[];
  return result.map(row => row.name);
}

/**
 * Check if a user has a specific permission
 */
export async function userHasPermission(userId: string, permissionName: string): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return userPermissions.includes(permissionName);
}

/**
 * Require a user to have a specific permission, throwing an error if they don't
 */
export async function requirePermission(userId: string, permissionName: string): Promise<void> {
  const hasPermission = await userHasPermission(userId, permissionName);
  if (!hasPermission) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
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
    }
  };
}

const puzzlesStmt = sqlite.prepare(
  `SELECT id, session_id, puzzle_id, title, description, solution, status, display_order, hints FROM session_puzzles WHERE session_id = ? ORDER BY display_order ASC`
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
    const puzzleRows = puzzlesStmt.all(row.session_id) as { id: string; session_id: string; puzzle_id: string | null; title: string; description: string | null; solution: string | null; status: string; display_order: number; hints: string | null }[];
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
    const puzzleRows = puzzlesStmt.all(row.session_id) as { id: string; session_id: string; puzzle_id: string | null; title: string; description: string | null; solution: string | null; status: string; display_order: number; hints: string | null }[];
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
    .all(id) as { id: string; puzzle_id: string | null; title: string; description: string | null; solution: string | null; status: string; display_order: number; hints: string | null }[];
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
    .all(id) as { id: string; type: string; message: string; asset_url: string | null; delivered_by: string; delivered_at: string }[];
  details.hintLog = hintRows.map((hint) => ({
    id: hint.id,
    type: hint.type as GameSessionDetails['hintLog'][number]['type'],
    message: hint.message,
    assetUrl: hint.asset_url ?? undefined,
    deliveredBy: hint.delivered_by,
    deliveredAt: hint.delivered_at
  }));

  // Get available milestones (enabled, not yet triggered)
  const triggeredMilestones = sqlite
    .prepare('SELECT milestone_id FROM session_milestones WHERE session_id = ?')
    .all(id) as { milestone_id: string }[];
  const triggeredIds = new Set(triggeredMilestones.map(m => m.milestone_id));

  const gameMilestones = milestonesByGameStmt.all(row.game_id) as GameMilestoneRow[];
  details.availableMilestones = gameMilestones
    .filter(m => m.enabled && !triggeredIds.has(m.id))
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
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));

  return details;
}

export function getSessionBySlug(slug: string): { session: GameSessionDetails; slug: string; narrative?: string } | undefined {
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
    .all(row.session_id) as { id: string; puzzle_id: string | null; title: string; description: string | null; solution: string | null; status: string; display_order: number; hints: string | null }[];
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
    `SELECT b.*, g.name AS game_name, g.name AS room_name, 0 AS conflict
     FROM bookings b
     JOIN games g ON g.id = b.game_id
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
  const operator = findOperatorById(operatorId);
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
      `SELECT b.*, g.name AS game_name, g.name AS room_name
       FROM bookings b
       JOIN games g ON g.id = b.game_id
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
      if (current.game_id !== other.game_id) continue;
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
  const game = getGameDetails(details.gameId);
  const roomConfig = game?.roomDisplayConfig;

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
      sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running' WHERE id = ?`).run(sessionId);
      logToDatabase('info', 'session', 'Timer started', {
        sessionId,
        gameName: session.gameName,
        roomName: session.roomName
      });
      break;
    case 'pause_timer':
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
      break;
    case 'resume_timer':
      sqlite.prepare(`UPDATE sessions SET timer_status = 'running', status = 'running' WHERE id = ?`).run(sessionId);
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
               timer_total_elapsed_seconds = ?
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
      const assetUrl = command.payload?.assetUrl ? String(command.payload.assetUrl) : null;
      const volumeLevel = command.payload?.volumeLevel ? Number(command.payload.volumeLevel) : null;
      const puzzleId = command.payload?.puzzleId ? String(command.payload.puzzleId) : null;
      const displayDurationSeconds = command.payload?.displayDurationSeconds ? Number(command.payload.displayDurationSeconds) : undefined;
      const loop = command.payload?.loop ? Boolean(command.payload.loop) : false;
      const loopCount = command.payload?.loopCount ? Number(command.payload.loopCount) : undefined;

      // Store hint in session_hints
      sqlite.prepare(`
        INSERT INTO session_hints
        (id, session_id, puzzle_id, type, message, asset_url, volume_level, delivered_by, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `hint-${Date.now()}`,
        sessionId,
        puzzleId,
        medium,
        message,
        assetUrl,
        volumeLevel,
        'Console Operator',
        nowIso
      );

      // Only increment hints_used if countAsHint is not explicitly false (defaults to true)
      const countAsHint = command.payload?.countAsHint !== false;
      if (countAsHint) {
        sqlite.prepare(`UPDATE sessions SET hints_used = hints_used + 1 WHERE id = ?`).run(sessionId);
      }

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
          textHintColors: medium === 'text' ? {
            textColor: game?.roomDisplayConfig?.textHintTextColor ?? '#000000',
            backgroundColor: game?.roomDisplayConfig?.textHintBackgroundColor ?? '#FFA500'
          } : undefined
        });
      }

      logToDatabase('info', 'session', `Hint sent: ${message.substring(0, 50)}`, {
        sessionId,
        gameName: session.gameName,
        medium,
        hasAsset: !!assetUrl
      });

      evaluateAlertRules('hint_sent', { sessionId, gameName: session.gameName });
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
    case 'trigger_milestone': {
      const milestoneId = String(command.payload?.milestoneId ?? '').trim();
      if (!milestoneId) {
        throw new Error('Milestone ID required');
      }

      // Get milestone details
      const milestone = sqlite.prepare('SELECT * FROM game_milestones WHERE id = ?').get(milestoneId) as GameMilestoneRow | undefined;
      if (!milestone) {
        throw new Error('Milestone not found');
      }

      // Check if already triggered
      const alreadyTriggered = sqlite.prepare(
        'SELECT id FROM session_milestones WHERE session_id = ? AND milestone_id = ?'
      ).get(sessionId, milestoneId);

      if (alreadyTriggered) {
        throw new Error('Milestone already triggered');
      }

      const assetUrl = milestone.asset_id ? `/api/assets/${milestone.asset_id}` : null;

      // Insert milestone trigger record
      sqlite.prepare(`
        INSERT INTO session_milestones (
          id, session_id, milestone_id, milestone_type, milestone_name,
          media_type, content, asset_url, volume_level, triggered_at, triggered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
        command.payload?.operatorId ?? null
      );

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
          textHintColors: milestone.media_type === 'text' ? {
            textColor: game?.roomDisplayConfig?.textHintTextColor ?? '#000000',
            backgroundColor: game?.roomDisplayConfig?.textHintBackgroundColor ?? '#FFA500'
          } : undefined
        });
      }

      logToDatabase('info', 'session', `Milestone triggered: ${milestone.name}`, {
        sessionId,
        gameName: session.gameName,
        milestoneType: milestone.type
      });
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

// ============================================================================
// RBAC MANAGEMENT
// ============================================================================
// MIGRATED to ./state/operators/roles.svelte.ts
// Import from: import { listRoles, getRoleById, createRole, updateRole, updateRolePermissions, deleteRole, listPermissions, getPermissionMatrix } from './state/index.js';

// Start the ticker - runs every 1000ms (1 second)
export const timerInterval = setInterval(tickTimers, 1000);

console.log("[Timer Ticker] Started - running every 1 second");
