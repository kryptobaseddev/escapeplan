<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails } from '@escapeplan/contracts';
  import { formatTimer } from '$lib/utils/datetime';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  interface Props {
    sessions: GameSessionDetails[];
    isLoading?: boolean;
    copySuccessMap?: Record<string, boolean>;
    onTimerCommand?: (sessionId: string, command: 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer') => void;
    onCopyTimerLink?: (session: GameSessionDetails) => void;
    onOpenTimerLink?: (session: GameSessionDetails) => void;
  }

  let {
    sessions,
    isLoading = false,
    copySuccessMap = {},
    onTimerCommand,
    onCopyTimerLink,
    onOpenTimerLink
  }: Props = $props();
</script>

<section class="glass-panel border-white/10 bg-base-200/70 p-6">
  <header class="flex items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-base-content">Live rooms</h2>
      <p class="text-sm text-base-content/60">Direct feed from the EscapePlan session broker.</p>
    </div>
    <a class="btn btn-sm btn-secondary/70 border border-secondary/40" href="/games">Manage sessions</a>
  </header>
  <div class="mt-5 space-y-4">
    {#if isLoading}
      <SkeletonLoader type="card" count={3} />
    {:else if sessions.length === 0}
      <EmptyState
        title="No active sessions"
        message="The control room is standing by."
      />
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
                    onclick={() => onTimerCommand?.(session.id, 'start_timer')}
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
                    onclick={() => onTimerCommand?.(session.id, 'pause_timer')}
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
                    onclick={() => onTimerCommand?.(session.id, 'resume_timer')}
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
                  onclick={() => onTimerCommand?.(session.id, 'reset_timer')}
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
                  onclick={() => onCopyTimerLink?.(session)}
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
                  onclick={() => onOpenTimerLink?.(session)}
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
