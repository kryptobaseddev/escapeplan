/**
 * EscapePlan Camera Schema - MVP (Simplified)
 * Just what you need for multi-brand support, nothing extra
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// CAMERAS TABLE - Enhanced for multi-brand support
// ============================================================================

export const cameras = sqliteTable('cameras', {
  // Identity
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  
  // Brand/Model for auto-config
  brand: text('brand').notNull(), // 'reolink' | 'hikvision' | 'dahua' | 'amcrest' | 'axis' | 'tapo' | 'foscam' | 'generic'
  model: text('model'), // Optional specific model
  
  // Game Association
  game_id: text('game_id'),
  
  // Network
  host: text('host').notNull(),
  port: integer('port').notNull().default(554),
  
  // Auth (encrypted)
  username: text('username'),
  password_encrypted: text('password_encrypted'),
  
  // Protocol
  protocol: text('protocol').notNull().default('rtsp'), // 'rtsp' | 'onvif' | 'mjpeg'
  
  // Stream Paths
  main_stream_path: text('main_stream_path').notNull(),
  sub_stream_path: text('sub_stream_path'),
  
  // Simple Capabilities (booleans)
  has_ptz: integer('has_ptz', { mode: 'boolean' }).default(false),
  has_audio: integer('has_audio', { mode: 'boolean' }).default(false),
  has_ir_control: integer('has_ir_control', { mode: 'boolean' }).default(false),
  
  // Current Settings
  ir_mode: text('ir_mode').default('auto'), // 'auto' | 'on' | 'off'
  audio_volume: integer('audio_volume').default(80), // 0-100
  
  // PTZ Current Position (if has_ptz=true)
  ptz_pan: real('ptz_pan'),
  ptz_tilt: real('ptz_tilt'),
  ptz_zoom: real('ptz_zoom'),
  
  // Status
  status: text('status').default('offline'), // 'online' | 'offline' | 'error'
  last_seen: text('last_seen'),
  error_message: text('error_message'),
  
  // Timestamps
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// ============================================================================
// CAMERA_STREAMS TABLE - Dual-stream configuration
// ============================================================================

export const cameraStreams = sqliteTable('camera_streams', {
  id: text('id').primaryKey(),
  camera_id: text('camera_id').notNull().references(() => cameras.id, { onDelete: 'cascade' }),
  
  stream_type: text('stream_type').notNull(), // 'main' | 'sub'
  stream_path: text('stream_path').notNull(),
  
  resolution: text('resolution').notNull(), // '1920x1080'
  frame_rate: integer('frame_rate').notNull(), // 15, 20, 30
  codec: text('codec'), // 'h264' | 'h265' | 'mjpeg'
  
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Camera = typeof cameras.$inferSelect;
export type NewCamera = typeof cameras.$inferInsert;
export type CameraStream = typeof cameraStreams.$inferSelect;

// ============================================================================
// MIGRATION FROM YOUR CURRENT SCHEMA
// ============================================================================

/**
 * To migrate from your current schema:
 * 
 * 1. Add new columns:
 *    ALTER TABLE cameras ADD COLUMN brand TEXT NOT NULL DEFAULT 'generic';
 *    ALTER TABLE cameras ADD COLUMN model TEXT;
 *    ALTER TABLE cameras ADD COLUMN main_stream_path TEXT;
 *    ALTER TABLE cameras ADD COLUMN sub_stream_path TEXT;
 *    ALTER TABLE cameras ADD COLUMN has_ptz INTEGER DEFAULT 0;
 *    ALTER TABLE cameras ADD COLUMN has_audio INTEGER DEFAULT 0;
 *    ALTER TABLE cameras ADD COLUMN has_ir_control INTEGER DEFAULT 0;
 *    ALTER TABLE cameras ADD COLUMN ir_mode TEXT DEFAULT 'auto';
 *    ALTER TABLE cameras ADD COLUMN audio_volume INTEGER DEFAULT 80;
 *    ALTER TABLE cameras ADD COLUMN ptz_pan REAL;
 *    ALTER TABLE cameras ADD COLUMN ptz_tilt REAL;
 *    ALTER TABLE cameras ADD COLUMN ptz_zoom REAL;
 * 
 * 2. Migrate existing data:
 *    UPDATE cameras SET main_stream_path = stream_path;
 *    UPDATE cameras SET brand = (detect from stream_path pattern);
 * 
 * 3. Create camera_streams table (run Drizzle migration)
 */
