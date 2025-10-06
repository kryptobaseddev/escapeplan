<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { formatTime } from '$lib/utils/datetime';
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { initializeRealtime } from '$lib/realtime';
  import { bookingsStore, dashboardStore, sessionsStore } from '$lib/realtime/stores';
  import QuickStartModal from '$lib/components/sessions/QuickStartModal.svelte';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import DashboardStats from '$lib/components/dashboard/DashboardStats.svelte';
  import DashboardNetwork from '$lib/components/dashboard/DashboardNetwork.svelte';
  import DashboardSessions from '$lib/components/dashboard/DashboardSessions.svelte';
  import type {
    GameSessionDetails,
    Alert as AlertType,
    ActiveSessionSummary,
    BookingSummary
  } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';
  import type { CommandResponse } from '$lib/api/types';
  import Alert from '$lib/components/ui/Alert.svelte';

  let { data }: { data: PageData } = $props();

  const isSessionDetails = (
    session: ActiveSessionSummary | GameSessionDetails
  ): session is GameSessionDetails => 'hintLog' in session && Array.isArray(session.hintLog);

  const ensureSessionDetails = (session: ActiveSessionSummary | GameSessionDetails): GameSessionDetails => {
    if (isSessionDetails(session)) {
      return session;
    }

    return {
      ...session,
      puzzles: [],
      hintLog: [],
      crew: {
        primary: session.roomName,
        support: null
      },
      milestones: [],
      gameSlug:
        'gameSlug' in session && typeof session.gameSlug === 'string' && session.gameSlug
          ? session.gameSlug
          : session.gameId,
      currentRoomDisplayMedia: null
    };
  };

  const normalizeSessions = (list: Array<ActiveSessionSummary | GameSessionDetails>): GameSessionDetails[] =>
    list.map(ensureSessionDetails);

  let isLoading = $state(true);
  let dashboard = $state(data.dashboard ?? null);
  let sessions = $state<GameSessionDetails[]>(normalizeSessions(data.dashboard?.activeSessions ?? []));
  let bookings = $state<BookingSummary[]>(data.dashboard?.upcomingBookings ?? []);
  let games = $state(data.games ?? []);
  let quickStartOpen = $state(false);
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let alertsModalOpen = $state(false);

  let canManageSessions = $derived($page.data.user?.permissions?.includes('manage_sessions') ?? false);
  let canViewNetwork = $derived($page.data.user?.permissions?.includes('view_network') ?? false);
  let networkLink = $derived(canViewNetwork ? (dashboard?.network.detailsUrl ?? '/admin/network') : null);

  // Derived stats for DashboardStats component
  let statsData = $derived({
    network: {
      ssid: dashboard?.network.ssid ?? null,
      password: dashboard?.network.password ?? null,
      status: dashboard?.network.status ?? 'offline',
      broadcastEnabled: dashboard?.network.broadcastEnabled ?? false
    },
    sessionCount: sessions.length,
    upcomingCount: bookings.length,
    alerts: dashboard?.alerts ?? []
  });

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
    const normalized = ensureSessionDetails(session);
    if (!sessions.some((existing) => existing.id === normalized.id)) {
      sessions = [normalized, ...sessions];
    }
    goto(`/games/${normalized.id}`);
  };

  const buildTimerUrl = (session: GameSessionDetails) => {
    const slug = session.gameSlug ?? session.gameId;
    if (!slug) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(`/room/${slug}`, origin);
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
  };

  const dismissAlert = async (alertId: string) => {
    try {
      await apiFetch(fetch, `/api/admin/alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      // Update local state immediately for better UX
      if (dashboard) {
        dashboard.alerts = dashboard.alerts.filter((a: AlertType) => a.id !== alertId);
      }
      setToast('Alert dismissed');
    } catch (error) {
      console.error('Failed to dismiss alert', error);
      setToast('Failed to dismiss alert', 'error');
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

  async function dispatchTimerCommand(sessionId: string, command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'stop_session') {
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
    // Simulate loading delay
    const loadingTimer = setTimeout(() => {
      isLoading = false;
    }, 500);

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
      sessions = normalizeSessions(value as Array<ActiveSessionSummary | GameSessionDetails>);
    });

    const todayKey = `${new Date().toISOString().slice(0, 10)}|all`;
    const unsubBookings = bookingsStore.subscribe((map) => {
      const snapshot = map.get(todayKey);
      if (snapshot) {
        bookings = snapshot.bookings;
      }
    });

    onDestroy(() => {
      clearTimeout(loadingTimer);
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
      {#if canManageSessions && games.length}
        <button class="btn btn-secondary w-full sm:w-auto" onclick={() => (quickStartOpen = true)}>
          + Quick start session
        </button>
      {/if}
    </div>
  </header>

  {#if data.dashboardError}
    <Alert type="error">
      <span>{data.dashboardError}</span>
    </Alert>
  {:else if dashboard}
    <!-- Stats Cards Section -->
    {#if isLoading}
      <SkeletonLoader type="card" count={4} class="grid gap-3 md:grid-cols-2 xl:grid-cols-4" />
    {:else}
      <DashboardStats stats={statsData} onAlertsClick={() => alertsModalOpen = true} />
    {/if}

    {#if toast}
      <div
        class={`alert ${toast.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'} mt-4`}
      >
        <span>{toast.message}</span>
      </div>
    {/if}

    <div class="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <DashboardSessions
        {sessions}
        {isLoading}
        onTimerCommand={dispatchTimerCommand}
        onCopyTimerLink={copyTimerLink}
        onOpenTimerLink={openTimerLink}
      />

      <DashboardNetwork {bookings} {isLoading} />
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

{#if alertsModalOpen && dashboard}
  <dialog class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-base-content">Active Alerts</h3>
          <p class="mt-1 text-sm text-base-content/60">{dashboard.alerts.length} {dashboard.alerts.length === 1 ? 'alert' : 'alerts'} requiring attention</p>
        </div>
        <button type="button" class="btn btn-sm btn-circle btn-ghost" onclick={() => (alertsModalOpen = false)}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      <ul class="mt-4 space-y-2">
        {#each dashboard.alerts as alert}
          <li class="rounded-lg border border-base-300 bg-base-200/60 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 flex-1">
                <span class={`mt-1 inline-flex size-2 rounded-full ${alert.level === 'critical' ? 'bg-error' : alert.level === 'warning' ? 'bg-warning' : 'bg-info'}`}></span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-base-content">{alert.title || alert.message}</p>
                  {#if alert.title && alert.message !== alert.title}
                    <p class="mt-1 text-xs text-base-content/70">{alert.message}</p>
                  {/if}
                  <p class="mt-1 text-xs text-base-content/40">{new Date(alert.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                onclick={() => dismissAlert(alert.id)}
                title="Dismiss alert"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
        {/each}
      </ul>
      <div class="modal-action">
        <button type="button" class="btn btn-primary" onclick={() => (alertsModalOpen = false)}>Close</button>
      </div>
    </div>
    <div class="modal-backdrop" onclick={() => (alertsModalOpen = false)}></div>
  </dialog>
{/if}
