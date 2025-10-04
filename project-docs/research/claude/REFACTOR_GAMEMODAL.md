# REFACTOR GAMEMODAL.SVELTE - COMPLETE GUIDE

**Version:** 1.0.0
**Date:** 2025-10-03
**Status:** READY FOR EXECUTION
**Estimated Time:** 12-16 hours
**Priority:** HIGH (Deferred from Phase 2)

---

## 🎯 OBJECTIVE

Refactor `GameModal.svelte` (2,080 lines) by:
1. Splitting into 4+ sub-components
2. Wrapping with Modal.svelte
3. Converting all form fields to proper DaisyUI 5.1.26 patterns
4. Using validator classes for form validation
5. Maintaining ALL existing functionality

**CRITICAL:** This is a refactor, NOT a redesign. Preserve all business logic, features, and user workflows.

---

## 📊 CURRENT STATE

### File Information
- **Location:** `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`
- **Lines:** 2,080
- **Tabs:** 7 (Details, Media, Puzzles, Cameras, Pricing, Booking, Milestones)
- **Complexity:** Very High
  - Drag-and-drop puzzle/hint reordering
  - Asset upload/browser integration
  - Milestone media handling
  - Complex form validation
  - Tabbed interface

### Dependencies (Already Imported)
```typescript
import { enhance } from '$app/forms';
import { apiFetch } from '$lib/api/client';
import HintModal from './HintModal.svelte';
import AssetUpload from '../assets/AssetUpload.svelte';
import AssetBrowser from '../assets/AssetBrowser.svelte';
import HelpTooltip from '../ui/HelpTooltip.svelte';
```

### Business Logic to Preserve
- [x] Create/edit mode switching
- [x] 7 tabbed sections with navigation
- [x] Puzzle drag-and-drop reordering
- [x] Hint drag-and-drop reordering within puzzles
- [x] Asset upload for game media
- [x] Asset browser for selecting existing media
- [x] Milestone media upload (image/video)
- [x] Difficulty selection with star ratings
- [x] Pricing configuration (base price, per-person, max capacity)
- [x] Booking rules (lead time, cancellation policy)
- [x] Custom booking fields management
- [x] Camera assignment to games
- [x] Slug auto-generation from game name
- [x] Form validation for all fields
- [x] Error handling and display

---

## 🏗️ REFACTORING PLAN

### Phase 1: Create Sub-Components (8 hours)

Create 4 new sub-components that extract sections from GameModal:

#### 1.1 GameBasicInfoForm.svelte (2 hours)
**Location:** `apps/escapeplan-web/src/lib/components/games/GameBasicInfoForm.svelte`

**Responsibilities:**
- Game name input (with slug auto-generation)
- Slug input (editable, auto-syncs with name)
- Description textarea
- Duration input (minutes)
- Difficulty selector (Beginner→Expert with stars)
- Max players input
- Is mobile toggle

**Props Interface:**
```typescript
interface Props {
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  maxPlayers: number;
  isMobile: boolean;
  slugTouched: boolean;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onDescriptionChange: (description: string) => void;
  onDurationChange: (minutes: number) => void;
  onDifficultyChange: (difficulty: string) => void;
  onMaxPlayersChange: (players: number) => void;
  onIsMobileChange: (isMobile: boolean) => void;
  onSlugTouched: () => void;
}
```

**DaisyUI Patterns to Use:**
- `<fieldset class="fieldset">` for grouping name+slug
- `<legend class="fieldset-legend">` for "Game Identity"
- `validator` class on name input (required, min 3 chars)
- `validator-hint` for validation messages
- `<label class="form-control">` for standard fields
- Difficulty selector as radio group with custom styling

**Extract From GameModal Lines:** ~50-150

---

#### 1.2 GameMediaSection.svelte (3 hours)
**Location:** `apps/escapeplan-web/src/lib/components/games/GameMediaSection.svelte`

**Responsibilities:**
- Cover image upload/browse
- Gallery images upload/browse (multiple)
- Trailer video upload/browse
- Preview selected media with thumbnails
- Asset browser modal integration

**Props Interface:**
```typescript
interface Props {
  coverImageId: string | null;
  galleryImageIds: string[];
  trailerVideoId: string | null;
  assetCache: Record<string, { url: string; filename: string }>;
  onCoverImageChange: (assetId: string | null) => void;
  onGalleryImagesChange: (assetIds: string[]) => void;
  onTrailerVideoChange: (assetId: string | null) => void;
  onAssetCacheUpdate: (assetId: string, asset: { url: string; filename: string }) => void;
}
```

**Components to Use:**
- `AssetUpload.svelte` (already exists)
- `AssetBrowser.svelte` (already exists)

**DaisyUI Patterns to Use:**
- `<fieldset class="fieldset">` for each media type
- `<legend class="fieldset-legend">` for "Cover Image", "Gallery", "Trailer"
- Preview cards with `card` class
- Remove buttons with `btn btn-circle btn-ghost btn-sm`

**Extract From GameModal Lines:** ~200-400

---

#### 1.3 GamePuzzlesSection.svelte (4 hours)
**Location:** `apps/escapeplan-web/src/lib/components/games/GamePuzzlesSection.svelte`

**Responsibilities:**
- Display list of puzzles
- Add new puzzle button
- Edit puzzle inline
- Delete puzzle with confirmation
- Drag-and-drop reordering (MUST PRESERVE)
- Puzzle collapse/expand
- Hints management per puzzle
  - Add hint button → opens HintModal
  - Display hints list
  - Edit hint → opens HintModal
  - Delete hint
  - Drag-and-drop hint reordering (MUST PRESERVE)

**Props Interface:**
```typescript
interface Props {
  puzzles: EditablePuzzle[];
  draggingPuzzleId: string | null;
  draggingHint: { puzzleId: string; hintId: string } | null;
  onPuzzlesChange: (puzzles: EditablePuzzle[]) => void;
  onDraggingPuzzleIdChange: (id: string | null) => void;
  onDraggingHintChange: (hint: { puzzleId: string; hintId: string } | null) => void;
  onOpenHintModal: (puzzle: EditablePuzzle, hint: EditableHint | null) => void;
}

interface EditablePuzzle extends GamePuzzleDefinition {
  hints: EditableHint[];
}

interface EditableHint extends GameHintDefinition {}
```

**DaisyUI Patterns to Use:**
- `collapse` for puzzle expand/collapse
- `collapse-title` and `collapse-content`
- Drag handle with `cursor-move` icon
- `validator` on puzzle name input
- `btn-group` for puzzle actions (edit/delete)

**Critical Requirements:**
- MUST preserve drag-and-drop functionality exactly as-is
- MUST use same `draggable` attributes and event handlers
- MUST maintain puzzle order state
- MUST maintain hint order state within puzzles
- MUST integrate with existing HintModal (already refactored in Phase 2)

**Extract From GameModal Lines:** ~500-1000

---

#### 1.4 GameAdvancedSettings.svelte (3 hours)
**Location:** `apps/escapeplan-web/src/lib/components/games/GameAdvancedSettings.svelte`

**Responsibilities:**
- Combine 4 tabs: Cameras, Pricing, Booking, Milestones
- Use nested tabs or accordion
- Camera assignment (select from available cameras)
- Pricing config (base price, per-person, max capacity)
- Booking rules (lead time, cancellation, custom fields)
- Milestones (intro/victory media with upload)

**Props Interface:**
```typescript
interface Props {
  cameras: CameraSummary[];
  assignedCameraIds: string[];
  pricing: GamePricingConfig;
  bookingRules: GameBookingRules;
  milestones: EditableMilestone[];
  milestoneUploading: Record<string, boolean>;
  milestoneUploadErrors: Record<string, string | null>;
  onCamerasChange: (cameraIds: string[]) => void;
  onPricingChange: (pricing: GamePricingConfig) => void;
  onBookingRulesChange: (rules: GameBookingRules) => void;
  onMilestonesChange: (milestones: EditableMilestone[]) => void;
  onMilestoneUpload: (milestoneId: string, file: File) => Promise<void>;
}
```

**DaisyUI Patterns to Use:**
- `tabs` for switching between Cameras/Pricing/Booking/Milestones
- `tab-lifted` or `tab-bordered`
- `validator` on pricing inputs (min 0, required)
- `fieldset` for booking custom fields
- `label` for checkbox lists (cameras)

**Extract From GameModal Lines:** ~800-1200

---

### Phase 2: Refactor GameModal to Orchestrator (2 hours)

**New GameModal.svelte Structure:**

```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';

  import GameBasicInfoForm from './GameBasicInfoForm.svelte';
  import GameMediaSection from './GameMediaSection.svelte';
  import GamePuzzlesSection from './GamePuzzlesSection.svelte';
  import GameAdvancedSettings from './GameAdvancedSettings.svelte';
  import HintModal from './HintModal.svelte';

  // Props
  let {
    open = $bindable(false),
    mode = 'create',
    action = '',
    game = null,
    onclose,
    onsuccess
  } = $props();

  // State
  let activeTab = $state<'basic' | 'media' | 'puzzles' | 'advanced'>('basic');
  let workingGame = $state(createEmptyGame());
  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  // Hint modal state (passed to puzzles section)
  let hintModalOpen = $state(false);
  let editingHint = $state<{ puzzle: EditablePuzzle; hint: EditableHint | null } | null>(null);

  // Form handler
  const handleSubmit = createFormHandler({
    onSubmit: () => {
      isSubmitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      isSubmitting = false;
      onsuccess?.();
    },
    onError: (result) => {
      isSubmitting = false;
      errorMessage = result.data?.message ?? 'Failed to save game.';
    }
  });

  // Tab navigation
  const tabs = [
    { id: 'basic', label: 'Details' },
    { id: 'media', label: 'Media' },
    { id: 'puzzles', label: 'Puzzles & Hints' },
    { id: 'advanced', label: 'Advanced' }
  ];
</script>

<Modal
  open={open}
  title={mode === 'create' ? 'Create Game' : `Edit ${game?.name ?? 'Game'}`}
  description="Configure game details, media, puzzles, and settings."
  size="4xl"
  onClose={onclose}
>
  {#if errorMessage}
    <Alert type="error" class="mb-6">{errorMessage}</Alert>
  {/if}

  <!-- Tab Navigation -->
  <div role="tablist" class="tabs tabs-lifted mb-6">
    {#each tabs as tab}
      <button
        role="tab"
        class="tab"
        class:tab-active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <form method="POST" action={action} use:enhance={handleSubmit} class="space-y-6">
    <!-- Tab Content -->
    {#if activeTab === 'basic'}
      <GameBasicInfoForm
        name={workingGame.name}
        slug={workingGame.slug}
        description={workingGame.description}
        durationMinutes={workingGame.durationMinutes}
        difficulty={workingGame.difficulty}
        maxPlayers={workingGame.maxPlayers}
        isMobile={workingGame.isMobile}
        slugTouched={slugTouched}
        onNameChange={(name) => { workingGame.name = name; }}
        onSlugChange={(slug) => { workingGame.slug = slug; }}
        {...}
      />
    {:else if activeTab === 'media'}
      <GameMediaSection
        coverImageId={workingGame.media.coverImageId}
        galleryImageIds={workingGame.media.galleryImageIds}
        {...}
      />
    {:else if activeTab === 'puzzles'}
      <GamePuzzlesSection
        puzzles={workingGame.puzzles}
        draggingPuzzleId={draggingPuzzleId}
        onOpenHintModal={(puzzle, hint) => {
          editingHint = { puzzle, hint };
          hintModalOpen = true;
        }}
        {...}
      />
    {:else if activeTab === 'advanced'}
      <GameAdvancedSettings
        cameras={availableCameras}
        assignedCameraIds={workingGame.cameraIds}
        pricing={workingGame.pricing}
        {...}
      />
    {/if}

    <!-- Hidden field for JSON payload -->
    <input type="hidden" name="gameData" value={payloadJson} />
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
    <LoadingButton type="submit" variant="primary" loading={isSubmitting}>
      {mode === 'create' ? 'Create Game' : 'Save Changes'}
    </LoadingButton>
  {/snippet}
</Modal>

<!-- Hint Modal (for editing puzzle hints) -->
{#if hintModalOpen && editingHint}
  <HintModal
    open={hintModalOpen}
    hint={editingHint.hint}
    onclose={() => { hintModalOpen = false; }}
    onsave={(savedHint) => {
      // Update hint in puzzle
      const puzzle = editingHint.puzzle;
      if (editingHint.hint) {
        // Edit existing hint
        const hintIndex = puzzle.hints.findIndex(h => h.id === savedHint.id);
        puzzle.hints[hintIndex] = savedHint;
      } else {
        // Add new hint
        puzzle.hints.push(savedHint);
      }
      hintModalOpen = false;
    }}
  />
{/if}
```

**Reduced Lines:** 2,080 → ~300 lines (orchestrator only)

---

### Phase 3: Update Form Fields with Proper DaisyUI Patterns (2-4 hours)

This should be done DURING Phase 1 while creating sub-components.

#### Required DaisyUI Patterns

**1. Use `validator` for Required Fields**

```svelte
<!-- BEFORE (incorrect) -->
<input class="input input-bordered" type="text" name="name" required />

<!-- AFTER (correct) -->
<input class="input validator" type="text" name="name" required placeholder="Game name" />
<div class="validator-hint">Game name is required (min 3 characters)</div>
```

**2. Use `fieldset` for Related Fields**

```svelte
<!-- BEFORE (incorrect) -->
<div class="grid grid-cols-2 gap-4">
  <FormField label="Base Price">
    <input class="input input-bordered" type="number" name="basePrice" />
  </FormField>
  <FormField label="Per Person">
    <input class="input input-bordered" type="number" name="perPerson" />
  </FormField>
</div>

<!-- AFTER (correct) -->
<fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
  <legend class="fieldset-legend">Pricing Configuration</legend>
  <div class="grid grid-cols-2 gap-4">
    <label class="form-control">
      <span class="label-text">Base Price</span>
      <input class="input validator" type="number" name="basePrice" required min="0" />
      <div class="validator-hint">Enter base price (minimum $0)</div>
    </label>
    <label class="form-control">
      <span class="label-text">Per Person</span>
      <input class="input validator" type="number" name="perPerson" required min="0" />
      <div class="validator-hint">Enter per-person fee</div>
    </label>
  </div>
  <p class="label mt-2 text-xs text-base-content/60">
    Base price plus per-person fee determines total booking cost.
  </p>
</fieldset>
```

**3. Use Label Inside Input for Prefixes/Suffixes**

```svelte
<!-- BEFORE (incorrect - separate label) -->
<FormField label="Lead Time">
  <input class="input input-bordered" type="number" name="leadTime" />
  <span class="text-sm">hours</span>
</FormField>

<!-- AFTER (correct - label inside) -->
<label class="form-control">
  <span class="label-text">Lead Time</span>
  <label class="input validator flex items-center gap-2">
    <input type="number" name="leadTime" required min="0" class="grow" />
    <span class="label">hours</span>
  </label>
  <div class="validator-hint">Enter minimum hours before booking</div>
</label>
```

**4. Use Floating Label for Modern Look (Optional)**

```svelte
<label class="floating-label">
  <span>Game Description</span>
  <textarea
    class="textarea textarea-bordered validator min-h-[8rem]"
    name="description"
    required
    minlength="10"
    placeholder="Describe your escape room experience..."
  ></textarea>
  <div class="validator-hint">Description must be at least 10 characters</div>
</label>
```

---

## 🔍 DETAILED EXTRACTION GUIDE

### How to Extract Each Section

#### Step 1: Identify Section Boundaries
1. Open GameModal.svelte
2. Find tab content blocks (search for `{#if activeTab === 'details'}`)
3. Copy entire block from `{#if}` to `{/if}`
4. Note all state variables used in that block

#### Step 2: Trace State Dependencies
For each section, identify:
- Which `workingGame` fields are read/written
- Which local state variables are used (`draggingPuzzleId`, etc.)
- Which functions are called
- Which events are emitted

#### Step 3: Create Props Interface
Convert state dependencies to props:
- Read-only values → regular props
- Read-write values → props with onChange callbacks
- Example: `workingGame.name` → `name` prop + `onNameChange` callback

#### Step 4: Extract Helper Functions
- Move section-specific functions into sub-component
- Keep shared utilities in GameModal or extract to separate file
- Example: `generateSlug()` stays in GameModal, used in onChange callback

#### Step 5: Test Extraction
After creating sub-component:
1. Import into GameModal
2. Pass all required props
3. Test create mode
4. Test edit mode
5. Test validation
6. Test state updates

---

## ⚠️ CRITICAL PRESERVATION CHECKLIST

### Drag-and-Drop (MUST NOT BREAK)

**Puzzle Reordering:**
```svelte
<!-- In GamePuzzlesSection.svelte -->
<div
  draggable="true"
  ondragstart={(e) => {
    draggingPuzzleId = puzzle.id;
    e.dataTransfer.effectAllowed = 'move';
  }}
  ondragover={(e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }}
  ondrop={(e) => {
    e.preventDefault();
    if (draggingPuzzleId && draggingPuzzleId !== puzzle.id) {
      // Reorder logic EXACTLY as in original
      const draggedIndex = puzzles.findIndex(p => p.id === draggingPuzzleId);
      const targetIndex = puzzles.findIndex(p => p.id === puzzle.id);
      const reordered = [...puzzles];
      const [removed] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      onPuzzlesChange(reordered);
    }
    draggingPuzzleId = null;
  }}
  ondragend={() => { draggingPuzzleId = null; }}
>
  <!-- Puzzle content -->
</div>
```

**Hint Reordering:**
- Use same pattern as puzzle reordering
- Track `draggingHint` with `{ puzzleId, hintId }`
- Only allow reordering within same puzzle

### Asset Upload/Browse Integration

**MUST preserve:**
- AssetUpload component integration
- AssetBrowser modal integration
- Asset cache for preview
- File upload error handling
- Asset selection callback

### Milestone Media Upload

**MUST preserve:**
- Per-milestone file input refs
- Upload progress tracking
- Error display per milestone
- Success callback with asset ID

### Form Validation

**MUST add:**
- `validator` class to ALL required inputs
- `validator-hint` with helpful messages
- HTML5 validation attributes (required, min, max, pattern)

### Tab Navigation

**MUST preserve:**
- Tab state (`activeTab`)
- Tab switching without losing data
- Tab labels
- Tab order

---

## 📝 IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Read this entire document
- [ ] Read IMPLEMENTATION_CONTEXT.md
- [ ] Read UI-OPTIMIZATION-PLAN.md
- [ ] Review current GameModal.svelte (understand all features)
- [ ] Identify all state variables used
- [ ] Map out data flow between tabs
- [ ] Identify all helper functions

### Phase 1: Sub-Components
- [ ] Create GameBasicInfoForm.svelte
  - [ ] Extract basic info fields
  - [ ] Add validator classes
  - [ ] Test slug auto-generation
  - [ ] Test difficulty selector
  - [ ] Verify props interface
- [ ] Create GameMediaSection.svelte
  - [ ] Extract media upload/browse
  - [ ] Preserve asset cache
  - [ ] Test cover image selection
  - [ ] Test gallery management
  - [ ] Test trailer upload
- [ ] Create GamePuzzlesSection.svelte
  - [ ] Extract puzzle list
  - [ ] Preserve drag-and-drop (CRITICAL)
  - [ ] Integrate HintModal
  - [ ] Test puzzle add/edit/delete
  - [ ] Test hint add/edit/delete
  - [ ] Test puzzle reordering
  - [ ] Test hint reordering
- [ ] Create GameAdvancedSettings.svelte
  - [ ] Extract cameras tab
  - [ ] Extract pricing tab
  - [ ] Extract booking tab
  - [ ] Extract milestones tab
  - [ ] Add nested tabs/accordion
  - [ ] Add validator classes
  - [ ] Test all sections

### Phase 2: Orchestrator
- [ ] Import all sub-components
- [ ] Add Modal wrapper
- [ ] Add tab navigation
- [ ] Connect props to sub-components
- [ ] Add form submission
- [ ] Add error handling
- [ ] Add LoadingButton
- [ ] Test create mode end-to-end
- [ ] Test edit mode end-to-end

### Phase 3: DaisyUI Compliance
- [ ] Add `validator` to all required inputs
- [ ] Add `validator-hint` to all validated fields
- [ ] Use `fieldset` for related field groups
- [ ] Use `fieldset-legend` for group titles
- [ ] Use label inside input for prefixes/suffixes
- [ ] Review all FormField usages
- [ ] Ensure consistent spacing

### Testing
- [ ] Create new game (all tabs)
- [ ] Edit existing game (all tabs)
- [ ] Upload cover image
- [ ] Add gallery images
- [ ] Upload trailer
- [ ] Add puzzle
- [ ] Add hint to puzzle
- [ ] Reorder puzzles (drag-and-drop)
- [ ] Reorder hints (drag-and-drop)
- [ ] Delete puzzle
- [ ] Delete hint
- [ ] Assign cameras
- [ ] Configure pricing
- [ ] Set booking rules
- [ ] Add custom booking fields
- [ ] Upload milestone media
- [ ] Form validation (submit empty form)
- [ ] Error handling (network error)
- [ ] Cancel modal
- [ ] Save and verify data persisted

---

## 🚫 WHAT NOT TO DO

**DO NOT:**
- ❌ Change business logic
- ❌ Remove features
- ❌ Redesign UI layout
- ❌ Change tab structure
- ❌ Modify drag-and-drop behavior
- ❌ Change form field names (breaks API)
- ❌ Remove validation rules
- ❌ Change difficulty options
- ❌ Modify pricing calculation
- ❌ Change milestone types
- ❌ Remove asset upload functionality
- ❌ Simplify complex features

**DO:**
- ✅ Extract code into sub-components
- ✅ Add proper DaisyUI classes
- ✅ Use validator for form fields
- ✅ Wrap with Modal.svelte
- ✅ Use LoadingButton for submit
- ✅ Add fieldset for related fields
- ✅ Preserve ALL existing functionality
- ✅ Maintain exact same data flow
- ✅ Keep same prop interfaces
- ✅ Use createFormHandler utility

---

## 📊 SUCCESS CRITERIA

### Code Quality
- [ ] GameModal reduced from 2,080 to ~300 lines
- [ ] 4 new sub-components created
- [ ] All sub-components < 400 lines each
- [ ] All form fields use proper DaisyUI patterns
- [ ] All required fields have validator class
- [ ] All fieldsets have legend
- [ ] No duplicate code between components

### Functionality
- [ ] Create mode works identically to before
- [ ] Edit mode works identically to before
- [ ] All form fields populate correctly
- [ ] All validation works
- [ ] Drag-and-drop works exactly as before
- [ ] Asset upload/browse works
- [ ] HintModal integration works
- [ ] Tab navigation works
- [ ] Form submission works
- [ ] Error handling works

### DaisyUI Compliance
- [ ] Uses validator class (not custom validation styling)
- [ ] Uses validator-hint (not custom error messages)
- [ ] Uses fieldset for related fields
- [ ] Uses fieldset-legend for section titles
- [ ] Uses label inside input for prefixes
- [ ] Uses form-control wrapper consistently
- [ ] Uses proper input classes (input, textarea, select)

---

## 🔗 REFERENCES

- UI-OPTIMIZATION-PLAN.md - Phase 2, GameModal section
- IMPLEMENTATION_CONTEXT.md - Migration instructions
- DaisyUI 5.1.26 Validator: https://daisyui.com/components/validator/
- DaisyUI 5.1.26 Input: https://daisyui.com/components/input/
- DaisyUI 5.1.26 Fieldset: https://daisyui.com/components/fieldset/
- DaisyUI 5.1.26 Label: https://daisyui.com/components/label/
- Svelte 5 Runes: https://svelte.dev/docs/svelte/what-are-runes
- Current GameModal: `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

---

## 📞 QUESTIONS TO ASK USER (If Unclear)

1. **Tab Structure:** Should advanced settings remain as 4 separate tabs, or combine into one "Advanced" tab with nested sections?
2. **Validation Messages:** Are current HTML5 validation messages sufficient, or need custom messages?
3. **Puzzle Limits:** Is there a max number of puzzles per game?
4. **Hint Limits:** Is there a max number of hints per puzzle?
5. **Asset Types:** Are there restrictions on file types/sizes for uploads?

---

**Document Status:** ✅ COMPLETE
**Ready for Agent:** ✅ YES
**Estimated Completion Time:** 12-16 hours
**Priority:** HIGH (Critical path for UI optimization)
