<svelte:options runes={true} />

<script lang="ts">
  import type { Alert } from '@escapeplan/contracts';

  interface StatsData {
    network: {
      ssid: string | null;
      password: string | null;
      status: 'online' | 'degraded' | 'offline';
      broadcastEnabled: boolean;
    };
    sessionCount: number;
    upcomingCount: number;
    alerts: Alert[];
  }

  interface Props {
    stats: StatsData;
    onAlertsClick?: () => void;
  }

  let { stats, onAlertsClick }: Props = $props();
</script>

<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
  <article class="metric-card p-4">
    <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">Network</p>
    <div class="mt-2 space-y-1">
      <div class="flex items-center justify-between">
        <p class="text-base font-semibold text-base-content">{stats.network.ssid ?? 'escapeplan_net'}</p>
        <span
          class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${stats.network.status === 'online' ? 'bg-success/15 text-success' : stats.network.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
        >
          <span class="inline-flex size-1.5 rounded-full bg-current"></span>
          {stats.network.status}
        </span>
      </div>
      {#if stats.network.password && stats.network.broadcastEnabled}
        <p class="text-xs text-base-content/60">Password: <span class="font-mono font-medium text-base-content">{stats.network.password}</span></p>
      {/if}
      <p class="text-[10px] text-base-content/40">Broadcast {stats.network.broadcastEnabled ? 'enabled' : 'disabled'}</p>
    </div>
  </article>

  <article class="metric-card p-4">
    <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">Active Sessions</p>
    <p class="mt-2 text-3xl font-display text-primary">{stats.sessionCount.toString().padStart(2, '0')}</p>
    <p class="mt-1 text-[10px] text-base-content/40">Live rooms</p>
  </article>

  <article class="metric-card p-4">
    <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">Upcoming</p>
    <p class="mt-2 text-3xl font-display text-secondary">{stats.upcomingCount.toString().padStart(2, '0')}</p>
    <p class="mt-1 text-[10px] text-base-content/40">Next 4 hours</p>
  </article>

  <button
    type="button"
    class="metric-card p-4 text-left transition-all hover:border-accent/30 hover:shadow-accent/10 {stats.alerts.length > 0 ? 'cursor-pointer' : 'cursor-default'}"
    onclick={() => { if (stats.alerts.length > 0 && onAlertsClick) onAlertsClick(); }}
    disabled={stats.alerts.length === 0}
  >
    <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">Alerts</p>
    <p class="mt-2 text-3xl font-display text-accent">{stats.alerts.length.toString().padStart(2, '0')}</p>
    <p class="mt-1 text-[10px] text-base-content/40">{stats.alerts.length > 0 ? 'Click to view' : 'No alerts'}</p>
  </button>
</div>
