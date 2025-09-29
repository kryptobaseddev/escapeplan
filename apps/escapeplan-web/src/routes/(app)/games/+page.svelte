<script lang="ts">
  import type { PageData } from './$types';
  import { formatTimer } from '$lib/utils/datetime';
  import { getContext, onDestroy, onMount } from 'svelte';
  import { initializeRealtime } from '$lib/realtime';
  import { sessionsStore } from '$lib/realtime/stores';

  let { data } = $props<{ data: PageData }>();

  let sessions = $state(data.sessions);
  const sessionToken = getContext<string | null>('sessionToken');

  onMount(() => {
    initializeRealtime(sessionToken ?? null, { sessions: data.sessions });

    const unsub = sessionsStore.subscribe((value) => {
      sessions = value;
    });

    onDestroy(unsub);
  });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="section-heading">Game runner</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Launch into rooms to manage timers, deliver multimedia hints, and monitor puzzle flow. All actions sync instantly to the public timer slugs.
      </p>
    </div>
    <div class="badge-pill">
      <span class="inline-flex size-2 rounded-full bg-primary"></span>
      <span>{sessions.length} sessions ready</span>
    </div>
  </header>

  {#if data.sessionsError}
    <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
      <span>{data.sessionsError}</span>
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-2">
    {#if sessions.length === 0}
      <div class="col-span-full rounded-2xl border border-dashed border-base-content/20 bg-base-200/60 px-6 py-10 text-center text-sm text-base-content/60">
        No active sessions. Once a booking checks in, the room will surface here for quick launch.
      </div>
    {:else}
      {#each sessions as session}
        <article class="glass-panel border-white/10 bg-base-200/70 p-6">
          <header class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">{session.roomName}</p>
              <h2 class="mt-1 text-2xl font-display text-base-content">{session.gameName}</h2>
              <p class="text-xs text-base-content/60">{session.players} players · {session.isMobile ? 'Mobile kit' : 'Storefront room'}</p>
            </div>
            <span class="badge badge-outline border-white/20 text-base-content/70">{session.status}</span>
          </header>

          <div class="mt-5 grid gap-4 text-sm md:grid-cols-4">
            <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
              <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">Timer</p>
              <p class={`mt-1 text-3xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
                {formatTimer(session.timer.remainingSeconds)}
              </p>
            </div>
            <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
              <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">Hints used</p>
              <p class="mt-2 text-2xl font-semibold text-base-content">{session.hintsUsed}</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
              <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">Crew</p>
              <p class="mt-2 text-base-content/80">{session.crew.primary}</p>
              {#if session.crew.support}
                <p class="text-xs text-base-content/60">Support · {session.crew.support}</p>
              {/if}
            </div>
            <div class="rounded-xl border border-white/10 bg-base-100/60 p-4 text-xs text-base-content/60">
              <p class="uppercase tracking-[0.3em] text-base-content/40">Started</p>
              <p class="mt-2 text-sm text-base-content">{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p class="text-base-content/50">Scheduled end {new Date(session.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2 text-xs text-base-content/60">
            {#each session.puzzles as puzzle}
              <span
                class={`badge ${puzzle.status === 'completed' ? 'badge-success' : puzzle.status === 'in_progress' ? 'badge-info' : 'badge-outline border-white/20'}`}
              >
                {puzzle.title}
              </span>
            {/each}
          </div>

          <footer class="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span class="text-xs text-base-content/60">Open the runner to send multimedia hints, control audio, and broadcast timers.</span>
            <a class="btn btn-sm btn-primary" href={`/games/${session.id}`}>Open runner</a>
          </footer>
        </article>
      {/each}
    {/if}
  </div>
</section>
