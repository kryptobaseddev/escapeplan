export type NetworkHealth = 'online' | 'degraded' | 'offline';
export type SessionStatus = 'upcoming' | 'running' | 'paused' | 'completed';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type OperatorRole = 'admin' | 'manager' | 'game_master' | 'customer';

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
  | 'view_dashboard'
  | 'view_bookings'
  | 'manage_bookings'
  | 'manage_sessions'
  | 'view_games'
  | 'manage_games'
  | 'view_network'
  | 'manage_network'
  | 'manage_users'
  | 'manage_files';

export interface OperatorProfile {
  id: string;
  username: string;
  name: string;
  role: OperatorRole;
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

export interface QuickStartSessionRequest {
  gameId: string;
  roomId: string;
  partySize: number;
  durationMinutes?: number | null;
  notes?: string | null;
}

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
  recentAlert?: string;
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
    detailsUrl?: string;
  };
  activeSessions: ActiveSessionSummary[];
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'critical';
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
  title: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  order: number;
}

export type HintMedium = 'text' | 'image' | 'audio' | 'video';

export interface HintEvent {
  id: string;
  type: HintMedium;
  message: string;
  assetUrl?: string;
  deliveredBy: string;
  deliveredAt: string;
}

export interface GameSessionDetails extends ActiveSessionSummary {
  puzzles: PuzzleState[];
  hintLog: HintEvent[];
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
  roomUuid?: string;
}

export interface TimerBroadcast {
  slug: string;
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
  command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'send_hint' | 'mark_puzzle';
  payload?: Record<string, unknown>;
}

export interface CommandResponse {
  status: 'ok';
  session: GameSessionDetails;
  message?: string;
}

export interface GamePuzzleDefinition {
  id: string;
  uuid: string;
  title: string;
  description?: string;
  solution?: string;
  mediaAsset?: string;
  operatorActions?: string;
  displayOrder: number;
  hints?: GameHintDefinition[];
  mediaMeta?: Record<string, unknown> | null;
}

export interface GameRoomDefinition {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  slug?: string;
  isMobileCapable: boolean;
  themeToken?: string;
  capacity?: number;
}

export interface GameMediaConfig {
  thumbnailAssetId?: string | null;
  roomScreenAssetId?: string | null;
  galleryAssetIds: string[];
}

export type PricingModel = 'per_person' | 'flat_rate';

export interface GamePricingTier {
  id: string;
  label: string;
  priceCents: number;
  minPlayers?: number | null;
  maxPlayers?: number | null;
}

export interface GameDiscountRule {
  code: string;
  percentOff?: number | null;
  amountOffCents?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export interface GamePricingConfig {
  model: PricingModel;
  tiers: GamePricingTier[];
  deposit?: {
    required: boolean;
    type?: 'flat' | 'percent';
    amountCents?: number | null;
  };
  discounts: GameDiscountRule[];
}

export interface GameBookingRules {
  isMobile?: boolean;
  locationNotes?: string | null;
  travelBufferMinutes?: number | null;
  equipmentChecklist: string[];
  reservationStyle: 'public' | 'private';
  cancellationPolicy?: string | null;
  customFields?: Array<{ label: string; required: boolean }>;
}

export interface GameDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  storyIntro?: string;
  durationMinutes: number;
  difficulty: string;
  pricingModel: PricingModel;
  categories: string[];
  minPlayers: number;
  maxPlayers: number;
  pricePerPlayerCents: number;
  resourcesRequired: number;
  validationNotes?: string;
  media?: GameMediaConfig;
  pricing?: GamePricingConfig;
  bookingRules?: GameBookingRules;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archivedReason?: string | null;
  puzzles: GamePuzzleDefinition[];
  rooms: GameRoomDefinition[];
}

export interface SaveGameRequest {
  slug: string;
  name: string;
  description: string;
  storyIntro?: string;
  durationMinutes: number;
  difficulty: string;
  pricingModel: PricingModel;
  categories: string[];
  minPlayers: number;
  maxPlayers: number;
  pricePerPlayerCents: number;
  resourcesRequired: number;
  validationNotes?: string;
  puzzles: GamePuzzleDefinition[];
  rooms: GameRoomDefinition[];
  media?: GameMediaConfig;
  pricing?: GamePricingConfig;
  bookingRules?: GameBookingRules;
}

export interface GameHintDefinition {
  uuid: string;
  type: HintMedium;
  content: string;
  assetUrl?: string;
  order: number;
  countAsHint?: boolean;
}

export interface ArchiveGameRequest {
  reason?: string | null;
}

export interface NetworkProfile {
  id: string;
  name: string;
  ssid: string;
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
  description?: string;
  band?: string;
  channel?: number;
  security?: string;
  broadcastEnabled?: boolean;
  status?: NetworkHealth;
  statusMessage?: string;
  details?: string;
}

export { ROLE_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, ALL_PERMISSIONS } from './rbac.js';
