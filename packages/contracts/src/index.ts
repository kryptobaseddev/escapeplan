export type NetworkHealth = 'online' | 'degraded' | 'offline';
export type SessionStatus = 'upcoming' | 'running' | 'paused' | 'completed';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type OperatorRole = 'admin' | 'general_manager' | 'game_master' | 'technician';

export type OperatorPermission =
  | 'manage_users'
  | 'manage_games'
  | 'manage_network'
  | 'view_network'
  | 'manage_sessions'
  | 'rotate_admin_credentials';

export interface OperatorProfile {
  id: string;
  username: string;
  name: string;
  role: OperatorRole;
  avatarUrl?: string;
  bio?: string;
  permissions: OperatorPermission[];
  email?: string;
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
  avatarUrl?: string;
  bio?: string;
  mustResetPassword?: boolean;
}

export interface UpdateOperatorRequest {
  name?: string;
  role?: OperatorRole;
  email?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  mustResetPassword?: boolean;
}

export interface ResetOperatorPasswordRequest {
  password: string;
  forceReset?: boolean;
}

export interface ChangeOwnPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateOwnProfileRequest {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface TimerState {
  totalSeconds: number;
  remainingSeconds: number;
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

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: OperatorProfile;
  expiresAt: string;
  mustResetPassword?: boolean;
}

export interface SessionResponse {
  user: OperatorProfile;
  issuedAt: string;
  expiresAt: string;
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
  title: string;
  description?: string;
  solution?: string;
  mediaAsset?: string;
  operatorActions?: string;
  displayOrder: number;
}

export interface GameRoomDefinition {
  id: string;
  name: string;
  isMobileCapable: boolean;
  themeToken?: string;
}

export interface GameDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  storyIntro?: string;
  durationMinutes: number;
  difficulty: string;
  pricingModel: string;
  categories: string[];
  minPlayers: number;
  maxPlayers: number;
  pricePerPlayerCents: number;
  resourcesRequired: number;
  validationNotes?: string;
  createdAt: string;
  updatedAt: string;
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
  pricingModel: string;
  categories: string[];
  minPlayers: number;
  maxPlayers: number;
  pricePerPlayerCents: number;
  resourcesRequired: number;
  validationNotes?: string;
  puzzles: GamePuzzleDefinition[];
  rooms: GameRoomDefinition[];
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
