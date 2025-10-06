/**
 * Games state management types
 *
 * This module defines types for game operations including:
 * - Game creation, updating, and deletion
 * - Game puzzle and hint management
 * - Game milestone and trigger configuration
 * - Game pricing and booking rules
 * - Game media and camera configuration
 */

import type {
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
  MilestoneTriggerType
} from '@escapeplan/contracts';
import type { AuditMetadata, ArchiveMetadata } from '../shared/types.js';

// Use imported types to avoid unused import warnings
type _AuditMetadata = AuditMetadata;
type _ArchiveMetadata = ArchiveMetadata;

/**
 * Re-export contract types for convenience
 */
export type {
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
  MilestoneTriggerType
};

/**
 * Database row representation of a game
 */
export interface GameRow {
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
}

/**
 * Database row representation of a game puzzle
 */
export interface GamePuzzleRow {
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
}

/**
 * Database row representation of a game milestone
 */
export interface GameMilestoneRow {
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
}

/**
 * Filters for listing games
 */
export interface GameListFilters {
  search?: string;
  status?: 'active' | 'archived' | 'all';
  category?: string;
}

/**
 * Game with full details including puzzles and milestones
 */
export interface GameWithDetails extends GameDetails {
  puzzles: GamePuzzleDefinition[];
  milestones: GameMilestone[];
}

/**
 * Game summary for list views
 */
export interface GameSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  gameType: string;
  minPlayers: number;
  maxPlayers: number;
  archived: boolean;
}

/**
 * Game archive operation request
 */
export interface ArchiveGameRequest {
  gameId: string;
  actorId: string;
  reason?: string | null;
}

/**
 * Game operation errors
 */
export enum GameErrorCode {
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  GAME_ARCHIVED = 'GAME_ARCHIVED',
  INVALID_GAME_DATA = 'INVALID_GAME_DATA',
  SLUG_CONFLICT = 'SLUG_CONFLICT',
  PUZZLE_NOT_FOUND = 'PUZZLE_NOT_FOUND',
  MILESTONE_NOT_FOUND = 'MILESTONE_NOT_FOUND',
  ACTIVE_SESSIONS_EXIST = 'ACTIVE_SESSIONS_EXIST',
}

export interface GameError {
  code: GameErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
