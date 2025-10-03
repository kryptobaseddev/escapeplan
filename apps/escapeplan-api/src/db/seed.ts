import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { auth } from '../auth.ts';
import { db as ormDb, sqlite } from './client.ts';
import { permissionsForRole, resolveRoleId } from '../security.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(`${rootDir}/../../data`, { recursive: true });

// Ensure migrations have been applied before seeding data
const migrationsPath = resolve(rootDir, '../../drizzle');

function ensureMigrationsApplied() {
  migrate(ormDb, { migrationsFolder: migrationsPath });
}

const db = sqlite;

// Stable identifiers keep the seed idempotent across runs
const pirateGameId = randomUUID();
const roomMainId = 'room-pirate-main';
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

const pirateGame = {
  id: pirateGameId,
  slug: 'pirate-mutiny',
  name: 'Pirate Mutiny',
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
  validation_notes: 'Enforce min/max participants, confirm resource availability, ensure room availability in booking window.',
  default_volume: 80
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
export const clearAll = () => {
  const tables = [
    'session_hints',
    'session_milestones',
    'session_puzzles',
    'timer_slugs',
    'sessions',
    'bookings',
    'game_milestones',
    'game_puzzles',
    'rooms',
    'asset_usage',
    'assets',
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
  db.exec('PRAGMA foreign_keys = OFF');
  const run = db.transaction(() => {
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
  run();
  db.exec('PRAGMA foreign_keys = ON');
};

/**
 * Idempotent seed function - safe to run multiple times.
 * Only creates data that doesn't already exist.
 */
export async function seedIdempotent() {
  ensureMigrationsApplied();

  // ============================================================================
  // SEED DATABASE-DRIVEN RBAC (Roles, Permissions, Role-Permissions)
  // ============================================================================

  console.log('Seeding RBAC system...');

  // Define permission labels and role mappings inline
  const PERMISSION_LABELS: Record<string, string> = {
    // Dashboard & Bookings
    view_dashboard: 'View dashboard and status widgets',
    view_bookings: 'View bookings calendar and manifests',
    manage_bookings: 'Create, modify, and cancel bookings',
    // Sessions & Games
    view_sessions: 'View active sessions',
    manage_sessions: 'Control live sessions and timers',
    view_games: 'View game library and details',
    manage_games: 'Edit game settings, puzzles, and rooms',
    // Network
    view_network: 'View network status and configuration',
    manage_network: 'Modify network and WiFi settings',
    // Users & RBAC
    view_users: 'View operator list',
    manage_users: 'Manage operator accounts',
    view_roles: 'View roles and their permissions',
    manage_roles: 'Create and modify custom roles',
    view_permissions: 'View all available permissions',
    manage_permissions: 'Assign permissions to roles',
    archive_users: 'Archive and restore operator accounts',
    // Assets & Storage
    view_assets: 'View media assets',
    manage_assets: 'Upload and manage media assets',
    view_storage: 'View storage usage and metrics',
    manage_storage: 'Delete assets and manage storage',
    // Cameras
    view_cameras: 'View camera feeds and status',
    manage_cameras: 'Add, configure, and remove cameras',
    // System & Logs
    view_system_logs: 'View system logs and audit trail',
    view_system_health: 'View system health and diagnostics',
    manage_system_health: 'Restart services and manage system',
    view_alert_rules: 'View alert rules',
    manage_alert_rules: 'Configure alert rules and thresholds'
  };

  const ROLE_PERM_MAP: Record<string, string[]> = {
    admin: Object.keys(PERMISSION_LABELS),
    manager: [
      'view_dashboard', 'view_bookings', 'manage_bookings',
      'view_sessions', 'manage_sessions', 'view_games', 'manage_games',
      'view_network',
      'view_users', 'manage_users',
      'view_assets', 'manage_assets', 'view_storage',
      'view_cameras', 'manage_cameras',
      'view_system_logs', 'view_system_health'
    ],
    game_master: [
      'view_dashboard', 'view_bookings',
      'view_sessions', 'manage_sessions', 'view_games',
      'view_cameras',
      'view_system_logs'
    ],
    customer: ['view_dashboard', 'view_bookings']
  };

  // 1. Seed 27 Permissions (idempotent)
  const permissionCategories: Record<string, string> = {
    view_dashboard: 'dashboard',
    view_bookings: 'bookings',
    manage_bookings: 'bookings',
    view_sessions: 'sessions',
    manage_sessions: 'sessions',
    view_games: 'games',
    manage_games: 'games',
    view_network: 'network',
    manage_network: 'network',
    view_users: 'users',
    manage_users: 'users',
    view_roles: 'rbac',
    manage_roles: 'rbac',
    view_permissions: 'rbac',
    manage_permissions: 'rbac',
    archive_users: 'users',
    view_assets: 'storage',
    manage_assets: 'storage',
    view_storage: 'storage',
    manage_storage: 'storage',
    view_cameras: 'cameras',
    manage_cameras: 'cameras',
    view_system_logs: 'system',
    view_system_health: 'system',
    manage_system_health: 'system',
    view_alert_rules: 'system',
    manage_alert_rules: 'system'
  };

  for (const [permName, permLabel] of Object.entries(PERMISSION_LABELS)) {
    const existing = db.prepare('SELECT id FROM permissions WHERE name = ?').get(permName);
    if (!existing) {
      const permId = `perm-${permName}`;
      db.prepare(`
        INSERT INTO permissions (id, name, label, category, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(permId, permName, permLabel, permissionCategories[permName] || 'system');
      console.log(`  ✅ Created permission: ${permName}`);
    }
  }

  // 2. Seed 4 System Roles (idempotent)
  const systemRoles = [
    { id: 'role-admin', name: 'admin', description: 'Full system access with all permissions' },
    { id: 'role-manager', name: 'manager', description: 'Manage games, bookings, sessions, users, and cameras' },
    { id: 'role-game-master', name: 'game_master', description: 'Run sessions, view games, and access cameras' },
    { id: 'role-customer', name: 'customer', description: 'View dashboard and bookings only' }
  ];

  for (const role of systemRoles) {
    const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(role.name);
    if (!existing) {
      db.prepare(`
        INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(role.id, role.name, role.description);
      console.log(`  ✅ Created role: ${role.name}`);
    }
  }

  // 3. Seed Role-Permission Mappings (idempotent)
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERM_MAP)) {
    const roleId = `role-${roleName.replace('_', '-')}`;

    for (const permName of permissionNames) {
      const permId = `perm-${permName}`;
      const existing = db.prepare(`
        SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?
      `).get(roleId, permId);

      if (!existing) {
        db.prepare(`
          INSERT INTO role_permissions (id, role_id, permission_id, granted_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(randomUUID(), roleId, permId);
      }
    }
    console.log(`  ✅ Mapped ${permissionNames.length} permissions to ${roleName}`);
  }

  console.log('✅ RBAC system seeded successfully\n');

  // ============================================================================
  // SEED ADMIN USER
  // ============================================================================

  const authContext = await auth.$context;
  const adapter = authContext.internalAdapter;

  const adminEmail = 'admin@escapeplan.local';
  const adminPermissions = permissionsForRole('admin');
  const adminRoleId = resolveRoleId('admin');
  const adminBio = 'Primary EscapePlan appliance administrator.';
  const adminBaseProfile = {
    name: 'System Administrator',
    username: 'admin',
    role: 'admin',
    roleId: adminRoleId,
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
    passwordHash: hashedPassword,
    image: JSON.stringify(defaultAvatarConfig) // Better Auth expects string
  };

  if (!existingAdmin) {
    console.log('Creating admin user...');
    const adminUser = await adapter.createUser({
      email: adminEmail,
      ...adminBaseProfile,
      passwordHash: hashedPassword,
      image: JSON.stringify(defaultAvatarConfig) // Better Auth expects string
    }) as any;
    adminId = adminUser.id;

    await adapter.updateUser(adminId, {
      role: 'admin',
      roleId: adminRoleId,
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
    await adapter.updateUser(adminId, {
      ...adminProfileUpdates,
      permissions: adminPermissions
    });
  }

  // Seed game (idempotent)
  const existingGame = db
    .prepare('SELECT id, slug FROM games WHERE slug IN (?, ?) LIMIT 1')
    .get(pirateGame.slug, 'pirate-mutiny') as { id: string; slug: string } | undefined;

  const gameId = existingGame?.id ?? pirateGame.id;
  pirateGame.id = gameId as `${string}-${string}-${string}-${string}-${string}`;

  if (!existingGame) {
    console.log('Creating Pirate Mutiny game...');
    db.prepare(
      `INSERT INTO games (
         id, slug, name, description, story_intro, duration_minutes, difficulty,
         pricing_model, category, categories, min_players, max_players,
         price_per_player_cents, resources_required, validation_notes, default_volume,
         created_at, updated_at
       )
       VALUES (
         @id, @slug, @name, @description, @story_intro, @duration_minutes, @difficulty,
         @pricing_model, @category, @categories, @min_players, @max_players,
         @price_per_player_cents, @resources_required, @validation_notes, @default_volume,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )`
    ).run({
      ...pirateGame,
      category: 'Private'
    });
  } else {
    console.log('Pirate Mutiny game already exists, syncing metadata...');
    if (existingGame.slug !== pirateGame.slug) {
      db.prepare('UPDATE games SET slug = @slug WHERE id = @id').run({
        id: pirateGame.id,
        slug: pirateGame.slug
      });
    }
    db.prepare(
      `UPDATE games SET
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
         default_volume = @default_volume,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`
    ).run({
      ...pirateGame,
      category: 'Private'
    });
  }

  db.prepare('DELETE FROM games WHERE slug IN (@canonical, @legacy) AND id != @id').run({
    canonical: pirateGame.slug,
    legacy: 'pirate-mutiny',
    id: pirateGame.id
  });

  // Seed room (idempotent)
  const existingRoom = db
    .prepare('SELECT id FROM rooms WHERE game_id = ? AND name = ? LIMIT 1')
    .get(pirateGame.id, 'Main') as { id: string } | undefined;

  const roomId = existingRoom?.id ?? roomMainId;

  if (!existingRoom) {
    console.log('Creating Main room...');
    db.prepare(
      `INSERT INTO rooms (id, game_id, name, is_mobile_capable, theme_token)
       VALUES (@id, @game_id, @name, @is_mobile_capable, @theme_token)`
    ).run({
      id: roomId,
      game_id: pirateGame.id,
      name: 'Main',
      is_mobile_capable: 0,
      theme_token: 'escapeplan-pirate'
    });
  } else {
    console.log('Main room already exists, syncing metadata...');
    db.prepare(
      `UPDATE rooms SET
         is_mobile_capable = @is_mobile_capable,
         theme_token = @theme_token
       WHERE id = @id`
    ).run({
      id: roomId,
      is_mobile_capable: 0,
      theme_token: 'escapeplan-pirate'
    });
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
