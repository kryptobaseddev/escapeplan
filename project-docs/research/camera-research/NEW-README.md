# Camera Support - Complete Package

## What's Included

### 1. **camera-schema-mvp.ts** - Database Schema
- 2 tables: `cameras` (enhanced) + `camera_streams` (dual-stream)
- Migration guide from your current schema
- Clean, focused data model

### 2. **camera-discovery.ts** - Discovery & Validation
- Stream validation with FFprobe
- Network scanning (Phase 2)
- ONVIF discovery (Phase 3)
- Brand detection utilities

### 3. **camera-templates.json** - Brand Templates
- 15+ camera models with full specs
- 8 major brands (Reolink, Hikvision, Dahua, Amcrest, Axis, Tapo, TP-Link, Foscam)
- Auto-configuration for port, paths, capabilities
- PTZ specs, video specs, recommended settings
- Brand-specific notes and quirks

### 4. **camera-help.json** - User Help System
- Field-by-field tooltips and guidance
- Troubleshooting workflows
- Best practices
- Security notes
- Complete glossary

### 5. **camera-settings-ui-mvp.svelte** - UI Component
- Simplified for 2-table schema
- Brand/model selection with auto-config
- Test connection integration
- Feature detection (PTZ, audio, IR)
- DaisyUI styling

### 6. **CAMERA_SUPPORT_DEVELOPER_DOCS.md** - Technical Reference
- Brand-specific implementation details
- RTSP URL formats for all brands
- PTZ control examples
- Audio/IR management
- Security best practices
- Troubleshooting guide

### 7. **SIMPLE_IMPLEMENTATION.md** - Build Guide
- MVP implementation (8-12 hours)
- Phase 2 & 3 roadmap
- Migration steps
- Testing checklist

---

## Database Approach

**MVP uses 2 tables:**
- `cameras` - Enhanced with brand, model, dual streams, capabilities, settings
- `camera_streams` - Independent stream configurations

**What's NOT in MVP** (add later when needed):
- PTZ presets/patrols tables
- Events/recordings tables  
- Templates table (using JSON file instead)
- Logs table (using console for now)

---

## The MVP (What You Build First)

### Backend (3 endpoints)
```typescript
POST /api/cameras/test      // Validate stream
GET  /api/camera-templates  // Load brand templates
POST /api/cameras           // Create with auto-config
```

### Frontend (Simple workflow)
1. Select brand → auto-fills port, paths
2. Enter IP, credentials
3. Test connection
4. Add camera

**Effort:** 8-12 hours

---

## Files Map

| File | Purpose | Size |
|------|---------|------|
| **camera-schema-mvp.ts** | Database schema + migration | 4.4KB |
| **camera-discovery.ts** | Validation & discovery functions | 6.0KB |
| **camera-templates.json** | 15+ brand/model configs | 23KB |
| **camera-help.json** | Help text & tooltips | 20KB |
| **camera-settings-ui-mvp.svelte** | UI component | 8KB |
| **CAMERA_SUPPORT_DEVELOPER_DOCS.md** | Technical reference | 31KB |
| **SIMPLE_IMPLEMENTATION.md** | Build guide | 6.0KB |

---

## Quick Start

1. **Migrate database** (camera-schema-mvp.ts)
2. **Copy discovery utilities** (camera-discovery.ts)
3. **Load templates** (camera-templates.json)
4. **Build UI** (camera-settings-ui-mvp.svelte)
5. **Test** with each brand

---

## Future Phases

### Phase 2: Network Scan (8 hours)
- Scan 10.10.10.0/24 for cameras
- Test URL patterns
- Present discovered cameras

### Phase 3: ONVIF Discovery (12 hours)
- WS-Discovery probe
- Auto-fill from ONVIF
- One-click add

---

## What's in the Comprehensive Docs

The developer documentation and templates include:
- **8 major camera brands** with detailed specs
- **15+ specific camera models** with optimized settings
- **PTZ control** implementation (ONVIF + brand-specific)
- **Audio/IR management** with codec details
- **Security best practices** (encryption, isolation)
- **Troubleshooting** guides for common issues
- **Performance optimization** for Raspberry Pi

Use these as reference when implementing MVP and future phases.

❌ PTZ presets table
❌ PTZ patrols table
❌ Camera events table
❌ Camera recordings table
❌ Camera templates table (using JSON instead)
❌ Camera logs table (use console for now)
❌ 100+ page developer docs
❌ Complex UI mockup with every feature

---

## The Actual MVP (What You Build First)

### Database Migration
```sql
-- Add 12 new columns to cameras table
-- Create camera_streams table
-- Migrate existing stream_path to main_stream_path
```

### Backend API (3 endpoints)
```typescript
POST /api/cameras/test      // Validate stream with ffprobe
GET  /api/camera-brands     // Return brand templates
POST /api/cameras           // Create with auto-config from brand
```

### Frontend (Simple Form)
```
1. Select brand (dropdown)
2. Auto-fills port & paths from template
3. User enters IP, username, password
4. Click "Test Connection"
5. Shows stream info if valid
6. Click "Add Camera"
```

**Total Effort:** 8-12 hours

---

## Future Phases (Build After MVP Works)

### Phase 2: Network Scan (8 hours)
- Add "Scan Network" button
- Uses `evilscan` to find cameras
- Tests URL patterns to detect brand
- User picks cameras to add

### Phase 3: ONVIF Discovery (12 hours)
- Add "Discover ONVIF" button
- Uses `node-onvif` to probe network
- Pre-fills everything from ONVIF
- One-click add

### Phase 4: Advanced Features (Later)
- PTZ presets (save positions)
- PTZ patrols (auto-routes)
- Event logging (motion, tampering)
- Recording management

---

## File Map

| File | What It Does | When You Need It |
|------|--------------|------------------|
| `camera-schema-mvp.ts` | Database schema | MVP migration |
| `camera-discovery.ts` | Discovery functions | MVP (validation)<br>Phase 2 (scan)<br>Phase 3 (ONVIF) |
| `camera-brands.json` | Brand templates | MVP (load in UI) |
| `SIMPLE_IMPLEMENTATION.md` | Build guide | MVP (read first) |

---

## Quick Start

1. **Read SIMPLE_IMPLEMENTATION.md** (10 min)
2. **Copy camera-schema-mvp.ts** to your project
3. **Run database migration** (add columns, create table)
4. **Copy camera-discovery.ts** utilities
5. **Load camera-brands.json** in your UI
6. **Build the form:**
   - Brand dropdown → auto-fills from JSON
   - IP, username, password inputs
   - Test connection button → calls validateCameraStream()
   - Add camera → saves to DB with brand info

**That's it for MVP.**

---

## Why This is Better Than the 150-Page Version

**Before (Over-Engineered):**
- 8 database tables (6 unused)
- 150+ pages of documentation
- 15+ camera model configs
- Complex UI with PTZ/Audio/IR
- 26-38 hour estimate

**Now (Simplified):**
- 2 database tables (exactly what's needed)
- 4 focused documents (~30 pages total)
- 8 brand templates (essentials only)
- Simple form with auto-config
- 8-12 hour estimate

---

## What You Learned

**The Research (CAMERA_DISCOVERY_OPTIONS.md) was already correct:**
- Phase 1: Manual entry ✅
- Phase 2: Network scan
- Phase 3: ONVIF discovery
- Phase 4: Templates

**I just added:**
- The missing brand templates (JSON)
- The actual discovery functions (TypeScript)
- Enhanced schema for multi-brand support
- Simplified implementation guide

**Bottom Line:**
Build MVP first (manual entry + brand templates), then add discovery features when they're actually needed.
