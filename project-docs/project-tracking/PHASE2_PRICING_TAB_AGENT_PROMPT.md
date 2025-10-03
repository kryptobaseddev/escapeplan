# Phase 2: Pricing Tab Rebuild - Agent Execution Prompt

**Agent Role:** Frontend UI Specialist
**Session:** Pricing Tab Component Rebuild
**Validation By:** claude-gamesettings (will review your work)
**Prerequisites:** ✅ Phase 1 (Rooms Removal) must be complete and validated

---

## YOUR MISSION

Rebuild the GameModal Pricing Tab from scratch with modular components supporting all 3 pricing models (per_person, per_session, per_hour). Create clean folder structure, implement HelpTooltip everywhere, and standardize DaisyUI component usage.

**Critical Success Factors:**
1. ✅ Follow the plan EXACTLY - component structure matters
2. ✅ Use Zod schemas from contracts (not manual types)
3. ✅ Add HelpTooltip to 15+ complex fields
4. ✅ Test each component in isolation before integration
5. ✅ Validate payload matches SaveGameRequest schema

---

## REQUIRED READING (Read these files FIRST)

**Base Instructions & Tech Stack:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt` - Base project instructions
2. `@escapeplan-app/project-docs/project-tracking/project.yaml` - Tech stack & commands
3. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md` - Schema/validation patterns

**Execution Plan:**
4. `@escapeplan-app/project-docs/project-tracking/GAMEMODAL_UI_REFACTORING_PLAN.md` - YOUR PRIMARY GUIDE

**Component References:**
5. `@escapeplan-app/apps/escapeplan-web/src/lib/components/ui/HelpTooltip.svelte` - Existing help component
6. `@escapeplan-app/apps/escapeplan-web/src/lib/components/games/GameModal.svelte` - Current modal (2184 lines)

**Schema/Validation:**
7. `@escapeplan-app/packages/contracts/src/validation.ts` - Zod schemas (use these!)
8. `@escapeplan-app/packages/contracts/src/index.ts` - Type exports

---

## CRITICAL RULES

### DO:
- ✅ Follow GAMEMODAL_UI_REFACTORING_PLAN.md Part 2 exactly
- ✅ Create clean folder structure first
- ✅ Import types from `@escapeplan/contracts` (use Zod-inferred types)
- ✅ Use `$bindable()` for two-way binding
- ✅ Add HelpTooltip to EVERY complex field
- ✅ Use DaisyUI classes consistently (see plan Part 3)
- ✅ Test each component file independently
- ✅ Validate payload generation matches schema

### DO NOT:
- ❌ Create manual TypeScript interfaces (use Zod inference)
- ❌ Skip HelpTooltip components
- ❌ Use inconsistent DaisyUI classes
- ❌ Touch other tabs yet (Pricing Tab only this session)
- ❌ Commit until validation passes
- ❌ Use deprecated fields (pricing.model, pricePerPlayerCents)

---

## TECH STACK REQUIREMENTS

**Frontend Framework:**
- **Svelte 5** with runes (`$state`, `$derived`, `$bindable`, `$effect`)
- **SvelteKit 2** for routing
- **DaisyUI 5.1.25+** for component styling
- **Tailwind CSS 4** for utilities

**Component Patterns:**
```svelte
<script lang="ts">
  // Import Zod-inferred types from contracts
  import type { GamePricingTier, PricingModel } from '@escapeplan/contracts';

  // Use $bindable for two-way binding
  let {
    tier = $bindable(),
    index
  }: {
    tier: GamePricingTier;
    index: number;
  } = $props();

  // Use $state for local state
  let showAdvanced = $state(false);

  // Use $derived for computed values
  const isPerHour = $derived(tier.model === 'per_hour');
</script>
```

**DaisyUI Standards (MUST FOLLOW):**
```svelte
<!-- Range slider -->
<input type="range" class="range range-primary" min="0" max="100" />

<!-- Text input -->
<input type="text" class="input input-bordered" />

<!-- Select dropdown -->
<select class="select select-bordered">...</select>

<!-- Toggle switch -->
<input type="checkbox" class="toggle toggle-primary" />

<!-- Card sections -->
<div class="card bg-base-200/50">
  <div class="card-body">...</div>
</div>

<!-- Buttons -->
<button class="btn btn-primary btn-sm">...</button>

<!-- Badges -->
<span class="badge badge-neutral">...</span>

<!-- Alerts -->
<div class="alert alert-info">...</div>
```

---

## FOLDER STRUCTURE (Create This First)

```bash
# Create directory structure
mkdir -p apps/escapeplan-web/src/lib/components/games/tabs
mkdir -p apps/escapeplan-web/src/lib/components/games/pricing
mkdir -p apps/escapeplan-web/src/lib/components/ui

# Verify structure
tree apps/escapeplan-web/src/lib/components/
```

**Expected structure:**
```
apps/escapeplan-web/src/lib/components/
├── games/
│   ├── GameModal.svelte              # (existing, will update later)
│   ├── tabs/
│   │   └── GamePricingTab.svelte     # NEW: Main pricing tab
│   └── pricing/
│       ├── DepositConfig.svelte      # NEW: Deposit toggle + config
│       ├── TierCard.svelte           # NEW: Individual tier editor
│       ├── TierModelSelector.svelte  # NEW: Model picker (3 cards)
│       ├── PerHourFields.svelte      # NEW: Per-hour model fields
│       └── TierScheduleFields.svelte # NEW: Day/time restrictions
└── ui/
    ├── HelpTooltip.svelte            # ✅ EXISTS - use this
    ├── VolumeSlider.svelte           # NEW: Standardized range input
    └── FormField.svelte              # NEW: Label + help + error wrapper
```

---

## EXECUTION WORKFLOW

### Phase 1: Create UI Utilities (1 hour)

**Goal:** Create reusable components for consistent styling

#### 1.1 VolumeSlider Component

**File:** `apps/escapeplan-web/src/lib/components/ui/VolumeSlider.svelte`

```svelte
<script lang="ts">
  import HelpTooltip from './HelpTooltip.svelte';

  let {
    value = $bindable(80),
    label = 'Volume',
    helpText = 'Playback volume (0-100)',
    min = 0,
    max = 100,
    step = 1
  }: {
    value: number;
    label?: string;
    helpText?: string;
    min?: number;
    max?: number;
    step?: number;
  } = $props();
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text">{label}</span>
    <HelpTooltip>{helpText}</HelpTooltip>
  </div>
  <div class="flex items-center gap-4">
    <input
      type="range"
      class="range range-primary"
      bind:value
      {min}
      {max}
      {step}
    />
    <span class="badge badge-neutral min-w-[3rem]">{value}</span>
  </div>
</div>
```

**Test:**
```bash
# Type-check
cd apps/escapeplan-web
pnpm check
```

#### 1.2 FormField Component

**File:** `apps/escapeplan-web/src/lib/components/ui/FormField.svelte`

```svelte
<script lang="ts">
  import HelpTooltip from './HelpTooltip.svelte';
  import type { Snippet } from 'svelte';

  let {
    label,
    helpText,
    error,
    required = false,
    children
  }: {
    label: string;
    helpText?: string;
    error?: string | null;
    required?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text">
      {label}
      {#if required}<span class="text-error">*</span>{/if}
    </span>
    {#if helpText}
      <HelpTooltip>{helpText}</HelpTooltip>
    {/if}
  </div>
  {@render children()}
  {#if error}
    <div class="label">
      <span class="label-text-alt text-error">{error}</span>
    </div>
  {/if}
</div>
```

**VALIDATE:**
```bash
pnpm check
# Should succeed with 0 errors
```

---

### Phase 2: Create Pricing Subcomponents (3 hours)

Work bottom-up (smallest to largest):

#### 2.1 DepositConfig Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/DepositConfig.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.6**

Key features:
- Toggle for deposit required
- Conditional fields (type + amount) when enabled
- Type selector (flat/percent)
- Amount input with validation

**Test standalone:**
```svelte
<!-- Test in +page.svelte temporarily -->
<script>
  import DepositConfig from '$lib/components/games/pricing/DepositConfig.svelte';
  let deposit = $state({ required: false });
</script>
<DepositConfig bind:deposit />
```

#### 2.2 TierModelSelector Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierModelSelector.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.3**

Key features:
- 3 visual cards (per_person, per_session, per_hour)
- Radio button behavior
- Icons + descriptions
- HelpTooltip explaining all 3 models

#### 2.3 PerHourFields Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/PerHourFields.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.4**

Key features:
- Base hours input
- Base price input
- Additional hour rate input
- Min/max duration hours
- Alert explaining calculation
- HelpTooltip on each field

#### 2.4 TierScheduleFields Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierScheduleFields.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.5**

Key features:
- Day of week buttons (7 toggles)
- Time range start/end pickers
- HelpTooltip explaining restrictions

**VALIDATE AFTER EACH COMPONENT:**
```bash
pnpm check
# Fix type errors immediately
```

---

### Phase 3: Create TierCard Orchestrator (2 hours)

#### 3.1 TierCard Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierCard.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.2**

This is the most complex component. It:
- Imports all 4 subcomponents above
- Shows tier header with index/status
- Basic fields (label, description)
- Model selector (imports TierModelSelector)
- Conditional fields based on model:
  - per_person: single price input
  - per_session: single price input
  - per_hour: imports PerHourFields
- Player range inputs
- Active toggle
- Advanced options (collapsible):
  - TierScheduleFields
  - validFrom/validUntil dates
- Move up/down/delete buttons

**Test with mock data:**
```svelte
<script>
  import TierCard from '$lib/components/games/pricing/TierCard.svelte';

  let tier = $state({
    id: 'tier-1',
    label: 'Standard',
    model: 'per_person',
    priceCents: 2500,
    active: true,
    displayOrder: 0
  });
</script>

<TierCard
  bind:tier
  index={0}
  canMoveUp={false}
  canMoveDown={false}
  onMoveUp={() => {}}
  onMoveDown={() => {}}
  onRemove={() => {}}
/>
```

---

### Phase 4: Create Main Pricing Tab (1.5 hours)

#### 4.1 GamePricingTab Component

**File:** `apps/escapeplan-web/src/lib/components/games/tabs/GamePricingTab.svelte`

**Full implementation in GAMEMODAL_UI_REFACTORING_PLAN.md Section 2.1**

Key features:
- Imports DepositConfig and TierCard
- Deposit settings section
- Pricing tiers section with add button
- Tier list (each using TierCard component)
- Tier reordering (up/down buttons)
- Tier deletion
- Discount codes info section (links to admin)

**Functions to implement:**
```typescript
function addTier() {
  const newTier: GamePricingTier = {
    id: crypto.randomUUID(),
    label: `Tier ${pricing.tiers.length + 1}`,
    model: 'per_person',
    priceCents: 0,
    displayOrder: pricing.tiers.length,
    active: true
  };
  pricing.tiers = [...pricing.tiers, newTier];
}

function removeTier(tierId: string) {
  pricing.tiers = pricing.tiers.filter(t => t.id !== tierId);
  // Recalculate display order
  pricing.tiers = pricing.tiers.map((t, idx) => ({ ...t, displayOrder: idx }));
}

function moveTier(tierId: string, direction: 'up' | 'down') {
  const index = pricing.tiers.findIndex(t => t.id === tierId);
  if (index === -1) return;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= pricing.tiers.length) return;

  const newTiers = [...pricing.tiers];
  [newTiers[index], newTiers[newIndex]] = [newTiers[newIndex], newTiers[index]];

  pricing.tiers = newTiers.map((t, idx) => ({ ...t, displayOrder: idx }));
}
```

---

### Phase 5: Integrate into GameModal (1 hour)

#### 5.1 Update GameModal.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

**Changes needed:**

1. **Add import (top of script):**
```svelte
<script lang="ts">
  // ... existing imports ...
  import GamePricingTab from './tabs/GamePricingTab.svelte';
</script>
```

2. **Replace pricing tab content (lines 1541-1847):**
```svelte
<!-- BEFORE (line 1541): -->
{:else if activeTab === 'pricing'}
  <div class="space-y-4">
    <!-- OLD 300+ lines of inline pricing fields -->
  </div>

<!-- AFTER: -->
{:else if activeTab === 'pricing'}
  <GamePricingTab bind:pricing={workingGame.pricing} gameType={workingGame.gameType} />
```

3. **Remove old pricing logic from createEmptyGame():**
```typescript
// BEFORE (line 158):
pricing: {
  tiers: [],
  deposit: { required: false },
  discounts: []
},

// AFTER (same - no change needed, already correct)
```

4. **Remove old pricing logic from cloneGameDetails():**
```typescript
// Find pricing mapping (line ~198)
// ENSURE it converts cents properly:
pricing: details.pricing
  ? {
      tiers: details.pricing.tiers
        ? details.pricing.tiers.map((tier) => ({
            ...tier,
            priceCents: tier.priceCents, // Already in cents from API
            model: tier.model ?? 'per_person', // Migration fallback
            active: tier.active ?? true
          }))
        : [],
      deposit: details.pricing.deposit ?? { required: false },
      discounts: [] // Moved to global system
    }
  : {
      tiers: [],
      deposit: { required: false },
      discounts: []
    },
```

5. **Update buildPayload() function:**

Find where pricing is serialized (search for `buildPayload`):

```typescript
// Ensure tiers are converted properly:
pricing: {
  tiers: workingGame.pricing.tiers.map(tier => ({
    ...tier,
    // priceCents stays as-is (already number)
    model: tier.model, // per_person | per_session | per_hour
    // Ensure optional fields are included
    baseHours: tier.baseHours ?? undefined,
    basePriceCents: tier.basePriceCents ?? undefined,
    additionalHourCents: tier.additionalHourCents ?? undefined,
    minDurationHours: tier.minDurationHours ?? undefined,
    maxDurationHours: tier.maxDurationHours ?? undefined,
    dayOfWeekRestrictions: tier.dayOfWeekRestrictions ?? undefined,
    timeRangeStart: tier.timeRangeStart ?? undefined,
    timeRangeEnd: tier.timeRangeEnd ?? undefined,
    validFrom: tier.validFrom ?? undefined,
    validUntil: tier.validUntil ?? undefined,
    description: tier.description ?? undefined,
    displayOrder: tier.displayOrder ?? 0,
    active: tier.active ?? true
  })),
  deposit: workingGame.pricing.deposit
}
```

**VALIDATE:**
```bash
pnpm check
pnpm run dev --host
# Open http://localhost:5173/admin/games
# Click "New Game" → Pricing tab should load
```

---

## VALIDATION CHECKLIST

Before marking complete, verify ALL of these:

### Component Structure
- [ ] `apps/escapeplan-web/src/lib/components/ui/VolumeSlider.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/ui/FormField.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/pricing/DepositConfig.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/pricing/TierModelSelector.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/pricing/PerHourFields.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/pricing/TierScheduleFields.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/pricing/TierCard.svelte` exists
- [ ] `apps/escapeplan-web/src/lib/components/games/tabs/GamePricingTab.svelte` exists

### Type Safety
- [ ] All components import types from `@escapeplan/contracts`
- [ ] No manual TypeScript interfaces created
- [ ] `pnpm check` passes with 0 errors
- [ ] All `$bindable()` parameters properly typed

### DaisyUI Standards
- [ ] All range inputs use `range range-primary`
- [ ] All text inputs use `input input-bordered`
- [ ] All selects use `select select-bordered`
- [ ] All toggles use `toggle toggle-primary`
- [ ] All cards use `card bg-base-200/50` + `card-body`
- [ ] All buttons use `btn btn-{variant} btn-{size}`

### HelpTooltip Usage
- [ ] DepositConfig has 2+ HelpTooltips
- [ ] TierModelSelector has 1 HelpTooltip
- [ ] PerHourFields has 5+ HelpTooltips
- [ ] TierScheduleFields has 3+ HelpTooltips
- [ ] TierCard has 10+ HelpTooltips total
- [ ] **Total: 15+ HelpTooltips across pricing tab**

### Functionality
- [ ] Can add new tier
- [ ] Can delete tier
- [ ] Can move tier up/down
- [ ] Display order recalculates after reorder
- [ ] Model selector shows all 3 models
- [ ] Per-hour fields appear when model = 'per_hour'
- [ ] Per-hour fields hidden when model != 'per_hour'
- [ ] Schedule fields work (day toggles + time inputs)
- [ ] Deposit toggle works
- [ ] Deposit fields appear when enabled

### Payload Validation
- [ ] Create game with per_person tier → payload correct
- [ ] Create game with per_session tier → payload correct
- [ ] Create game with per_hour tier → payload has all fields
- [ ] Tier with schedule restrictions → payload includes restrictions
- [ ] Tier with seasonal dates → payload includes validFrom/validUntil
- [ ] Payload matches `SaveGameRequest` schema exactly

### Runtime Validation
- [ ] GameModal opens without errors
- [ ] Pricing tab loads without errors
- [ ] Can switch between tabs without errors
- [ ] Console shows 0 errors
- [ ] Console shows 0 warnings

---

## TESTING SCENARIOS

Test these manually before marking complete:

### Scenario 1: Per-Person Tier
1. Open GameModal (create new game)
2. Go to Pricing tab
3. Click "Add Tier"
4. Set label: "Standard"
5. Select model: "Per Person"
6. Set price: $25
7. Set min players: 2, max players: 6
8. Save game
9. **Verify:** Payload has tier with model='per_person', priceCents=2500

### Scenario 2: Per-Hour Tier
1. Add new tier
2. Set label: "Extended Session"
3. Select model: "Per Hour"
4. Set base hours: 2
5. Set base price: $150
6. Set additional hour rate: $75
7. Set min duration: 2 hours
8. Set max duration: 6 hours
9. Save game
10. **Verify:** Payload has tier with model='per_hour', all hour fields present

### Scenario 3: Schedule Restrictions
1. Expand "Advanced Options" in tier
2. Click days: Fri, Sat, Sun
3. Set time range: 18:00 - 23:00
4. Set validFrom: 2025-12-01
5. Set validUntil: 2025-12-31
6. Save game
7. **Verify:** Payload includes dayOfWeekRestrictions=[5,6,0], timeRange, validFrom/validUntil

### Scenario 4: Deposit Configuration
1. Toggle "Require deposit" ON
2. Select type: "Flat"
3. Set amount: $50
4. Save game
5. **Verify:** Payload has deposit: { required: true, type: 'flat', amountCents: 5000 }

### Scenario 5: Tier Reordering
1. Create 3 tiers
2. Click "Move up" on tier 3
3. **Verify:** Tier 3 becomes tier 2
4. **Verify:** displayOrder recalculated (0, 1, 2)

---

## COMPLETION REQUIREMENTS

### 1. Create Session Notes

Create `project-docs/project-tracking/sessions/SESSION_43_PRICING_TAB_REBUILD.md` with:

```markdown
# Session 43: Pricing Tab Rebuild - Execution

**Date:** [DATE]
**Status:** ✅ COMPLETE
**Validation:** Pending (claude-gamesettings)

## Summary
Rebuilt GameModal Pricing Tab with modular components. Created clean folder structure and standardized DaisyUI usage.

## Components Created
1. VolumeSlider.svelte (UI utility)
2. FormField.svelte (UI utility)
3. DepositConfig.svelte (pricing subcomponent)
4. TierModelSelector.svelte (pricing subcomponent)
5. PerHourFields.svelte (pricing subcomponent)
6. TierScheduleFields.svelte (pricing subcomponent)
7. TierCard.svelte (pricing orchestrator)
8. GamePricingTab.svelte (main tab)

## Lines of Code
- Components created: 8 files, ~1200 lines
- GameModal reduced: 2184 → ~1900 lines (pricing tab extracted)
- HelpTooltip usage: 18 instances

## Testing Results
[PASTE MANUAL TEST RESULTS FOR 5 SCENARIOS]

## Validation Results
[PASTE VALIDATION CHECKLIST WITH CHECKMARKS]

## Issues Encountered
[LIST ANY PROBLEMS AND HOW YOU SOLVED THEM]
```

### 2. DO NOT Commit Yet

- ❌ Do NOT commit changes
- ❌ Do NOT push to remote
- ✅ Leave changes staged for validation by claude-gamesettings

### 3. Report Completion

Reply with:
```
✅ PRICING TAB REBUILD COMPLETE

Components created: 8
Lines added: ~1200
HelpTooltips: 18
GameModal reduction: 2184 → 1900 lines

Testing scenarios passed:
- [x] Per-person tier
- [x] Per-hour tier
- [x] Schedule restrictions
- [x] Deposit config
- [x] Tier reordering

Session notes: SESSION_43_PRICING_TAB_REBUILD.md
Ready for validation by claude-gamesettings
```

---

## TROUBLESHOOTING

### Issue: Type error on GamePricingTier

**Solution:**
```typescript
// Import from contracts, not manual definition
import type { GamePricingTier } from '@escapeplan/contracts';

// NOT:
// interface GamePricingTier { ... } ❌
```

### Issue: HelpTooltip not found

**Solution:**
```svelte
<!-- Use relative import from component location -->
<!-- In pricing/ subfolder: -->
import HelpTooltip from '../../ui/HelpTooltip.svelte';

<!-- In tabs/ subfolder: -->
import HelpTooltip from '../../ui/HelpTooltip.svelte';
```

### Issue: $bindable errors

**Solution:**
```svelte
<!-- Ensure Svelte 5 syntax -->
let {
  tier = $bindable()
} = $props();

<!-- NOT: -->
<!-- export let tier; ❌ (Svelte 4 syntax) -->
```

### Issue: Payload doesn't match schema

**Solution:**
```typescript
// Check buildPayload() in GameModal.svelte
// Ensure ALL tier fields are included
// Check validation.ts pricingTierSchema for required fields
```

---

## SUCCESS CRITERIA

You are DONE when:
1. ✅ All 8 components created in correct folders
2. ✅ All validation checklist items pass (35 items)
3. ✅ All 5 testing scenarios pass
4. ✅ `pnpm check` succeeds with 0 errors
5. ✅ GameModal opens and pricing tab works
6. ✅ 18+ HelpTooltips present
7. ✅ Session notes created
8. ✅ Completion report posted

**Estimated Time:** 6-8 hours
**Your Priority:** Component quality over speed
**When Stuck:** Re-read GAMEMODAL_UI_REFACTORING_PLAN.md section carefully

Good luck! Build beautiful, maintainable components. 🎨
