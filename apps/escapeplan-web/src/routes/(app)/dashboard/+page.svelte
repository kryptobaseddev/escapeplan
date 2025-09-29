<script lang="ts">
  import type { PageData } from './$types';
  import { formatDate, formatTime, formatTimer } from '$lib/utils/datetime';
  import { getContext, onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initializeRealtime } from '$lib/realtime';
  import { bookingsStore, dashboardStore, sessionsStore } from '$lib/realtime/stores';

  let { data } = $props<{ data: PageData }>();

  let dashboard = $state(data.dashboard ?? null);
  let sessions = $state(data.dashboard?.activeSessions ?? []);
  let bookings = $state(data.dashboard?.upcomingBookings ?? []);

  let canViewNetwork = $derived($page.data.user?.permissions?.includes('view_network') ?? false);
  let networkLink = $derived(canViewNetwork ? (dashboard?.network.detailsUrl ?? '/admin/network') : null);

  const sessionToken = getContext<string | null>('sessionToken');

  onMount(() => {
    initializeRealtime(sessionToken ?? null, {
      dashboard,
      sessions,
      bookings: []
    });

    const unsubDashboard = dashboardStore.subscribe((value) => {
      if (value) {
        dashboard = value;
        bookings = value.upcomingBookings;
      }
    });

    const unsubSessions = sessionsStore.subscribe((value) => {
      sessions = value;
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
    });
  });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="section-heading">Control room overview</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Real-time status for storefront rooms, mobile kits, and live sessions across the EscapePlan appliance.
        All metrics are sourced locally from the Fastify control API.
      </p>
    </div>
    {#if dashboard}
      <div class="badge-pill">
        <span class="inline-flex size-2 rounded-full {dashboard.network.status === 'online' ? 'bg-success' : dashboard.network.status === 'degraded' ? 'bg-warning' : 'bg-error'}"></span>
        <span>Network {dashboard.network.status} · refreshed {formatTime(dashboard.generatedAt)}</span>
      </div>
    {/if}
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
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="space-y-1">
                    <p class="text-sm uppercase tracking-[0.25em] text-base-content/40">{session.roomName}</p>
                    <h3 class="text-xl font-display text-base-content">{session.gameName}</h3>
                    <p class="text-xs text-base-content/60">{session.players} players · {session.isMobile ? 'Mobile kit' : 'Storefront room'}</p>
                  </div>
                  <div class="text-right">
                    <p class={`text-3xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
                      {formatTimer(session.timer.remainingSeconds)}
                    </p>
                    <p class="mt-1 text-xs uppercase tracking-[0.3em] text-base-content/50">{session.status}</p>
                  </div>
                </div>
                <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div class="flex items-center gap-3 text-xs text-base-content/60">
                    <span>Hints used: <strong class="text-base-content">{session.hintsUsed}</strong></span>
                    {#if session.recentAlert}
                      <span class="badge badge-warning badge-sm">{session.recentAlert}</span>
                    {/if}
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <a class="btn btn-sm btn-primary" href={`/games/${session.id}`}>Open runner</a>
                    <a class="btn btn-sm btn-ghost border border-white/10" href={`/bookings?focus=${session.id}`}>View booking</a>
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
                <th>Start</th>
                <th>Game</th>
                <th>Party</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#if bookings.length === 0}
                <tr>
                  <td colspan="5" class="py-6 text-center text-sm text-base-content/60">No upcoming bookings.</td>
                </tr>
              {:else}
                {#each bookings as booking}
                  <tr class={booking.conflict ? 'bg-secondary/10' : ''}>
                    <td>
                      <div class="flex flex-col">
                        <span class="font-semibold text-base-content">{formatTime(booking.startTime)}</span>
                        <span class="text-xs text-base-content/50">{formatDate(booking.startTime)}</span>
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-col">
                        <span class="font-semibold text-base-content/90">{booking.gameName}</span>
                        <span class="text-xs text-base-content/50">{booking.roomName}</span>
                      </div>
                    </td>
                    <td class="text-sm text-base-content/80">{booking.partySize}</td>
                    <td>
                      <span class={`badge badge-sm ${booking.isMobile ? 'badge-info' : 'badge-neutral'}`}>
                        {booking.isMobile ? 'Mobile' : 'Storefront'}
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-outline badge-sm text-base-content/70">{booking.status}</span>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  {/if}
</section>
