/**
 * Games domain state management
 *
 * This module provides game CRUD operations using a class-based state pattern
 * inspired by Svelte 5 runes. All functions maintain existing behavior from
 * the original state.ts implementation.
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../../db/client.js';
import type {
  GameDetails,
  GamePuzzleDefinition,
  GameHintDefinition,
  GameMediaConfig,
  GamePricingConfig,
  GameBookingRules,
  GameMilestone,
  GameMilestoneTriggerConfig,
  MilestoneMediaType,
  MilestoneType,
  MilestoneTriggerType,
  SaveGameRequest
} from '@escapeplan/contracts';
import type {
  GameRow,
  GamePuzzleRow,
  GameMilestoneRow,
  GameListFilters
} from './types.js';

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

/**
 * Maps a database GameRow to a GameDetails domain object
 */
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

/**
 * Normalizes puzzle input data, ensuring IDs and display orders
 */
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

/**
 * Persists game puzzles to the database (upsert and delete orphaned)
 */
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

/**
 * Persists game milestones to the database (upsert and delete orphaned)
 */
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

/**
 * Class-based state management for games domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class GamesState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  games: GameDetails[] = [];
  selectedGame: GameDetails | undefined = undefined;

  /**
   * Lists all games with optional filters
   */
  listGameDetails(filters: GameListFilters = {}): GameDetails[] {
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

  /**
   * Gets a single game by ID
   */
  getGameDetails(gameId: string): GameDetails | undefined {
    const row = gameByIdStmt.get(gameId) as GameRow | undefined;
    if (!row) return undefined;
    return mapGameDetailsRow(row);
  }

  /**
   * Creates a new game
   */
  createGame(payload: SaveGameRequest): GameDetails {
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

    return this.getGameDetails(gameId)!;
  }

  /**
   * Updates an existing game
   */
  updateGame(gameId: string, payload: SaveGameRequest): GameDetails {
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

    const result = this.getGameDetails(gameId)!;
    console.log('[DEBUG] Game after update:', {
      id: result.id,
      media: result.media,
      roomDisplayConfig: result.roomDisplayConfig,
      puzzles: result.puzzles.map(p => ({ id: p.id, title: p.title, hintsCount: p.hints?.length || 0 }))
    });

    return result;
  }

  /**
   * Deletes a game and all its relations
   */
  deleteGame(gameId: string): void {
    persistGameRelations(gameId, []);
    sqlite.prepare(`DELETE FROM games WHERE id = ?`).run(gameId);
  }

  /**
   * Archives a game
   */
  archiveGame(gameId: string, actorId: string, reason?: string | null): GameDetails {
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

    const details = this.getGameDetails(gameId);
    if (!details) {
      throw new Error('Unable to load archived game');
    }
    return details;
  }

  /**
   * Unarchives a game
   */
  unarchiveGame(gameId: string): GameDetails {
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

    const details = this.getGameDetails(gameId);
    if (!details) {
      throw new Error('Unable to load restored game');
    }
    return details;
  }
}

/**
 * Singleton instance of the games state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const gamesState = new GamesState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const listGameDetails = (filters?: GameListFilters) => gamesState.listGameDetails(filters);
export const getGameDetails = (gameId: string) => gamesState.getGameDetails(gameId);
export const createGame = (payload: SaveGameRequest) => gamesState.createGame(payload);
export const updateGame = (gameId: string, payload: SaveGameRequest) => gamesState.updateGame(gameId, payload);
export const deleteGame = (gameId: string) => gamesState.deleteGame(gameId);
export const archiveGame = (gameId: string, actorId: string, reason?: string | null) => gamesState.archiveGame(gameId, actorId, reason);
export const unarchiveGame = (gameId: string) => gamesState.unarchiveGame(gameId);

/**
 * Export helper functions that may be used by other modules
 */
export { mapGameDetailsRow, normalizePuzzleInput, persistGameRelations, persistGameMilestones };

/**
 * Re-export types for convenience
 */
export type { GameListFilters } from './types.js';
