<script lang="ts">
  import type { GamePricingConfig, GameBookingRules } from '@escapeplan/contracts';

  let {
    pricing = $bindable(),
    bookingRules = $bindable(),
    isMobile,
    onPricingChange,
    onBookingRulesChange
  }: {
    pricing: GamePricingConfig;
    bookingRules: GameBookingRules;
    isMobile: boolean;
    onPricingChange: (pricing: GamePricingConfig) => void;
    onBookingRulesChange: (rules: GameBookingRules) => void;
  } = $props();

  // Helper function to generate unique IDs
  function uid(prefix: string) {
    const uuid = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return `${prefix}-${uuid}`;
  }

  // Pricing handlers
  function addPricingTier() {
    if (!pricing) return;
    const newTiers = [
      ...pricing.tiers,
      {
        id: uid('tier'),
        label: `Tier ${pricing.tiers.length + 1}`,
        model: 'per_person' as const,
        priceCents: 0,
        displayOrder: pricing.tiers.length + 1,
        active: true
      }
    ];
    onPricingChange({ ...pricing, tiers: newTiers, discounts: pricing.discounts || [] });
  }

  function removePricingTier(tierId: string) {
    if (!pricing) return;
    const newTiers = pricing.tiers.filter(tier => tier.id !== tierId);
    onPricingChange({ ...pricing, tiers: newTiers, discounts: pricing.discounts || [] });
  }

  function addDiscount() {
    if (!pricing) return;
    const newDiscounts = [
      ...(pricing.discounts || []),
      {
        code: `DISC-${(pricing.discounts || []).length + 1}`,
        percentOff: 10,
        amountOffCents: null,
        expiresAt: null,
        notes: null
      }
    ];
    onPricingChange({ ...pricing, discounts: newDiscounts });
  }

  function removeDiscount(index: number) {
    if (!pricing) return;
    const newDiscounts = (pricing.discounts || []).filter((_, idx) => idx !== index);
    onPricingChange({ ...pricing, discounts: newDiscounts });
  }

  // Booking handlers
  function addEquipmentItem() {
    if (!bookingRules) return;
    const newChecklist = [
      ...(bookingRules.equipmentChecklist || []),
      `Item ${(bookingRules.equipmentChecklist?.length || 0) + 1}`
    ];
    onBookingRulesChange({ ...bookingRules, equipmentChecklist: newChecklist });
  }

  function removeEquipmentItem(index: number) {
    if (!bookingRules) return;
    const newChecklist = (bookingRules.equipmentChecklist || []).filter((_, idx) => idx !== index);
    onBookingRulesChange({ ...bookingRules, equipmentChecklist: newChecklist });
  }

  function addCustomField() {
    if (!bookingRules) return;
    const newFields = [
      ...(bookingRules.customFields || []),
      { label: 'Custom field', required: false }
    ];
    onBookingRulesChange({ ...bookingRules, customFields: newFields });
  }

  function removeCustomField(index: number) {
    if (!bookingRules) return;
    const newFields = (bookingRules.customFields || []).filter((_, idx) => idx !== index);
    onBookingRulesChange({ ...bookingRules, customFields: newFields });
  }
</script>

<div class="space-y-4">
  <!-- PRICING SECTION -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-base-content">Pricing Configuration</h3>

    <!-- Pricing Model & Deposit -->
    <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
      <legend class="fieldset-legend">Deposit Settings</legend>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Deposit required</span>
          <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-base-100/70 px-3 py-2">
            <input
              type="checkbox"
              class="toggle toggle-secondary"
              checked={Boolean(pricing?.deposit?.required)}
              onchange={(event) => {
                if (!pricing) return;
                const checked = (event.currentTarget as HTMLInputElement).checked;
                onPricingChange({
                  ...pricing,
                  discounts: pricing.discounts || [],
                  deposit: checked
                    ? {
                        required: true,
                        type: pricing.deposit?.type ?? 'flat',
                        amountCents: pricing.deposit?.amountCents ?? 0
                      }
                    : { required: false }
                });
              }}
            />
            <span class="text-sm text-base-content/70">Collect deposit during booking</span>
          </div>
        </label>
      </div>

      {#if pricing?.deposit?.required}
        <div class="grid gap-4 md:grid-cols-2 mt-4">
          <label class="form-control">
            <span class="label-text">Deposit type</span>
            <select
              class="select select-bordered"
              value={pricing.deposit?.type ?? 'flat'}
              onchange={(event) => {
                if (!pricing) return;
                const value = (event.currentTarget as HTMLSelectElement).value as 'flat' | 'percent';
                onPricingChange({
                  ...pricing,
                  discounts: pricing.discounts || [],
                  deposit: {
                    ...(pricing.deposit ?? { required: true }),
                    required: true,
                    type: value,
                    amountCents: pricing.deposit?.amountCents ?? 0
                  }
                });
              }}
            >
              <option value="flat">Flat</option>
              <option value="percent">Percent</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text">Deposit amount {pricing.deposit?.type === 'percent' ? '(%)' : '($)'}</span>
            <label class="input validator flex items-center gap-2">
              <span class="label">{pricing.deposit?.type === 'percent' ? '%' : '$'}</span>
              <input
                type="number"
                class="grow"
                min="0"
                step="0.01"
                value={pricing.deposit?.amountCents ?? 0}
                oninput={(event) => {
                  if (!pricing) return;
                  const amount = Number((event.currentTarget as HTMLInputElement).value) || 0;
                  onPricingChange({
                    ...pricing,
                    discounts: pricing.discounts || [],
                    deposit: {
                      ...(pricing.deposit ?? { required: true, type: 'flat' }),
                      required: true,
                      amountCents: amount
                    }
                  });
                }}
                required
              />
            </label>
            <div class="validator-hint">Enter deposit amount</div>
          </label>
        </div>
      {/if}
    </fieldset>

    <!-- Pricing Tiers -->
    <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
      <header class="mb-3 flex items-center justify-between gap-3">
        <h4 class="text-sm font-semibold text-base-content">Pricing tiers</h4>
        <button
          type="button"
          class="btn btn-xs btn-secondary"
          onclick={addPricingTier}
        >
          + Add tier
        </button>
      </header>

      {#if !pricing || pricing.tiers.length === 0}
        <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">No pricing tiers configured.</p>
      {/if}

      <div class="space-y-3">
        {#each pricing?.tiers || [] as tier (tier.id)}
          <fieldset class="fieldset rounded-lg border border-white/10 bg-base-200/80 p-3">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <label class="form-control flex-1">
                <span class="label-text">Label</span>
                <input
                  class="input input-bordered input-sm"
                  bind:value={tier.label}
                  oninput={() => onPricingChange(pricing)}
                />
              </label>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error"
                onclick={() => removePricingTier(tier.id)}
              >
                Remove
              </button>
            </div>

            <div class="mt-2 grid gap-2 md:grid-cols-3">
              <label class="form-control">
                <span class="label-text">Price ($)</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <span class="label">$</span>
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    step="0.01"
                    bind:value={tier.priceCents}
                    oninput={() => onPricingChange(pricing)}
                    required
                  />
                </label>
                <div class="validator-hint">Base price</div>
              </label>
              <label class="form-control">
                <span class="label-text">Min players</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <input
                    type="number"
                    class="grow"
                    min="1"
                    bind:value={tier.minPlayers}
                    oninput={() => onPricingChange(pricing)}
                  />
                </label>
              </label>
              <label class="form-control">
                <span class="label-text">Max players</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <input
                    type="number"
                    class="grow"
                    min="1"
                    bind:value={tier.maxPlayers}
                    oninput={() => onPricingChange(pricing)}
                  />
                </label>
              </label>
            </div>
          </fieldset>
        {/each}
      </div>
    </section>

    <!-- Discount Codes -->
    <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
      <header class="mb-3 flex items-center justify-between gap-3">
        <h4 class="text-sm font-semibold text-base-content">Discount codes</h4>
        <button
          type="button"
          class="btn btn-xs btn-secondary"
          onclick={addDiscount}
        >
          + Add discount
        </button>
      </header>

      {#if !pricing || (pricing.discounts || []).length === 0}
        <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">No discounts configured.</p>
      {/if}

      <div class="space-y-3">
        {#each pricing?.discounts || [] as discount, index (discount.code + index)}
          <div class="rounded-lg border border-white/10 bg-base-200/80 p-3">
            <div class="grid gap-2 md:grid-cols-4">
              <label class="form-control">
                <span class="label-text">Code</span>
                <input
                  class="input input-bordered input-sm uppercase"
                  bind:value={discount.code}
                  oninput={() => onPricingChange(pricing)}
                />
              </label>
              <label class="form-control">
                <span class="label-text">Percent off</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <span class="label">%</span>
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    max="100"
                    bind:value={discount.percentOff}
                    oninput={() => onPricingChange(pricing)}
                  />
                </label>
              </label>
              <label class="form-control">
                <span class="label-text">Amount off ($)</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <span class="label">$</span>
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    step="0.01"
                    bind:value={discount.amountOffCents}
                    oninput={() => onPricingChange(pricing)}
                  />
                </label>
              </label>
              <label class="form-control">
                <span class="label-text">Expires at</span>
                <input
                  class="input input-bordered input-sm"
                  type="datetime-local"
                  bind:value={discount.expiresAt}
                  oninput={() => onPricingChange(pricing)}
                />
              </label>
            </div>
            <label class="form-control mt-2">
              <span class="label-text">Notes</span>
              <textarea
                class="textarea textarea-bordered textarea-sm"
                rows={2}
                bind:value={discount.notes}
                oninput={() => onPricingChange(pricing)}
              ></textarea>
            </label>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-error mt-2"
              onclick={() => removeDiscount(index)}
            >
              Remove
            </button>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <!-- BOOKING RULES SECTION -->
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-base-content">Booking Rules</h3>

    {#if bookingRules}
      <!-- Mobile Toggle -->
      <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-base-100/70 px-4 py-3">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          bind:checked={bookingRules.isMobile}
          onchange={() => onBookingRulesChange(bookingRules)}
        />
        <span class="text-sm text-base-content/70">Game is available for mobile deployments</span>
      </div>

      <!-- Mobile-only fields: Location Notes and Travel Buffer -->
      {#if isMobile}
        <label class="form-control">
          <span class="label-text">Location notes template</span>
          <textarea
            class="textarea textarea-bordered"
            rows={3}
            bind:value={bookingRules.locationNotes}
            oninput={() => onBookingRulesChange(bookingRules)}
            placeholder="Enter template for mobile game location instructions..."
          ></textarea>
        </label>

        <label class="form-control">
          <span class="label-text">Travel buffer (minutes)</span>
          <label class="input validator flex items-center gap-2">
            <input
              type="number"
              class="grow"
              min="0"
              max="600"
              bind:value={bookingRules.travelBufferMinutes}
              oninput={() => onBookingRulesChange(bookingRules)}
            />
          </label>
          <div class="validator-hint">Buffer time for travel/setup</div>
        </label>
      {/if}

      <!-- Reservation Style -->
      <label class="form-control">
        <span class="label-text">Reservation style</span>
        <select
          class="select select-bordered"
          bind:value={bookingRules.reservationStyle}
          onchange={() => onBookingRulesChange(bookingRules)}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <!-- Cancellation Policy -->
      <label class="form-control">
        <span class="label-text">Cancellation policy</span>
        <textarea
          class="textarea textarea-bordered"
          rows={3}
          bind:value={bookingRules.cancellationPolicy}
          oninput={() => onBookingRulesChange(bookingRules)}
        ></textarea>
      </label>
    {/if}

    <!-- Equipment Checklist -->
    {#if bookingRules}
      <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
        <header class="mb-3 flex items-center justify-between gap-3">
          <h4 class="text-sm font-semibold text-base-content">Equipment checklist</h4>
          <button
            type="button"
            class="btn btn-xs btn-secondary"
            onclick={addEquipmentItem}
          >
            + Add item
          </button>
        </header>
        <div class="space-y-2">
          {#each bookingRules.equipmentChecklist || [] as item, index (item + index)}
          <div class="flex items-center gap-3">
            <input
              class="input input-bordered input-sm flex-1"
              bind:value={bookingRules.equipmentChecklist[index]}
              oninput={() => onBookingRulesChange(bookingRules)}
              placeholder="Equipment name"
            />
            <button
              type="button"
              class="btn btn-xs btn-ghost text-error"
              onclick={() => removeEquipmentItem(index)}
            >
              Remove
            </button>
          </div>
          {/each}
        </div>
      </section>

      <!-- Custom Booking Fields -->
      <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
        <header class="mb-3 flex items-center justify-between gap-3">
          <h4 class="text-sm font-semibold text-base-content">Custom booking fields</h4>
          <button
            type="button"
            class="btn btn-xs btn-secondary"
            onclick={addCustomField}
          >
            + Add field
          </button>
        </header>
        <div class="space-y-3">
          {#each bookingRules.customFields || [] as field, index (`${field.label}-${index}`)}
          <div class="rounded-lg border border-white/10 bg-base-200/80 p-3">
            <label class="form-control">
              <span class="label-text">Label</span>
              <input
                class="input input-bordered input-sm"
                bind:value={field.label}
                oninput={() => onBookingRulesChange(bookingRules)}
              />
            </label>
            <div class="mt-2 flex items-center gap-3">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                bind:checked={field.required}
                onchange={() => onBookingRulesChange(bookingRules)}
              />
              <span class="text-xs text-base-content/60">Required</span>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error ml-auto"
                onclick={() => removeCustomField(index)}
              >
                Remove
              </button>
            </div>
          </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>
