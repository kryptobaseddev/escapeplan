# Room Display Schema Changes - Git-Style Diffs

## 1. Schema Changes (`packages/contracts/src/schema.ts`)

### Added `room_display_config` to `games` table

```diff
  camera_ids: text('camera_ids', { mode: 'json' }).default(sql`'[]'`),
  media_config: text('media_config', { mode: 'json' }),
+ room_display_config: text('room_display_config', { mode: 'json' }), // Room Display background and visual settings
  pricing_config: text('pricing_config', { mode: 'json' }),
  booking_rules_config: text('booking_rules_config', { mode: 'json' }),
```

### Added display settings to `game_milestones` table

```diff
  trigger_type: text('trigger_type').notNull(),
  trigger_config: text('trigger_config', { mode: 'json' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
+ // Media display settings
+ display_duration_seconds: integer('display_duration_seconds'),
+ loop: integer('loop', { mode: 'boolean' }).notNull().default(false),
+ loop_count: integer('loop_count'),
+ auto_dismiss: integer('auto_dismiss', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
```

---

## 2. Validation Changes (`packages/contracts/src/validation.ts`)

### Updated `hintSchema` - Added display settings

```diff
  penaltySeconds: z.number().int().min(0).max(300).default(0),
  penaltyEnabled: z.boolean().default(false),
- countAsHint: z.boolean().default(true)
+ countAsHint: z.boolean().default(true),
+
+ // Media display settings
+ displayDurationSeconds: z.number().int().positive().optional(),
+ loop: z.boolean().default(false),
+ loopCount: z.number().int().positive().optional(),
+ autoDismiss: z.boolean().default(true)
});
```

### Updated `milestoneSchema` - Added display settings

```diff
  triggerType: z.enum(['manual', 'timer', 'condition']),
  triggerConfig: z.record(z.any()).nullable().optional(),
- enabled: z.boolean().default(true)
+ enabled: z.boolean().default(true),
+
+ // Media display settings
+ displayDurationSeconds: z.number().int().positive().optional(),
+ loop: z.boolean().default(false),
+ loopCount: z.number().int().positive().optional(),
+ autoDismiss: z.boolean().default(true)
});
```

### Updated `mediaConfigSchema` - Removed deprecated field

```diff
export const mediaConfigSchema = z.object({
  thumbnailAssetId: z.string().optional(),
- roomScreenAssetId: z.string().optional(),
  galleryAssetIds: z.array(z.string()).default([])
}).optional();
```

### NEW: `roomDisplayConfigSchema`

```diff
+ // Room Display config schema
+ export const roomDisplayConfigSchema = z.object({
+   backgroundType: z.enum(['asset', 'solid', 'gradient']).default('solid'),
+   backgroundAssetId: z.string().optional(),
+   backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
+   gradientFrom: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
+   gradientTo: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
+   gradientDirection: z.enum(['to-b', 'to-t', 'to-r', 'to-l', 'to-br', 'to-tl', 'radial']).default('to-b'),
+   backgroundOpacity: z.number().int().min(0).max(100).default(40),
+   defaultMediaScale: z.number().int().min(10).max(100).default(90),
+   showTimer: z.boolean().default(true),
+   timerPosition: z.enum(['center', 'top', 'bottom']).default('center'),
+   textHintTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
+   textHintBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFA500')
+ }).optional();
```

### Updated `saveGameSchema` - Added roomDisplayConfig

```diff
  // Config objects
  media: mediaConfigSchema,
+ roomDisplayConfig: roomDisplayConfigSchema,
  pricing: pricingConfigSchema,
  bookingRules: bookingRulesSchema
});
```

### Added type export

```diff
export type GameMediaConfig = z.infer<typeof mediaConfigSchema>;
+ export type RoomDisplayConfig = z.infer<typeof roomDisplayConfigSchema>;
export type GamePricingConfig = z.infer<typeof pricingConfigSchema>;
```

---

## 3. API State Changes (`apps/escapeplan-api/src/state.ts`)

### Removed `roomScreenAssetId` from media config

```diff
    media: mediaConfig
      ? {
          thumbnailAssetId: mediaConfig.thumbnailAssetId ?? undefined,
-         roomScreenAssetId: mediaConfig.roomScreenAssetId ?? undefined,
          galleryAssetIds: mediaConfig.galleryAssetIds ?? []
        }
      : undefined,
```

---

## 4. Frontend Component Changes

### `GameModal.svelte` - Removed roomScreenAssetId references

```diff
  async function fetchGameAssets() {
    const assetIds: string[] = [];
    if (workingGame.media?.thumbnailAssetId) assetIds.push(workingGame.media.thumbnailAssetId);
-   if (workingGame.media?.roomScreenAssetId) assetIds.push(workingGame.media.roomScreenAssetId);
    if (workingGame.media?.galleryAssetIds) assetIds.push(...workingGame.media.galleryAssetIds);
    await Promise.all(assetIds.map(fetchAsset));
  }
```

```diff
    const media: GameMediaConfig = {
      thumbnailAssetId: workingGame.media?.thumbnailAssetId || undefined,
-     roomScreenAssetId: workingGame.media?.roomScreenAssetId || undefined,
      galleryAssetIds: workingGame.media?.galleryAssetIds?.filter(Boolean) ?? []
    };
```

```diff
      {:else if activeTab === 'media'}
        <GameMediaSection
          gameSlug={workingGame.slug}
          bind:coverImageId={workingGame.media!.thumbnailAssetId}
-         bind:backgroundImageId={workingGame.media!.roomScreenAssetId}
          bind:galleryImageIds={workingGame.media!.galleryAssetIds}
          assetCache={assetCache}
          onCoverImageChange={(val) => { if (workingGame.media) workingGame.media.thumbnailAssetId = val; markDirty(); }}
-         onBackgroundImageChange={(val) => { if (workingGame.media) workingGame.media.roomScreenAssetId = val; markDirty(); }}
          onGalleryImagesChange={(val) => { if (workingGame.media) workingGame.media.galleryAssetIds = val; markDirty(); }}
          onAssetCacheUpdate={(assetId, asset) => { assetCache[assetId] = asset; }}
        />
```

### `GameMediaSection.svelte` - Removed backgroundImageId prop and section

```diff
  interface Props {
    gameSlug: string;
    coverImageId: string | undefined;
-   backgroundImageId: string | undefined;
    galleryImageIds: string[];
    assetCache: Record<string, { url: string; filename: string }>;
    onCoverImageChange: (assetId: string | undefined) => void;
-   onBackgroundImageChange: (assetId: string | undefined) => void;
    onGalleryImagesChange: (assetIds: string[]) => void;
    onAssetCacheUpdate: (assetId: string, asset: { url: string; filename: string }) => void;
  }

  let {
    gameSlug,
    coverImageId = $bindable(),
-   backgroundImageId = $bindable(),
    galleryImageIds = $bindable(),
    assetCache,
    onCoverImageChange,
-   onBackgroundImageChange,
    onGalleryImagesChange,
    onAssetCacheUpdate
  }: Props = $props();
```

```diff
  </section>

- <!-- Room Display Background -->
- <section class="space-y-3">
-   <div class="flex items-center justify-between">
-     <h3 class="text-base font-semibold text-base-content">Room Display Background</h3>
-     {#if backgroundImageId}
-       <button
-         type="button"
-         class="btn btn-xs btn-ghost text-error"
-         onclick={() => {
-           onBackgroundImageChange(undefined);
-         }}
-       >
-         Remove
-       </button>
-     {/if}
-   </div>
-   {#if backgroundImageId}
-     ... [50+ lines removed]
-   {:else}
-     ... [asset upload and browser sections removed]
-   {/if}
- </section>

  <!-- Gallery Images -->
```

### Similar changes in:
- `routes/(app)/admin/games/create/+page.svelte`
- `routes/(app)/admin/games/[id]/edit/+page.svelte`

---

## 5. Database Migration SQL

### NEW: `MIGRATION_ROOM_DISPLAY_CONFIG.sql`

```sql
-- Add room_display_config column to games table
ALTER TABLE games ADD COLUMN room_display_config TEXT;

-- Add media display settings to game_milestones table
ALTER TABLE game_milestones ADD COLUMN display_duration_seconds INTEGER;
ALTER TABLE game_milestones ADD COLUMN loop INTEGER DEFAULT 0;
ALTER TABLE game_milestones ADD COLUMN loop_count INTEGER;
ALTER TABLE game_milestones ADD COLUMN auto_dismiss INTEGER DEFAULT 1;
```

---

## Summary of Changes

### Additions
- ✅ `games.room_display_config` column
- ✅ `game_milestones.display_duration_seconds` column
- ✅ `game_milestones.loop` column
- ✅ `game_milestones.loop_count` column
- ✅ `game_milestones.auto_dismiss` column
- ✅ `roomDisplayConfigSchema` validation schema
- ✅ Display settings in `hintSchema`
- ✅ Display settings in `milestoneSchema`
- ✅ `RoomDisplayConfig` TypeScript type
- ✅ `roomDisplayConfig` field in `saveGameSchema`

### Removals
- ✅ `roomScreenAssetId` from `mediaConfigSchema`
- ✅ `roomScreenAssetId` from `state.ts` media config mapping
- ✅ `roomScreenAssetId` from all frontend components (3 files)
- ✅ `backgroundImageId` prop from `GameMediaSection.svelte`
- ✅ "Room Display Background" section from `GameMediaSection.svelte` (~60 lines)

### Files Modified
- `packages/contracts/src/schema.ts`
- `packages/contracts/src/validation.ts`
- `apps/escapeplan-api/src/state.ts`
- `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
- `apps/escapeplan-web/src/lib/components/games/GameMediaSection.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/games/create/+page.svelte`
- `apps/escapeplan-web/src/routes/(app)/admin/games/[id]/edit/+page.svelte`

### Files Created
- `MIGRATION_ROOM_DISPLAY_CONFIG.sql`
- `ROOM_DISPLAY_SCHEMA_AUDIT_REPORT.md`
- `ROOM_DISPLAY_SCHEMA_CHANGES_DIFF.md` (this file)

---

## Next Steps

1. Run database migration
2. Rebuild contracts package
3. Test type safety
4. Verify functionality
5. Consider implementing new Room Display config UI in future update
