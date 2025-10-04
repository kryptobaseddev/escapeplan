/**
 * EscapePlan Camera Database Schema
 * Enhanced for multi-brand camera support with PTZ, audio, IR, and dual-stream capabilities
 * 
 * Stack: Drizzle ORM + SQLite
 * Platform: Raspberry Pi 4+ / Node.js
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// ============================================================================
// CAMERAS TABLE - Core camera configuration
// ============================================================================

export const cameras = sqliteTable('cameras', {
  // Identity
  id: text('id').primaryKey(), // UUID v4
  name: text('name').notNull(),
  
  // Brand & Model
  brand: text('brand').notNull(), // 'reolink' | 'hikvision' | 'dahua' | 'amcrest' | 'axis' | 'tapo' | 'tplink' | 'foscam' | 'generic'
  model: text('model'), // Specific model number, optional
  
  // Game Association (1-to-1)
  game_id: text('game_id').references(() => games.id, { onDelete: 'set null' }),
  
  // Primary Protocol
  protocol: text('protocol').notNull(), // 'rtsp' | 'onvif' | 'mjpeg'
  
  // Network Configuration
  host: text('host').notNull(), // IP address or hostname
  port: integer('port').notNull().default(554),
  
  // Authentication
  username: text('username'),
  password_encrypted: text('password_encrypted'), // Encrypted with libsodium
  
  // Primary Stream Configuration
  main_stream_path: text('main_stream_path'), // e.g., "/Streaming/Channels/101"
  sub_stream_path: text('sub_stream_path'), // e.g., "/Streaming/Channels/102"
  
  // ONVIF Specific
  onvif_port: integer('onvif_port').default(80), // Usually 80, Tapo uses 2020
  onvif_profile_token: text('onvif_profile_token'), // Cached from ONVIF discovery
  video_source_token: text('video_source_token'), // For imaging/IR control
  
  // Default Stream Settings
  default_resolution: text('default_resolution').default('1920x1080'), // '3840x2160' | '2560x1440' | '1920x1080' | '1280x720' | '640x480'
  default_frame_rate: integer('default_frame_rate').default(15), // FPS
  transport: text('transport').default('tcp'), // 'tcp' | 'udp' | 'http'
  
  // Capability Flags (from template or ONVIF discovery)
  has_ptz: integer('has_ptz', { mode: 'boolean' }).default(false),
  has_audio: integer('has_audio', { mode: 'boolean' }).default(false),
  has_two_way_audio: integer('has_two_way_audio', { mode: 'boolean' }).default(false),
  has_ir_control: integer('has_ir_control', { mode: 'boolean' }).default(false),
  has_dual_stream: integer('has_dual_stream', { mode: 'boolean' }).default(true),
  
  // IR/Night Vision Settings
  ir_mode: text('ir_mode').default('auto'), // 'auto' | 'on' | 'off'
  
  // Audio Settings
  audio_enabled: integer('audio_enabled', { mode: 'boolean' }).default(true),
  audio_volume: integer('audio_volume').default(80), // 0-100
  
  // Status & Health
  status: text('status').default('offline'), // 'online' | 'offline' | 'testing' | 'error' | 'connecting'
  last_seen: text('last_seen'), // ISO 8601 timestamp
  last_successful_connection: text('last_successful_connection'),
  error_message: text('error_message'),
  error_count: integer('error_count').default(0),
  
  // Stream Health Metrics
  current_fps: integer('current_fps'),
  current_bitrate: integer('current_bitrate'), // Kbps
  packet_loss: real('packet_loss'), // Percentage
  
  // HLS Streaming (for web playback)
  hls_enabled: integer('hls_enabled', { mode: 'boolean' }).default(false),
  hls_path: text('hls_path'), // /streams/camera-id/stream.m3u8
  
  // PTZ Current Position (if applicable)
  ptz_pan: real('ptz_pan'), // -1.0 to 1.0
  ptz_tilt: real('ptz_tilt'), // -1.0 to 1.0
  ptz_zoom: real('ptz_zoom'), // 0.0 to 1.0
  
  // Metadata
  firmware_version: text('firmware_version'),
  manufacturer_info: text('manufacturer_info'), // JSON string with additional info
  notes: text('notes'),
  
  // Timestamps
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  gameIdIdx: index('idx_cameras_game').on(table.game_id),
  statusIdx: index('idx_cameras_status').on(table.status),
  brandIdx: index('idx_cameras_brand').on(table.brand),
  hostIdx: index('idx_cameras_host').on(table.host)
}));

// ============================================================================
// CAMERA_STREAMS TABLE - Dual-stream configuration
// ============================================================================

export const cameraStreams = sqliteTable('camera_streams', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  // Stream Type
  stream_type: text('stream_type').notNull(), // 'main' | 'sub' | 'third'
  stream_path: text('stream_path').notNull(), // URL path segment
  
  // Video Configuration
  resolution: text('resolution').notNull(), // '1920x1080'
  frame_rate: integer('frame_rate').notNull(), // FPS
  video_codec: text('video_codec'), // 'h264' | 'h265' | 'mjpeg'
  bitrate: integer('bitrate'), // Kbps
  gop_size: integer('gop_size'), // Keyframe interval
  
  // Audio Configuration
  audio_codec: text('audio_codec'), // 'aac' | 'g711a' | 'g711u' | 'pcm'
  audio_sample_rate: integer('audio_sample_rate'), // 8000 | 16000 | 44100
  audio_bitrate: integer('audio_bitrate'), // Kbps
  
  // Stream Health
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  last_validated: text('last_validated'),
  
  // Timestamps
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_camera_streams_camera').on(table.camera_id),
  streamTypeIdx: index('idx_camera_streams_type').on(table.stream_type)
}));

// ============================================================================
// PTZ_PRESETS TABLE - Saved PTZ positions
// ============================================================================

export const ptzPresets = sqliteTable('ptz_presets', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  // Preset Identity
  name: text('name').notNull(),
  preset_token: text('preset_token'), // ONVIF preset token (if applicable)
  preset_index: integer('preset_index'), // Numeric index (some cameras use numbers)
  
  // Position Values
  pan: real('pan').notNull(), // -1.0 to 1.0 or absolute degrees
  tilt: real('tilt').notNull(), // -1.0 to 1.0 or absolute degrees
  zoom: real('zoom').notNull(), // 0.0 to 1.0
  
  // Optional: Absolute position (degrees)
  pan_degrees: real('pan_degrees'),
  tilt_degrees: real('tilt_degrees'),
  
  // UI Display
  thumbnail_url: text('thumbnail_url'), // Snapshot when preset saved
  is_home_position: integer('is_home_position', { mode: 'boolean' }).default(false),
  
  // Metadata
  description: text('description'),
  
  // Timestamps
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_ptz_presets_camera').on(table.camera_id),
  nameIdx: index('idx_ptz_presets_name').on(table.name)
}));

// ============================================================================
// PTZ_PATROLS TABLE - Auto-patrol sequences
// ============================================================================

export const ptzPatrols = sqliteTable('ptz_patrols', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  preset_sequence: text('preset_sequence').notNull(), // JSON array of preset IDs
  dwell_time: integer('dwell_time').default(5000), // Milliseconds at each preset
  transition_speed: real('transition_speed').default(0.5), // 0.0 to 1.0
  
  is_active: integer('is_active', { mode: 'boolean' }).default(false),
  
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_ptz_patrols_camera').on(table.camera_id)
}));

// ============================================================================
// CAMERA_EVENTS TABLE - Motion detection, tampering, etc.
// ============================================================================

export const cameraEvents = sqliteTable('camera_events', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  event_type: text('event_type').notNull(), // 'motion' | 'tampering' | 'audio_detected' | 'connection_lost' | 'connection_restored'
  event_source: text('event_source'), // 'onvif' | 'ffmpeg' | 'system'
  
  severity: text('severity').default('info'), // 'info' | 'warning' | 'error' | 'critical'
  
  // Event Data
  event_data: text('event_data'), // JSON string with event-specific data
  snapshot_url: text('snapshot_url'),
  video_clip_url: text('video_clip_url'),
  
  // Game Integration
  triggered_game_event: integer('triggered_game_event', { mode: 'boolean' }).default(false),
  
  // Status
  acknowledged: integer('acknowledged', { mode: 'boolean' }).default(false),
  acknowledged_at: text('acknowledged_at'),
  acknowledged_by: text('acknowledged_by'),
  
  occurred_at: text('occurred_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_camera_events_camera').on(table.camera_id),
  typeIdx: index('idx_camera_events_type').on(table.event_type),
  occurredIdx: index('idx_camera_events_occurred').on(table.occurred_at)
}));

// ============================================================================
// CAMERA_RECORDINGS TABLE - Recording sessions
// ============================================================================

export const cameraRecordings = sqliteTable('camera_recordings', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  game_id: text('game_id').references(() => games.id, { onDelete: 'set null' }),
  
  recording_type: text('recording_type').notNull(), // 'continuous' | 'motion' | 'manual' | 'game_session'
  
  // File Information
  file_path: text('file_path').notNull(),
  file_size: integer('file_size'), // Bytes
  duration: integer('duration'), // Seconds
  
  // Video Metadata
  resolution: text('resolution'),
  codec: text('codec'),
  fps: integer('fps'),
  bitrate: integer('bitrate'),
  
  // Timestamps
  started_at: text('started_at').notNull(),
  ended_at: text('ended_at'),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_recordings_camera').on(table.camera_id),
  gameIdIdx: index('idx_recordings_game').on(table.game_id),
  startedIdx: index('idx_recordings_started').on(table.started_at),
  typeIdx: index('idx_recordings_type').on(table.recording_type)
}));

// ============================================================================
// CAMERA_TEMPLATES TABLE - Brand/model presets (optional, can use JSON file)
// ============================================================================

export const cameraTemplates = sqliteTable('camera_templates', {
  id: text('id').primaryKey(),
  
  brand: text('brand').notNull(),
  model: text('model'),
  model_series: text('model_series'), // e.g., "RLC-8xx" for Reolink
  
  // Connection Defaults
  default_port: integer('default_port').notNull(),
  default_onvif_port: integer('default_onvif_port'),
  protocol: text('protocol').notNull(),
  
  // Stream Paths
  main_stream_path: text('main_stream_path').notNull(),
  sub_stream_path: text('sub_stream_path'),
  third_stream_path: text('third_stream_path'),
  
  // Capabilities
  has_ptz: integer('has_ptz', { mode: 'boolean' }).default(false),
  has_audio: integer('has_audio', { mode: 'boolean' }).default(false),
  has_two_way_audio: integer('has_two_way_audio', { mode: 'boolean' }).default(false),
  has_ir_control: integer('has_ir_control', { mode: 'boolean' }).default(false),
  has_onvif: integer('has_onvif', { mode: 'boolean' }).default(true),
  
  // Recommended Settings
  recommended_transport: text('recommended_transport').default('tcp'),
  recommended_timeout: integer('recommended_timeout').default(10000),
  
  // Additional Info
  notes: text('notes'),
  documentation_url: text('documentation_url'),
  
  // Versioning
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  brandIdx: index('idx_templates_brand').on(table.brand),
  brandModelIdx: index('idx_templates_brand_model').on(table.brand, table.model)
}));

// ============================================================================
// CAMERA_LOGS TABLE - Connection attempts, errors, diagnostics
// ============================================================================

export const cameraLogs = sqliteTable('camera_logs', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  log_level: text('log_level').notNull(), // 'debug' | 'info' | 'warning' | 'error'
  log_type: text('log_type').notNull(), // 'connection' | 'stream' | 'ptz' | 'config' | 'health'
  
  message: text('message').notNull(),
  details: text('details'), // JSON string with additional context
  
  // Performance Metrics (optional)
  response_time: integer('response_time'), // Milliseconds
  
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  cameraIdIdx: index('idx_logs_camera').on(table.camera_id),
  levelIdx: index('idx_logs_level').on(table.log_level),
  typeIdx: index('idx_logs_type').on(table.log_type),
  createdIdx: index('idx_logs_created').on(table.created_at)
}));

// ============================================================================
// RELATIONS - Drizzle ORM relations for easier querying
// ============================================================================

export const camerasRelations = relations(cameras, ({ one, many }) => ({
  game: one(games, {
    fields: [cameras.game_id],
    references: [games.id]
  }),
  streams: many(cameraStreams),
  ptzPresets: many(ptzPresets),
  ptzPatrols: many(ptzPatrols),
  events: many(cameraEvents),
  recordings: many(cameraRecordings),
  logs: many(cameraLogs)
}));

export const cameraStreamsRelations = relations(cameraStreams, ({ one }) => ({
  camera: one(cameras, {
    fields: [cameraStreams.camera_id],
    references: [cameras.id]
  })
}));

export const ptzPresetsRelations = relations(ptzPresets, ({ one }) => ({
  camera: one(cameras, {
    fields: [ptzPresets.camera_id],
    references: [cameras.id]
  })
}));

export const ptzPatrolsRelations = relations(ptzPatrols, ({ one }) => ({
  camera: one(cameras, {
    fields: [ptzPatrols.camera_id],
    references: [cameras.id]
  })
}));

export const cameraEventsRelations = relations(cameraEvents, ({ one }) => ({
  camera: one(cameras, {
    fields: [cameraEvents.camera_id],
    references: [cameras.id]
  })
}));

export const cameraRecordingsRelations = relations(cameraRecordings, ({ one }) => ({
  camera: one(cameras, {
    fields: [cameraRecordings.camera_id],
    references: [cameras.id]
  }),
  game: one(games, {
    fields: [cameraRecordings.game_id],
    references: [games.id]
  })
}));

export const cameraLogsRelations = relations(cameraLogs, ({ one }) => ({
  camera: one(cameras, {
    fields: [cameraLogs.camera_id],
    references: [cameras.id]
  })
}));

// ============================================================================
// TYPE EXPORTS - For use in application code
// ============================================================================

export type Camera = typeof cameras.$inferSelect;
export type NewCamera = typeof cameras.$inferInsert;

export type CameraStream = typeof cameraStreams.$inferSelect;
export type NewCameraStream = typeof cameraStreams.$inferInsert;

export type PtzPreset = typeof ptzPresets.$inferSelect;
export type NewPtzPreset = typeof ptzPresets.$inferInsert;

export type PtzPatrol = typeof ptzPatrols.$inferSelect;
export type NewPtzPatrol = typeof ptzPatrols.$inferInsert;

export type CameraEvent = typeof cameraEvents.$inferSelect;
export type NewCameraEvent = typeof cameraEvents.$inferInsert;

export type CameraRecording = typeof cameraRecordings.$inferSelect;
export type NewCameraRecording = typeof cameraRecordings.$inferInsert;

export type CameraTemplate = typeof cameraTemplates.$inferSelect;
export type NewCameraTemplate = typeof cameraTemplates.$inferInsert;

export type CameraLog = typeof cameraLogs.$inferSelect;
export type NewCameraLog = typeof cameraLogs.$inferInsert;

// ============================================================================
// MIGRATION NOTES
// ============================================================================

/**
 * Migration from existing schema:
 * 
 * 1. Add new columns to cameras table:
 *    - brand, model
 *    - main_stream_path, sub_stream_path (replace stream_path)
 *    - onvif_port, onvif_profile_token, video_source_token
 *    - has_ptz, has_audio, has_two_way_audio, has_ir_control, has_dual_stream
 *    - ir_mode, audio_enabled, audio_volume
 *    - current_fps, current_bitrate, packet_loss
 *    - hls_enabled, hls_path
 *    - ptz_pan, ptz_tilt, ptz_zoom
 *    - firmware_version, manufacturer_info, notes
 * 
 * 2. Data migration:
 *    - Parse existing stream_path to determine brand
 *    - Split resolution into default_resolution
 *    - Move stream_path to main_stream_path
 * 
 * 3. Create new tables:
 *    - camera_streams
 *    - ptz_presets
 *    - ptz_patrols
 *    - camera_events
 *    - camera_recordings
 *    - camera_templates (optional)
 *    - camera_logs
 * 
 * 4. Backward Compatibility:
 *    - Keep resolution and frame_rate columns for now (deprecated)
 *    - stream_path can be computed from main_stream_path
 *    - Add migration script to populate camera_streams from existing data
 */
