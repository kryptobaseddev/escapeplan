<script lang="ts">
  import type { PageData } from './$types';
  import { browser } from '$app/environment';
  import { formatTimer } from '$lib/utils/datetime';
  import { getContext, onDestroy, onMount } from 'svelte';
  import { apiFetch } from '$lib/api/client';
  import type { CommandRequest, CommandResponse } from '$lib/api/types';
  import { initializeRealtime, enqueueOfflineCommand } from '$lib/realtime';
  import { offlineCommandQueue, sessionsStore } from '$lib/realtime/stores';
  import { get } from 'svelte/store';

  type RunnerActionData = {
    hintError?: string;
    puzzleError?: string;
  } | null;

  let { data, form } = $props<{ data: PageData; form: RunnerActionData }>();
  let session = $state(data.session);
  const sessionToken = getContext<string | null>('sessionToken');
  let hintFormError = $state(form?.hintError ?? null);
  let puzzleFormError = $state(form?.puzzleError ?? null);
  let offlineNotice = $state<string | null>(null);
  let queuedCommands = $state(0);

  onMount(() => {
    initializeRealtime(sessionToken ?? null, { sessions: [data.session] });

    const unsubSessions = sessionsStore.subscribe((value) => {
      const next = value.find((s) => s.id === data.session.id);
      if (next) {
        session = next;
      }
    });

    const unsubQueue = offlineCommandQueue.subscribe((queue) => {
      queuedCommands = queue.filter((entry) => entry.sessionId === data.session.id).length;
    });

    onDestroy(() => {
      unsubSessions();
      unsubQueue();
    });
  });

  async function dispatchCommand(command: CommandRequest['command'], payload: Record<string, unknown> = {}) {
    try {
      await apiFetch<CommandResponse>(fetch, `/sessions/${session.id}/commands`, {
        method: 'POST',
        token: sessionToken,
        body: JSON.stringify({ command, payload })
      });
      offlineNotice = null;
    } catch (error) {
      console.warn('Command queued due to connectivity issue', error);
      enqueueOfflineCommand({
        sessionId: session.id,
        command,
        payload,
        createdAt: new Date().toISOString()
      });
      offlineNotice = 'Offline — command queued until connection is restored.';
    }
  }

  async function retryQueued() {
    const snapshot = get(offlineCommandQueue).filter((entry) => entry.sessionId === session.id);
    for (const entry of snapshot) {
      await dispatchCommand(entry.command as CommandRequest['command'], entry.payload ?? {});
    }
  }

  function handleTimerAction(command: CommandRequest['command']) {
    dispatchCommand(command);
  }

  async function handlePuzzle(event: SubmitEvent) {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formElement);
    const puzzleId = formData.get('puzzleId');
    const status = formData.get('status');

    if (typeof puzzleId !== 'string' || typeof status !== 'string') {
      puzzleFormError = 'Puzzle and status required.';
      return;
    }

    puzzleFormError = null;
    await dispatchCommand('mark_puzzle', { puzzleId, status });
  }

  async function handleHint(event: SubmitEvent) {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formElement);
    const message = String(formData.get('message') ?? '').trim();
    const medium = String(formData.get('medium') ?? 'text');

    if (!message) {
      hintFormError = 'Hint message required.';
      return;
    }

    hintFormError = null;
    await dispatchCommand('send_hint', { message, medium });
    formElement.reset();
  }

  function printRunSheet() {
    if (browser) {
      window.print();
    }
  }
</script>

<section class="space-y-8">
  <header class="glass-panel border-white/10 bg-base-200/80 p-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-[0.32em] text-base-content/40">{session.roomName}</p>
        <h1 class="text-3xl font-display text-base-content sm:text-4xl">{session.gameName}</h1>
        <p class="text-xs text-base-content/60">Booking {session.id} · {session.players} players</p>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-base-content/60">
          <span class="badge badge-outline badge-neutral">Crew lead · {session.crew.primary}</span>
          {#if session.crew.support}
            <span class="badge badge-outline badge-neutral">Support · {session.crew.support}</span>
          {/if}
          <span class={`badge ${session.isMobile ? 'badge-info' : 'badge-primary/40 border border-primary/40 text-primary'}`}>
            {session.isMobile ? 'Mobile deployment' : 'Storefront room'}
          </span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-4">
        <div class="text-right">
          <p class={`text-5xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
            {formatTimer(session.timer.remainingSeconds)}
          </p>
          <p class="text-xs uppercase tracking-[0.3em] text-base-content/50">{session.timer.status}</p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <button class="btn btn-sm btn-primary" type="button" onclick={() => handleTimerAction('start_timer')}>
            Start
          </button>
          <button
            class="btn btn-sm btn-secondary/70 border border-secondary/40"
            type="button"
            onclick={() => handleTimerAction('pause_timer')}
          >
            Pause
          </button>
          <button
            class="btn btn-sm btn-ghost border border-white/10"
            type="button"
            onclick={() => handleTimerAction('resume_timer')}
          >
            Resume
          </button>
          <button
            class="btn btn-sm btn-ghost border border-white/10"
            type="button"
            onclick={() => handleTimerAction('reset_timer')}
          >
            Reset
          </button>
        </div>
        <button class="btn btn-xs btn-ghost border border-white/10" type="button" onclick={printRunSheet}>
          Print run sheet
        </button>
        {#if offlineNotice}
          <p class="mt-3 text-xs text-warning text-right">{offlineNotice} ({queuedCommands} queued)</p>
        {:else if queuedCommands}
          <div class="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-accent">
            <span>{queuedCommands} command(s) queued</span>
            <button class="btn btn-ghost btn-xs border border-accent/40" type="button" onclick={retryQueued}>
              Retry now
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
    <section class="space-y-6">
      <div id="streams" class="glass-panel border-white/10 bg-base-200/70 p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-base-content">Live feed</h2>
          <span class="badge badge-outline border-white/10 text-xs uppercase tracking-[0.3em] text-base-content/50">Camera core</span>
        </div>
        <div class="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-neutral/10">
          <div class="aspect-video w-full overflow-hidden">
            {#if session.streamThumbnailUrl}
              <img src={session.streamThumbnailUrl} alt={`Camera preview for ${session.roomName}`} class="h-full w-full object-cover" />
            {:else}
              <div class="flex h-full items-center justify-center text-sm text-base-content/60">
                Camera stream preview unavailable
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div id="puzzles" class="glass-panel border-white/10 bg-base-200/70 p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-base-content">Puzzle tracker</h2>
          {#if puzzleFormError}
            <span class="text-xs text-error">{puzzleFormError}</span>
          {/if}
        </div>
        <div class="mt-5 space-y-3">
          {#each session.puzzles as puzzle}
            <article
              class={`rounded-xl border border-white/10 bg-base-100/60 p-4 transition ${puzzle.status === 'completed' ? 'border-success/40 bg-success/10' : puzzle.status === 'in_progress' ? 'border-info/40 bg-info/10' : ''}`}
            >
              <header class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-semibold text-base-content">{puzzle.title}</h3>
                <span class="badge badge-outline badge-sm uppercase tracking-[0.25em] text-base-content/60">{puzzle.status.replace('_', ' ')}</span>
              </header>
              <form class="mt-4 flex flex-wrap gap-2 text-xs" onsubmit={handlePuzzle}>
                <input type="hidden" name="puzzleId" value={puzzle.id} />
                <button class="btn btn-xs btn-ghost border border-white/10" type="submit" name="status" value="in_progress">Mark in progress</button>
                <button class="btn btn-xs btn-primary" type="submit" name="status" value="completed">Mark complete</button>
              </form>
            </article>
          {/each}
        </div>
      </div>

      <div id="hint-log" class="glass-panel border-white/10 bg-base-200/70 p-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-base-content">Hint console</h2>
          {#if hintFormError}
            <span class="text-xs text-error">{hintFormError}</span>
          {/if}
        </div>
        <form class="mt-5 space-y-4" onsubmit={handleHint}>
          <label class="form-control">
            <span class="label-text text-xs uppercase tracking-[0.3em] text-base-content/50">Hint message</span>
            <textarea class="textarea textarea-bordered mt-2 bg-base-100/60" name="message" required rows="3" placeholder="Team is stuck on the cipher – remind them of the lantern pattern."></textarea>
          </label>
          <div class="flex flex-wrap items-center gap-4">
            <label class="form-control max-w-xs">
              <span class="label-text text-xs uppercase tracking-[0.3em] text-base-content/50">Medium</span>
              <select class="select select-bordered mt-2 bg-base-100/60" name="medium">
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </label>
            <button class="btn btn-primary" type="submit">Send hint</button>
          </div>
        </form>

        <div class="mt-6 space-y-3">
          {#if session.hintLog.length === 0}
            <p class="rounded-xl border border-dashed border-base-content/20 bg-base-100/50 px-4 py-6 text-sm text-base-content/60">
              No hints sent yet.
            </p>
          {:else}
            {#each session.hintLog as hint}
              <article class="rounded-xl border border-white/10 bg-base-100/60 p-4 text-sm">
                <header class="flex items-center justify-between">
                  <span class="font-semibold text-base-content/90">{hint.deliveredBy}</span>
                  <span class="text-xs uppercase tracking-[0.3em] text-base-content/50">{new Date(hint.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </header>
                <p class="mt-2 text-base-content/80">{hint.message}</p>
                <footer class="mt-2 text-xs uppercase tracking-[0.25em] text-base-content/50">{hint.type}</footer>
              </article>
            {/each}
          {/if}
        </div>
      </div>
    </section>

    <aside class="space-y-6">
      <div class="glass-panel border-white/10 bg-base-200/70 p-6">
        <h2 class="text-lg font-semibold text-base-content">Session details</h2>
        <dl class="mt-4 space-y-3 text-sm text-base-content/70">
          <div class="flex items-center justify-between gap-4">
            <dt>Status</dt>
            <dd class="badge badge-outline border-white/15 text-xs uppercase tracking-[0.3em] text-base-content/60">{session.status}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt>Players</dt>
            <dd>{session.players}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt>Started</dt>
            <dd>{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt>Scheduled end</dt>
            <dd>{new Date(session.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt>Hints used</dt>
            <dd>{session.hintsUsed}</dd>
          </div>
        </dl>
      </div>

      {#if session.backgroundAudio}
        <div class="glass-panel border-white/10 bg-base-200/70 p-5">
          <h2 class="text-lg font-semibold text-base-content">Audio</h2>
          <p class="mt-2 text-sm text-base-content/70">Track · {session.backgroundAudio.trackName}</p>
          <span class={`badge badge-sm mt-3 ${session.backgroundAudio.isPlaying ? 'badge-success' : 'badge-secondary'}`}>
            {session.backgroundAudio.isPlaying ? 'Playing' : 'Paused'}
          </span>
        </div>
      {/if}
    </aside>
  </div>
</section>
