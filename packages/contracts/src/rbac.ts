import type { OperatorPermission, OperatorRole } from './index.js';

export const PERMISSION_LABELS: Record<OperatorPermission, string> = {
  view_dashboard: 'View dashboard and status widgets',
  view_bookings: 'View bookings calendar and manifests',
  manage_bookings: 'Modify, cancel, and create bookings',
  manage_sessions: 'Control live sessions and timers',
  view_games: 'View game library and details',
  manage_games: 'Edit game settings, puzzles, and rooms',
  view_network: 'View appliance network status',
  manage_network: 'Modify network configuration',
  manage_users: 'Manage operator accounts and roles',
  manage_files: 'Manage asset and file storage'
};

export const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: Object.keys(PERMISSION_LABELS) as OperatorPermission[],
  manager: [
    'view_dashboard',
    'view_bookings',
    'manage_bookings',
    'manage_sessions',
    'view_games',
    'manage_games',
    'view_network',
    'manage_users'
  ],
  game_master: ['view_dashboard', 'view_bookings', 'manage_sessions', 'view_games'],
  customer: ['view_dashboard', 'view_bookings']
};

export const ALL_PERMISSIONS: OperatorPermission[] = Object.keys(PERMISSION_LABELS) as OperatorPermission[];

export const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  game_master: 'Game Master',
  customer: 'Customer'
};
