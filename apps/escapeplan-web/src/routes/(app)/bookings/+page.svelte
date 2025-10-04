<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { browser } from '$app/environment';
  import { formatDate, formatTime } from '$lib/utils/datetime';
  import { onDestroy, onMount } from 'svelte';
  import { initializeRealtime } from '$lib/realtime';
  import { bookingsStore } from '$lib/realtime/stores';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let { data }: { data: PageData } = $props();
  let bookings = $state(data.calendar?.bookings ?? []);
  let conflicts = $state(data.calendar?.conflicts ?? []);
  let isLoading = $state(true);

  onMount(() => {
    // Simulate data loading
    setTimeout(() => {
      isLoading = false;
    }, 500);

    initializeRealtime({
      bookings: data.calendar ? [data.calendar] : []
    });

    const key = `${data.date}|${data.scope}`;
    const unsub = bookingsStore.subscribe((map) => {
      const snapshot = map.get(key);
      if (snapshot) {
        bookings = snapshot.bookings;
        conflicts = snapshot.conflicts;
      }
    });

    onDestroy(unsub);
  });

  function printManifest() {
    if (browser) {
      window.print();
    }
  }
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Manage bookings, confirm deposits, and start sessions.
      </p>
    </div>
    <div class="badge-pill">
      <span class="inline-flex size-2 rounded-full bg-accent"></span>
      <span>Timezone · {data.calendar?.timezone ?? 'Local appliance'}</span>
    </div>
  </header>

  <div class="flex flex-wrap items-center justify-end gap-3">
    <button class="btn btn-sm btn-ghost border border-white/10" type="button" onclick={printManifest}>
      Print manifest
    </button>
  </div>

  <form
    method="GET"
    class="glass-panel border-white/10 bg-base-200/70 p-6"
  >
    <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <label class="form-control w-full sm:max-w-xs">
        <span class="label-text text-xs font-semibold uppercase tracking-[0.35em] text-base-content/50">Schedule date</span>
        <input class="input input-bordered input-primary/70 mt-2 bg-base-100/70" type="date" name="date" value={data.date} />
      </label>

      <div class="flex flex-col gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/50">Scope</span>
        <div class="flex gap-2">
          <button
            class={`btn btn-sm ${data.scope === 'all' ? 'btn-primary' : 'btn-ghost border border-white/10'}`}
            type="submit"
            name="scope"
            value="all"
          >
            All bookings
          </button>
          <button
            class={`btn btn-sm ${data.scope === 'storefront' ? 'btn-primary' : 'btn-ghost border border-white/10'}`}
            type="submit"
            name="scope"
            value="storefront"
          >
            Storefront
          </button>
          <button
            class={`btn btn-sm ${data.scope === 'mobile' ? 'btn-primary' : 'btn-ghost border border-white/10'}`}
            type="submit"
            name="scope"
            value="mobile"
          >
            Mobile
          </button>
        </div>
      </div>
    </div>
  </form>

  {#if isLoading}
    <div class="grid gap-6 lg:grid-cols-2">
      <SkeletonLoader type="card" count={1} class="h-96" />
      <SkeletonLoader type="table" rows={5} />
    </div>
  {:else if data.calendarError}
    <Alert type="error">
      <span>{data.calendarError}</span>
    </Alert>
  {:else if data.calendar}
    <section class="glass-panel border-white/10 bg-base-200/70 p-6">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-xl font-display text-base-content">{formatDate(data.calendar.date)} manifest</h2>
          <p class="text-sm text-base-content/60">{bookings.length} total bookings · scope {data.scope}</p>
        </div>
        {#if conflicts.length}
          <span class="badge badge-warning badge-lg">{conflicts.length} conflicts</span>
        {/if}
      </header>

      <div class="mt-6 space-y-6">
        {#if bookings.length === 0}
          <EmptyState
            title="No bookings"
            message="No bookings scheduled for this scope."
          />
        {:else}
          <div class="space-y-4">
            {#each bookings as booking}
              <article class={`relative overflow-hidden rounded-2xl border border-white/10 bg-base-100/60 p-5 shadow-lg shadow-black/20 ${booking.conflict ? 'ring-2 ring-warning/60' : ''}`}>
                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div class="space-y-1">
                    <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">{booking.roomName}</p>
                    <h3 class="text-xl font-display text-base-content">{booking.gameName}</h3>
                    <div class="flex items-center gap-2 text-xs text-base-content/60">
                      <span class="badge badge-outline">Party {booking.partySize}</span>
                      <span class="badge badge-ghost">Tier {booking.priceTier}</span>
                      {#if booking.discountCode}
                        <span class="badge badge-secondary badge-outline">Code {booking.discountCode}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-semibold text-primary">{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.3em] text-base-content/50">{booking.status}</p>
                  </div>
                </div>
                <div class="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div class="flex items-center gap-2 text-base-content/70">
                    <span class={`badge badge-sm ${booking.isMobile ? 'badge-info' : 'badge-neutral'}`}>
                      {booking.isMobile ? 'Mobile deployment' : 'Storefront'}
                    </span>
                    <span class="badge badge-outline badge-sm">Deposit ${booking.depositDue.toFixed(2)}</span>
                  </div>
                  <div class="text-base-content/70">
                    <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">Point of contact</p>
                    <p>{booking.contactName}</p>
                    <p class="text-xs text-base-content/50">{booking.contactPhone}</p>
                  </div>
                  <div class="text-base-content/70">
                    <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">Booking code</p>
                    <p class="font-semibold text-base-content/80">{booking.bookingCode}</p>
                  </div>
                </div>
                {#if booking.locationNote}
                  <div class="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary-content/80">
                    <span class="font-semibold uppercase tracking-[0.25em]">Logistics</span>
                    <p class="mt-2">{booking.locationNote}</p>
                  </div>
                {/if}
              </article>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    {#if conflicts.length}
      <section class="glass-panel border-warning/40 bg-warning/10 p-5">
        <h3 class="text-base font-semibold text-warning-content">Conflict log</h3>
        <ul class="mt-3 space-y-2 text-sm text-warning-content/80">
          {#each conflicts as conflict}
            <li class="flex gap-2">
              <span class="inline-flex size-1.5 rounded-full bg-warning"></span>
              <span>{conflict.reason}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</section>
