<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { formatTimer } from '$lib/utils/datetime';
  import QuickStartModal from '$lib/components/sessions/QuickStartModal.svelte';
  import type { GameSessionDetails, GameDetails } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';
  import type { CommandResponse } from '$lib/api/types';
  import { initializeRealtime } from '$lib/realtime';
  import { sessionsStore } from '$lib/realtime/stores';

  let { data } = $props<{ data: PageData }>();

  let canManageSessions = $derived($page.data.user?.permissions?.includes('manage_sessions') ?? false);

  // Local state for this page - NOT using the global sessions store for filtered views
  let allSessions = $state<GameSessionDetails[]>(data.sessions ?? []);
  let generatedAt = $state(data.generatedAt ?? null);
  let games = $state<GameDetails[]>(data.games ?? []);
  let quickStartOpen = $state(false);
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let statusFilter = $state<string>('active');
  let searchQuery = $state<string>('');
  let sortBy = $state<'date' | 'game' | 'location'>('date');
  let sortOrder = $state<'asc' | 'desc'>('desc');

  // Client-side filtering and sorting
  const matchesStatus = (session: GameSessionDetails) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return session.status === 'running' || session.status === 'paused';
    return session.status === statusFilter;
  };

  const matchesSearch = (session: GameSessionDetails) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const haystack = [session.gameName, session.roomName, session.id].join(' ').toLowerCase();
    return haystack.includes(query);
  };

  const sessions = $derived(
    [...allSessions]
      .filter(matchesStatus)
      .filter(matchesSearch)
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
          comparison = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        } else if (sortBy === 'game') {
          comparison = a.gameName.localeCompare(b.gameName);
        } else if (sortBy === 'location') {
          comparison = a.roomName.localeCompare(b.roomName);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      })
  );

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
    if (!allSessions.some((existing: GameSessionDetails) => existing.id === session.id)) {
      allSessions = [session, ...allSessions];
    }
    goto(`/games/${session.id}`);
  };

  const buildTimerUrl = (session: GameSessionDetails) => {
    const slug = session.gameSlug ?? session.gameId;
    if (!slug) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(`/timer/${slug}`, origin);
    const roomIdentity = session.roomId;
    if (roomIdentity) {
      url.searchParams.set('room', roomIdentity);
    }
    return url.toString();
  };

  const copyTimerLink = async (session: GameSessionDetails) => {
    const url = buildTimerUrl(session);
    if (!url) {
      setToast('Timer link unavailable for this session.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Timer link copied to clipboard.');
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

  let copySuccessMap = $state<Record<string, boolean>>({});

  const copyTimerLinkWithFeedback = async (session: GameSessionDetails) => {
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

  function clearSearch() {
    searchQuery = '';
  }

  let unsubSessions: (() => void) | null = null;

  onMount(() => {
    // Initialize real-time WebSocket connection (but don't sync session store)
    initializeRealtime({});

    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (canManageSessions && games.length > 0) {
          quickStartOpen = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);

    // Subscribe to real-time session updates and merge with local list
    unsubSessions = sessionsStore.subscribe((storeSessions) => {
      // Update allSessions with real-time data
      allSessions = allSessions.map(session => {
        const updated = storeSessions.find(s => s.id === session.id);
        return updated || session;
      });
      // Also add any new sessions from the store that aren't in our list
      storeSessions.forEach(storeSession => {
        if (!allSessions.find(s => s.id === storeSession.id)) {
          allSessions = [...allSessions, storeSession];
        }
      });
    });

    onDestroy(() => {
      unsubSessions?.();
      window.removeEventListener('keydown', handleKeydown);
    });
  });

  // Sync local state when page data changes
  $effect(() => {
    allSessions = data.sessions ?? [];
    generatedAt = data.generatedAt ?? null;
    // Only update games if we received data (don't clear on navigation)
    if (data.games !== undefined && data.games !== null) {
      games = data.games;
    }
  });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="section-heading">Game runner</h1>
        <p class="mt-2 max-w-2xl text-sm text-base-content/60">
          Launch into rooms to manage timers, deliver hints, and monitor puzzle flow.
        </p>
      </div>
      {#if canManageSessions && games.length > 0}
        <button class="btn btn-secondary w-full lg:w-auto" onclick={() => (quickStartOpen = true)}>
          + Quick start session
        </button>
      {/if}
    </div>

    <div class="glass-panel border-white/10 bg-base-200/70 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
          <div class="form-control flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by game, room, or booking..."
              class="input input-bordered w-full bg-base-100/60 text-sm"
              bind:value={searchQuery}
            />
          </div>

          <select class="select select-bordered bg-base-100/60 text-sm max-w-xs" bind:value={statusFilter}>
            <option value="all">All Sessions</option>
            <option value="active">Active Only</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <select class="select select-bordered select-sm bg-base-100/60 text-xs" bind:value={sortBy}>
            <option value="date">Sort by Date</option>
            <option value="game">Sort by Game</option>
            <option value="location">Sort by Location</option>
          </select>
          <button
            class="btn btn-sm btn-ghost border border-white/10"
            onclick={() => { sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; }}
            aria-label="Toggle sort order"
          >
            {#if sortOrder === 'desc'}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </header>

  {#if data.sessionsError}
    <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
      <span>{data.sessionsError}</span>
    </div>
  {:else}
    {#if toast}
      <div
        class={`alert ${toast.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'}`}
      >
        <span>{toast.message}</span>
      </div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-2">
      {#if sessions.length === 0}
        <div class="col-span-full rounded-2xl border border-dashed border-base-content/20 bg-base-200/60 px-6 py-10 text-center text-sm text-base-content/60">
          No active sessions. Once a booking checks in, the room will surface here for quick launch.
        </div>
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
                  <a class="btn btn-sm btn-primary" href={`/games/${session.id}`} data-sveltekit-reload>
                    Open runner
                  </a>
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
                    onclick={() => copyTimerLinkWithFeedback(session)}
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
  {/if}
</section>

<QuickStartModal
  open={quickStartOpen}
  games={games}
  activeSessions={sessions}
  onclose={() => (quickStartOpen = false)}
  onsuccess={handleQuickStartSuccess}
/>
