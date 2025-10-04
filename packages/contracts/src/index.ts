// Import Zod-inferred types for use in this file
import type {
  GameHintDefinition,
  GamePuzzleDefinition,
  GameMediaConfig,
  GamePricingConfig,
  GameBookingRules,
  SaveGameRequest,
  QuickStartSessionRequest
} from './validation.js';

export type NetworkHealth = 'online' | 'degraded' | 'offline';
export type SessionStatus = 'upcoming' | 'running' | 'paused' | 'completed';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type OperatorRole = 'admin' | 'manager' | 'game_master' | 'customer';

export type PermissionCategory =
  | 'dashboard'
  | 'bookings'
  | 'sessions'
  | 'games'
  | 'network'
  | 'users'
  | 'rbac'
  | 'storage'
  | 'cameras'
  | 'system';

// DiceBear Bottts avatar configuration
export interface BotttsAvatarConfig {
  seed: string;
  backgroundType?: string[];
  backgroundColor?: string[];
  baseColor?: string[];
  eyes?: string[];
  face?: string[];
  mouth?: string[];
  sides?: string[];
  texture?: string[];
  top?: string[];
}

export type OperatorPermission =
  // Dashboard & Bookings
  | 'view_dashboard'
  | 'view_bookings'
  | 'manage_bookings'
  // Sessions & Games
  | 'view_sessions'
  | 'manage_sessions'
  | 'view_games'
  | 'manage_games'
  // Network
  | 'view_network'
  | 'manage_network'
  // Users & RBAC
  | 'view_users'
  | 'manage_users'
  | 'view_roles'
  | 'manage_roles'
  | 'view_permissions'
  | 'manage_permissions'
  | 'archive_users'
  // Assets & Storage
  | 'view_assets'
  | 'manage_assets'
  | 'view_storage'
  | 'manage_storage'
  // Cameras
  | 'view_cameras'
  | 'manage_cameras'
  // System & Logs
  | 'view_system_logs'
  | 'view_system_health'
  | 'manage_system_health'
  | 'view_alert_rules'
  | 'manage_alert_rules';

export interface OperatorProfile {
  id: string;
  username: string;
  name: string;
  role: OperatorRole;
  user_type?: 'operator' | 'customer'; // Field from unified user table
  avatarConfig?: BotttsAvatarConfig;
  bio?: string;
  permissions: OperatorPermission[];
  email?: string;
  emailVerified?: boolean;
  banned?: boolean;
  banReason?: string | null;
  banExpires?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archivedReason?: string | null;
}

export interface OperatorSummary extends OperatorProfile {
  createdAt: string;
  updatedAt: string;
  mustResetPassword: boolean;
  lastLoginAt?: string;
}

export interface CreateOperatorRequest {
  username: string;
  name: string;
  role: OperatorRole;
  password: string;
  email?: string;
  avatarConfig?: BotttsAvatarConfig;
  bio?: string;
  mustResetPassword?: boolean;
}

export interface UpdateOperatorRequest {
  name?: string;
  role?: OperatorRole;
  email?: string;
  avatarConfig?: BotttsAvatarConfig | null;
  bio?: string | null;
  mustResetPassword?: boolean;
}

export interface ResetOperatorPasswordRequest {
  password: string;
  forceReset?: boolean;
}

export interface ArchiveOperatorRequest {
  reason?: string | null;
}

// Re-export QuickStartSessionRequest from validation
export type { QuickStartSessionRequest };

export interface ChangeOwnPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateOwnProfileRequest {
  name: string;
  email?: string | null;
  avatarConfig?: BotttsAvatarConfig | null;
  bio?: string | null;
}

export interface TimerState {
  totalSeconds: number;
  remainingSeconds: number;
  totalElapsedSeconds: number;
  status: TimerStatus;
  startedAt?: string;
  updatedAt: string;
}

export interface ActiveSessionSummary {
  id: string;
  gameId: string;
  gameName: string;
  roomName: string;
  startedAt: string;
  scheduledEnd: string;
  status: SessionStatus;
  players: number;
  isMobile: boolean;
  isAdhoc?: boolean;
  timer: TimerState;
  hintsUsed: number;
  streamThumbnailUrl?: string;
}

export interface BookingSummary {
  id: string;
  bookingCode: string;
  gameId: string;
  gameName: string;
  roomName: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
  partySize: number;
  depositDue: number;
  totalDue: number;
  priceTier: 'standard' | 'premier' | 'offsite';
  discountCode?: string | null;
  isMobile: boolean;
  isAdhoc?: boolean;
  notes?: string | null;
  locationNote?: string | null;
  contactName: string;
  contactPhone: string;
  conflict?: boolean;
}

export interface DashboardResponse {
  generatedAt: string;
  timezone: string;
  network: {
    status: NetworkHealth;
    message: string;
    lastChecked: string;
    ssid?: string;
    password?: string;
    broadcastEnabled?: boolean;
    detailsUrl?: string;
  };
  activeSessions: ActiveSessionSummary[];
  alerts: Array<{
    id: string;
    sessionId?: string;
    level: 'info' | 'warning' | 'critical';
    category: 'timer' | 'network' | 'system' | 'session' | 'hint';
    title: string;
    message: string;
    createdAt: string;
  }>;
  upcomingBookings: BookingSummary[];
}

export interface BookingCalendarResponse {
  date: string;
  timezone: string;
  scope: 'all' | 'storefront' | 'mobile';
  bookings: BookingSummary[];
  conflicts: Array<{
    bookingIds: string[];
    reason: string;
  }>;
}

export interface PuzzleState {
  id: string;
  puzzleId?: string; // Reference back to game_puzzles
  title: string;
  description?: string | null;
  solution?: string | null;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  order: number;
  hints?: GameHintDefinition[]; // Copy of hints for quick access
}

export type HintMedium = 'text' | 'image' | 'audio' | 'video';

export interface HintEvent {
  id: string;
  puzzleId?: string | null; // Which puzzle this hint was for
  type: HintMedium;
  message: string;
  assetUrl?: string;
  volumeLevel?: number | null; // Volume at which hint was sent
  deliveredBy: string;
  deliveredAt: string;
}

export interface GameSessionDetails extends ActiveSessionSummary {
  puzzles: PuzzleState[];
  hintLog: HintEvent[];
  milestones?: SessionMilestone[]; // Triggered milestones
  availableMilestones?: GameMilestone[]; // Milestones that can be manually triggered
  backgroundAudio?: {
    trackName: string;
    url: string;
    isPlaying: boolean;
  };
  crew: {
    primary: string;
    support?: string | null;
  };
  gameSlug?: string;
  roomId?: string;
  gameDefaultVolume?: number; // Game-wide default volume
  currentRoomDisplayMedia?: {
    mediaType: 'text' | 'image' | 'audio' | 'video';
    source: 'hint' | 'milestone';
    status: RoomDisplayPlaybackStatus;
    triggeredAt: string;
  } | null; // Currently playing media on room display
}

export interface RoomDisplayConfig {
  showTimer?: boolean;
  timerPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundType: 'asset' | 'solid' | 'gradient';
  backgroundAssetId?: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: 'to-b' | 'to-t' | 'to-r' | 'to-l' | 'to-br' | 'to-tl' | 'radial';
  backgroundOpacity?: number;
  defaultMediaScale?: number;
  textHintTextColor?: string;
  textHintBackgroundColor?: string;
  timerTextColor?: string;
  timerBackgroundColor?: string;
  timerOpacity?: number;
}

// RoomDisplayMediaEvent is now exported from validation.ts as a Zod-inferred type
// This ensures runtime validation and TypeScript types stay in sync

export type RoomDisplayPlaybackStatus = 'playing' | 'finished' | 'dismissed';

export interface RoomDisplayStatusEvent {
  slug: string;
  sessionId: string;
  mediaType: 'text' | 'image' | 'audio' | 'video';
  source: 'hint' | 'milestone';
  status: RoomDisplayPlaybackStatus;
  triggeredAt: string; // Original trigger timestamp to match the media event
  statusUpdatedAt: string; // When this status update occurred
}

export interface TimerBroadcast {
  slug: string;
  sessionId: string;
  gameName: string;
  roomName: string;
  narrative?: string;
  background: {
    type: 'image' | 'video';
    url: string;
  };
  timer: TimerState;
  hintBanner?: {
    message: string;
    shownAt: string;
  };
  roomConfig?: RoomDisplayConfig;
}

export interface ActiveSessionsResponse {
  generatedAt: string;
  sessions: GameSessionDetails[];
}

export interface QuickStartSessionResponse {
  session: GameSessionDetails;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthSessionInfo {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedBy?: string | null;
}

export interface AuthSessionUser extends OperatorSummary {
  emailVerified: boolean;
  banned?: boolean;
  banReason?: string | null;
  banExpires?: string | null;
}

export interface AuthSessionEnvelope {
  session: AuthSessionInfo;
  user: AuthSessionUser;
}

export interface CommandRequest {
  command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'stop_session' | 'send_hint' | 'mark_puzzle' | 'trigger_milestone' | 'reset_milestone';
  payload?: Record<string, unknown>;
}

export interface CommandResponse {
  status: 'ok';
  session: GameSessionDetails;
  message?: string;
}

// NOTE: Game-related types (GamePuzzleDefinition, GameMediaConfig, etc.)
// are now inferred from Zod schemas in validation.ts and exported from there.
// These old interface definitions have been removed to avoid conflicts with Zod types.

export type PricingModel = 'per_person' | 'flat_rate' | 'dynamic';
export type GameType = 'storefront' | 'mobile';

export interface GameDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  storyIntro?: string;
  durationMinutes: number;
  difficulty: string;
  gameType: GameType;
  pricingModel?: PricingModel; // DEPRECATED: Use pricing.tiers[].model instead
  categories: string[];
  minPlayers: number; // Room capacity minimum
  maxPlayers: number; // Room capacity maximum
  pricePerPlayerCents?: number; // DEPRECATED: Use pricing.tiers instead
  resourcesRequired: number;
  validationNotes?: string;
  defaultVolume: number; // 0-100, game-wide default for all media
  cameraIds: string[]; // Array of camera IDs associated with this game
  media?: GameMediaConfig;
  roomDisplayConfig?: RoomDisplayConfig;
  pricing?: GamePricingConfig;
  bookingRules?: GameBookingRules;
  milestones?: GameMilestone[]; // Game milestones configuration
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archivedReason?: string | null;
  puzzles: GamePuzzleDefinition[];
}

// NOTE: SaveGameRequest is now inferred from Zod in validation.ts

// NOTE: GameHintDefinition is now inferred from Zod in validation.ts

// Game Milestone types
export type MilestoneType = 'intro' | 'escaped' | 'failed' | 'custom';
export type MilestoneTriggerType = 'manual' | 'timer' | 'condition';
export type MilestoneMediaType = 'text' | 'image' | 'audio' | 'video';

export interface GameMilestoneTriggerConfig {
  // Timer-based triggers
  minutes?: number; // Play at X minutes elapsed
  interval?: number; // Play every X minutes
  // Condition-based triggers
  hintsUsed?: number; // After X hints used
  puzzlesCompleted?: number; // After X puzzles completed
}

export interface GameMilestone {
  id: string;
  gameId: string;
  type: MilestoneType;
  name: string; // User-friendly name
  mediaType?: MilestoneMediaType | null;
  content?: string | null; // Text content or description
  assetId?: string | null; // Reference to asset
  volumeLevel: number; // 0-100
  displayOrder: number;
  triggerType: MilestoneTriggerType;
  triggerConfig?: GameMilestoneTriggerConfig | null;
  enabled: boolean;
  triggered?: boolean; // Whether this milestone has been triggered in the current session
  createdAt: string;
  updatedAt: string;
}

export interface SessionMilestone {
  id: string;
  sessionId: string;
  milestoneId: string;
  milestoneType: MilestoneType;
  milestoneName: string;
  mediaType?: MilestoneMediaType | null;
  content?: string | null;
  assetUrl?: string | null;
  volumeLevel?: number | null;
  triggeredAt: string;
  triggeredBy?: string | null; // Operator ID, null for auto-triggers
}

export interface ArchiveGameRequest {
  reason?: string | null;
}

export interface NetworkProfile {
  id: string;
  name: string;
  ssid: string;
  password?: string;
  description?: string;
  band?: string;
  channel?: number;
  security?: string;
  broadcastEnabled: boolean;
  status: NetworkHealth;
  statusMessage?: string;
  details?: string;
  lastUpdated: string;
}


export interface NetworkServiceToggles {
  enableApi?: boolean;
  enableWeb?: boolean;
  enableWifi?: boolean;
}

export interface NetworkEnvConfig {
  api?: Record<string, string>;
  web?: Record<string, string>;
}

export interface ApplyNetworkConfigRequest {
  wifi: {
    ssid: string;
    passphrase: string;
    channel: number;
    band?: '2g' | '5g' | 'auto';
    country?: string;
  };
  network: {
    router: string;
    dns: string;
    dhcpRangeStart: string;
    dhcpRangeEnd: string;
    domain: string;
  };
  nginx: {
    serverName: string;
    apiUpstream: string;
    webRoot?: string;
    webUpstream?: string;
  };
  env?: NetworkEnvConfig;
  services?: NetworkServiceToggles;
}

export interface ApplyNetworkConfigResponse {
  appliedAt: string;
  stdout?: string;
  stderr?: string;
  services: {
    hostapd: 'active' | 'inactive' | 'unknown';
    dnsmasq: 'active' | 'inactive' | 'unknown';
    api: 'active' | 'inactive' | 'unknown';
    web: 'active' | 'inactive' | 'unknown';
  };
}
export interface UpdateNetworkProfileRequest {
  name?: string;
  ssid?: string;
  password?: string;
  description?: string;
  band?: string;
  channel?: number;
  security?: string;
  broadcastEnabled?: boolean;
  status?: NetworkHealth;
  statusMessage?: string;
  details?: string;
}

// WiFi Client Scanning & Connection
export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  signal: number; // Signal strength percentage 0-100
  frequency: number; // MHz
  security: string; // e.g., "WPA2-PSK", "Open", "WPA3-SAE"
  channel: number;
  inUse: boolean;
}

export interface WiFiScanResponse {
  networks: WiFiNetwork[];
  scannedAt: string;
}

export interface WiFiClientConnectRequest {
  ssid: string;
  password?: string;
  security?: string;
}

export interface WiFiClientStatus {
  connected: boolean;
  ssid?: string;
  signal?: number;
  ipAddress?: string;
  gateway?: string;
  dns?: string[];
}

// ============================================================================
// LOGGING & ALERTING
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'session' | 'auth' | 'system' | 'network' | 'api';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertCategory = 'timer' | 'network' | 'system' | 'session' | 'hint';

export interface SystemLog {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any> | null;
  timestamp: string;
  created_at: string;
}

export interface Alert {
  id: string;
  sessionId?: string | null;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  message: string;
  context?: Record<string, any> | null;
  createdAt: string;
  dismissedAt?: string | null;
  dismissedBy?: string | null;
}

export interface AlertRuleConditions {
  event: string;
  threshold?: {
    count?: number;
    window_minutes?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string | null;
  category: AlertCategory;
  level: AlertLevel;
  enabled: boolean;
  conditions: AlertRuleConditions;
  title_template: string;
  message_template: string;
  auto_dismiss_on?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface GetAlertRulesResponse {
  rules: AlertRule[];
}

export interface UpdateAlertRuleRequest {
  enabled?: boolean;
  level?: AlertLevel;
  conditions?: AlertRuleConditions;
  title_template?: string;
  message_template?: string;
  auto_dismiss_on?: string[] | null;
}

export interface GetSystemLogsRequest {
  level?: LogLevel;
  category?: LogCategory;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface GetSystemLogsResponse {
  logs: SystemLog[];
  total: number;
}

export interface DismissAlertRequest {
  alertId: string;
}

export interface DismissAlertResponse {
  success: boolean;
}

// ============================================================================
// DATABASE-DRIVEN RBAC TYPES
// ============================================================================

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: OperatorPermission;
  label: string;
  category: 'dashboard' | 'bookings' | 'sessions' | 'games' | 'network' | 'users' | 'rbac' | 'storage' | 'cameras' | 'system';
  description?: string | null;
  createdAt: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  grantedAt: string;
  grantedBy?: string | null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface PermissionSummary extends Permission {
  assignedToRoles: number; // Count of roles with this permission
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  permissionIds: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
}

export interface UpdateRolePermissionsRequest {
  permissionIds: string[];
}

export interface GetRolesResponse {
  roles: RoleWithPermissions[];
}

export interface GetPermissionsResponse {
  permissions: PermissionSummary[];
}

// Database-driven RBAC is now fully implemented
// All roles and permissions are stored in the database (roles, permissions, role_permissions tables)

// ============================================================================
// CAMERAS
// ============================================================================

export type CameraBrand = 'reolink' | 'hikvision' | 'dahua' | 'amcrest' | 'axis' | 'tapo' | 'foscam' | 'tplink' | 'generic';
export type CameraProtocol = 'rtsp' | 'mjpeg' | 'onvif';
export type CameraResolution = '480p' | '720p' | '1080p' | '2k' | '4k' | 'native';
export type CameraTransport = 'tcp' | 'udp' | 'http';
export type CameraStatus = 'online' | 'offline' | 'testing' | 'error';
export type IRMode = 'auto' | 'on' | 'off';

export interface Camera {
  id: string;
  name: string;
  gameId?: string | null; // 1-to-1 association with game

  // Brand & Model
  brand: CameraBrand;
  model?: string | null;

  // Connection Details
  protocol: CameraProtocol;
  host: string;
  port: number;
  username?: string | null;
  passwordEncrypted?: string | null; // Never expose plain password

  // Stream Paths (dual-stream support)
  mainStreamPath?: string | null;
  subStreamPath?: string | null;
  streamPath?: string | null; // DEPRECATED: Legacy single stream

  // Stream Settings
  resolution: CameraResolution;
  frameRate: number;
  transport: CameraTransport;

  // Capabilities
  hasPtz: boolean;
  hasAudio: boolean;
  hasIrControl: boolean;

  // Feature Settings
  irMode: IRMode;
  audioVolume: number; // 0-100
  ptzPan: number; // -180 to 180
  ptzTilt: number; // -90 to 90
  ptzZoom: number; // 0-100

  // Status
  status: CameraStatus;
  lastSeen?: string | null;
  errorMessage?: string | null;
  hlsStreaming: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CameraSummary {
  id: string;
  name: string;
  gameId?: string | null;
  gameName?: string | null; // Populated from join
  brand: CameraBrand;
  model?: string | null;
  protocol: CameraProtocol;
  host: string;
  port: number;
  status: CameraStatus;
  lastSeen?: string | null;
  hlsStreaming: boolean;
  hasPtz: boolean;
  hasAudio: boolean;
}

export interface CreateCameraRequest {
  name: string;
  gameId?: string | null;

  // Brand & Model
  brand: CameraBrand;
  model?: string | null;

  // Connection
  protocol: CameraProtocol;
  host: string;
  port?: number;
  username?: string | null;
  password?: string | null; // Plain password, will be encrypted server-side

  // Stream Paths
  mainStreamPath?: string | null;
  subStreamPath?: string | null;
  streamPath?: string | null; // DEPRECATED

  // Stream Settings
  resolution?: CameraResolution;
  frameRate?: number;
  transport?: CameraTransport;

  // Capabilities (usually auto-detected from brand/model)
  hasPtz?: boolean;
  hasAudio?: boolean;
  hasIrControl?: boolean;

  // Feature Settings
  irMode?: IRMode;
  audioVolume?: number;
  ptzPan?: number; // -180 to 180
  ptzTilt?: number; // -90 to 90
  ptzZoom?: number; // 0-100
}

export interface UpdateCameraRequest {
  name?: string;
  gameId?: string | null;

  // Brand & Model
  brand?: CameraBrand;
  model?: string | null;

  // Connection
  protocol?: CameraProtocol;
  host?: string;
  port?: number;
  username?: string | null;
  password?: string | null; // If provided, will be re-encrypted

  // Stream Paths
  mainStreamPath?: string | null;
  subStreamPath?: string | null;
  streamPath?: string | null;

  // Stream Settings
  resolution?: CameraResolution;
  frameRate?: number;
  transport?: CameraTransport;

  // Capabilities
  hasPtz?: boolean;
  hasAudio?: boolean;
  hasIrControl?: boolean;

  // Feature Settings
  irMode?: IRMode;
  audioVolume?: number;
  ptzPan?: number;
  ptzTilt?: number;
  ptzZoom?: number;
}

export interface TestCameraConnectionRequest {
  protocol: CameraProtocol;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  streamPath?: string | null;
}

export interface TestCameraConnectionResponse {
  success: boolean;
  previewUrl?: string; // 5-second clip URL if successful
  errorMessage?: string;
  diagnostics?: {
    reachable: boolean;
    authValid: boolean;
    streamAvailable: boolean;
    resolution?: string;
    frameRate?: number;
  };
}

export interface StartCameraStreamRequest {
  cameraId: string;
}

export interface StopCameraStreamRequest {
  cameraId: string;
}

export interface CameraStreamStatus {
  cameraId: string;
  streaming: boolean;
  hlsUrl?: string;
  bitrate?: number;
  fps?: number;
  errorMessage?: string;
}

export interface GetCamerasResponse {
  cameras: CameraSummary[];
}

// Camera Template Types (for auto-configuration from camera-templates.json)
export interface CameraTemplate {
  id: string;
  brand: CameraBrand;
  model: string;
  modelSeries?: string;
  displayName: string;
  defaultPort: number;
  defaultOnvifPort?: number;
  protocol: CameraProtocol;
  mainStreamPath: string;
  subStreamPath?: string;
  streamUrlFormat: string;
  hasPtz: boolean;
  hasAudio: boolean;
  hasIr: boolean;
  videoSpecs?: {
    maxResolution: string;
    mainCodec: string;
    subCodec: string;
    maxFps: number;
  };
  audioSpecs?: {
    inputCodec?: string;
    outputCodec?: string;
    sampleRate?: number;
  };
  ptzSpecs?: {
    panRange?: string;
    tiltRange?: string;
    zoom?: string;
    presets?: number;
    patrols?: boolean;
    autoTracking?: boolean;
  };
  recommendedSettings: {
    transport: CameraTransport;
    timeout: number;
    mainResolution: string;
    mainFps: number;
    subResolution?: string;
    subFps?: number;
  };
  notes?: string;
  documentationUrl?: string;
}

export interface CameraTemplatesResponse {
  version: string;
  lastUpdated: string;
  templates: CameraTemplate[];
  brandDefaults: Record<CameraBrand, {
    defaultPort: number;
    defaultOnvifPort: number;
    protocol: CameraProtocol;
    urlPattern: string;
    transport: CameraTransport;
    timeout: number;
  }>;
}

// ============================================================================
// ROLE AND PERMISSION LABELS (for UI display)
// ============================================================================

export const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  game_master: 'Game Master',
  customer: 'Customer'
};

export const PERMISSION_LABELS: Record<OperatorPermission, string> = {
  view_dashboard: 'View dashboard and status widgets',
  view_bookings: 'View booking calendar',
  manage_bookings: 'Create, modify, and cancel bookings',
  view_sessions: 'View active sessions',
  manage_sessions: 'Start, pause, and end game sessions',
  view_games: 'View game library',
  manage_games: 'Create and edit games',
  view_network: 'View network configuration',
  manage_network: 'Modify network settings',
  view_users: 'View operator list',
  manage_users: 'Create and edit operators',
  view_roles: 'View roles',
  manage_roles: 'Create and edit roles',
  view_permissions: 'View permissions',
  manage_permissions: 'Assign permissions to roles',
  archive_users: 'Archive operators',
  view_assets: 'View media assets',
  manage_assets: 'Upload and manage media',
  view_storage: 'View storage metrics',
  manage_storage: 'Manage file storage',
  view_cameras: 'View camera streams',
  manage_cameras: 'Configure cameras',
  view_system_logs: 'View system logs',
  view_system_health: 'View system health metrics',
  manage_system_health: 'Manage system health',
  view_alert_rules: 'View alert rules',
  manage_alert_rules: 'Configure alert rules'
};

// Role-Permission mapping (for reference/validation - actual source of truth is database)
export const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: [
    'view_dashboard', 'view_bookings', 'manage_bookings',
    'view_sessions', 'manage_sessions', 'view_games', 'manage_games',
    'view_network', 'manage_network',
    'view_users', 'manage_users', 'view_roles', 'manage_roles', 'view_permissions', 'manage_permissions', 'archive_users',
    'view_assets', 'manage_assets', 'view_storage', 'manage_storage',
    'view_cameras', 'manage_cameras',
    'view_system_logs', 'view_system_health', 'manage_system_health', 'view_alert_rules', 'manage_alert_rules'
  ],
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
  customer: [
    'view_dashboard', 'view_bookings'
  ]
};

// ============================================================================
// DRIZZLE SCHEMA & ZOD VALIDATION
// ============================================================================

// Export Drizzle schema tables (for API database operations)
export * from './schema.js';

// Export Zod validation schemas and inferred types (for API request validation)
export * from './validation.js';

// ============================================================================
// RUNTIME ENVIRONMENT & PATHS (Node.js only - do not import in browser!)
// ============================================================================

// ============================================================================
// UNIVERSAL CONSTANTS & SETTINGS (Browser + Node.js safe)
// ============================================================================
// NOTE: runtime.js and paths.js are server-only and should NOT be exported
// from the main index. Import them directly in server code when needed.

// Application constants
export * from './constants.js';

// System settings types
export * from './settings-types.js';
