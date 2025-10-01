<svelte:options runes={true} />

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageData } from './$types';
  import { formatTimer } from '$lib/utils/datetime';
  import type { TimerBroadcast } from '$lib/api/types';
  import { apiFetch } from '$lib/api/client';
  import { getSocket } from '$lib/realtime/socket';
  import { timerBroadcasts, upsertTimerBroadcast } from '$lib/realtime/stores';

  const { data, params } = $props<{ data: PageData; params: { slug: string } }>();
  let timer = $state<TimerBroadcast | null>(data.timer);
  let errorMessage = $state<string | null>(data.timerError ?? null);
  let unsub: (() => void) | null = null;

  async function refreshTimer() {
    try {
      timer = await apiFetch<TimerBroadcast>(fetch, `/public/timer/${params.slug}`);
      upsertTimerBroadcast(timer);
      errorMessage = null;
    } catch (error) {
      console.error('Failed to refresh timer', error);
      errorMessage = 'Connection lost. Waiting to resync…';
    }
  }

  onMount(() => {
    const socket = getSocket();
    if (socket) {
      const handler = (broadcast: TimerBroadcast) => {
        if (broadcast.slug === params.slug) {
          timer = broadcast;
          errorMessage = null;
        }
      };
      socket.on('timer:update', handler);
      unsub = () => socket.off('timer:update', handler);
    }

    const storeUnsub = timerBroadcasts.subscribe((map) => {
      const broadcast = map.get(params.slug);
      if (broadcast) {
        timer = broadcast;
        errorMessage = null;
      }
    });
    unsub = unsub
      ? () => {
          unsub?.();
          storeUnsub();
        }
      : storeUnsub;

    // fallback polling if realtime unavailable
    if (!socket) {
      const interval = setInterval(refreshTimer, 5000);
      const prevUnsub = unsub;
      unsub = () => {
        if (interval) clearInterval(interval);
        prevUnsub?.();
      };
    }
  });

  onDestroy(() => {
    unsub?.();
  });
</script>

{#if errorMessage}
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-100 text-base-content">
    <h1 class="text-3xl font-display font-semibold">Timer unavailable</h1>
    <p class="text-sm text-base-content/60">{errorMessage}</p>
  </div>
{:else if timer}
  <section
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center"
    style={`background-image: url('${timer.background.url}'); background-size: cover; background-position: center;`}
  >
    <div class="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85"></div>
    <div class="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-primary/30 via-transparent to-secondary/30"></div>
    <div class="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 px-6">
      <div class="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/80 shadow-lg shadow-black/40">
        {timer.roomName}
      </div>
      <h1 class="text-5xl font-display font-semibold text-white drop-shadow-lg sm:text-6xl">{timer.gameName}</h1>
      <div class="rounded-[3rem] border border-white/20 bg-black/40 px-16 py-8 shadow-2xl shadow-black/50">
        <span class="text-7xl font-display font-bold text-primary drop-shadow">{formatTimer(timer.timer.remainingSeconds)}</span>
      </div>
      {#if timer.hintBanner}
        <div class="rounded-2xl border border-warning/60 bg-warning/90 px-8 py-4 text-black shadow-xl shadow-warning/30">
          <p class="text-xl font-semibold tracking-tight">{timer.hintBanner.message}</p>
        </div>
      {/if}
      {#if timer.narrative}
        <p class="max-w-2xl text-lg text-white/80">{timer.narrative}</p>
      {/if}
      <p class="text-xs uppercase tracking-[0.4em] text-white/40">EscapePlan · Offline timer broadcast</p>
    </div>
  </section>
{/if}
