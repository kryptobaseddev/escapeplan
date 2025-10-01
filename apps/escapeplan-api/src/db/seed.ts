import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth } from '../auth.ts';
import { runMigrations, sqlite } from './client.ts';
import { permissionsForRole } from '../security.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(`${rootDir}/../../data`, { recursive: true });

await runMigrations();

const db = sqlite;

const pirateGame = {
  id: 'game-pirate-mutany',
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
    id: 'gpz-pirate-1',
    title: 'Intro Audio',
    description: 'Launch the intro audio to set the mission briefing.',
    solution: 'Trigger the intro audio sequence from the console.',
    operator_actions: 'Confirm audio plays cleanly in-room.',
    display_order: 1
  },
  {
    id: 'gpz-pirate-2',
    title: 'Find map',
    description: "Break into the captain's desk and recover the treasure map.",
    solution: 'Identify map cache and retrieve scroll.',
    operator_actions: 'Ready map reveal lighting.',
    display_order: 2
  },
  {
    id: 'gpz-pirate-3',
    title: 'Skulls',
    description: 'Line up the shrinking skulls from largest to smallest.',
    solution: 'Arrange skull sequence 8-4-6-3-9 per clue.',
    operator_actions: 'Verify magnet lock releases.',
    display_order: 3
  },
  {
    id: 'gpz-pirate-4',
    title: 'Helms',
    description: 'Set the helms according to telescope, gun, and compass clues.',
    solution: 'Dial helm positions to match instrument bearings.',
    operator_actions: 'Confirm portrait release actuates.',
    display_order: 4
  },
  {
    id: 'gpz-pirate-5',
    title: 'Kraken',
    description: 'Place the four blocks into the kraken relief.',
    solution: 'Insert blocks matching tentacle outlines.',
    operator_actions: 'Monitor kraken panel for full closure.',
    display_order: 5
  },
  {
    id: 'gpz-pirate-6',
    title: 'Swords',
    description: 'Coordinate two players to hold the swords simultaneously.',
    solution: 'Hold both swords steady to open secret compartment.',
    operator_actions: 'Ensure sword contact sensors register.',
    display_order: 6
  },
  {
    id: 'gpz-pirate-7',
    title: 'Map/Chess',
    description: 'Scan the map to illuminate grid locations and place chess pieces accordingly.',
    solution: 'Positions F4, C5, G7, B3, D2 unlock the desk drawer.',
    operator_actions: 'Prepare drawer release and monitor camera.',
    display_order: 7
  },
  {
    id: 'gpz-pirate-8',
    title: 'Dice',
    description: 'Combine colored dice to create purple and green for the music box lock.',
    solution: 'Add dice values to reach color combinations for lock code.',
    operator_actions: 'Reset dice positions post-game.',
    display_order: 8
  },
  {
    id: 'gpz-pirate-9',
    title: 'Music',
    description: 'Match the sound sequence on the music box.',
    solution: 'Notes sequence 3,5,4,2,1 opens the box.',
    operator_actions: 'Check drive mechanism when resetting.',
    display_order: 9
  }
];

const clearAll = db.transaction(() => {
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
    'network_health'
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

clearAll();

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

const existingAdmin = await adapter.findUserByEmail(adminEmail, { includeAccounts: true });
let adminId: string;

const hashedPassword = await authContext.password.hash('escapeplan');
// Generate default avatar config based on username
const defaultAvatarConfig = {
  seed: 'admin',
  eyes: ['happy'],
  mouth: ['smile01']
};

// Better-Auth with Drizzle mode: 'json' automatically stringifies objects/arrays
// So pass permissions and avatar_config directly as objects, not JSON strings
const adminProfileUpdates = {
  ...adminBaseProfile,
  permissions: adminPermissions,
  passwordHash: hashedPassword,
  image: defaultAvatarConfig
};

if (!existingAdmin) {
  const adminUser = await adapter.createUser({
    email: adminEmail,
    ...adminBaseProfile,
    passwordHash: hashedPassword,
    image: defaultAvatarConfig
  });
  adminId = adminUser.id;

  // Update permissions after creation
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
  adminId = existingAdmin.user.id;
  await adapter.updatePassword(adminId, hashedPassword);
  await adapter.updateUser(adminId, adminProfileUpdates);
}

db.prepare(
  `INSERT INTO games (id, slug, name, description, story_intro, duration_minutes, difficulty, pricing_model, category, categories, min_players, max_players, price_per_player_cents, resources_required, validation_notes, created_at, updated_at)
   VALUES (@id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty, @pricing_model, @category, @categories, @min_players, @max_players, @price_per_player_cents, @resources_required, @validation_notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
).run({
  ...pirateGame,
  category: 'Private'
});

db.prepare(
  `INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token)
   VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token)`
).run({
  id: 'room-main',
  game_id: pirateGame.id,
  name: 'Main',
  is_mobile_capable: 0,
  theme_token: 'escapeplan-pirate'
});

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

db.prepare(
  `INSERT INTO network_profiles (id, name, ssid, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
   VALUES ('primary', 'EscapePlan Control Network', 'escapeplan_net', 'Primary operator network and broadcast SSID for in-room displays.', '5GHz/2.4GHz', 36, 'WPA2-PSK', 1, 'offline', 'Awaiting first health check from Pi appliance.', NULL, CURRENT_TIMESTAMP)`
).run();

console.log('EscapePlan database initialised with core admin and Pirate Mutany profile.');
