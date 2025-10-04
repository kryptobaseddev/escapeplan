/**
 * Demo Fixtures Seed - Pirate Mutiny Game (Development Only)
 *
 * This seed file populates demonstration data for development and testing environments.
 * It is automatically skipped in production environments using runtime detection.
 *
 * Data included:
 * - Pirate Mutiny game (escape room scenario)
 * - 9 game puzzles (linked to the Pirate Mutiny game)
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../client.ts';
import { runtime } from '@escapeplan/contracts/runtime';

const db = sqlite;

/**
 * Seeds demonstration game data for development and testing.
 *
 * This function is environment-aware and will skip execution in production.
 * It is idempotent and safe to run multiple times - existing data will not be duplicated.
 *
 * @returns Promise<void>
 * @throws Error if database operations fail (non-production environments only)
 */
export async function seedDemoFixtures(): Promise<void> {
  try {
    // Skip demo data in production
    if (runtime.isProduction) {
      console.log('[Seed:Demo] Skipping demo fixtures in production environment\n');
      return;
    }

    console.log('[Seed:Demo] Starting demo fixtures seeding (development only)...');

    // ============================================================================
    // SEED PIRATE MUTINY GAME
    // ============================================================================

    const pirateGameId = randomUUID();
    const pirateGame = {
      id: pirateGameId,
      slug: 'pirate-mutiny',
      name: 'Pirate Mutiny',
      description:
        "Break into the captain's quarters, recover the map, and claim the treasure before the crew returns.",
      story_intro:
        'The Captain has decided to keep 90% of the treasure. This is unacceptable—recover the map and make the captain walk the plank.',
      duration_minutes: 20,
      difficulty: 'Medium',
      game_type: 'storefront',
      pricing_model: 'PER_PERSON',
      categories: JSON.stringify(['Person', 'Private']),
      min_players: 1,
      max_players: 5,
      price_per_player_cents: 2000,
      resources_required: 1,
      validation_notes: 'Enforce min/max participants, confirm resource availability, ensure booking window.',
      default_volume: 80
    };

    // Check if game already exists
    const existingGame = db
      .prepare('SELECT id, slug FROM games WHERE slug = ? LIMIT 1')
      .get(pirateGame.slug) as { id: string; slug: string } | undefined;

    let gameId: string;

    if (!existingGame) {
      console.log('[Seed:Demo] Creating Pirate Mutiny game...');

      try {
        db.prepare(
          `INSERT INTO games (
            id, slug, name, description, story_intro, duration_minutes, difficulty,
            game_type, pricing_model, category, categories, min_players, max_players,
            price_per_player_cents, resources_required, validation_notes, default_volume,
            created_at, updated_at
          )
          VALUES (
            @id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty,
            @game_type, @pricing_model, @category, @categories, @min_players, @max_players,
            @price_per_player_cents, @resources_required, @validation_notes, @default_volume,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`
        ).run({
          ...pirateGame,
          category: 'Private'
        });

        gameId = pirateGameId;
        console.log('[Seed:Demo] Pirate Mutiny game created successfully');
      } catch (error) {
        console.error('[Seed:Demo] Error creating Pirate Mutiny game:', error);
        throw error;
      }
    } else {
      console.log('[Seed:Demo] Pirate Mutiny game already exists, skipping game creation');
      gameId = existingGame.id;
    }

    // ============================================================================
    // SEED GAME PUZZLES
    // ============================================================================

    const puzzleIds = [
      'puzzle-pirate-intro-audio',
      'puzzle-pirate-find-map',
      'puzzle-pirate-skulls',
      'puzzle-pirate-helms',
      'puzzle-pirate-kraken',
      'puzzle-pirate-swords',
      'puzzle-pirate-map-chess',
      'puzzle-pirate-dice',
      'puzzle-pirate-music'
    ];

    const piratePuzzles = [
      {
        id: puzzleIds[0],
        title: 'Intro Audio',
        description: 'Launch the intro audio to set the mission briefing.',
        solution: 'Trigger the intro audio sequence from the console.',
        operator_actions: 'Confirm audio plays cleanly in-room.',
        display_order: 1
      },
      {
        id: puzzleIds[1],
        title: 'Find map',
        description: "Break into the captain's desk and recover the treasure map.",
        solution: 'Identify map cache and retrieve scroll.',
        operator_actions: 'Ready map reveal lighting.',
        display_order: 2
      },
      {
        id: puzzleIds[2],
        title: 'Skulls',
        description: 'Line up the shrinking skulls from largest to smallest.',
        solution: 'Arrange skull sequence 8-4-6-3-9 per clue.',
        operator_actions: 'Verify magnet lock releases.',
        display_order: 3
      },
      {
        id: puzzleIds[3],
        title: 'Helms',
        description: 'Set the helms according to telescope, gun, and compass clues.',
        solution: 'Dial helm positions to match instrument bearings.',
        operator_actions: 'Confirm portrait release actuates.',
        display_order: 4
      },
      {
        id: puzzleIds[4],
        title: 'Kraken',
        description: 'Place the four blocks into the kraken relief.',
        solution: 'Insert blocks matching tentacle outlines.',
        operator_actions: 'Monitor kraken panel for full closure.',
        display_order: 5
      },
      {
        id: puzzleIds[5],
        title: 'Swords',
        description: 'Coordinate two players to hold the swords simultaneously.',
        solution: 'Hold both swords steady to open secret compartment.',
        operator_actions: 'Ensure sword contact sensors register.',
        display_order: 6
      },
      {
        id: puzzleIds[6],
        title: 'Map/Chess',
        description: 'Scan the map to illuminate grid locations and place chess pieces accordingly.',
        solution: 'Positions F4, C5, G7, B3, D2 unlock the desk drawer.',
        operator_actions: 'Prepare drawer release and monitor camera.',
        display_order: 7
      },
      {
        id: puzzleIds[7],
        title: 'Dice',
        description: 'Combine colored dice to create purple and green for the music box lock.',
        solution: 'Add dice values to reach color combinations for lock code.',
        operator_actions: 'Reset dice positions post-game.',
        display_order: 8
      },
      {
        id: puzzleIds[8],
        title: 'Music',
        description: 'Match the sound sequence on the music box.',
        solution: 'Notes sequence 3,5,4,2,1 opens the box.',
        operator_actions: 'Check drive mechanism when resetting.',
        display_order: 9
      }
    ];

    // Check if puzzles already exist for this game
    const existingPuzzles = db
      .prepare('SELECT COUNT(*) as count FROM game_puzzles WHERE game_id = ?')
      .get(gameId) as { count: number };

    if (existingPuzzles.count === 0) {
      console.log('[Seed:Demo] Creating game puzzles...');

      try {
        const insertPuzzle = db.prepare(
          `INSERT INTO game_puzzles (id, game_id, title, description, solution, media_asset, operator_actions, display_order)
           VALUES (@id, @game_id, @title, @description, @solution, NULL, @operator_actions, @display_order)`
        );

        for (const puzzle of piratePuzzles) {
          insertPuzzle.run({
            id: puzzle.id,
            game_id: gameId,
            title: puzzle.title,
            description: puzzle.description,
            solution: puzzle.solution,
            operator_actions: puzzle.operator_actions,
            display_order: puzzle.display_order
          });
        }

        console.log(`[Seed:Demo] Created ${piratePuzzles.length} game puzzles successfully`);
      } catch (error) {
        console.error('[Seed:Demo] Error creating game puzzles:', error);
        throw error;
      }
    } else {
      console.log(`[Seed:Demo] Game already has ${existingPuzzles.count} puzzles, skipping puzzle creation`);
    }

    console.log('[Seed:Demo] ✅ Demo fixtures seeded successfully\n');
  } catch (error) {
    console.error('[Seed:Demo] ❌ Fatal error during demo fixtures seeding:', error);
    throw error;
  }
}
