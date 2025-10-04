<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails, CommandRequest } from '@escapeplan/contracts';
  import SessionCard from './SessionCard.svelte';

  let {
    session,
    queuedCommands = 0,
    offlineNotice = null,
    onTimerAction,
    onRetryQueued
  }: {
    session: GameSessionDetails;
    queuedCommands?: number;
    offlineNotice?: string | null;
    onTimerAction: (command: CommandRequest['command']) => void;
    onRetryQueued: () => void;
  } = $props();

  function handleTimerCommand(sessionId: string, command: CommandRequest['command']) {
    onTimerAction(command);
  }
</script>

<header class="glass-panel border-white/10 bg-base-200/80 overflow-hidden">
  <div class="session-header-wrapper">
    <SessionCard {session} onTimerCommand={handleTimerCommand} />
  </div>

  <div class="px-3 pb-3 md:px-5 md:pb-5 space-y-2">
    {#if offlineNotice}
      <p class="text-[10px] md:text-xs text-warning">{offlineNotice} ({queuedCommands} queued)</p>
    {:else if queuedCommands > 0}
      <div class="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-accent">
        <span>{queuedCommands} command(s) queued</span>
        <button class="btn btn-ghost btn-xs border border-accent/40" type="button" onclick={onRetryQueued}>
          Retry now
        </button>
      </div>
    {/if}
  </div>
</header>

<style>
  .session-header-wrapper :global(.card) {
    background: transparent;
    box-shadow: none;
    padding: 0;
  }

  .session-header-wrapper :global(.card > div:first-child) {
    padding: 0.75rem;
  }

  @media (min-width: 768px) {
    .session-header-wrapper :global(.card > div:first-child) {
      padding: 1.25rem;
    }
  }

  /* Hide SessionCard's "View bookings" button */
  .session-header-wrapper :global(.card button[onclick*="bookings"]) {
    display: none;
  }

  /* Position Room Display section to align with right side under timer */
  .session-header-wrapper :global(.card > div:first-child > div:first-child > div:first-child) {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  @media (min-width: 640px) {
    .session-header-wrapper :global(.card > div:first-child > div:first-child > div:first-child) {
      gap: 0.75rem;
    }
  }

  /* Room Display section - float it to the right */
  .session-header-wrapper :global(.card > div:first-child > div:first-child > div:first-child > div.pt-1),
  .session-header-wrapper :global(.card > div:first-child > div:first-child > div:first-child > div.sm\\:pt-2) {
    justify-self: end;
    max-width: 12rem;
    width: 100%;
  }
</style>
