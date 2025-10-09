/**
 * State Management Module Barrel Exports
 *
 * This file serves as the central export point for all state management modules.
 * Each domain (network, games, operators, sessions, bookings, dashboard) has its
 * own directory with types and functions that will be populated by subsequent agents.
 *
 * Architecture:
 * - Modular domain-driven design
 * - Type-safe operations
 * - Shared utilities and helpers
 * - Clear separation of concerns
 */

// Shared types and utilities
export * from './shared/types.js';

// Network state management
export * from './network/types.js';
export {
  networkState,
  getNetworkProfile,
  updateNetworkProfile,
  scanWiFiNetworks,
  connectToWiFi,
  getWiFiClientStatus,
  disconnectFromWiFi
} from './network/index.svelte.js';

// Games state management
export * from './games/types.js';
export {
  gamesState,
  listGameDetails,
  getGameDetails,
  createGame,
  updateGame,
  deleteGame,
  archiveGame,
  unarchiveGame
} from './games/index.svelte.js';

// Operators state management
export * from './operators/types.js';
export {
  operatorsState,
  createOperatorAccount,
  updateOperatorAccount,
  resetOperatorPassword,
  changeOwnPassword,
  updateOwnProfile,
  deleteOperatorAccount,
  archiveOperatorAccount,
  unarchiveOperatorAccount,
  findOperatorById,
  findOperatorByUsername,
  listOperatorSummaries,
  updateOperatorLoginTimestamp,
  getUserPermissions,
  userHasPermission,
  requirePermission
} from './operators/index.svelte.js';

// RBAC (Roles and Permissions) state management
export {
  rolesState,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
  listPermissions,
  getPermissionMatrix
} from './operators/roles.svelte.js';

// Sessions state management
export * from './sessions/types.js';
export {
  sessionsState,
  listActiveSessions,
  listSessions,
  getSessionById,
  getSessionBySlug,
  toTimerBroadcast,
  quickStartSession
} from './sessions/index.svelte.js';

// Timer state management
export {
  timerState,
  startTimerInterval,
  stopTimerInterval,
  tickTimers,
  getTimerStatus
} from './sessions/timer.svelte.js';

// Commands state management
export {
  commandsState,
  applyCommand
} from './sessions/commands.svelte.js';

// Bookings state management
export * from './bookings/types.js';
export {
  bookingsState,
  listUpcomingBookings,
  getBookingsByDate
} from './bookings/index.svelte.js';

// Dashboard state management
export * from './dashboard/types.js';
export {
  dashboardState,
  getDashboard,
  getCachedDashboard,
  invalidateDashboardCache
} from './dashboard/index.svelte.js';

// Alert Rules state management
export {
  listAlertRules,
  getAlertRule,
  updateAlertRule
} from './alert-rules.js';
export type {
  AlertRule,
  UpdateAlertRuleData
} from './alert-rules.js';

/**
 * NOTE: Function exports will be added by subsequent agents as they
 * implement the business logic for each domain. The current exports
 * focus on types only to establish the type system foundation.
 */
