import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth } from '../auth.ts';
import { sqlite } from './client.ts';
import { initializeSchema } from './init.ts';
import { permissionsForRole } from '../security.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(`${rootDir}/../../data`, { recursive: true });

// Initialize schema (idempotent - safe to call multiple times)
initializeSchema();

const db = sqlite;

// Generate stable UUIDs for seed data
const pirateGameId = randomUUID();
const roomMainId = randomUUID();
const puzzleIds = Array.from({ length: 9 }, () => randomUUID());

const pirateGame = {
  id: pirateGameId,
  slug: 'pirate-mutany',
  name: 'Pirate Mutany',
  description:
    "Break into the captain's quarters, recover the map, and claim the treasure before the crew returns.",
  story_intro:
    'The Captain has decided to keep 90% of the treasure. This is unacceptable—recover the map and make the captain walk the plank.',
  duration_minutes: 20,
  difficulty: '3/5',
  pricing_model: 'PER_PERSON',
  categories: JSON.stringify(['Person', 'Private']),
  min_players: 1,
  max_players: 5,
  price_per_player_cents: 2000,
  resources_required: 1,
  validation_notes: 'Enforce min/max participants, confirm resource availability, ensure room availability in booking window.'
};

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

/**
 * WARNING: Deletes all data from all tables.
 * Only use this when you explicitly want to reset the database.
 */
export const clearAll = db.transaction(() => {
  const tables = [
    'session_hints',
    'session_puzzles',
    'timer_slugs',
    'sessions',
    'bookings',
    'game_puzzles',
    'rooms',
    'games',
    'operator_auth_sessions',
    'operator_accounts',
    'operator_verifications',
    'operators',
    'network_profiles',
    'network_health',
    'alerts',
    'system_logs'
  ];
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such table')) {
        continue;
      }
      throw error;
    }
  }
});

/**
 * Idempotent seed function - safe to run multiple times.
 * Only creates data that doesn't already exist.
 */
export async function seedIdempotent() {
  const authContext = await auth.$context;
  const adapter = authContext.internalAdapter;

  const adminEmail = 'admin@escapeplan.local';
  const adminPermissions = permissionsForRole('admin');
  const adminBio = 'Primary EscapePlan appliance administrator.';
  const adminBaseProfile = {
    name: 'System Administrator',
    username: 'admin',
    role: 'admin',
    bio: adminBio,
    mustResetPassword: false,
    emailVerified: true
  };

  // Seed admin user (idempotent)
  const existingAdmin = await adapter.findUserByEmail(adminEmail, { includeAccounts: true });
  let adminId: string;

  const hashedPassword = await authContext.password.hash('escapeplan');
  const defaultAvatarConfig = {
    seed: 'admin',
    eyes: ['happy'],
    mouth: ['smile01']
  };

  const adminProfileUpdates = {
    ...adminBaseProfile,
    permissions: adminPermissions,
    passwordHash: hashedPassword,
    image: JSON.stringify(defaultAvatarConfig) // Better Auth expects string, we stringify for compatibility
  };

  if (!existingAdmin) {
    console.log('Creating admin user...');
    const adminUser = await adapter.createUser({
      email: adminEmail,
      ...adminBaseProfile,
      passwordHash: hashedPassword,
      image: JSON.stringify(defaultAvatarConfig) // Better Auth expects string, we stringify for compatibility
    }) as any;
    adminId = adminUser.id;

    await adapter.updateUser(adminId, {
      permissions: adminPermissions
    });

    await adapter.createAccount({
      userId: adminId,
      providerId: 'credential',
      accountId: adminId,
      password: hashedPassword
    });
  } else {
    console.log('Admin user already exists, updating password and permissions...');
    adminId = existingAdmin.user.id;
    await adapter.updatePassword(adminId, hashedPassword);
    await adapter.updateUser(adminId, adminProfileUpdates);
  }

  // Seed game (idempotent)
  const existingGame = db.prepare('SELECT id FROM games WHERE id = ?').get(pirateGame.id);
  if (!existingGame) {
    console.log('Creating Pirate Mutany game...');
    db.prepare(
      `INSERT INTO games (id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories, min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at)
       VALUES (@id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty, @pricing_model, @category, @categories, @min_players, @max_players, @price_per_player_cents, @resources_required, @validation_notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run({
      ...pirateGame,
      category: 'Private'
    });
  } else {
    console.log('Pirate Mutany game already exists, skipping...');
  }

  // Seed room (idempotent)
  const existingRoom = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomMainId);
  if (!existingRoom) {
    console.log('Creating Main room...');
    db.prepare(
      `INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token)
       VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token)`
    ).run({
      id: roomMainId,
      game_id: pirateGame.id,
      name: 'Main',
      is_mobile_capable: 0,
      theme_token: 'escapeplan-pirate'
    });
  } else {
    console.log('Main room already exists, skipping...');
  }

  // Seed puzzles (idempotent)
  const existingPuzzles = db.prepare('SELECT COUNT(*) as count FROM game_puzzles WHERE game_id = ?').get(pirateGame.id) as { count: number };
  if (existingPuzzles.count === 0) {
    console.log('Creating game puzzles...');
    const insertPuzzle = db.prepare(
      `INSERT INTO game_puzzles (id, game_id, title, description, solution, media_asset, operator_actions, display_order)
       VALUES (@id, @game_id, @title, @description, @solution, NULL, @operator_actions, @display_order)`
    );
    for (const puzzle of piratePuzzles) {
      insertPuzzle.run({
        id: puzzle.id,
        game_id: pirateGame.id,
        title: puzzle.title,
        description: puzzle.description,
        solution: puzzle.solution,
        operator_actions: puzzle.operator_actions,
        display_order: puzzle.display_order
      });
    }
  } else {
    console.log(`Game already has ${existingPuzzles.count} puzzles, skipping...`);
  }

  // Seed network profile (idempotent)
  const existingNetwork = db.prepare('SELECT id FROM network_profiles WHERE id = ?').get('primary');
  if (!existingNetwork) {
    console.log('Creating network profile...');
    db.prepare(
      `INSERT INTO network_profiles (id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
       VALUES ('primary', 'EscapePlan Control Network', 'escapeplan_net', 'escape2024', 'Primary operator network and broadcast SSID for in-room displays.', '5GHz/2.4GHz', 36, 'WPA2-PSK', 1, 'offline', 'Awaiting first health check from Pi appliance.', NULL, CURRENT_TIMESTAMP)`
    ).run();
  } else {
    console.log('Network profile already exists, skipping...');
  }

  // Seed alert rules (already idempotent with INSERT OR REPLACE)
  console.log('Seeding alert rules (INSERT OR REPLACE)...');
  const alertRules = [
    {
      id: 'game_paused',
      name: 'game_paused',
      description: 'Alert when a game timer is paused',
      category: 'timer',
      level: 'warning',
      enabled: 1,
      conditions: JSON.stringify({ event: 'timer_paused' }),
      title_template: '⏸ Game Paused',
      message_template: '{{gameName}} ({{roomName}}) paused at {{time}}',
      auto_dismiss_on: JSON.stringify(['timer_resume', 'session_complete'])
    },
    {
      id: 'low_time',
      name: 'low_time',
      description: 'Alert when timer drops below 5 minutes',
      category: 'timer',
      level: 'warning',
      enabled: 1,
      conditions: JSON.stringify({
        event: 'timer_tick',
        threshold: { remaining_seconds: { lt: 300 } }
      }),
      title_template: '⏱ Low Time Remaining',
      message_template: '{{gameName}} has less than 5 minutes remaining',
      auto_dismiss_on: JSON.stringify(['session_complete'])
    },
    {
      id: 'excessive_hints',
      name: 'excessive_hints',
      description: 'Alert when 3+ hints sent in 5 minutes',
      category: 'hint',
      level: 'warning',
      enabled: 1,
      conditions: JSON.stringify({
        event: 'hint_sent',
        threshold: { count: 3, window_minutes: 5 }
      }),
      title_template: '🔔 Excessive Hints',
      message_template: '{{gameName}}: {{count}} hints in {{window_minutes}} minutes',
      auto_dismiss_on: null
    },
    {
      id: 'network_offline',
      name: 'network_offline',
      description: 'Alert when network status changes to offline',
      category: 'network',
      level: 'critical',
      enabled: 1,
      conditions: JSON.stringify({
        event: 'network_status_change',
        threshold: { status: 'offline' }
      }),
      title_template: '🔴 Network Offline',
      message_template: 'Network controller offline - check connectivity',
      auto_dismiss_on: JSON.stringify(['network_online'])
    }
  ];

  const insertAlertRule = db.prepare(
    `INSERT OR REPLACE INTO alert_rules (id, name, description, category, level, enabled, conditions, title_template, message_template, auto_dismiss_on, created_at, updated_at)
     VALUES (@id, @name, @description, @category, @level, @enabled, @conditions, @title_template, @message_template, @auto_dismiss_on, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  );

  for (const rule of alertRules) {
    insertAlertRule.run(rule);
  }

  console.log('✅ EscapePlan database seeded successfully (idempotent mode)');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--clear')) {
    console.log('⚠️  WARNING: Clearing all database tables...');
    clearAll();
    console.log('✅ Database cleared.');
  }

  await seedIdempotent();
  process.exit(0);
}
