<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails } from '@escapeplan/contracts';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import SessionCard from '$lib/components/sessions/SessionCard.svelte';

  interface Props {
    sessions: GameSessionDetails[];
    isLoading?: boolean;
    onTimerCommand?: (sessionId: string, command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'stop_session') => void;
    onCopyTimerLink?: (session: GameSessionDetails) => void;
    onOpenTimerLink?: (session: GameSessionDetails) => void;
  }

  let {
    sessions,
    isLoading = false,
    onTimerCommand,
    onCopyTimerLink,
    onOpenTimerLink
  }: Props = $props();
</script>

<section class="glass-panel border-white/10 bg-base-200/70 p-6 sm:p-6 max-sm:p-4">
  <header class="flex items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-base-content">Live rooms</h2>
      <p class="text-sm text-base-content/60">Direct feed from the EscapePlan session broker.</p>
    </div>
    <a class="btn btn-sm btn-secondary/70 border border-secondary/40" href="/games">Manage sessions</a>
  </header>
  <div class="mt-5 space-y-2 sm:space-y-4">
    {#if isLoading}
      <SkeletonLoader type="card" count={3} />
    {:else if sessions.length === 0}
      <EmptyState
        title="No active sessions"
        message="The control room is standing by."
      />
    {:else}
      {#each sessions as session}
        <SessionCard
          {session}
          variant="compact"
          {onTimerCommand}
          onCopyLink={onCopyTimerLink}
          onOpenLink={onOpenTimerLink}
        />
      {/each}
    {/if}
  </div>
</section>
