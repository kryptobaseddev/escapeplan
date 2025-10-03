# GameModal UI Refactoring - Comprehensive Plan

**Status:** 🔵 Planning Document
**Created:** 2025-10-02
**Assigned To:** claude-gamesettings
**Prerequisites:** ✅ Rooms table removal complete (see ROOMS_TABLE_REMOVAL_PLAN.md)

---

## Executive Summary

Refactor the massive 2184-line `GameModal.svelte` component into modular tab components. Priority focus on **Pricing Tab** which needs complete rebuild to support new per-tier pricing models, help tooltips, and enhanced DaisyUI component standardization.

**Key Goals:**
1. **Modularize:** Split GameModal into separate tab components (~300 LOC each)
2. **Pricing Rebuild:** Complete rebuild with per-tier models and validation
3. **DaisyUI Standardization:** Use range sliders, proper form validation, help tooltips
4. **Remove Rooms Tab:** Delete entire rooms section (post-removal)
5. **Schema Compliance:** Match new contract/schema changes exactly

---

## Current State Analysis

### GameModal.svelte Structure (2184 lines)

| Section | Lines | Status | Issues |
|---------|-------|--------|--------|
| Script block | 1-890 | ⚠️ BLOATED | Too much logic, needs extraction |
| Template tabs | 891-2100 | ⚠️ MONOLITHIC | Each tab should be component |
| Details Tab | 906-1077 | ✅ GOOD | Needs minor updates |
| Media Tab | 1078-1279 | ✅ GOOD | Working well |
| Rooms Tab | 1280-1361 | ❌ DELETE | Remove post-rooms removal |
| Puzzles Tab | 1362-1540 | ⚠️ COMPLEX | Consider splitting hints |
| **Pricing Tab** | **1541-1847** | ❌ BROKEN | **NEEDS COMPLETE REBUILD** |
| Milestones Tab | 1848-2050 | ✅ GOOD | Working well |
| Booking Tab | 2051-2100 | ✅ GOOD | Minor improvements |

### Critical Issues in Pricing Tab

**Problem 1: Missing Per-Tier Pricing Models**
- Current code (line 1546) has: `workingGame.pricing.model` (global model)
- **NEW SCHEMA** requires: `tier.model` (per-tier model: 'per_person' | 'per_session' | 'per_hour')

**Problem 2: Missing Enhanced Tier Fields**
```typescript
// MISSING from UI but in schema:
- tier.model (per-tier pricing model)
- tier.baseHours (for 'per_hour' model)
- tier.basePriceCents (for 'per_hour' model)
- tier.additionalHourCents (for 'per_hour' model)
- tier.minDurationHours (duration constraints)
- tier.maxDurationHours (duration constraints)
- tier.dayOfWeekRestrictions (schedule restrictions)
- tier.timeRangeStart / timeRangeEnd (time restrictions)
- tier.validFrom / validUntil (seasonal pricing)
- tier.description (tier explanation)
- tier.displayOrder (tier ordering)
- tier.active (enable/disable)
```

**Problem 3: No Help Tooltips**
- User mentioned Phase 2 added HelpTooltip component
- Not used in Pricing tab at all
- Critical for explaining complex per_hour model

**Problem 4: Deprecated Fields Still Present**
```typescript
// These should be REMOVED:
- pricing.model (line 1546) - now per-tier
- Game.pricingModel (deprecated)
- Game.pricePerPlayerCents (deprecated)
```

---

## Part 1: Component Architecture (New Structure)

### New File Structure

```
apps/escapeplan-web/src/lib/components/games/
├── GameModal.svelte                 # Shell (tabs + orchestration) ~400 lines
├── tabs/
│   ├── GameDetailsTab.svelte        # Game info, type, duration ~300 lines
│   ├── GameMediaTab.svelte          # Thumbnails, gallery ~200 lines
│   ├── GamePuzzlesTab.svelte        # Puzzles & hints ~400 lines
│   ├── GamePricingTab.svelte        # ⭐ PRIORITY: Pricing tiers ~500 lines
│   ├── GameBookingTab.svelte        # Booking rules ~200 lines
│   └── GameMilestonesTab.svelte     # Milestones config ~300 lines
├── pricing/
│   ├── TierCard.svelte              # Single tier editor ~250 lines
│   ├── TierModelSelector.svelte     # Model picker with help ~150 lines
│   ├── PerHourFields.svelte         # Base hours + additional ~100 lines
│   ├── TierScheduleFields.svelte    # Day/time restrictions ~150 lines
│   └── DepositConfig.svelte         # Deposit toggle + fields ~100 lines
└── ui/
    ├── HelpTooltip.svelte           # ✅ EXISTS - Use everywhere
    ├── FormField.svelte             # NEW: Standardized input wrapper
    └── ValidationError.svelte       # NEW: Error display component
```

---

## Part 2: Pricing Tab - Complete Rebuild Specification

### 2.1 Pricing Tab Layout

**File:** `apps/escapeplan-web/src/lib/components/games/tabs/GamePricingTab.svelte`

```svelte
<script lang="ts">
  import type { GamePricingConfig, GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';
  import TierCard from '../pricing/TierCard.svelte';
  import DepositConfig from '../pricing/DepositConfig.svelte';

  let {
    pricing = $bindable(),
    gameType
  }: {
    pricing: GamePricingConfig;
    gameType: 'storefront' | 'mobile';
  } = $props();

  function addTier() {
    const newTier: GamePricingTier = {
      id: crypto.randomUUID(),
      label: `Tier ${pricing.tiers.length + 1}`,
      model: 'per_person', // Default model
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

    // Update display order
    pricing.tiers = newTiers.map((t, idx) => ({ ...t, displayOrder: idx }));
  }
</script>

<div class="space-y-6">
  <!-- Deposit Configuration -->
  <section class="card bg-base-200/50">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <h3 class="card-title text-base">Deposit Settings</h3>
        <HelpTooltip>
          Configure whether a deposit is required at booking time.
          Deposits can be a flat dollar amount or a percentage of the total.
        </HelpTooltip>
      </div>
      <DepositConfig bind:deposit={pricing.deposit} />
    </div>
  </section>

  <!-- Pricing Tiers -->
  <section class="card bg-base-200/50">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h3 class="card-title text-base">Pricing Tiers</h3>
          <HelpTooltip>
            Create multiple pricing tiers for different party sizes, times, or dates.
            Each tier can have its own pricing model (per person, per session, or per hour).
          </HelpTooltip>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick={addTier}>
          <svg><!-- Plus icon --></svg>
          Add Tier
        </button>
      </div>

      {#if pricing.tiers.length === 0}
        <div class="alert">
          <svg><!-- Info icon --></svg>
          <span>No pricing tiers configured. Add at least one tier to enable bookings.</span>
        </div>
      {/if}

      <div class="space-y-4">
        {#each pricing.tiers as tier, index (tier.id)}
          <TierCard
            bind:tier
            {index}
            canMoveUp={index > 0}
            canMoveDown={index < pricing.tiers.length - 1}
            onMoveUp={() => moveTier(tier.id, 'up')}
            onMoveDown={() => moveTier(tier.id, 'down')}
            onRemove={() => removeTier(tier.id)}
          />
        {/each}
      </div>
    </div>
  </section>

  <!-- Discount Codes Info (Global System) -->
  <section class="card bg-base-200/50">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <h3 class="card-title text-base">Discount Codes</h3>
        <HelpTooltip>
          Discount codes are managed globally in the Admin > Discounts section.
          They can be applied to specific games or all games.
        </HelpTooltip>
      </div>
      <div class="alert alert-info">
        <svg><!-- Info icon --></svg>
        <div>
          <p class="font-semibold">Discounts managed globally</p>
          <p class="text-sm">Visit Admin > Discounts to create codes that apply to this game.</p>
        </div>
        <a href="/admin/discounts" class="btn btn-sm btn-primary">Manage Discounts</a>
      </div>
    </div>
  </section>
</div>
```

### 2.2 TierCard Component (Individual Tier Editor)

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierCard.svelte`

```svelte
<script lang="ts">
  import type { GamePricingTier, PricingModel } from '@escapeplan/contracts';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';
  import TierModelSelector from './TierModelSelector.svelte';
  import PerHourFields from './PerHourFields.svelte';
  import TierScheduleFields from './TierScheduleFields.svelte';

  let {
    tier = $bindable(),
    index,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onRemove
  }: {
    tier: GamePricingTier;
    index: number;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  } = $props();

  // Expanded state for advanced options
  let showAdvanced = $state(false);
</script>

<div class="card bg-base-100 shadow-md">
  <div class="card-body">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="badge badge-neutral">Tier {index + 1}</span>
        {#if !tier.active}
          <span class="badge badge-ghost">Inactive</span>
        {/if}
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={!canMoveUp}
          onclick={onMoveUp}
          title="Move up"
        >
          <svg><!-- Up arrow --></svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={!canMoveDown}
          onclick={onMoveDown}
          title="Move down"
        >
          <svg><!-- Down arrow --></svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-error"
          onclick={onRemove}
          title="Delete tier"
        >
          <svg><!-- Trash icon --></svg>
        </button>
      </div>
    </div>

    <!-- Basic Fields -->
    <div class="grid gap-4 md:grid-cols-2">
      <label class="form-control">
        <div class="label">
          <span class="label-text">Tier Label</span>
          <HelpTooltip>Display name for this tier (e.g., "Standard", "Premier", "Offsite")</HelpTooltip>
        </div>
        <input type="text" class="input input-bordered" bind:value={tier.label} required />
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text">Description</span>
          <HelpTooltip>Optional explanation shown to customers during booking</HelpTooltip>
        </div>
        <input type="text" class="input input-bordered" bind:value={tier.description} placeholder="Optional" />
      </label>
    </div>

    <!-- Pricing Model Selector -->
    <TierModelSelector bind:model={tier.model} />

    <!-- Model-Specific Fields -->
    <div class="divider">Pricing Details</div>

    {#if tier.model === 'per_person'}
      <label class="form-control">
        <div class="label">
          <span class="label-text">Price Per Person</span>
          <HelpTooltip>Amount charged per player (in dollars)</HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.priceCents}
          min="0"
          step="0.01"
          required
        />
      </label>
    {:else if tier.model === 'per_session'}
      <label class="form-control">
        <div class="label">
          <span class="label-text">Flat Session Price</span>
          <HelpTooltip>Fixed price for the entire group regardless of size</HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.priceCents}
          min="0"
          step="0.01"
          required
        />
      </label>
    {:else if tier.model === 'per_hour'}
      <PerHourFields bind:tier />
    {/if}

    <!-- Player Range -->
    <div class="grid gap-4 md:grid-cols-2">
      <label class="form-control">
        <div class="label">
          <span class="label-text">Min Players</span>
          <HelpTooltip>Minimum party size for this tier (leave blank for no minimum)</HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.minPlayers}
          min="1"
          placeholder="No minimum"
        />
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text">Max Players</span>
          <HelpTooltip>Maximum party size for this tier (leave blank for no maximum)</HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.maxPlayers}
          min="1"
          placeholder="No maximum"
        />
      </label>
    </div>

    <!-- Active Toggle -->
    <label class="flex cursor-pointer items-center gap-3">
      <input type="checkbox" class="toggle toggle-primary" bind:checked={tier.active} />
      <span class="label-text">Tier is active and bookable</span>
    </label>

    <!-- Advanced Options (Collapsible) -->
    <div class="divider">
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        onclick={() => showAdvanced = !showAdvanced}
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        <svg class:rotate-180={showAdvanced} class="transition-transform"><!-- Chevron --></svg>
      </button>
    </div>

    {#if showAdvanced}
      <div class="space-y-4 rounded-lg bg-base-200/50 p-4">
        <TierScheduleFields bind:tier />

        <!-- Valid Date Range -->
        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <div class="label">
              <span class="label-text">Valid From</span>
              <HelpTooltip>Start date for seasonal/holiday pricing (leave blank for always)</HelpTooltip>
            </div>
            <input type="date" class="input input-bordered" bind:value={tier.validFrom} />
          </label>

          <label class="form-control">
            <div class="label">
              <span class="label-text">Valid Until</span>
              <HelpTooltip>End date for seasonal/holiday pricing (leave blank for always)</HelpTooltip>
            </div>
            <input type="date" class="input input-bordered" bind:value={tier.validUntil} />
          </label>
        </div>
      </div>
    {/if}
  </div>
</div>
```

### 2.3 TierModelSelector Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierModelSelector.svelte`

```svelte
<script lang="ts">
  import type { PricingModel } from '@escapeplan/contracts';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

  let {
    model = $bindable()
  }: {
    model: PricingModel;
  } = $props();

  const models: Array<{ value: PricingModel; label: string; description: string; icon: string }> = [
    {
      value: 'per_person',
      label: 'Per Person',
      description: 'Charge each player individually (e.g., $25/person)',
      icon: '👤'
    },
    {
      value: 'per_session',
      label: 'Per Session',
      description: 'Flat rate for entire group (e.g., $150/session)',
      icon: '🎮'
    },
    {
      value: 'per_hour',
      label: 'Per Hour',
      description: 'Hourly rate with base hours + additional (e.g., $100/hr)',
      icon: '⏱️'
    }
  ];
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text">Pricing Model</span>
    <HelpTooltip>
      How this tier calculates pricing:
      • Per Person: Multiply price by party size
      • Per Session: Fixed price regardless of party size
      • Per Hour: Base price + hourly rate for extended sessions
    </HelpTooltip>
  </div>

  <div class="grid gap-3 md:grid-cols-3">
    {#each models as modelOption}
      <label class="cursor-pointer">
        <input
          type="radio"
          name="pricing-model"
          value={modelOption.value}
          bind:group={model}
          class="hidden"
        />
        <div
          class="card border-2 transition-all"
          class:border-primary={model === modelOption.value}
          class:bg-primary/10={model === modelOption.value}
          class:border-base-300={model !== modelOption.value}
        >
          <div class="card-body p-4">
            <div class="text-2xl">{modelOption.icon}</div>
            <h4 class="font-semibold">{modelOption.label}</h4>
            <p class="text-xs text-base-content/70">{modelOption.description}</p>
          </div>
        </div>
      </label>
    {/each}
  </div>
</div>
```

### 2.4 PerHourFields Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/PerHourFields.svelte`

```svelte
<script lang="ts">
  import type { GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

  let {
    tier = $bindable()
  }: {
    tier: GamePricingTier;
  } = $props();

  // Ensure per_hour fields exist
  $effect(() => {
    if (tier.model === 'per_hour') {
      tier.baseHours ??= 1;
      tier.basePriceCents ??= 0;
      tier.additionalHourCents ??= 0;
      tier.minDurationHours ??= 1;
      tier.maxDurationHours ??= undefined;
    }
  });
</script>

<div class="space-y-4 rounded-lg bg-base-300/30 p-4">
  <div class="alert alert-info">
    <svg><!-- Info icon --></svg>
    <div class="text-sm">
      <strong>Per Hour Model:</strong> Set a base price for the first X hours, then charge
      a discounted rate for additional hours. Example: $100 for first 2 hours, $50/hr after.
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <label class="form-control">
      <div class="label">
        <span class="label-text">Base Hours Included</span>
        <HelpTooltip>Number of hours included in the base price (e.g., 2 hours)</HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.baseHours}
        min="1"
        step="0.5"
        required
      />
    </label>

    <label class="form-control">
      <div class="label">
        <span class="label-text">Base Price ($)</span>
        <HelpTooltip>Price for the base hours (e.g., $100 for 2 hours)</HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.basePriceCents}
        min="0"
        step="0.01"
        required
      />
    </label>
  </div>

  <label class="form-control">
    <div class="label">
      <span class="label-text">Additional Hour Rate ($)</span>
      <HelpTooltip>
        Discounted rate per additional hour beyond base hours (e.g., $50/hr after first 2 hours)
      </HelpTooltip>
    </div>
    <input
      type="number"
      class="input input-bordered"
      bind:value={tier.additionalHourCents}
      min="0"
      step="0.01"
      required
    />
  </label>

  <div class="divider text-xs">Duration Constraints</div>

  <div class="grid gap-4 md:grid-cols-2">
    <label class="form-control">
      <div class="label">
        <span class="label-text">Min Duration (hours)</span>
        <HelpTooltip>Minimum session length bookable for this tier</HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.minDurationHours}
        min="0.5"
        step="0.5"
      />
    </label>

    <label class="form-control">
      <div class="label">
        <span class="label-text">Max Duration (hours)</span>
        <HelpTooltip>Maximum session length bookable for this tier (leave blank for no limit)</HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.maxDurationHours}
        min="0.5"
        step="0.5"
        placeholder="No limit"
      />
    </label>
  </div>
</div>
```

### 2.5 TierScheduleFields Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierScheduleFields.svelte`

```svelte
<script lang="ts">
  import type { GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

  let {
    tier = $bindable()
  }: {
    tier: GamePricingTier;
  } = $props();

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  function toggleDay(day: number) {
    if (!tier.dayOfWeekRestrictions) {
      tier.dayOfWeekRestrictions = [day];
    } else {
      const index = tier.dayOfWeekRestrictions.indexOf(day);
      if (index > -1) {
        tier.dayOfWeekRestrictions = tier.dayOfWeekRestrictions.filter(d => d !== day);
      } else {
        tier.dayOfWeekRestrictions = [...tier.dayOfWeekRestrictions, day];
      }
    }
  }

  function isDaySelected(day: number): boolean {
    return tier.dayOfWeekRestrictions?.includes(day) ?? false;
  }
</script>

<div class="space-y-4">
  <div class="form-control">
    <div class="label">
      <span class="label-text">Day of Week Restrictions</span>
      <HelpTooltip>
        Select specific days this tier is available. Leave all unchecked for any day.
      </HelpTooltip>
    </div>
    <div class="flex gap-2">
      {#each daysOfWeek as day}
        <button
          type="button"
          class="btn btn-sm"
          class:btn-primary={isDaySelected(day.value)}
          class:btn-ghost={!isDaySelected(day.value)}
          onclick={() => toggleDay(day.value)}
        >
          {day.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <label class="form-control">
      <div class="label">
        <span class="label-text">Time Range Start</span>
        <HelpTooltip>Earliest booking time (24-hour format, e.g., "09:00")</HelpTooltip>
      </div>
      <input type="time" class="input input-bordered" bind:value={tier.timeRangeStart} />
    </label>

    <label class="form-control">
      <div class="label">
        <span class="label-text">Time Range End</span>
        <HelpTooltip>Latest booking time (24-hour format, e.g., "21:00")</HelpTooltip>
      </div>
      <input type="time" class="input input-bordered" bind:value={tier.timeRangeEnd} />
    </label>
  </div>
</div>
```

### 2.6 DepositConfig Component

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/DepositConfig.svelte`

```svelte
<script lang="ts">
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

  let {
    deposit = $bindable()
  }: {
    deposit: { required: boolean; type?: 'flat' | 'percent'; amountCents?: number | null };
  } = $props();

  function toggleDeposit(checked: boolean) {
    if (checked) {
      deposit = { required: true, type: 'flat', amountCents: 0 };
    } else {
      deposit = { required: false };
    }
  }
</script>

<div class="space-y-4">
  <label class="flex cursor-pointer items-center gap-3">
    <input
      type="checkbox"
      class="toggle toggle-primary"
      checked={deposit.required}
      onchange={(e) => toggleDeposit(e.currentTarget.checked)}
    />
    <span class="label-text">Require deposit at booking</span>
  </label>

  {#if deposit.required}
    <div class="grid gap-4 md:grid-cols-2">
      <label class="form-control">
        <div class="label">
          <span class="label-text">Deposit Type</span>
          <HelpTooltip>
            Flat: Fixed dollar amount (e.g., $50)
            Percent: Percentage of total (e.g., 25%)
          </HelpTooltip>
        </div>
        <select class="select select-bordered" bind:value={deposit.type}>
          <option value="flat">Flat Amount</option>
          <option value="percent">Percentage</option>
        </select>
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text">
            {deposit.type === 'percent' ? 'Percent (%)' : 'Amount ($)'}
          </span>
          <HelpTooltip>
            {deposit.type === 'percent'
              ? 'Percentage of total booking price (0-100)'
              : 'Fixed dollar amount required as deposit'}
          </HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={deposit.amountCents}
          min="0"
          max={deposit.type === 'percent' ? 100 : undefined}
          step={deposit.type === 'percent' ? 1 : 0.01}
          required
        />
      </label>
    </div>
  {/if}
</div>
```

---

## Part 3: DaisyUI Component Standardization

### 3.1 Volume Slider Component (NEW)

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

### 3.2 FormField Wrapper (NEW)

**File:** `apps/escapeplan-web/src/lib/components/ui/FormField.svelte`

```svelte
<script lang="ts">
  import HelpTooltip from './HelpTooltip.svelte';

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
    children: import('svelte').Snippet;
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

### 3.3 Usage Example (Game Details Tab)

```svelte
<!-- BEFORE (old pattern): -->
<label class="form-control">
  <span class="label-text">Duration (minutes)</span>
  <input type="number" class="input input-bordered" bind:value={game.durationMinutes} />
</label>

<!-- AFTER (standardized): -->
<FormField
  label="Duration (minutes)"
  helpText="Standard session length. Can be overridden during quick-start."
  error={errors.durationMinutes}
  required
>
  <input type="number" class="input input-bordered" bind:value={game.durationMinutes} />
</FormField>

<!-- Volume slider standardization: -->
<VolumeSlider
  bind:value={game.defaultVolume}
  label="Default Volume"
  helpText="Default playback volume for all media in this game (0-100)"
/>
```

---

## Part 4: Implementation Checklist

### Phase 1: Rooms Removal (Prerequisite - Other Agent)
- [ ] Execute ROOMS_TABLE_REMOVAL_PLAN.md
- [ ] Validate all tests pass
- [ ] Confirm GameModal.svelte compiles
- [ ] Verify no room references remain

### Phase 2: Pricing Tab Rebuild (PRIORITY - claude-gamesettings)
- [ ] Create `apps/escapeplan-web/src/lib/components/games/pricing/` directory
- [ ] Implement `DepositConfig.svelte` (simplest component)
- [ ] Implement `TierModelSelector.svelte` (visual model picker)
- [ ] Implement `PerHourFields.svelte` (per_hour model fields)
- [ ] Implement `TierScheduleFields.svelte` (day/time restrictions)
- [ ] Implement `TierCard.svelte` (orchestrates above components)
- [ ] Create `tabs/GamePricingTab.svelte` (main tab component)
- [ ] Update `GameModal.svelte` to use new pricing tab
- [ ] Test pricing tab in isolation
- [ ] Validate tier creation/editing/deletion
- [ ] Test per_person, per_session, per_hour models
- [ ] Verify payload generation matches schema

### Phase 3: UI Utilities (Supporting Components)
- [ ] Create `VolumeSlider.svelte` component
- [ ] Create `FormField.svelte` wrapper
- [ ] Update existing inputs to use FormField
- [ ] Add HelpTooltip to all complex fields
- [ ] Standardize error display

### Phase 4: Tab Extraction (Remaining Tabs)
- [ ] Extract `GameDetailsTab.svelte`
- [ ] Extract `GameMediaTab.svelte`
- [ ] Extract `GamePuzzlesTab.svelte`
- [ ] Extract `GameBookingTab.svelte`
- [ ] Extract `GameMilestonesTab.svelte`
- [ ] Update `GameModal.svelte` to orchestrate tabs
- [ ] Verify all tabs work independently

### Phase 5: Testing & Validation
- [ ] Create game with all tier types
- [ ] Edit existing game tiers
- [ ] Delete tier, verify order recalculates
- [ ] Test per_hour model calculations
- [ ] Test schedule restrictions (days/times)
- [ ] Test seasonal pricing (validFrom/validUntil)
- [ ] Verify payload matches SaveGameRequest schema
- [ ] Test validation errors display correctly

---

## Part 5: Validation Criteria

### Pricing Tab Must:
- [ ] Support all 3 pricing models (per_person, per_session, per_hour)
- [ ] Display HelpTooltip for every complex field
- [ ] Allow creating/editing/deleting tiers
- [ ] Allow reordering tiers (up/down buttons)
- [ ] Support all tier fields from schema:
  - [ ] model, label, description, priceCents
  - [ ] baseHours, basePriceCents, additionalHourCents (per_hour)
  - [ ] minPlayers, maxPlayers
  - [ ] minDurationHours, maxDurationHours (per_hour)
  - [ ] dayOfWeekRestrictions (array of 0-6)
  - [ ] timeRangeStart, timeRangeEnd (HH:MM format)
  - [ ] validFrom, validUntil (date pickers)
  - [ ] displayOrder (auto-calculated)
  - [ ] active (toggle)
- [ ] Generate correct SaveGameRequest payload
- [ ] Validate required fields before submission
- [ ] Show clear error messages

### DaisyUI Standards Must:
- [ ] Use `range range-primary` for all sliders
- [ ] Use `input input-bordered` for all text inputs
- [ ] Use `select select-bordered` for all dropdowns
- [ ] Use `toggle toggle-primary` for all boolean toggles
- [ ] Use `card` + `card-body` for all sections
- [ ] Use `badge` for status indicators
- [ ] Use `alert` for info/warning messages
- [ ] Use consistent spacing (space-y-4, gap-4)

---

## Part 6: Migration Path for Existing Games

When users open an existing game in edit mode with old pricing structure:

**Migration Logic in `cloneGameDetails()`:**

```typescript
function cloneGameDetails(details: GameDetails): EditableGame {
  // ... existing fields ...

  pricing: details.pricing
    ? {
        tiers: details.pricing.tiers
          ? details.pricing.tiers.map((tier) => ({
              ...tier,
              // MIGRATION: If tier.model is missing, infer from deprecated game.pricingModel
              model: tier.model ?? (details.pricingModel === 'PER_PERSON' ? 'per_person' : 'per_session'),
              priceCents: tier.priceCents / 100, // Convert cents to dollars for input
              active: tier.active ?? true
            }))
          : [],
        deposit: details.pricing.deposit ?? { required: false },
        discounts: [] // Discounts moved to global system
      }
    : {
        tiers: [],
        deposit: { required: false },
        discounts: []
      },

  // ... rest of fields ...
}
```

---

## Part 7: Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Create pricing tab components (6 files) | 4 hours |
| Integrate pricing tab into GameModal | 1 hour |
| Test pricing tab functionality | 2 hours |
| Create UI utility components | 1 hour |
| Extract remaining tabs (5 tabs) | 6 hours |
| Update GameModal orchestration | 2 hours |
| End-to-end testing | 3 hours |
| Bug fixes + polish | 2 hours |
| **TOTAL** | **~21 hours (3 sessions)** |

---

## Part 8: Success Criteria

- [ ] GameModal.svelte is <400 lines (down from 2184)
- [ ] Each tab component is <500 lines
- [ ] Pricing tab supports all 3 models fully
- [ ] HelpTooltip used on 15+ fields
- [ ] All inputs use standardized DaisyUI classes
- [ ] Volume sliders use range component
- [ ] Can create game with per_hour pricing
- [ ] Can edit all tier fields
- [ ] Can reorder tiers
- [ ] Payload matches SaveGameRequest schema exactly
- [ ] 0 TypeScript errors
- [ ] GameModal loads in <500ms
- [ ] No console errors

---

## Part 9: Post-Completion Tasks

1. **Update Documentation:**
   - Document new pricing models in project-overview.md
   - Add pricing examples to USER_STORIES.json
   - Create pricing FAQ for operators

2. **Update Seed Data:**
   - Add multi-tier examples to seed.ts
   - Include per_hour tier example
   - Add seasonal pricing example

3. **Create Tests:**
   - Unit tests for tier calculations
   - Integration tests for game creation
   - E2E test for full booking flow with tiers

4. **Training Materials:**
   - Screenshot pricing tab for documentation
   - Create video walkthrough of per_hour model
   - Document common pricing strategies

---

**Document Version:** 1.0
**Ready for Execution:** ✅ YES (after rooms removal)
**Priority:** 🔴 HIGH - Pricing is core business logic
**Estimated Start:** After rooms removal validation complete

