<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { formatDate, formatTime, formatTimer } from '$lib/utils/datetime';
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { initializeRealtime } from '$lib/realtime';
  import { bookingsStore, dashboardStore, sessionsStore } from '$lib/realtime/stores';
  import QuickStartModal from '$lib/components/sessions/QuickStartModal.svelte';
  import type { GameSessionDetails, GameDetails } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';
  import type { CommandResponse } from '$lib/api/types';

  let { data } = $props<{ data: PageData }>();

  let dashboard = $state(data.dashboard ?? null);
  let sessions = $state<GameSessionDetails[]>(data.dashboard?.activeSessions ?? []);
  let bookings = $state(data.dashboard?.upcomingBookings ?? []);
  let games = $state(data.games ?? []);
  let quickStartOpen = $state(false);
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  let canManageSessions = $derived($page.data.user?.permissions?.includes('manage_sessions') ?? false);
  let canViewNetwork = $derived($page.data.user?.permissions?.includes('view_network') ?? false);
  let networkLink = $derived(canViewNetwork ? (dashboard?.network.detailsUrl ?? '/admin/network') : null);

  const setToast = (message: string, type: 'success' | 'error' = 'success') => {
    toast = { message, type };
    setTimeout(() => {
      if (toast?.message === message) {
        toast = null;
      }
    }, 4000);
  };

  const handleQuickStartSuccess = (session: GameSessionDetails) => {
    quickStartOpen = false;
    setToast('Session started successfully.');
    if (!sessions.some((existing: GameSessionDetails) => existing.id === session.id)) {
      sessions = [session, ...sessions];
    }
    goto(`/games/${session.id}`);
  };

  const buildTimerUrl = (session: GameSessionDetails) => {
    const slug = session.gameSlug ?? session.gameId;
    if (!slug) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(`/timer/${slug}`, origin);
    const roomIdentity = session.roomUuid ?? session.roomId;
    if (roomIdentity) {
      url.searchParams.set('room', roomIdentity);
    }
    return url.toString();
  };

  let copySuccessMap = $state<Record<string, boolean>>({});

  const copyTimerLink = async (session: GameSessionDetails) => {
    const url = buildTimerUrl(session);
    if (!url) {
      setToast('Timer link unavailable for this session.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      copySuccessMap[session.id] = true;
      setTimeout(() => {
        copySuccessMap[session.id] = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy timer link', error);
      setToast('Unable to copy timer link.', 'error');
    }
  };

  const openTimerLink = (session: GameSessionDetails) => {
    const url = buildTimerUrl(session);
    if (!url) {
      setToast('Timer link unavailable for this session.', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  async function dispatchTimerCommand(sessionId: string, command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer') {
    try {
      await apiFetch<CommandResponse>(fetch, `/sessions/${sessionId}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command, payload: {} })
      });
    } catch (error) {
      console.error('Timer command failed', error);
      setToast('Failed to update timer.', 'error');
    }
  }

  onMount(() => {
    initializeRealtime({
      dashboard,
      sessions,
      bookings: []
    });

    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (canManageSessions && games.length) {
          quickStartOpen = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);

    const unsubDashboard = dashboardStore.subscribe((value) => {
      if (value) {
        dashboard = value;
        bookings = value.upcomingBookings;
      }
    });

    const unsubSessions = sessionsStore.subscribe((value) => {
      sessions = [...value]; // Create new array reference to trigger reactivity
    });

    const todayKey = `${new Date().toISOString().slice(0, 10)}|all`;
    const unsubBookings = bookingsStore.subscribe((map) => {
      const snapshot = map.get(todayKey);
      if (snapshot) {
        bookings = snapshot.bookings;
      }
    });

    onDestroy(() => {
      unsubDashboard();
      unsubSessions();
      unsubBookings();
      window.removeEventListener('keydown', handleKeydown);
    });
  });

  $effect(() => {
    games = data.games ?? [];
  });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="section-heading">Control Room</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Real-time status for rooms, and view alerts and bookings
      </p>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      {#if dashboard}
        <div class="badge-pill">
          <span class="inline-flex size-2 rounded-full {dashboard.network.status === 'online' ? 'bg-success' : dashboard.network.status === 'degraded' ? 'bg-warning' : 'bg-error'}"></span>
          <span>Network {dashboard.network.status} · refreshed {formatTime(dashboard.generatedAt)}</span>
        </div>
      {/if}
      {#if canManageSessions && games.length}
        <button class="btn btn-secondary w-full sm:w-auto" onclick={() => (quickStartOpen = true)}>
          + Quick start session
        </button>
      {/if}
    </div>
  </header>

  {#if data.dashboardError}
    <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
      <span>{data.dashboardError}</span>
    </div>
  {:else if dashboard}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="metric-card">
        <div class="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-base-content/50">
          <span>Network</span>
          <span>{formatTime(dashboard.network.lastChecked)}</span>
        </div>
        <div class="mt-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-base-content">{dashboard.network.ssid ?? 'escapeplan_net'}</p>
            <p class="mt-1 text-xs text-base-content/60">{dashboard.network.message}</p>
          </div>
          <span
            class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${dashboard.network.status === 'online' ? 'bg-success/15 text-success' : dashboard.network.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
          >
            <span class="inline-flex size-2 rounded-full bg-current"></span>
            {dashboard.network.status}
          </span>
        </div>
        {#if networkLink}
          <a class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary" href={networkLink}>
            Review network panel
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current">
              <path d="M5 12h12.586l-3.293-3.293 1.414-1.414L21.414 12l-5.707 5.707-1.414-1.414L17.586 13H5z" />
            </svg>
          </a>
        {/if}
      </article>

      <article class="metric-card">
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/50">Active Sessions</p>
        <p class="mt-3 text-4xl font-display text-primary">{sessions.length.toString().padStart(2, '0')}</p>
        <p class="mt-2 text-sm text-base-content/60">Live rooms on deck</p>
      </article>

      <article class="metric-card">
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/50">Upcoming bookings</p>
        <p class="mt-3 text-4xl font-display text-secondary">{bookings.length.toString().padStart(2, '0')}</p>
        <p class="mt-2 text-sm text-base-content/60">In the next four hours</p>
      </article>

      <article class="metric-card">
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/50">Alerts</p>
        <p class="mt-3 text-4xl font-display text-accent">{dashboard.alerts.length.toString().padStart(2, '0')}</p>
        <p class="mt-2 text-sm text-base-content/60">Action items awaiting review</p>
      </article>
    </div>

    {#if dashboard.alerts.length}
      <div class="glass-panel border-white/10 bg-secondary/10 p-5">
        <header class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.35em] text-secondary">Alerts</p>
            <h2 class="mt-1 text-lg font-semibold text-base-content">Immediate attention required</h2>
          </div>
          <span class="badge badge-secondary badge-lg">{dashboard.alerts.length}</span>
        </header>
        <ul class="mt-4 space-y-2 text-sm text-secondary-content/90">
          {#each dashboard.alerts as alert}
            <li class="flex items-baseline gap-2 rounded-lg border border-secondary/20 bg-secondary/10 px-3 py-2">
              <span class="inline-flex size-1.5 rounded-full bg-secondary"></span>
              <span>{alert.message}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if toast}
      <div
        class={`alert ${toast.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'} mt-4`}
      >
        <span>{toast.message}</span>
      </div>
    {/if}

    <div class="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <section class="glass-panel border-white/10 bg-base-200/70 p-6">
        <header class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-base-content">Live rooms</h2>
            <p class="text-sm text-base-content/60">Direct feed from the EscapePlan session broker.</p>
          </div>
          <a class="btn btn-sm btn-secondary/70 border border-secondary/40" href="/games">Manage sessions</a>
        </header>
        <div class="mt-5 space-y-4">
          {#if sessions.length === 0}
            <p class="rounded-xl border border-dashed border-base-content/20 bg-base-100/50 px-4 py-6 text-center text-sm text-base-content/60">
              No active sessions — the control room is standing by.
            </p>
          {:else}
            {#each sessions as session}
              <article class="rounded-xl border border-white/10 bg-base-100/60 p-5">
                <div class="flex flex-col gap-3">
                  <!-- Top row: Game name, action buttons, timer -->
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 class="flex items-center gap-2 text-xl font-display text-base-content">
                        {session.gameName}
                        {#if session.isAdhoc}
                          <span class="badge badge-outline border-primary/40 text-[11px] text-primary">Ad-hoc</span>
                        {/if}
                      </h3>
                      <p class="mt-1 text-xs text-base-content/60">{session.players} players</p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <a class="btn btn-sm btn-primary" href={`/games/${session.id}`}>Open runner</a>
                      <a class="btn btn-sm btn-ghost border border-white/10" href={`/bookings?focus=${session.id}`}>View booking</a>
                    </div>

                    <div class="text-right">
                      <p class={`text-3xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
                        {formatTimer(session.timer.remainingSeconds)}
                      </p>
                      <p class="mt-1 text-xs uppercase tracking-[0.3em] text-base-content/50">{session.timer.status}</p>
                      <p class="text-xs text-base-content/40">
                        Total: {formatTimer(session.timer.totalElapsedSeconds)}
                      </p>
                    </div>
                  </div>

                  <!-- Bottom row: Session details, timer controls + room display -->
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <dl class="space-y-1 text-sm">
                      <div class="flex items-center gap-2 text-base-content/70">
                        <dt class="font-medium">Started:</dt>
                        <dd>{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
                      </div>
                      <div class="flex items-center gap-2 text-base-content/70">
                        <dt class="font-medium">Scheduled end:</dt>
                        <dd>{new Date(session.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
                      </div>
                      <div class="flex items-center gap-2 text-base-content/70">
                        <dt class="font-medium">Hints used:</dt>
                        <dd>{session.hintsUsed}</dd>
                      </div>
                    </dl>

                    <div class="flex flex-col items-end gap-2">

                    <div class="flex items-center gap-1">
                      {#if session.timer.status === 'idle'}
                        <button
                          type="button"
                          class="btn btn-sm btn-circle btn-primary"
                          onclick={() => dispatchTimerCommand(session.id, 'start_timer')}
                          aria-label="Start timer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      {:else if session.timer.status === 'running'}
                        <button
                          type="button"
                          class="btn btn-sm btn-circle btn-warning"
                          onclick={() => dispatchTimerCommand(session.id, 'pause_timer')}
                          aria-label="Pause timer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      {:else if session.timer.status === 'paused'}
                        <button
                          type="button"
                          class="btn btn-sm btn-circle btn-success"
                          onclick={() => dispatchTimerCommand(session.id, 'resume_timer')}
                          aria-label="Resume timer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="btn btn-sm btn-circle btn-ghost border border-white/10"
                        onclick={() => dispatchTimerCommand(session.id, 'reset_timer')}
                        aria-label="Reset timer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>

                    <div class="flex items-center gap-1">
                      <span class="mr-1 text-xs text-base-content/40">Room Display:</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-ghost border border-white/10"
                        onclick={() => copyTimerLink(session)}
                        aria-label="Copy URL to clipboard"
                      >
                        {#if copySuccessMap[session.id]}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                          </svg>
                        {:else}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        {/if}
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-ghost border border-white/10"
                        onclick={() => openTimerLink(session)}
                        aria-label="Open in new tab"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              </article>
            {/each}
          {/if}
        </div>
      </section>

      <section class="glass-panel border-white/10 bg-base-200/70 p-6">
        <header class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-base-content">Upcoming bookings</h2>
            <p class="text-sm text-base-content/60">Chronological view of arrivals within the current prep window.</p>
          </div>
          <a class="btn btn-sm btn-ghost border border-white/10" href="/bookings">Full schedule</a>
        </header>
        <div class="mt-5 overflow-hidden rounded-xl border border-white/10">
          <table class="table table-zebra table-sm">
            <thead class="bg-base-300/60 text-xs uppercase tracking-[0.3em] text-base-content/40">
              <tr>
                <th class="text-left">Time</th>
                <th class="text-left">Game</th>
                <th class="text-left hidden sm:table-cell">Party</th>
                <th class="text-left">Room</th>
                <th class="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each bookings as booking}
                <tr class="text-xs sm:text-sm">
                  <td class="whitespace-nowrap">{formatDate(booking.startTime)} · {formatTime(booking.startTime)}</td>
                  <td>
                    <div class="flex flex-col">
                      <span class="font-medium text-base-content">{booking.gameName}</span>
                      {#if booking.notes}
                        <span class="text-[11px] text-base-content/50">{booking.notes}</span>
                      {/if}
                    </div>
                  </td>
                  <td class="hidden sm:table-cell">{booking.partySize} guests</td>
                  <td>{booking.roomName}</td>
                  <td class="flex items-center gap-2">
                    <span class={`badge badge-outline border-white/15 text-[11px] ${booking.status === 'checked_in' ? 'text-success' : 'text-base-content/60'}`}>
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
      </section>
    </div>
  {/if}
</section>

<QuickStartModal
  open={quickStartOpen}
  games={games}
  activeSessions={sessions}
  onclose={() => (quickStartOpen = false)}
  onsuccess={handleQuickStartSuccess}
/>
