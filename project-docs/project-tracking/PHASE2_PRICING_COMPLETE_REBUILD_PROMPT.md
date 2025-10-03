# Phase 2: Complete Pricing System Rebuild - Agent Execution Prompt

**Agent Role:** Full-Stack Pricing Specialist
**Session:** Complete Pricing Model + UI Rebuild
**Validation By:** claude-gamesettings (will review your work)
**Prerequisites:** ✅ Phase 1 (Rooms Removal) must be 100% complete
**Estimated Duration:** 12-16 hours across 2 sessions

---

## 🎯 MISSION OVERVIEW

**Rebuild the ENTIRE pricing system from schema to UI with:**
1. Per-tier pricing models ('per_person' | 'per_session' | 'per_hour')
2. Complete UI components with DaisyUI 5.1.26+ standards
3. Enhanced per-hour model with base hours + additional hour discounts
4. Tier scheduling constraints (days, times, seasonal dates)
5. Mobile pricing considerations (travel time/mileage for mobile games)
6. Comprehensive help tooltips explaining all complex fields

**CRITICAL:** This is NOT just a pricing tab rebuild. You will touch:
- Database schema (Drizzle)
- Validation schemas (Zod)
- API state logic (calculations, validations)
- 8 new UI components
- GameModal integration
- Booking flow updates

---

## REQUIRED READING (Read ALL before starting)

**Foundation Documents:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt` - Base instructions
2. `@escapeplan-app/project-docs/project-tracking/project.yaml` - Tech stack
3. `@escapeplan-app/apps/DOCS/API_CONTRACTS_SCHEMA_MANAGEMENT.md` - Schema patterns

**Planning Documents:**
4. `@escapeplan-app/project-docs/project-tracking/GAMEMODAL_UI_REFACTORING_PLAN.md` - UI component specs
5. **THIS FILE** - Complete pricing requirements

**Schema/Validation:**
6. `@escapeplan-app/packages/contracts/src/schema.ts` - Drizzle schema
7. `@escapeplan-app/packages/contracts/src/validation.ts` - Zod schemas (pricingTierSchema is already defined!)

**Reference Implementations:**
8. `@escapeplan-app/apps/escapeplan-web/src/lib/components/ui/HelpTooltip.svelte` - Existing help component

---

## 📋 PRICING REQUIREMENTS (User-Specified)

### A. Pricing Model Options
```typescript
type PricingModel = 'per_person' | 'per_session' | 'per_hour';
```

**Meanings:**
- **per_person**: Multiply price by party size (e.g., $25/person × 4 people = $100)
- **per_session**: Flat rate for entire group (e.g., $150 for up to 6 people)
- **per_hour**: Base hours at base price + discounted additional hours (e.g., $200 for 2hrs + $75/hr after)

### B. Tier-Level Model Assignment

**✅ REQUIREMENT:** Each tier can have its own pricing model (flexible, per user request)

**Example game with multiple tiers:**
```javascript
{
  name: "Pirate Mutiny",
  gameType: "storefront",
  pricing: {
    tiers: [
      {
        label: "Standard Weekday",
        model: "per_person",  // $25/person
        priceCents: 2500,
        dayOfWeekRestrictions: [1, 2, 3, 4],  // Mon-Thu
        active: true
      },
      {
        label: "Weekend Group Rate",
        model: "per_session",  // $150 flat for up to 8 people
        priceCents: 15000,
        maxPlayers: 8,
        dayOfWeekRestrictions: [5, 6, 0],  // Fri-Sun
        active: true
      },
      {
        label: "Private Party (2-6 hours)",
        model: "per_hour",  // $200 for 2hrs + $75/hr additional
        baseHours: 2,
        basePriceCents: 20000,
        additionalHourCents: 7500,
        minDurationHours: 2,
        maxDurationHours: 6,
        active: true
      }
    ]
  }
}
```

### C. Mobile Game Pricing (gameType: 'mobile')

**✅ REQUIREMENT:** Games are configured as EITHER 'storefront' OR 'mobile' (never both)

**Mobile-specific considerations:**
- Game has `gameType: 'mobile'` field
- Per-hour tiers should account for travel time/mileage (manual operator override)
- Booking rules have `travelBufferMinutes` and `locationNotes`
- No separate `isMobileOnly` tier flag needed (use tier constraints instead)

**Pattern:**
```javascript
// Mobile game example
{
  name: "Mobile Mystery Van",
  gameType: "mobile",  // ← Set at game level
  pricing: {
    tiers: [
      {
        label: "2-Hour Mobile Experience",
        model: "per_hour",
        baseHours: 2,
        basePriceCents: 30000,  // Higher base includes travel
        additionalHourCents: 10000,
        minDurationHours: 2,
        maxDurationHours: 4
      }
    ]
  },
  bookingRules: {
    isMobile: true,
    travelBufferMinutes: 60,  // 1 hour buffer for travel
    locationNotes: "Travel surcharge: $0.50/mile beyond 20 miles"
  }
}
```

### D. Tier Selection Logic (How Customers Choose Tiers)

**✅ CLARIFIED LOGIC:**

**Tier matching happens in this order:**
1. **Party size constraints** - Filter tiers by `minPlayers` and `maxPlayers`
2. **Day of week** - Filter tiers by `dayOfWeekRestrictions` (if set)
3. **Time of day** - Filter tiers by `timeRangeStart`/`timeRangeEnd` (if set)
4. **Seasonal dates** - Filter tiers by `validFrom`/`validUntil` (if set)
5. **Active status** - Only show `active: true` tiers
6. **Display order** - Sort remaining tiers by `displayOrder` ascending

**Example scenarios:**

**Scenario 1: Weekend Pricing**
```javascript
// Customer books for Saturday 7pm, party of 6
// Tiers available:
[
  { label: "Weekday Standard", dayOfWeekRestrictions: [1,2,3,4] },  // ← Filtered out (Sat = 6)
  { label: "Weekend Premium", dayOfWeekRestrictions: [5,6,0] },     // ← MATCHES
  { label: "Holiday Special", validFrom: "2025-12-20", validUntil: "2026-01-05" }  // ← Filtered out (not in range)
]
// Customer sees only "Weekend Premium"
```

**Scenario 2: Party Buyout**
```javascript
// Customer books for Wednesday 2pm, party of 12 (wants entire room)
// Tiers available:
[
  { label: "Standard (up to 6)", maxPlayers: 6 },           // ← Filtered out (party too large)
  { label: "Large Group (7-10)", minPlayers: 7, maxPlayers: 10 },  // ← Filtered out (party too large)
  { label: "Full Buyout", model: "per_hour", minPlayers: 10, maxPlayers: 15 }  // ← MATCHES
]
// Customer sees only "Full Buyout"
```

**Scenario 3: Time-Based Pricing**
```javascript
// Customer books for Friday 11am, party of 4
// Tiers available:
[
  { label: "Early Bird", timeRangeStart: "09:00", timeRangeEnd: "12:00" },  // ← MATCHES (11am in range)
  { label: "Prime Time", timeRangeStart: "18:00", timeRangeEnd: "22:00" },  // ← Filtered out
  { label: "Anytime", /* no time restrictions */ }  // ← ALSO MATCHES (always available)
]
// Customer sees "Early Bird" and "Anytime", can choose based on price
```

**UI Display:**
- Show all matching tiers as selectable cards/buttons
- Display price calculation preview for each tier
- Highlight "Best Value" or "Most Popular" tier
- Include tier description text to explain constraints

### E. Per-Hour Duration Handling

**✅ REQUIREMENTS:**

**Schema Fields (already in validation.ts):**
```typescript
{
  model: "per_hour",
  baseHours: number,              // Minimum hours included (e.g., 2)
  basePriceCents: number,         // Price for base hours (e.g., $200)
  additionalHourCents: number,    // Rate per additional hour (e.g., $75)
  minDurationHours: number,       // Minimum bookable duration (e.g., 2)
  maxDurationHours: number        // Maximum bookable duration (e.g., 6)
}
```

**Pricing Calculation:**
```typescript
function calculatePerHourPrice(tier: GamePricingTier, durationHours: number): number {
  if (durationHours <= tier.baseHours) {
    return tier.basePriceCents;
  }

  const additionalHours = durationHours - tier.baseHours;
  return tier.basePriceCents + (tier.additionalHourCents * additionalHours);
}

// Example:
// Tier: 2 base hours @ $200, $75/additional hour
// Booking: 4 hours
// Calculation: $200 + ($75 × 2) = $350
```

**Booking Modal Behavior:**
1. When per_hour tier selected, show duration dropdown
2. Dropdown shows hours from `minDurationHours` to `maxDurationHours` in 1-hour increments
3. Display real-time price calculation as user changes hours
4. For mobile games, remind about travel buffer (travelBufferMinutes)

**Duration Override:**
- Game has `durationMinutes` field (default game length, e.g., 60)
- Per-hour bookings can override this for longer sessions
- Example: Game duration = 60 mins, customer books 3-hour party = 180 mins total

### F. Full Group Buyout Rates

**✅ CLARIFIED:**

**Use BOTH approaches:**
1. **Tier-based buyouts** (permanent pricing structure)
2. **Discount code promos** (temporary special offers)

**Tier Example:**
```javascript
{
  label: "Exclusive Buyout",
  model: "per_session",  // Flat rate for entire space
  priceCents: 50000,     // $500 for exclusive use
  minPlayers: 15,        // Must book at least 15 people
  maxPlayers: 30,        // Can fit up to 30
  description: "Reserve entire space exclusively for your group",
  active: true
}
```

**Discount Code Example:**
```javascript
// Created via Admin > Discounts
{
  code: "BIRTHDAY50",
  type: "percent",
  percentOff: 50,
  appliesTo: "selected",
  gameIds: ["game-uuid-here"],
  minimumPartySize: 10,
  validUntil: "2025-12-31T23:59:59Z",
  notes: "Birthday party special - 50% off for groups of 10+"
}
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### Component Structure
```
apps/escapeplan-web/src/lib/components/
├── ui/
│   ├── HelpTooltip.svelte           ✅ EXISTS (use this)
│   ├── VolumeSlider.svelte          ❌ CREATE (generic range slider)
│   └── FormField.svelte             ❌ CREATE (label + help + error wrapper)
├── games/
│   ├── GameModal.svelte             ⚠️ UPDATE (integrate pricing tab)
│   ├── pricing/                     ❌ CREATE FOLDER
│   │   ├── DepositConfig.svelte     ❌ CREATE
│   │   ├── TierModelSelector.svelte ❌ CREATE
│   │   ├── PerHourFields.svelte     ❌ CREATE
│   │   ├── TierScheduleFields.svelte ❌ CREATE
│   │   └── TierCard.svelte          ❌ CREATE
│   └── tabs/                        ❌ CREATE FOLDER
│       └── GamePricingTab.svelte    ❌ CREATE
```

### Data Flow
```
User Input → GamePricingTab → TierCard → Specialized Fields (PerHourFields, etc.)
                    ↓
             workingGame.pricing (Svelte $state)
                    ↓
           buildPayload() in GameModal
                    ↓
         API POST /admin/games with SaveGameRequest
                    ↓
        Zod validation (saveGameSchema.safeParse)
                    ↓
           API state.ts (createGame/updateGame)
                    ↓
                 Database
```

---

## 📝 SCHEMA & VALIDATION (ALREADY DEFINED)

**Current state:** `packages/contracts/src/validation.ts` ALREADY HAS correct schema!

```typescript
// ✅ pricingTierSchema (lines 67-103) is PERFECT - use as-is
export const pricingTierSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  model: z.enum(['per_person', 'per_session', 'per_hour']),
  priceCents: z.number().int().nonnegative(),
  baseHours: z.number().int().positive().optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  additionalHourCents: z.number().int().nonnegative().optional(),
  minPlayers: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),
  minDurationHours: z.number().int().positive().optional(),
  maxDurationHours: z.number().int().positive().optional(),
  dayOfWeekRestrictions: z.array(z.number().int().min(0).max(6)).optional(),
  timeRangeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeRangeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().min(1).default(1),
  active: z.boolean().default(true)
});
```

**YOUR TASK:** Use this schema - NO CHANGES NEEDED to validation.ts

**Type inference:**
```typescript
import type { GamePricingTier } from '@escapeplan/contracts';
// This type is already exported from validation.ts via z.infer
```

---

## 🎨 COMPONENT SPECIFICATIONS

### BUILD ORDER (Bottom-Up):
1. VolumeSlider + FormField (UI utilities)
2. DepositConfig
3. TierModelSelector
4. PerHourFields
5. TierScheduleFields
6. TierCard (orchestrates 2-5)
7. GamePricingTab (orchestrates all)
8. GameModal integration

---

## 📦 COMPONENT 1: VolumeSlider.svelte

**File:** `apps/escapeplan-web/src/lib/components/ui/VolumeSlider.svelte`

**Purpose:** Reusable range slider with DaisyUI styling + live value display

**Spec:**
```svelte
<script lang="ts">
  import HelpTooltip from './HelpTooltip.svelte';

  let {
    value = $bindable(80),
    label = 'Volume',
    helpText,
    min = 0,
    max = 100,
    step = 1,
    disabled = false
  }: {
    value: number;
    label?: string;
    helpText?: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  } = $props();
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text">{label}</span>
    {#if helpText}
      <HelpTooltip>{helpText}</HelpTooltip>
    {/if}
  </div>
  <div class="flex items-center gap-4">
    <input
      type="range"
      class="range range-primary"
      bind:value
      {min}
      {max}
      {step}
      {disabled}
    />
    <span class="badge badge-neutral min-w-[3rem] font-mono">{value}</span>
  </div>
</div>
```

**DaisyUI Classes Used:**
- `range range-primary` - Primary colored range slider
- `badge badge-neutral` - Neutral badge for value display
- `form-control` - Form field wrapper
- `label` + `label-text` - Label styling

**Test:**
```bash
cd apps/escapeplan-web
pnpm check
# Should succeed with 0 errors
```

---

## 📦 COMPONENT 2: FormField.svelte

**File:** `apps/escapeplan-web/src/lib/components/ui/FormField.svelte`

**Purpose:** DRY wrapper for form inputs with label + help + error display

**Spec:**
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
      {#if required}<span class="text-error ml-1">*</span>{/if}
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

**Usage Example:**
```svelte
<FormField
  label="Tier Label"
  helpText="Display name shown to customers"
  required
  error={errors.label}
>
  <input type="text" class="input input-bordered" bind:value={tier.label} />
</FormField>
```

---

## 📦 COMPONENT 3: DepositConfig.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/DepositConfig.svelte`

**Purpose:** Toggle + config for deposit requirements

**Spec:**
```svelte
<script lang="ts">
  import HelpTooltip from '../../ui/HelpTooltip.svelte';

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

  // Convert cents to dollars for input display
  let amountDollars = $derived(
    deposit.amountCents ? deposit.amountCents / 100 : 0
  );

  function updateAmount(dollars: number) {
    deposit.amountCents = Math.round(dollars * 100);
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
    <HelpTooltip>
      Customers pay a deposit upfront and remainder on arrival. Helps reduce no-shows.
    </HelpTooltip>
  </label>

  {#if deposit.required}
    <div class="grid gap-4 md:grid-cols-2 pl-10">
      <div class="form-control">
        <div class="label">
          <span class="label-text">Deposit Type</span>
          <HelpTooltip>
            • Flat: Fixed dollar amount (e.g., $50 deposit)<br/>
            • Percent: Percentage of total (e.g., 25% deposit)
          </HelpTooltip>
        </div>
        <select class="select select-bordered" bind:value={deposit.type}>
          <option value="flat">Flat Amount ($)</option>
          <option value="percent">Percentage (%)</option>
        </select>
      </div>

      <div class="form-control">
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
          value={amountDollars}
          oninput={(e) => updateAmount(parseFloat(e.currentTarget.value) || 0)}
          min="0"
          max={deposit.type === 'percent' ? 100 : undefined}
          step={deposit.type === 'percent' ? 1 : 0.01}
          required
        />
      </div>
    </div>
  {/if}
</div>
```

**DaisyUI Classes:**
- `toggle toggle-primary` - Primary toggle switch
- `select select-bordered` - Bordered select dropdown
- `input input-bordered` - Bordered text input

**Validation:**
```bash
pnpm check
# FormField should type-check correctly
```

---

## 📦 COMPONENT 4: TierModelSelector.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierModelSelector.svelte`

**Purpose:** Visual card-based selector for pricing model

**Spec:**
```svelte
<script lang="ts">
  import type { PricingModel } from '@escapeplan/contracts';
  import HelpTooltip from '../../ui/HelpTooltip.svelte';

  let {
    model = $bindable()
  }: {
    model: PricingModel;
  } = $props();

  const models: Array<{
    value: PricingModel;
    label: string;
    description: string;
    icon: string;
    example: string;
  }> = [
    {
      value: 'per_person',
      label: 'Per Person',
      description: 'Charge each player individually',
      icon: '👤',
      example: '$25/person × 4 players = $100'
    },
    {
      value: 'per_session',
      label: 'Per Session',
      description: 'Flat rate for entire group',
      icon: '🎮',
      example: '$150 for up to 6 players'
    },
    {
      value: 'per_hour',
      label: 'Per Hour',
      description: 'Hourly rate with base + additional',
      icon: '⏱️',
      example: '$200 for 2hrs + $75/hr after'
    }
  ];
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text font-semibold">Pricing Model</span>
    <HelpTooltip>
      <strong>How this tier calculates pricing:</strong><br/><br/>
      • <strong>Per Person:</strong> Multiply price by party size (best for standard bookings)<br/>
      • <strong>Per Session:</strong> Fixed price regardless of party size (best for buyouts)<br/>
      • <strong>Per Hour:</strong> Base price + hourly rate for extended sessions (best for parties)
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
          class="hidden peer"
        />
        <div
          class="card border-2 transition-all hover:shadow-md peer-checked:border-primary peer-checked:bg-primary/10 border-base-300"
        >
          <div class="card-body p-4 text-center">
            <div class="text-3xl mb-2">{modelOption.icon}</div>
            <h4 class="font-semibold text-sm">{modelOption.label}</h4>
            <p class="text-xs text-base-content/70 mb-2">{modelOption.description}</p>
            <p class="text-xs text-base-content/50 italic">{modelOption.example}</p>
          </div>
        </div>
      </label>
    {/each}
  </div>
</div>
```

**DaisyUI Classes:**
- `card` + `card-body` - Card container
- `border-2` + `border-primary` - Border styling
- `bg-primary/10` - Primary background with opacity
- Tailwind peer utilities for radio button state

---

## 📦 COMPONENT 5: PerHourFields.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/PerHourFields.svelte`

**Purpose:** Per-hour model configuration (base hours, rates, duration limits)

**Spec:**
```svelte
<script lang="ts">
  import type { GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '../../ui/HelpTooltip.svelte';

  let {
    tier = $bindable()
  }: {
    tier: GamePricingTier;
  } = $props();

  // Ensure per_hour fields exist
  $effect(() => {
    if (tier.model === 'per_hour') {
      tier.baseHours ??= 2;
      tier.basePriceCents ??= 0;
      tier.additionalHourCents ??= 0;
      tier.minDurationHours ??= 2;
      tier.maxDurationHours ??= undefined;
    }
  });

  // Convert cents to dollars for input
  let basePriceDollars = $derived((tier.basePriceCents ?? 0) / 100);
  let additionalHourDollars = $derived((tier.additionalHourCents ?? 0) / 100);

  function updateBasePrice(dollars: number) {
    tier.basePriceCents = Math.round(dollars * 100);
  }

  function updateAdditionalHour(dollars: number) {
    tier.additionalHourCents = Math.round(dollars * 100);
  }
</script>

<div class="space-y-4 rounded-lg bg-base-300/30 p-4 border-l-4 border-primary">
  <div class="alert alert-info">
    <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div class="text-sm">
      <strong>Per-Hour Model:</strong> Set a base price for the first X hours, then charge
      a discounted rate for additional hours. Perfect for birthday parties and private events.
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <div class="form-control">
      <div class="label">
        <span class="label-text">Base Hours Included</span>
        <HelpTooltip>
          Number of hours included in base price.<br/>
          Example: "2 hours" means first 2 hours cost the base price
        </HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.baseHours}
        min="1"
        max="24"
        step="0.5"
        required
      />
    </div>

    <div class="form-control">
      <div class="label">
        <span class="label-text">Base Price ($)</span>
        <HelpTooltip>
          Price for the base hours.<br/>
          Example: "$200 for 2 hours"
        </HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        value={basePriceDollars}
        oninput={(e) => updateBasePrice(parseFloat(e.currentTarget.value) || 0)}
        min="0"
        step="0.01"
        required
      />
    </div>
  </div>

  <div class="form-control">
    <div class="label">
      <span class="label-text">Additional Hour Rate ($)</span>
      <HelpTooltip>
        Discounted rate per additional hour beyond base hours.<br/>
        Example: "$75/hr for hours 3, 4, 5, etc."
      </HelpTooltip>
    </div>
    <input
      type="number"
      class="input input-bordered"
      value={additionalHourDollars}
      oninput={(e) => updateAdditionalHour(parseFloat(e.currentTarget.value) || 0)}
      min="0"
      step="0.01"
      required
    />
  </div>

  <div class="divider text-xs">Duration Constraints</div>

  <div class="grid gap-4 md:grid-cols-2">
    <div class="form-control">
      <div class="label">
        <span class="label-text">Min Duration (hours)</span>
        <HelpTooltip>
          Minimum session length bookable for this tier.<br/>
          Usually equal to base hours (e.g., must book at least 2 hours)
        </HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.minDurationHours}
        min="0.5"
        step="0.5"
      />
    </div>

    <div class="form-control">
      <div class="label">
        <span class="label-text">Max Duration (hours)</span>
        <HelpTooltip>
          Maximum session length bookable for this tier.<br/>
          Leave blank for no limit.
        </HelpTooltip>
      </div>
      <input
        type="number"
        class="input input-bordered"
        bind:value={tier.maxDurationHours}
        min="0.5"
        step="0.5"
        placeholder="No limit"
      />
    </div>
  </div>

  <!-- Price Preview -->
  {#if tier.baseHours && tier.basePriceCents && tier.additionalHourCents}
    <div class="alert">
      <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <div class="text-sm">
        <strong>Example Calculation:</strong><br/>
        {tier.baseHours}hrs = ${(tier.basePriceCents / 100).toFixed(2)}<br/>
        {tier.baseHours + 2}hrs = ${(tier.basePriceCents / 100 + (tier.additionalHourCents / 100) * 2).toFixed(2)}
        (base + 2 additional hours)
      </div>
    </div>
  {/if}
</div>
```

**DaisyUI Classes:**
- `alert alert-info` - Info alert box
- `input input-bordered` - Text/number inputs
- `divider` - Section divider
- `bg-base-300/30` + `border-l-4 border-primary` - Highlighted section

---

## 📦 COMPONENT 6: TierScheduleFields.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierScheduleFields.svelte`

**Purpose:** Day/time/date restrictions for tier availability

**Spec:**
```svelte
<script lang="ts">
  import type { GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '../../ui/HelpTooltip.svelte';

  let {
    tier = $bindable()
  }: {
    tier: GamePricingTier;
  } = $props();

  const daysOfWeek = [
    { value: 0, label: 'Sun', fullName: 'Sunday' },
    { value: 1, label: 'Mon', fullName: 'Monday' },
    { value: 2, label: 'Tue', fullName: 'Tuesday' },
    { value: 3, label: 'Wed', fullName: 'Wednesday' },
    { value: 4, label: 'Thu', fullName: 'Thursday' },
    { value: 5, label: 'Fri', fullName: 'Friday' },
    { value: 6, label: 'Sat', fullName: 'Saturday' }
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

  // Convert ISO datetime to date input format (YYYY-MM-DD)
  function isoToDate(iso: string | undefined): string {
    if (!iso) return '';
    return iso.split('T')[0];
  }

  function dateToIso(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00Z').toISOString();
  }
</script>

<div class="space-y-4">
  <!-- Day of Week Restrictions -->
  <div class="form-control">
    <div class="label">
      <span class="label-text">Day of Week Availability</span>
      <HelpTooltip>
        Select specific days this tier is available.<br/>
        Leave all unchecked for "available any day".<br/><br/>
        <strong>Example:</strong> Weekend rates only apply Fri-Sun
      </HelpTooltip>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each daysOfWeek as day}
        <button
          type="button"
          class="btn btn-sm"
          class:btn-primary={isDaySelected(day.value)}
          class:btn-ghost={!isDaySelected(day.value)}
          onclick={() => toggleDay(day.value)}
          title={day.fullName}
        >
          {day.label}
        </button>
      {/each}
    </div>
    {#if tier.dayOfWeekRestrictions && tier.dayOfWeekRestrictions.length > 0}
      <div class="label">
        <span class="label-text-alt text-base-content/70">
          Available on: {tier.dayOfWeekRestrictions.map(d => daysOfWeek[d].fullName).join(', ')}
        </span>
      </div>
    {:else}
      <div class="label">
        <span class="label-text-alt text-base-content/50">
          Available any day of the week
        </span>
      </div>
    {/if}
  </div>

  <!-- Time Range Restrictions -->
  <div class="grid gap-4 md:grid-cols-2">
    <div class="form-control">
      <div class="label">
        <span class="label-text">Available From (Time)</span>
        <HelpTooltip>
          Earliest booking time (24-hour format).<br/>
          Example: "09:00" for 9am start
        </HelpTooltip>
      </div>
      <input
        type="time"
        class="input input-bordered font-mono"
        bind:value={tier.timeRangeStart}
        placeholder="09:00"
      />
    </div>

    <div class="form-control">
      <div class="label">
        <span class="label-text">Available Until (Time)</span>
        <HelpTooltip>
          Latest booking time (24-hour format).<br/>
          Example: "21:00" for 9pm cutoff
        </HelpTooltip>
      </div>
      <input
        type="time"
        class="input input-bordered font-mono"
        bind:value={tier.timeRangeEnd}
        placeholder="21:00"
      />
    </div>
  </div>

  {#if tier.timeRangeStart && tier.timeRangeEnd}
    <div class="label">
      <span class="label-text-alt text-base-content/70">
        Available {tier.timeRangeStart} – {tier.timeRangeEnd}
      </span>
    </div>
  {/if}

  <div class="divider text-xs">Seasonal Dates</div>

  <!-- Valid Date Range (Seasonal/Holiday Pricing) -->
  <div class="grid gap-4 md:grid-cols-2">
    <div class="form-control">
      <div class="label">
        <span class="label-text">Valid From (Date)</span>
        <HelpTooltip>
          Start date for seasonal/holiday pricing.<br/>
          Leave blank for "always available".<br/><br/>
          <strong>Example:</strong> Set Dec 20 – Jan 5 for holiday rates
        </HelpTooltip>
      </div>
      <input
        type="date"
        class="input input-bordered"
        value={isoToDate(tier.validFrom)}
        oninput={(e) => tier.validFrom = dateToIso(e.currentTarget.value)}
      />
    </div>

    <div class="form-control">
      <div class="label">
        <span class="label-text">Valid Until (Date)</span>
        <HelpTooltip>
          End date for seasonal/holiday pricing.<br/>
          Leave blank for "no expiration"
        </HelpTooltip>
      </div>
      <input
        type="date"
        class="input input-bordered"
        value={isoToDate(tier.validUntil)}
        oninput={(e) => tier.validUntil = dateToIso(e.currentTarget.value)}
      />
    </div>
  </div>

  {#if tier.validFrom || tier.validUntil}
    <div class="label">
      <span class="label-text-alt text-base-content/70">
        {#if tier.validFrom && tier.validUntil}
          Valid {isoToDate(tier.validFrom)} – {isoToDate(tier.validUntil)}
        {:else if tier.validFrom}
          Valid from {isoToDate(tier.validFrom)} onwards
        {:else if tier.validUntil}
          Valid until {isoToDate(tier.validUntil)}
        {/if}
      </span>
    </div>
  {/if}
</div>
```

**DaisyUI Classes:**
- `btn btn-sm` + `btn-primary`/`btn-ghost` - Day toggle buttons
- `input input-bordered` + `font-mono` - Time/date inputs
- `divider` - Section separator
- `label-text-alt` - Helper text styling

---

## 📦 COMPONENT 7: TierCard.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/pricing/TierCard.svelte`

**Purpose:** Complete tier editor orchestrating all subcomponents

**Spec:**
```svelte
<script lang="ts">
  import type { GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '../../ui/HelpTooltip.svelte';
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

  // Convert cents to dollars for price input
  let priceDollars = $derived((tier.priceCents ?? 0) / 100);

  function updatePrice(dollars: number) {
    tier.priceCents = Math.round(dollars * 100);
  }
</script>

<div class="card bg-base-100 shadow-md border border-base-300">
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
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={!canMoveDown}
          onclick={onMoveDown}
          title="Move down"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-error hover:bg-error/10"
          onclick={onRemove}
          title="Delete tier"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Basic Fields -->
    <div class="grid gap-4 md:grid-cols-2 mt-4">
      <div class="form-control">
        <div class="label">
          <span class="label-text">Tier Label</span>
          <HelpTooltip>
            Display name for this tier shown to customers.<br/>
            <strong>Examples:</strong> "Standard", "Weekend Premium", "Party Package"
          </HelpTooltip>
        </div>
        <input
          type="text"
          class="input input-bordered"
          bind:value={tier.label}
          placeholder="e.g., Standard Pricing"
          required
        />
      </div>

      <div class="form-control">
        <div class="label">
          <span class="label-text">Description (Optional)</span>
          <HelpTooltip>
            Optional explanation shown to customers during booking.<br/>
            Use this to explain when/why this tier applies.
          </HelpTooltip>
        </div>
        <input
          type="text"
          class="input input-bordered"
          bind:value={tier.description}
          placeholder="e.g., Best for weekday bookings"
        />
      </div>
    </div>

    <div class="divider"></div>

    <!-- Pricing Model Selector -->
    <TierModelSelector bind:model={tier.model} />

    <div class="divider">Pricing Details</div>

    <!-- Model-Specific Price Fields -->
    {#if tier.model === 'per_person'}
      <div class="form-control">
        <div class="label">
          <span class="label-text font-semibold">Price Per Person ($)</span>
          <HelpTooltip>
            Amount charged per player.<br/>
            <strong>Example:</strong> $25/person × 4 players = $100 total
          </HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered input-lg"
          value={priceDollars}
          oninput={(e) => updatePrice(parseFloat(e.currentTarget.value) || 0)}
          min="0"
          step="0.01"
          required
        />
      </div>
    {:else if tier.model === 'per_session'}
      <div class="form-control">
        <div class="label">
          <span class="label-text font-semibold">Flat Session Price ($)</span>
          <HelpTooltip>
            Fixed price for entire group regardless of size.<br/>
            <strong>Example:</strong> $150 flat for 2-8 players
          </HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered input-lg"
          value={priceDollars}
          oninput={(e) => updatePrice(parseFloat(e.currentTarget.value) || 0)}
          min="0"
          step="0.01"
          required
        />
      </div>
    {:else if tier.model === 'per_hour'}
      <PerHourFields bind:tier />
    {/if}

    <div class="divider">Player Capacity</div>

    <!-- Player Range -->
    <div class="grid gap-4 md:grid-cols-2">
      <div class="form-control">
        <div class="label">
          <span class="label-text">Min Players</span>
          <HelpTooltip>
            Minimum party size for this tier.<br/>
            Leave blank to use game default ({tier.minPlayers || 'N/A'})
          </HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.minPlayers}
          min="1"
          placeholder="Use game default"
        />
      </div>

      <div class="form-control">
        <div class="label">
          <span class="label-text">Max Players</span>
          <HelpTooltip>
            Maximum party size for this tier.<br/>
            Leave blank to use game default ({tier.maxPlayers || 'N/A'})
          </HelpTooltip>
        </div>
        <input
          type="number"
          class="input input-bordered"
          bind:value={tier.maxPlayers}
          min="1"
          placeholder="Use game default"
        />
      </div>
    </div>

    <!-- Active Toggle -->
    <label class="flex cursor-pointer items-center gap-3 mt-4">
      <input type="checkbox" class="toggle toggle-success" bind:checked={tier.active} />
      <span class="label-text font-semibold">Tier is active and bookable</span>
      <HelpTooltip>
        Inactive tiers are hidden from customers but preserved in the system.<br/>
        Use this to temporarily disable seasonal pricing without deleting.
      </HelpTooltip>
    </label>

    <!-- Advanced Options (Collapsible) -->
    <div class="divider mt-6">
      <button
        type="button"
        class="btn btn-ghost btn-sm gap-2"
        onclick={() => showAdvanced = !showAdvanced}
      >
        <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
        <svg
          class="h-4 w-4 transition-transform duration-200"
          class:rotate-180={showAdvanced}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    {#if showAdvanced}
      <div class="space-y-4 rounded-lg bg-base-200/50 p-4">
        <TierScheduleFields bind:tier />
      </div>
    {/if}
  </div>
</div>
```

**DaisyUI Classes:**
- `card` + `card-body` + `shadow-md` - Card styling
- `badge` variants - Status indicators
- `btn` variants - Action buttons
- `toggle toggle-success` - Active status toggle
- `input-lg` - Large input for primary price field
- `divider` - Section separators
- Transition utilities for collapse animation

---

## 📦 COMPONENT 8: GamePricingTab.svelte

**File:** `apps/escapeplan-web/src/lib/components/games/tabs/GamePricingTab.svelte`

**Purpose:** Main pricing tab orchestrating all tiers + deposit config

**Spec:**
```svelte
<script lang="ts">
  import type { GamePricingConfig, GamePricingTier } from '@escapeplan/contracts';
  import HelpTooltip from '../../ui/HelpTooltip.svelte';
  import TierCard from '../pricing/TierCard.svelte';
  import DepositConfig from '../pricing/DepositConfig.svelte';

  let {
    pricing = $bindable(),
    gameType
  }: {
    pricing: GamePricingConfig;
    gameType: 'storefront' | 'mobile';
  } = $props();

  // Ensure pricing structure exists
  $effect(() => {
    pricing.tiers ??= [];
    pricing.deposit ??= { required: false };
  });

  function addTier() {
    const newTier: GamePricingTier = {
      id: crypto.randomUUID(),
      label: `Tier ${pricing.tiers.length + 1}`,
      model: 'per_person', // Default model
      priceCents: 0,
      displayOrder: pricing.tiers.length + 1,
      active: true
    };
    pricing.tiers = [...pricing.tiers, newTier];
  }

  function removeTier(tierId: string) {
    if (pricing.tiers.length <= 1) {
      alert('At least one pricing tier is required');
      return;
    }
    pricing.tiers = pricing.tiers.filter(t => t.id !== tierId);
    // Recalculate display order
    pricing.tiers = pricing.tiers.map((t, idx) => ({ ...t, displayOrder: idx + 1 }));
  }

  function moveTier(tierId: string, direction: 'up' | 'down') {
    const index = pricing.tiers.findIndex(t => t.id === tierId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pricing.tiers.length) return;

    const newTiers = [...pricing.tiers];
    [newTiers[index], newTiers[newIndex]] = [newTiers[newIndex], newTiers[index]];

    // Update display order
    pricing.tiers = newTiers.map((t, idx) => ({ ...t, displayOrder: idx + 1 }));
  }
</script>

<div class="space-y-6">
  <!-- Game Type Notice (if mobile) -->
  {#if gameType === 'mobile'}
    <div class="alert alert-info">
      <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="text-sm">
        <strong>Mobile Game Pricing:</strong> Consider travel time and mileage in your pricing tiers.
        Use per-hour model for flexible booking durations. Set travel buffer in Booking Rules tab.
      </div>
    </div>
  {/if}

  <!-- Deposit Configuration -->
  <section class="card bg-base-200/50">
    <div class="card-body">
      <div class="flex items-center gap-2">
        <h3 class="card-title text-base">Deposit Settings</h3>
        <HelpTooltip>
          Configure whether customers pay a deposit at booking time.<br/>
          Deposits can be a flat dollar amount or a percentage of the total.<br/><br/>
          <strong>Why use deposits?</strong><br/>
          • Reduces no-shows and last-minute cancellations<br/>
          • Secures revenue upfront<br/>
          • Common practice in the escape room industry
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
            Create multiple pricing tiers for different scenarios:<br/>
            • Weekday vs weekend rates<br/>
            • Early bird vs prime time<br/>
            • Private party packages<br/>
            • Holiday/seasonal pricing<br/><br/>
            Each tier can use its own pricing model (per person, per session, or per hour).
          </HelpTooltip>
        </div>
        <button type="button" class="btn btn-primary btn-sm gap-2" onclick={addTier}>
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Tier
        </button>
      </div>

      {#if pricing.tiers.length === 0}
        <div class="alert alert-warning mt-4">
          <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>⚠️ No pricing tiers configured. Add at least one tier to enable bookings.</span>
        </div>
      {/if}

      <div class="space-y-4 mt-4">
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
          Discount codes are managed globally in Admin > Discounts.<br/>
          They can apply to specific games or all games.<br/><br/>
          <strong>Use Cases:</strong><br/>
          • Birthday party specials<br/>
          • Group booking discounts<br/>
          • Seasonal promotions<br/>
          • Corporate event packages
        </HelpTooltip>
      </div>
      <div class="alert">
        <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="font-semibold">Discounts managed globally</p>
          <p class="text-sm text-base-content/70">Visit Admin > Discounts to create promo codes that apply to this game.</p>
        </div>
        <a href="/admin/discounts" class="btn btn-sm btn-primary">Manage Discounts</a>
      </div>
    </div>
  </section>
</div>
```

**DaisyUI Classes:**
- `card` + `card-body` - Section containers
- `card-title` - Section headers
- `alert` variants - Info/warning messages
- `btn btn-primary btn-sm` - Action buttons
- `space-y-6` - Vertical spacing

**VALIDATE:**
```bash
cd apps/escapeplan-web
pnpm check
# Should succeed with 0 errors
```

---

## 🔌 GAMEMODAL INTEGRATION

**File:** `apps/escapeplan-web/src/lib/components/games/GameModal.svelte`

### Changes Required:

**1. Add import (top of script):**
```typescript
import GamePricingTab from './tabs/GamePricingTab.svelte';
```

**2. Replace pricing tab content (find `{:else if activeTab === 'pricing'}`):**
```svelte
<!-- BEFORE (lines ~1541-1847): -->
{:else if activeTab === 'pricing'}
  <div class="space-y-4">
    <!-- OLD 300+ lines of inline pricing fields --!>
  </div>

<!-- AFTER: -->
{:else if activeTab === 'pricing'}
  <GamePricingTab bind:pricing={workingGame.pricing} gameType={workingGame.gameType} />
```

**3. Verify buildPayload() function (lines ~628-734) has correct cents conversion:**
```typescript
const pricing: GamePricingConfig | undefined = workingGame.pricing
  ? {
      tiers: workingGame.pricing.tiers?.map((tier) => ({
        ...tier,
        id: tier.id || uid('tier'),
        // ✅ CRITICAL: Convert dollars to cents
        priceCents: Math.round((tier.priceCents ?? 0) * 100),
        basePriceCents: tier.basePriceCents ? Math.round(tier.basePriceCents * 100) : undefined,
        additionalHourCents: tier.additionalHourCents ? Math.round(tier.additionalHourCents * 100) : undefined,
        // ✅ Ensure all per-hour fields pass through
        baseHours: tier.baseHours ?? undefined,
        minDurationHours: tier.minDurationHours ?? undefined,
        maxDurationHours: tier.maxDurationHours ?? undefined,
        // ✅ Ensure all schedule fields pass through
        dayOfWeekRestrictions: tier.dayOfWeekRestrictions ?? undefined,
        timeRangeStart: tier.timeRangeStart ?? undefined,
        timeRangeEnd: tier.timeRangeEnd ?? undefined,
        validFrom: tier.validFrom ?? undefined,
        validUntil: tier.validUntil ?? undefined,
        // ✅ Ensure metadata fields pass through
        description: tier.description ?? undefined,
        displayOrder: tier.displayOrder ?? 0,
        active: tier.active ?? true,
        minPlayers: tier.minPlayers ?? undefined,
        maxPlayers: tier.maxPlayers ?? undefined
      })) ?? [],
      deposit: workingGame.pricing.deposit
        ? {
            required: Boolean(workingGame.pricing.deposit.required),
            type: workingGame.pricing.deposit.type,
            amountCents: workingGame.pricing.deposit.amountCents
              ? Math.round(workingGame.pricing.deposit.amountCents * 100)
              : null
          }
        : undefined,
      discounts: [] // Moved to global system
    }
  : undefined;
```

**4. Update validation (line ~749):**
```typescript
if ((workingGame.pricing.tiers?.length ?? 0) === 0) {
  return 'Add at least one pricing tier before saving.';
}

// Add per-hour model validation
for (const tier of workingGame.pricing.tiers) {
  if (tier.model === 'per_hour') {
    if (!tier.baseHours || !tier.basePriceCents || !tier.additionalHourCents) {
      return `Tier "${tier.label}": Per-hour model requires base hours, base price, and additional hour rate.`;
    }
    if (tier.minDurationHours && tier.maxDurationHours && tier.minDurationHours > tier.maxDurationHours) {
      return `Tier "${tier.label}": Min duration cannot exceed max duration.`;
    }
  }
}
```

**VALIDATE:**
```bash
cd apps/escapeplan-web
pnpm check
# Should succeed

# Test in browser
pnpm dev --host
# Navigate to /admin/games
# Click "New Game" → Pricing tab should load
```

---

## 🧪 TESTING REQUIREMENTS

### Manual Test Scenarios:

**Test 1: Create Game with Per-Person Tier**
1. Open GameModal (create new game)
2. Fill basic details (name, slug, add 1 puzzle)
3. Go to Pricing tab
4. Click "Add Tier"
5. Set label: "Standard Weekday"
6. Select model: "Per Person"
7. Set price: $25
8. Set min players: 2, max players: 6
9. Set day restrictions: Mon-Thu
10. Save game
11. **VERIFY:** Payload has tier with `model: 'per_person'`, `priceCents: 2500`, `dayOfWeekRestrictions: [1,2,3,4]`

**Test 2: Create Game with Per-Hour Tier**
1. Add new tier
2. Set label: "Private Party Package"
3. Select model: "Per Hour"
4. Set base hours: 3
5. Set base price: $300
6. Set additional hour rate: $100
7. Set min duration: 3 hours
8. Set max duration: 6 hours
9. Click "Show Advanced Options"
10. Set days: Fri, Sat, Sun
11. Set time range: 18:00 - 23:00
12. Save game
13. **VERIFY:** Payload has all per-hour fields, schedule restrictions, no cents conversion errors

**Test 3: Mobile Game with Per-Hour Pricing**
1. Create new game
2. Set gameType: "mobile"
3. Go to Pricing tab
4. **VERIFY:** Info alert about mobile pricing shows
5. Add per-hour tier with higher base rate
6. Go to Booking Rules tab
7. Set travelBufferMinutes: 60
8. Set locationNotes: "Travel fee: $0.50/mile"
9. Save game
10. **VERIFY:** Game saves with mobile=true, pricing tier, booking rules intact

**Test 4: Tier Reordering**
1. Create game with 3 tiers
2. Click "Move up" on tier 3
3. **VERIFY:** Tier 3 becomes tier 2, displayOrder recalculates
4. Click "Move down" on tier 1
5. **VERIFY:** Tier 1 becomes tier 2, displayOrder recalculates

**Test 5: Deposit Configuration**
1. Go to Pricing tab
2. Toggle "Require deposit" ON
3. Select type: "Percent"
4. Set amount: 25
5. Save game
6. **VERIFY:** Payload has `deposit: { required: true, type: 'percent', amountCents: 25 }`
7. Edit game, change to "Flat" $50
8. **VERIFY:** Payload updates to `{ required: true, type: 'flat', amountCents: 5000 }`

---

## ✅ VALIDATION CHECKLIST

Mark each item as you complete it:

### Component Creation
- [ ] `VolumeSlider.svelte` created and exports correctly
- [ ] `FormField.svelte` created with Snippet support
- [ ] `DepositConfig.svelte` created with cents conversion
- [ ] `TierModelSelector.svelte` created with 3 model cards
- [ ] `PerHourFields.svelte` created with calculation preview
- [ ] `TierScheduleFields.svelte` created with day/time/date inputs
- [ ] `TierCard.svelte` created orchestrating subcomponents
- [ ] `GamePricingTab.svelte` created orchestrating all tiers

### Type Safety
- [ ] All components import types from `@escapeplan/contracts`
- [ ] No manual TypeScript interfaces created
- [ ] All `$bindable()` parameters properly typed
- [ ] `pnpm check` passes with 0 errors

### DaisyUI Standards
- [ ] All range inputs use `range range-primary`
- [ ] All text inputs use `input input-bordered`
- [ ] All selects use `select select-bordered`
- [ ] All toggles use `toggle toggle-primary` or `toggle-success`
- [ ] All cards use `card bg-base-200/50` or `bg-base-100` + `card-body`
- [ ] All buttons use `btn btn-{variant} btn-{size}`
- [ ] All badges use `badge badge-{variant}`
- [ ] All alerts use `alert alert-{variant}`

### HelpTooltip Usage
- [ ] DepositConfig has 2+ HelpTooltips
- [ ] TierModelSelector has 1 comprehensive HelpTooltip
- [ ] PerHourFields has 5+ HelpTooltips
- [ ] TierScheduleFields has 4+ HelpTooltips
- [ ] TierCard has 10+ HelpTooltips total
- [ ] GamePricingTab has 3+ section-level HelpTooltips
- [ ] **Total: 25+ HelpTooltips across pricing system**

### Functionality
- [ ] Can add new tier
- [ ] Can delete tier (with validation: min 1 tier)
- [ ] Can move tier up/down
- [ ] Display order recalculates after reorder
- [ ] Model selector shows all 3 models with examples
- [ ] Per-hour fields appear when model = 'per_hour'
- [ ] Per-hour fields hidden when model != 'per_hour'
- [ ] Schedule fields work (7 day toggles + time inputs + date inputs)
- [ ] Deposit toggle works with type/amount fields
- [ ] Mobile game shows info alert

### Payload Validation
- [ ] Create game with per_person tier → payload correct (cents conversion)
- [ ] Create game with per_session tier → payload correct
- [ ] Create game with per_hour tier → payload has all per-hour fields
- [ ] Tier with day restrictions → payload includes dayOfWeekRestrictions
- [ ] Tier with time range → payload includes timeRangeStart/End
- [ ] Tier with seasonal dates → payload includes validFrom/validUntil
- [ ] Deposit with flat amount → cents conversion correct
- [ ] Deposit with percent → amountCents set correctly
- [ ] Payload matches `SaveGameRequest` schema exactly

### Runtime Validation
- [ ] GameModal opens without errors
- [ ] Pricing tab loads without errors
- [ ] Can switch between tabs without errors
- [ ] Console shows 0 errors
- [ ] Console shows 0 warnings
- [ ] All 5 test scenarios pass

---

## 📋 COMPLETION REQUIREMENTS

### 1. Create Session Notes

Create `project-docs/project-tracking/sessions/SESSION_51_PRICING_COMPLETE_REBUILD.md`:

```markdown
# Session 51: Pricing System Complete Rebuild

**Date:** [DATE]
**Status:** ✅ COMPLETE
**Agent:** [YOUR NAME]
**Validation:** Pending (claude-gamesettings)

## Summary
Complete rebuild of pricing system from schema to UI. Implemented per-tier pricing models, per-hour functionality, tier scheduling, and comprehensive UI components with DaisyUI 5.1.26+ standards.

## Components Created

### UI Utilities
1. VolumeSlider.svelte (lines: X)
2. FormField.svelte (lines: X)

### Pricing Components
3. DepositConfig.svelte (lines: X)
4. TierModelSelector.svelte (lines: X)
5. PerHourFields.svelte (lines: X)
6. TierScheduleFields.svelte (lines: X)
7. TierCard.svelte (lines: X)
8. GamePricingTab.svelte (lines: X)

**Total:** 8 components, ~X lines

### GameModal Integration
- Imported GamePricingTab
- Replaced pricing tab content (~300 lines → 1 line)
- Updated buildPayload() with complete tier field mapping
- Added per-hour tier validation

## Lines of Code
- Components created: X lines
- GameModal reduced: 2184 → ~1880 lines (pricing tab extracted)
- HelpTooltip usage: 27 instances across pricing system
- Net LOC reduction: ~X lines

## Testing Results

### Manual Test Scenarios
- [x] Per-person tier: ✅ SUCCESS
- [x] Per-hour tier with schedule: ✅ SUCCESS
- [x] Mobile game pricing: ✅ SUCCESS
- [x] Tier reordering: ✅ SUCCESS
- [x] Deposit configuration: ✅ SUCCESS

### Payload Validation
[PASTE EXAMPLE PAYLOADS FROM TESTS]

## Validation Results

### Type Checking
```bash
pnpm --filter @escapeplan/contracts build: ✅ SUCCESS
pnpm --filter escapeplan-web check: ✅ SUCCESS (0 errors)
```

### Runtime Testing
```bash
pnpm --filter escapeplan-web dev: ✅ Started without errors
Manual testing: ✅ ALL PASS (5/5 scenarios)
```

## Issues Encountered
[LIST ANY PROBLEMS AND HOW YOU SOLVED THEM]

## Checklist Status
[COPY VALIDATION CHECKLIST WITH ALL CHECKMARKS]

## Notes for Next Phase
Pricing system is now 100% complete. Ready for Phase 0: UI Design System Audit.
```

### 2. DO NOT Commit Yet

- ❌ Do NOT commit changes
- ❌ Do NOT push to remote
- ✅ Leave changes staged for validation by claude-gamesettings

### 3. Report Completion

Reply with:
```
✅ PRICING SYSTEM COMPLETE REBUILD FINISHED

Components created: 8
Total lines added: ~X
HelpTooltips: 27
GameModal reduction: 2184 → 1880 lines

Testing scenarios passed:
- [x] Per-person tier
- [x] Per-hour tier with schedule
- [x] Mobile game pricing
- [x] Tier reordering
- [x] Deposit configuration

Payload validation: ✅ ALL PASS
Type checking: ✅ 0 errors
Runtime testing: ✅ No errors

Session notes: SESSION_51_PRICING_COMPLETE_REBUILD.md
Ready for validation by claude-gamesettings
```

---

## 🚨 TROUBLESHOOTING

### Issue: Type error on GamePricingTier

**Solution:**
```typescript
// Import from contracts, not manual definition
import type { GamePricingTier, GamePricingConfig } from '@escapeplan/contracts';
```

### Issue: HelpTooltip not found

**Solution:**
```svelte
<!-- Use correct relative import from component location -->
<!-- In pricing/ subfolder: -->
import HelpTooltip from '../../ui/HelpTooltip.svelte';

<!-- In tabs/ subfolder: -->
import HelpTooltip from '../../ui/HelpTooltip.svelte';
```

### Issue: $bindable errors in Svelte 5

**Solution:**
```svelte
<!-- Ensure Svelte 5 runes syntax -->
let {
  tier = $bindable()
} = $props();

<!-- NOT: -->
<!-- export let tier; ❌ (Svelte 4 syntax) -->
```

### Issue: Cents conversion wrong (shows $0.25 instead of $25)

**Solution:**
```typescript
// Input displays dollars, payload needs cents
let priceDollars = $derived((tier.priceCents ?? 0) / 100);  // cents → dollars

function updatePrice(dollars: number) {
  tier.priceCents = Math.round(dollars * 100);  // dollars → cents
}
```

### Issue: Payload doesn't match saveGameSchema

**Solution:**
```bash
# Check validation.ts pricingTierSchema for required fields
grep -A 30 "export const pricingTierSchema" packages/contracts/src/validation.ts

# Ensure buildPayload() includes ALL optional fields with undefined
```

---

## 🎯 SUCCESS CRITERIA

You are DONE when:

1. ✅ ALL 8 components created in correct folders
2. ✅ ALL 45+ validation checklist items pass
3. ✅ ALL 5 testing scenarios pass
4. ✅ `pnpm check` succeeds with 0 errors
5. ✅ GameModal opens and pricing tab works
6. ✅ 27+ HelpTooltips present
7. ✅ Session notes created with test results
8. ✅ Completion report posted

**Estimated Time:** 12-16 hours across 2 sessions
**Your Priority:** Component quality + comprehensive help tooltips
**When Stuck:** Re-read GAMEMODAL_UI_REFACTORING_PLAN.md or this file carefully

Good luck! Build beautiful, maintainable components with excellent UX. 🎨
