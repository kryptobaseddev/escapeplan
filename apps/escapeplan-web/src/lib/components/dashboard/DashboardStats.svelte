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

<div class="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
  <article class="metric-card p-2 md:p-4">
    <p class="text-[8px] font-semibold uppercase tracking-[0.4em] text-base-content/40 md:text-[10px]">Network</p>
    <div class="mt-1 space-y-0.5 md:mt-2 md:space-y-1">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-base-content md:text-base">{stats.network.ssid ?? 'Unknown'}</p>
        <span
          class={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider md:gap-1.5 md:px-2 md:text-[10px] ${stats.network.status === 'online' ? 'bg-success/15 text-success' : stats.network.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
        >
          <span class="inline-flex size-1 rounded-full bg-current md:size-1.5"></span>
          {stats.network.status}
        </span>
      </div>
      {#if stats.network.password && stats.network.broadcastEnabled}
        <p class="text-[10px] text-base-content/60 md:text-xs">Password: <span class="font-mono font-medium text-base-content">{stats.network.password}</span></p>
      {/if}
      <p class="text-[8px] text-base-content/40 md:text-[10px]">Broadcast {stats.network.broadcastEnabled ? 'enabled' : 'disabled'}</p>
    </div>
  </article>

  <article class="metric-card p-2 md:p-4">
    <p class="text-[8px] font-semibold uppercase tracking-[0.4em] text-base-content/40 md:text-[10px]">Active Sessions</p>
    <p class="mt-1 text-2xl font-display text-primary md:mt-2 md:text-3xl">{stats.sessionCount.toString().padStart(2, '0')}</p>
    <p class="mt-0.5 text-[8px] text-base-content/40 md:mt-1 md:text-[10px]">Live rooms</p>
  </article>

  <article class="metric-card p-2 md:p-4">
    <p class="text-[8px] font-semibold uppercase tracking-[0.4em] text-base-content/40 md:text-[10px]">Upcoming</p>
    <p class="mt-1 text-2xl font-display text-secondary md:mt-2 md:text-3xl">{stats.upcomingCount.toString().padStart(2, '0')}</p>
    <p class="mt-0.5 text-[8px] text-base-content/40 md:mt-1 md:text-[10px]">Next 4 hours</p>
  </article>

  <button
    type="button"
    class="metric-card p-2 text-left transition-all hover:border-accent/30 hover:shadow-accent/10 md:p-4 {stats.alerts.length > 0 ? 'cursor-pointer' : 'cursor-default'}"
    onclick={() => { if (stats.alerts.length > 0 && onAlertsClick) onAlertsClick(); }}
    disabled={stats.alerts.length === 0}
  >
    <p class="text-[8px] font-semibold uppercase tracking-[0.4em] text-base-content/40 md:text-[10px]">Alerts</p>
    <p class="mt-1 text-2xl font-display text-accent md:mt-2 md:text-3xl">{stats.alerts.length.toString().padStart(2, '0')}</p>
    <p class="mt-0.5 text-[8px] text-base-content/40 md:mt-1 md:text-[10px]">{stats.alerts.length > 0 ? 'Click to view' : 'No alerts'}</p>
  </button>
</div>
