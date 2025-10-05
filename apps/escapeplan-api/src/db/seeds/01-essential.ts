/**
 * Essential Data Seed - RBAC System and Admin User
 *
 * This seed file populates the core authentication and authorization data required
 * for the EscapePlan system to function. It is safe to run in production and uses
 * idempotent operations to prevent duplicates.
 *
 * Data included:
 * - 27 permissions (view_dashboard, manage_bookings, etc.)
 * - 4 system roles (admin, manager, game_master, customer)
 * - Role-permission mappings
 * - Default admin user (admin@escapeplan.local)
 */

import { randomUUID } from 'node:crypto';
import { sqlite } from '../client.ts';
import { auth } from '../../auth.ts';
import { resolveRoleId } from '../../security.ts';

const db = sqlite;

/**
 * Seeds the complete RBAC system (roles, permissions, role-permission mappings)
 * and creates the default admin user account.
 *
 * This function is idempotent and safe to run multiple times.
 * Existing data will not be duplicated or overwritten.
 *
 * @returns Promise<void>
 * @throws Error if database operations fail
 */
export async function seedEssentialData(): Promise<void> {
  try {
    console.log('[Seed:Essential] Starting RBAC system seeding...');

    // ============================================================================
    // SEED PERMISSIONS (27 total)
    // ============================================================================

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

    let permissionsCreated = 0;
    let permissionsSkipped = 0;

    for (const [permName, permLabel] of Object.entries(PERMISSION_LABELS)) {
      try {
        const existing = db.prepare('SELECT id FROM permissions WHERE name = ?').get(permName);
        if (!existing) {
          const permId = `perm-${permName}`;
          db.prepare(`
            INSERT INTO permissions (id, name, label, category, user_type_scope, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(permId, permName, permLabel, permissionCategories[permName] || 'system', 'operator');
          permissionsCreated++;
        } else {
          permissionsSkipped++;
        }
      } catch (error) {
        console.error(`[Seed:Essential] Error seeding permission ${permName}:`, error);
        throw error;
      }
    }

    console.log(`[Seed:Essential] Permissions: ${permissionsCreated} created, ${permissionsSkipped} skipped`);

    // ============================================================================
    // SEED SYSTEM ROLES (4 total)
    // ============================================================================

    const systemRoles = [
      {
        id: 'role-admin',
        name: 'admin',
        description: 'Full system access with all permissions',
        user_type_scope: 'operator'
      },
      {
        id: 'role-manager',
        name: 'manager',
        description: 'Manage games, bookings, sessions, users, and cameras',
        user_type_scope: 'operator'
      },
      {
        id: 'role-game-master',
        name: 'game_master',
        description: 'Run sessions, view games, and access cameras',
        user_type_scope: 'operator'
      },
      {
        id: 'role-customer',
        name: 'customer',
        description: 'View dashboard and bookings only',
        user_type_scope: 'customer'
      }
    ];

    let rolesCreated = 0;
    let rolesSkipped = 0;

    for (const role of systemRoles) {
      try {
        const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(role.name);
        if (!existing) {
          db.prepare(`
            INSERT INTO roles (id, name, description, user_type_scope, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(role.id, role.name, role.description, role.user_type_scope);
          rolesCreated++;
        } else {
          rolesSkipped++;
        }
      } catch (error) {
        console.error(`[Seed:Essential] Error seeding role ${role.name}:`, error);
        throw error;
      }
    }

    console.log(`[Seed:Essential] Roles: ${rolesCreated} created, ${rolesSkipped} skipped`);

    // ============================================================================
    // SEED ROLE-PERMISSION MAPPINGS
    // ============================================================================

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

    let mappingsCreated = 0;
    let mappingsSkipped = 0;

    for (const [roleName, permissionNames] of Object.entries(ROLE_PERM_MAP)) {
      try {
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
            mappingsCreated++;
          } else {
            mappingsSkipped++;
          }
        }
      } catch (error) {
        console.error(`[Seed:Essential] Error seeding role permissions for ${roleName}:`, error);
        throw error;
      }
    }

    console.log(`[Seed:Essential] Role-Permission Mappings: ${mappingsCreated} created, ${mappingsSkipped} skipped`);

    // ============================================================================
    // SEED DEFAULT ADMIN USER
    // ============================================================================

    try {
      const authContext = await auth.$context;
      const adapter = authContext.internalAdapter;

      const adminEmail = 'admin@escapeplan.local';
      const adminRoleId = resolveRoleId('admin');
      const adminBio = 'Primary EscapePlan appliance administrator.';

      const existingAdmin = await adapter.findUserByEmail(adminEmail, { includeAccounts: true });
      const hashedPassword = await authContext.password.hash('escapeplan');
      const defaultAvatarConfig = {
        seed: 'admin',
        eyes: ['happy'],
        mouth: ['smile01']
      };

      if (!existingAdmin) {
        console.log('[Seed:Essential] Creating admin user...');

        const userPayload = {
          email: adminEmail,
          name: 'System Administrator',
          username: 'admin',
          bio: adminBio,
          emailVerified: true,
          passwordHash: hashedPassword,
          image: JSON.stringify(defaultAvatarConfig),
          avatar_config: JSON.stringify(defaultAvatarConfig)
        };

        const adminUser = await adapter.createUser(userPayload) as any;
        const adminId = adminUser.id;

        // Update server-managed fields directly in database
        db.prepare(`
          UPDATE user
          SET role_id = ?, user_type = ?, must_reset_password = ?
          WHERE id = ?
        `).run(adminRoleId, 'operator', 0, adminId);

        await adapter.createAccount({
          userId: adminId,
          providerId: 'credential',
          accountId: adminId,
          password: hashedPassword
        });

        console.log('[Seed:Essential] Admin user created successfully');
      } else {
        console.log('[Seed:Essential] Admin user already exists, updating password and metadata...');
        const adminId = existingAdmin.user.id;

        await adapter.updatePassword(adminId, hashedPassword);

        // Ensure role_id and user_type are correct
        db.prepare(`
          UPDATE user
          SET role_id = ?, user_type = ?, bio = ?, image = ?, avatar_config = ?
          WHERE id = ?
        `).run(adminRoleId, 'operator', adminBio, JSON.stringify(defaultAvatarConfig), JSON.stringify(defaultAvatarConfig), adminId);

        console.log('[Seed:Essential] Admin user updated successfully');
      }
    } catch (error) {
      console.error('[Seed:Essential] Error seeding admin user:', error);
      throw error;
    }

    console.log('[Seed:Essential] ✅ Essential data seeded successfully\n');
  } catch (error) {
    console.error('[Seed:Essential] ❌ Fatal error during essential data seeding:', error);
    throw error;
  }
}
