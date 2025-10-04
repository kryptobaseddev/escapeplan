/**
 * Zod Validation Schemas
 *
 * This file provides Zod schemas for API request/response validation.
 * These schemas are the SINGLE SOURCE OF TRUTH for validation.
 *
 * Benefits:
 * - No manual field-by-field reconstruction needed in API endpoints
 * - Type-safe: TypeScript types are inferred directly from schemas
 * - DRY: Schemas drive both runtime validation and compile-time types
 * - Maintainable: Adding a field updates validation automatically
 */

import { z } from 'zod';

// ============================================================================
// GAMES
// ============================================================================

// Hint schema for puzzle hints
export const hintSchema = z.object({
  uuid: z.string(),
  type: z.enum(['text', 'image', 'audio', 'video']),
  content: z.string(),
  assetUrl: z.string().optional(),
  volumeLevel: z.number().int().min(0).max(100).optional(), // 0-100, overrides game default
  order: z.number().int().min(1),

  // Penalty fields - use camelCase to match existing JSON structure
  penaltySeconds: z.number().int().min(0).max(300).default(0),
  penaltyEnabled: z.boolean().default(false),
  countAsHint: z.boolean().default(true),

  // Media display settings
  displayDurationSeconds: z.number().int().positive().optional(), // Required for images, optional for audio/video
  loop: z.boolean().default(false), // Loop playback
  loopCount: z.number().int().positive().optional(), // Number of loops (undefined = infinite when loop=true)
  autoDismiss: z.boolean().default(true) // Auto-dismiss after playback
});


// Puzzle schema
export const puzzleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Puzzle title is required'),
  description: z.string().optional(),
  solution: z.string().optional(),
  mediaAsset: z.string().optional(),
  operatorActions: z.string().optional(),
  displayOrder: z.number().int().min(1).default(1),
  hints: z.array(hintSchema).optional(),
  mediaMeta: z.record(z.unknown()).optional()
});

// Milestone schema
export const milestoneSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['intro', 'escaped', 'failed', 'custom']),
  name: z.string().min(1, 'Milestone name is required'),
  mediaType: z.enum(['text', 'image', 'audio', 'video']).nullable().optional(),
  content: z.string().nullable().optional(),
  assetId: z.string().nullable().optional(),
  volumeLevel: z.number().int().min(0).max(100).default(80),
  displayOrder: z.number().int().min(1).default(1),
  triggerType: z.enum(['manual', 'timer', 'condition']),
  triggerConfig: z.record(z.any()).nullable().optional(),
  enabled: z.boolean().default(true),

  // Media display settings
  displayDurationSeconds: z.number().int().positive().optional(), // Required for images, optional for audio/video
  loop: z.boolean().default(false), // Loop playback
  loopCount: z.number().int().positive().optional(), // Number of loops (undefined = infinite when loop=true)
  autoDismiss: z.boolean().default(true) // Auto-dismiss after playback
});

// Media config schema
export const mediaConfigSchema = z.object({
  thumbnailAssetId: z.string().optional(),
  galleryAssetIds: z.array(z.string()).default([])
}).optional();

// Room Display config schema
export const roomDisplayConfigSchema = z.object({
  backgroundType: z.enum(['asset', 'solid', 'gradient']).default('solid'),
  backgroundAssetId: z.string().optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gradientFrom: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gradientTo: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  gradientDirection: z.enum(['to-b', 'to-t', 'to-r', 'to-l', 'to-br', 'to-tl', 'radial']).default('to-b'),
  backgroundOpacity: z.number().int().min(0).max(100).default(40),
  defaultMediaScale: z.number().int().min(10).max(100).default(90),
  showTimer: z.boolean().default(true),
  timerPosition: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('center'),
  textHintTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  textHintBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFA500'),
  timerTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
  timerBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  timerOpacity: z.number().int().min(0).max(100).default(80)
}).optional();

// Pricing tier schema - Enhanced with per-tier models and scheduling
export const pricingTierSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100, 'Label must be 100 characters or less'),

  // Model selection (per-tier)
  model: z.enum(['per_person', 'per_session', 'per_hour']),

  // Pricing structure
  priceCents: z.number().int().nonnegative(),

  // For 'per_hour' model with flat base + discounted additional hours
  baseHours: z.number().int().positive().optional(),          // Minimum hours (e.g., 2)
  basePriceCents: z.number().int().nonnegative().optional(),  // Price for base hours (e.g., $200 for 2hrs)
  additionalHourCents: z.number().int().nonnegative().optional(), // Discounted rate per extra hour (e.g., $75/hr)

  // Capacity constraints (optional, defaults to game min/max)
  minPlayers: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),

  // Duration constraints (for 'per_hour' model)
  minDurationHours: z.number().int().positive().optional(),
  maxDurationHours: z.number().int().positive().optional(),

  // Schedule restrictions
  dayOfWeekRestrictions: z.array(z.number().int().min(0).max(6)).optional(), // [0=Sun, 6=Sat]
  timeRangeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "09:00"
  timeRangeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),   // "21:00"

  // Valid date range (for seasonal/holiday pricing)
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),

  // Display
  description: z.string().max(500).optional(), // Help text shown to customers
  displayOrder: z.number().int().min(1).default(1),
  active: z.boolean().default(true)
});

// Pricing discount schema
export const pricingDiscountSchema = z.object({
  code: z.string().min(1),
  percentOff: z.number().min(0).max(100).optional().nullable(),
  amountOffCents: z.number().int().nonnegative().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().max(200).optional().nullable()
});

// Pricing config schema
export const pricingConfigSchema = z.object({
  tiers: z.array(pricingTierSchema).default([]),
  deposit: z.object({
    required: z.boolean(),
    type: z.enum(['flat', 'percent']).optional(),
    amountCents: z.number().int().nonnegative().optional().nullable()
  }).optional(),
  // NOTE: discounts moved to global discount_codes table
  // Legacy field kept for migration compatibility
  discounts: z.array(pricingDiscountSchema).default([])
}).optional();

// Booking rules schema
export const bookingRulesSchema = z.object({
  isMobile: z.boolean().optional(),
  locationNotes: z.string().max(500).optional().nullable(),
  travelBufferMinutes: z.number().int().min(0).max(600).optional().nullable(),
  equipmentChecklist: z.array(z.string().min(1)).default([]),
  reservationStyle: z.enum(['public', 'private']).default('public'),
  cancellationPolicy: z.string().max(2000).optional().nullable(),
  customFields: z.array(
    z.object({
      label: z.string().min(1).max(120),
      required: z.boolean()
    })
  ).default([])
}).optional();

/**
 * Complete game save request schema
 * This is used for both POST (create) and PUT (update) operations
 */
export const saveGameSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Game name is required'),
  description: z.string().min(1, 'Description is required'),
  storyIntro: z.string().optional(),
  durationMinutes: z.number().int().positive().default(60), // No hardcoded min/max - validated against system settings at API level
  difficulty: z.string().min(1).default('Medium'),
  gameType: z.enum(['storefront', 'mobile']).default('storefront'),
  categories: z.array(z.string().min(1)).default([]),

  // Capacity constraints (NOT pricing)
  minPlayers: z.number().int().positive().default(1),
  maxPlayers: z.number().int().positive().default(1),

  resourcesRequired: z.number().int().positive().default(1),
  validationNotes: z.string().optional(),
  defaultVolume: z.number().int().min(0).max(100).default(80),
  cameraIds: z.array(z.string()).default([]),

  // Child entities
  puzzles: z.array(puzzleSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),

  // Config objects
  media: mediaConfigSchema,
  roomDisplayConfig: roomDisplayConfigSchema,
  pricing: pricingConfigSchema,
  bookingRules: bookingRulesSchema
});

/**
 * Infer TypeScript types from Zod schemas
 * These become the canonical types used throughout the application
 */
export type SaveGameRequest = z.infer<typeof saveGameSchema>;
export type GamePuzzleDefinition = z.infer<typeof puzzleSchema>;
export type GameMilestone = z.infer<typeof milestoneSchema>;
export type GameHintDefinition = z.infer<typeof hintSchema>;
export type GameMediaConfig = z.infer<typeof mediaConfigSchema>;
export type RoomDisplayConfig = z.infer<typeof roomDisplayConfigSchema>;
export type GamePricingConfig = z.infer<typeof pricingConfigSchema>;
export type GameBookingRules = z.infer<typeof bookingRulesSchema>;

// ============================================================================
// OPERATORS (USERS)
// ============================================================================

// Avatar config schema
const avatarConfigSchema = z.object({
  seed: z.string(),
  backgroundType: z.array(z.string()).optional(),
  backgroundColor: z.array(z.string()).optional(),
  baseColor: z.array(z.string()).optional(),
  eyes: z.array(z.string()).optional(),
  face: z.array(z.string()).optional(),
  mouth: z.array(z.string()).optional(),
  sides: z.array(z.string()).optional(),
  texture: z.array(z.string()).optional(),
  top: z.array(z.string()).optional()
});

export const createOperatorSchema = z.object({
  username: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'manager', 'game_master', 'customer']),
  password: z.string().min(12),
  avatarConfig: avatarConfigSchema.optional(),
  bio: z.string().max(500).optional(),
  mustResetPassword: z.boolean().optional()
});

export const updateOperatorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'game_master', 'customer']).optional(),
  avatarConfig: avatarConfigSchema.optional().or(z.literal(null)),
  bio: z.string().max(500).optional().or(z.literal(null)),
  mustResetPassword: z.boolean().optional()
});

export type CreateOperatorRequest = z.infer<typeof createOperatorSchema>;
export type UpdateOperatorRequest = z.infer<typeof updateOperatorSchema>;

// ============================================================================
// QUICK START / BOOKINGS
// ============================================================================

export const quickStartSchema = z.object({
  gameId: z.string().min(1),
  partySize: z.number().int().positive(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  notes: z.string().max(500).optional().nullable(),
  autoStartTimer: z.boolean().optional()
});

export type QuickStartSessionRequest = z.infer<typeof quickStartSchema>;

// ============================================================================
// SESSION COMMANDS
// ============================================================================

export const sessionCommandSchema = z.object({
  command: z.enum([
    'start_timer',
    'pause_timer',
    'resume_timer',
    'reset_timer',
    'stop_session',
    'send_hint',
    'mark_puzzle',
    'trigger_milestone',
    'reset_milestone'
  ]),
  payload: z.record(z.any()).optional()
});

export type CommandRequest = z.infer<typeof sessionCommandSchema>;

// ============================================================================
// RBAC
// ============================================================================

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  isSystem: z.boolean().default(false),
  permissionIds: z.array(z.string()).default([])
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable()
});

export type CreateRoleRequest = z.infer<typeof createRoleSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleSchema>;

// ============================================================================
// CAMERAS
// ============================================================================

export const createCameraSchema = z.object({
  name: z.string().min(1),
  gameId: z.string().optional().nullable(),

  // Brand & Model
  brand: z.enum(['reolink', 'hikvision', 'dahua', 'amcrest', 'axis', 'tapo', 'foscam', 'tplink', 'generic']).default('generic'),
  model: z.string().optional().nullable(),

  // Connection
  protocol: z.enum(['rtsp', 'mjpeg', 'onvif']),
  host: z.string().min(1),
  port: z.number().int().positive().default(554),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),

  // Stream Paths (dual-stream support)
  mainStreamPath: z.string().optional().nullable(),
  subStreamPath: z.string().optional().nullable(),
  streamPath: z.string().optional().nullable(), // DEPRECATED

  // Stream Settings
  resolution: z.enum(['480p', '720p', '1080p', '2k', '4k', 'native']).default('720p'),
  frameRate: z.number().int().positive().default(15),
  transport: z.enum(['tcp', 'udp', 'http']).default('tcp'),

  // Capabilities (usually auto-detected from brand/model template)
  hasPtz: z.boolean().default(false),
  hasAudio: z.boolean().default(false),
  hasIrControl: z.boolean().default(false),

  // Feature Settings
  irMode: z.enum(['auto', 'on', 'off']).default('auto'),
  audioVolume: z.number().int().min(0).max(100).default(80)
});

export const updateCameraSchema = z.object({
  name: z.string().min(1).optional(),
  gameId: z.string().optional().nullable(),

  // Brand & Model
  brand: z.enum(['reolink', 'hikvision', 'dahua', 'amcrest', 'axis', 'tapo', 'foscam', 'tplink', 'generic']).optional(),
  model: z.string().optional().nullable(),

  // Connection
  protocol: z.enum(['rtsp', 'mjpeg', 'onvif']).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),

  // Stream Paths
  mainStreamPath: z.string().optional().nullable(),
  subStreamPath: z.string().optional().nullable(),
  streamPath: z.string().optional().nullable(),

  // Stream Settings
  resolution: z.enum(['480p', '720p', '1080p', '2k', '4k', 'native']).optional(),
  frameRate: z.number().int().positive().optional(),
  transport: z.enum(['tcp', 'udp', 'http']).optional(),

  // Capabilities
  hasPtz: z.boolean().optional(),
  hasAudio: z.boolean().optional(),
  hasIrControl: z.boolean().optional(),

  // Feature Settings
  irMode: z.enum(['auto', 'on', 'off']).optional(),
  audioVolume: z.number().int().min(0).max(100).optional(),
  ptzPan: z.number().int().min(-180).max(180).optional(),
  ptzTilt: z.number().int().min(-90).max(90).optional(),
  ptzZoom: z.number().int().min(0).max(100).optional()
});

export type CreateCameraRequest = z.infer<typeof createCameraSchema>;
export type UpdateCameraRequest = z.infer<typeof updateCameraSchema>;

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

// Service status schema
const serviceStatusSchema = z.object({
  name: z.string(),
  status: z.enum(['online', 'offline', 'degraded']),
  uptime: z.string(),
  details: z.string()
});

export const systemHealthSchema = z.object({
  cpuUsagePercent: z.number().int().min(0).max(100),
  memoryTotalMb: z.number().int().positive(),
  memoryUsedMb: z.number().int().nonnegative(),
  diskTotalGb: z.number().int().positive(),
  diskUsedGb: z.number().int().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
  servicesStatus: z.array(serviceStatusSchema)
});

export type SystemHealthSnapshot = z.infer<typeof systemHealthSchema>;

// Response format for GET /api/admin/system/health
export const systemHealthResponseSchema = z.object({
  cpu: z.number().int().min(0).max(100),
  memory: z.object({
    used: z.number(),
    total: z.number()
  }),
  disk: z.object({
    used: z.number(),
    total: z.number()
  }),
  uptime: z.string(),
  services: z.array(serviceStatusSchema)
});

export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;

// ============================================================================
// BACKUPS
// ============================================================================

// Backup includes schema
export const backupIncludesSchema = z.object({
  database: z.boolean().default(true), // Always include DB
  games: z.boolean().default(true),
  assets: z.boolean().default(false), // Large, optional
  logs: z.boolean().default(false) // Last 7 days only
});

// Create backup request
export const createBackupSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'pre-update']).default('manual'),
  includes: backupIncludesSchema.default({
    database: true,
    games: true,
    assets: false,
    logs: false
  }),
  destination: z.enum(['local', 'usb']).default('local'),
  usbDeviceId: z.string().optional() // Required if destination is 'usb'
}).refine(
  (data) => {
    if (data.destination === 'usb' && !data.usbDeviceId) {
      return false;
    }
    return true;
  },
  {
    message: 'USB device ID required when destination is usb',
    path: ['usbDeviceId']
  }
);

export type CreateBackupRequest = z.infer<typeof createBackupSchema>;
export type BackupIncludes = z.infer<typeof backupIncludesSchema>;

// Backup response
export const backupResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['manual', 'scheduled', 'pre-update']),
  status: z.enum(['in_progress', 'completed', 'failed']),
  filePath: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  includes: backupIncludesSchema,
  destination: z.enum(['local', 'usb']),
  usbDevice: z.string().optional(),
  checksumSha256: z.string().optional(),
  errorMessage: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  completedAt: z.string().optional()
});

export type BackupResponse = z.infer<typeof backupResponseSchema>;

// Restore backup request
export const restoreBackupSchema = z.object({
  backupId: z.string().min(1),
  restoreAssets: z.boolean().default(false), // Confirm asset restoration
  restoreLogs: z.boolean().default(false)
});

export type RestoreBackupRequest = z.infer<typeof restoreBackupSchema>;

// ============================================================================
// USB DEVICES
// ============================================================================

export const usbDeviceResponseSchema = z.object({
  id: z.string(),
  devicePath: z.string(),
  mountPoint: z.string().optional(),
  label: z.string().optional(),
  totalSpaceGb: z.number().int().nonnegative().optional(),
  availableSpaceGb: z.number().int().nonnegative().optional(),
  isMounted: z.boolean(),
  lastSeen: z.string()
});

export type USBDeviceResponse = z.infer<typeof usbDeviceResponseSchema>;

// ============================================================================
// STORAGE METRICS (FIXED FORMAT)
// ============================================================================

// Storage metrics response format (matching frontend expectations)
export const storageMetricsResponseSchema = z.object({
  system: z.object({
    totalBytes: z.number().int().nonnegative(),
    usedBytes: z.number().int().nonnegative(),
    availableBytes: z.number().int().nonnegative(),
    usedPercent: z.number().min(0).max(100)
  }),
  assets: z.object({
    totalFiles: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    byType: z.object({
      images: z.object({
        totalFiles: z.number().int().nonnegative(),
        totalBytes: z.number().int().nonnegative()
      }),
      videos: z.object({
        totalFiles: z.number().int().nonnegative(),
        totalBytes: z.number().int().nonnegative()
      }),
      audio: z.object({
        totalFiles: z.number().int().nonnegative(),
        totalBytes: z.number().int().nonnegative()
      })
    }),
    byGame: z.array(z.object({
      gameName: z.string().nullable(),
      totalFiles: z.number().int().nonnegative(),
      totalBytes: z.number().int().nonnegative()
    }))
  }),
  lastBackupAt: z.string().nullable()
});

export type StorageMetricsResponse = z.infer<typeof storageMetricsResponseSchema>;

// ============================================================================
// DISCOUNT CODES
// ============================================================================

export const createDiscountCodeSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  description: z.string().max(500).optional(),
  type: z.enum(['percent', 'fixed_amount']),
  percentOff: z.number().int().min(0).max(100).optional(),
  amountOffCents: z.number().int().nonnegative().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional().nullable(),
  appliesTo: z.enum(['all', 'selected']).default('all'),
  gameIds: z.array(z.string()).optional(), // Only if appliesTo='selected'
  minimumPartySize: z.number().int().positive().optional(),
  notes: z.string().max(500).optional()
}).refine(
  (data) => {
    // Must have either percentOff or amountOffCents
    if (data.type === 'percent' && !data.percentOff) return false;
    if (data.type === 'fixed_amount' && !data.amountOffCents) return false;
    return true;
  },
  {
    message: 'Must provide percentOff for percent type or amountOffCents for fixed_amount type'
  }
).refine(
  (data) => {
    // If appliesTo='selected', must provide gameIds
    if (data.appliesTo === 'selected' && (!data.gameIds || data.gameIds.length === 0)) return false;
    return true;
  },
  {
    message: 'Must provide at least one gameId when appliesTo is "selected"',
    path: ['gameIds']
  }
);

export const updateDiscountCodeSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase().optional(),
  description: z.string().max(500).optional(),
  percentOff: z.number().int().min(0).max(100).optional(),
  amountOffCents: z.number().int().nonnegative().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional().nullable(),
  appliesTo: z.enum(['all', 'selected']).optional(),
  gameIds: z.array(z.string()).optional(),
  minimumPartySize: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  archived: z.boolean().optional() // For archiving
});

export type CreateDiscountCodeRequest = z.infer<typeof createDiscountCodeSchema>;
export type UpdateDiscountCodeRequest = z.infer<typeof updateDiscountCodeSchema>;
