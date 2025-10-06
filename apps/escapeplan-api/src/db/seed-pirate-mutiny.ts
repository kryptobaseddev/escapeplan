/**
 * Pirate Mutiny Game Seed Script
 *
 * This standalone seed script creates the Pirate Mutiny game with all puzzles.
 * It is idempotent and safe to run multiple times.
 *
 * Usage:
 *   tsx src/db/seed-pirate-mutiny.ts
 *   node dist/db/seed-pirate-mutiny.js
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from './client.ts';

const db = sqlite;

/**
 * Seeds the Pirate Mutiny game with all puzzles.
 * Idempotent - safe to run multiple times.
 */
export async function seedPirateMutiny(): Promise<void> {
  console.log('[Seed:PirateMutiny] Starting Pirate Mutiny game seed...');

  // ============================================================================
  // SEED PIRATE MUTINY GAME
  // ============================================================================

  const pirateGameId = randomUUID();
  const pirateGame = {
    id: pirateGameId,
    slug: 'pirate-mutiny',
    name: 'Pirate Mutiny',
    description:
      "The Captain has decided to keep 90% of the treasure when you find it. This is unacceptable! You break into his quarters while he is out in search for the treasure map. Once the map is yours, you can make the captain walk the plank and claim the entire treasure for yourself!",
    story_intro:
      'The Captain has decided to keep 90% of the treasure. This is unacceptable—recover the map and make the captain walk the plank.',
    duration_minutes: 20,
    difficulty: 'Medium', // 3/5 difficulty
    game_type: 'storefront',
    pricing_model: 'PER_PERSON',
    categories: JSON.stringify(['Person', 'Private']),
    min_players: 1,
    max_players: 5,
    price_per_player_cents: 2000, // $20 per player
    resources_required: 1,
    validation_notes: 'participants within game min/max; resource availability; room free in window.',
    default_volume: 80,
    camera_ids: JSON.stringify([]),
    pricing_config: JSON.stringify({
      tiers: [
        {
          name: 'Standard',
          model: 'PER_PERSON',
          base_price_cents: 2000, // $20 per player
          min_players: 1,
          max_players: 5
        }
      ]
    })
  };

  // Check if game already exists
  const existingGame = db
    .prepare('SELECT id, slug FROM games WHERE slug = ? LIMIT 1')
    .get(pirateGame.slug) as { id: string; slug: string } | undefined;

  let gameId: string;

  if (!existingGame) {
    console.log('[Seed:PirateMutiny] Creating Pirate Mutiny game...');

    try {
      db.prepare(
        `INSERT INTO games (
          id, slug, name, description, story_intro, duration_minutes, difficulty,
          game_type, pricing_model, category, categories, min_players, max_players,
          price_per_player_cents, resources_required, validation_notes, default_volume,
          camera_ids, pricing_config,
          created_at, updated_at
        )
        VALUES (
          @id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty,
          @game_type, @pricing_model, @category, @categories, @min_players, @max_players,
          @price_per_player_cents, @resources_required, @validation_notes, @default_volume,
          @camera_ids, @pricing_config,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run({
        ...pirateGame,
        category: 'Private'
      });

      gameId = pirateGameId;
      console.log('[Seed:PirateMutiny] ✅ Pirate Mutiny game created successfully');
    } catch (error) {
      console.error('[Seed:PirateMutiny] ❌ Error creating Pirate Mutiny game:', error);
      throw error;
    }
  } else {
    console.log('[Seed:PirateMutiny] Game already exists (id: ' + existingGame.id + '), skipping game creation');
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
      display_order: 1,
      slug: 'intro-audio'
    },
    {
      id: puzzleIds[1],
      title: 'Find map',
      description: "Break into the captain's desk and recover the treasure map.",
      solution: 'Identify map cache and retrieve scroll.',
      operator_actions: 'Ready map reveal lighting.',
      display_order: 2,
      slug: 'find-map'
    },
    {
      id: puzzleIds[2],
      title: 'Skulls',
      description: 'Line up the 5 skulls biggest to smallest as suggested by the "HEAD SHRINKER" on the treasure box.',
      solution: '84639',
      operator_actions: 'Verify magnet lock releases.',
      display_order: 3,
      slug: 'skulls'
    },
    {
      id: puzzleIds[3],
      title: 'Helms',
      description: 'Turn the 3 helms to the correct positions as indicated on the telescope, gun, and something else.',
      solution: 'Maglock - opens Captain Portrait',
      operator_actions: 'Confirm portrait release actuates.',
      display_order: 4,
      slug: 'helms'
    },
    {
      id: puzzleIds[4],
      title: 'Kraken',
      description: 'Place 4 blocks into the kraken picture.',
      solution: 'Opens Kraken',
      operator_actions: 'Monitor kraken panel for full closure.',
      display_order: 5,
      slug: 'kraken'
    },
    {
      id: puzzleIds[5],
      title: 'Swords',
      description: 'Two people hold the swords to make a secret compartment open up.',
      solution: 'Hold swords - box opens to reveal the last chess pieces',
      operator_actions: 'Ensure sword contact sensors register.',
      display_order: 6,
      slug: 'swords'
    },
    {
      id: puzzleIds[6],
      title: 'Map/Chess',
      description: 'Use the scanner on the map to find 5 grid spots that light up. Put the chess pieces on the chessboard in those spots.',
      solution: 'F4, C5, G7, B3, D2 - opens drawer in desk',
      operator_actions: 'Prepare drawer release and monitor camera.',
      display_order: 7,
      slug: 'map-chess'
    },
    {
      id: puzzleIds[7],
      title: 'Dice',
      description: 'Colored dice will open the lock on the music box. Combine colors to make purple and green by adding the dice.',
      solution: 'not sure yet',
      operator_actions: 'Reset dice positions post-game.',
      display_order: 8,
      slug: 'dice'
    },
    {
      id: puzzleIds[8],
      title: 'Music',
      description: 'Push the button on the little box in the drawer to play a sound. Match the sound on the box to open it.',
      solution: 'Notes: 3,5,4,2,1',
      operator_actions: 'Check drive mechanism when resetting.',
      display_order: 9,
      slug: 'music'
    }
  ];

  // Check if puzzles already exist for this game
  const existingPuzzles = db
    .prepare('SELECT COUNT(*) as count FROM game_puzzles WHERE game_id = ?')
    .get(gameId) as { count: number };

  if (existingPuzzles.count === 0) {
    console.log('[Seed:PirateMutiny] Creating game puzzles...');

    try {
      const insertPuzzle = db.prepare(
        `INSERT INTO game_puzzles (id, game_id, title, description, solution, media_asset, operator_actions, display_order, slug)
         VALUES (@id, @game_id, @title, @description, @solution, NULL, @operator_actions, @display_order, @slug)`
      );

      for (const puzzle of piratePuzzles) {
        insertPuzzle.run({
          id: puzzle.id,
          game_id: gameId,
          title: puzzle.title,
          description: puzzle.description,
          solution: puzzle.solution,
          operator_actions: puzzle.operator_actions,
          display_order: puzzle.display_order,
          slug: puzzle.slug
        });
      }

      console.log(`[Seed:PirateMutiny] ✅ Created ${piratePuzzles.length} game puzzles successfully`);
    } catch (error) {
      console.error('[Seed:PirateMutiny] ❌ Error creating game puzzles:', error);
      throw error;
    }
  } else {
    console.log(`[Seed:PirateMutiny] Game already has ${existingPuzzles.count} puzzles, skipping puzzle creation`);
  }

  console.log('[Seed:PirateMutiny] ✅ Pirate Mutiny game seeded successfully\n');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await seedPirateMutiny();
      console.log('[Seed:PirateMutiny] Done!');
      process.exit(0);
    } catch (error) {
      console.error('[Seed:PirateMutiny] Fatal error:', error);
      process.exit(1);
    }
  })();
}
