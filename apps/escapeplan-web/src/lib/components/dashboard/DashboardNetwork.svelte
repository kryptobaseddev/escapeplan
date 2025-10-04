<svelte:options runes={true} />

<script lang="ts">
  import { formatDate, formatTime } from '$lib/utils/datetime';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  interface Booking {
    id: string;
    startTime: string;
    gameName: string;
    notes: string | null;
    partySize: number;
    roomName: string;
    status: string;
    isAdhoc: boolean;
  }

  interface Props {
    bookings: Booking[];
    isLoading?: boolean;
  }

  let { bookings, isLoading = false }: Props = $props();
</script>

<section class="glass-panel border-white/10 bg-base-200/70 p-3 sm:p-6">
  <header class="flex items-center justify-between gap-2 sm:gap-4">
    <div>
      <h2 class="text-base sm:text-lg font-semibold text-base-content">Upcoming bookings</h2>
      <p class="text-xs sm:text-sm text-base-content/60">Chronological view of arrivals within the current prep window.</p>
    </div>
    <a class="btn btn-sm btn-ghost border border-white/10" href="/bookings">Full schedule</a>
  </header>
  {#if isLoading}
    <div class="mt-3 sm:mt-5">
      <SkeletonLoader type="table" rows={5} />
    </div>
  {:else if bookings.length === 0}
    <div class="mt-3 sm:mt-5">
      <EmptyState
        title="No upcoming bookings"
        message="No bookings scheduled for the next 4 hours."
      />
    </div>
  {:else}
  <div class="mt-3 sm:mt-5 overflow-hidden rounded-xl border border-white/10">
    <table class="table table-zebra table-sm">
      <thead class="bg-base-300/60 text-[10px] sm:text-xs uppercase tracking-[0.3em] text-base-content/40">
        <tr>
          <th class="text-left py-2 sm:py-3">Time</th>
          <th class="text-left py-2 sm:py-3">Game</th>
          <th class="text-left hidden sm:table-cell py-2 sm:py-3">Party</th>
          <th class="text-left py-2 sm:py-3">Room</th>
          <th class="text-left py-2 sm:py-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each bookings as booking}
          <tr class="text-[11px] sm:text-sm">
            <td class="whitespace-nowrap py-2 sm:py-3">{formatDate(booking.startTime)} · {formatTime(booking.startTime)}</td>
            <td class="py-2 sm:py-3">
              <div class="flex flex-col">
                <span class="font-medium text-base-content">{booking.gameName}</span>
                {#if booking.notes}
                  <span class="text-[10px] sm:text-[11px] text-base-content/50">{booking.notes}</span>
                {/if}
              </div>
            </td>
            <td class="hidden sm:table-cell py-2 sm:py-3">{booking.partySize} guests</td>
            <td class="py-2 sm:py-3">{booking.roomName}</td>
            <td class="flex items-center gap-1 sm:gap-2 py-2 sm:py-3">
              <span class={`badge badge-outline border-white/15 text-[10px] sm:text-[11px] ${booking.status === 'checked_in' ? 'text-success' : 'text-base-content/60'}`}>
                {booking.status}
              </span>
              {#if booking.isAdhoc}
                <span class="badge badge-secondary badge-xs">Ad-hoc</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</section>
