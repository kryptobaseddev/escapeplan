<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { browser } from '$app/environment';
  import { formatTimer } from '$lib/utils/datetime';
  import { onDestroy, onMount } from 'svelte';
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
  let hintFormError = $state(form?.hintError ?? null);
  let puzzleFormError = $state(form?.puzzleError ?? null);
  let offlineNotice = $state<string | null>(null);
  let queuedCommands = $state(0);

  onMount(() => {
    initializeRealtime({ sessions: [data.session] });

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

  let copySuccess = $state(false);

  function copyRoomDisplayUrl() {
    if (!browser) return;
    const url = `${window.location.origin}/timer/${session.gameSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      copySuccess = true;
      setTimeout(() => { copySuccess = false; }, 2000);
    });
  }

  function openRoomDisplay() {
    if (!browser) return;
    const url = `/timer/${session.gameSlug}`;
    window.open(url, '_blank');
  }
</script>

<section class="space-y-6">
  <div class="flex items-center gap-3">
    <a href="/games" class="btn btn-sm btn-ghost border border-white/10" aria-label="Back to game runner">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      <span>Back to Game Runner</span>
    </a>
  </div>

  <header class="glass-panel border-white/10 bg-base-200/80 p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex-1 space-y-3">
        <div>
          <h1 class="text-2xl font-display text-base-content">{session.gameName}</h1>
          <p class="mt-1 text-xs text-base-content/60">{session.players} players</p>
        </div>
        <dl class="space-y-1.5 text-sm">
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
        <a class="btn btn-sm btn-ghost border border-white/10 w-fit" href={`/bookings?focus=${session.id}`}>
          View booking
        </a>
      </div>

      <div class="flex flex-col items-end gap-3">
        <div class="text-right">
          <p class={`text-5xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
            {formatTimer(session.timer.remainingSeconds)}
          </p>
          <p class="mt-1 text-xs uppercase tracking-[0.3em] text-base-content/50">{session.timer.status}</p>
          <p class="text-xs text-base-content/40">
            Total elapsed: {formatTimer(session.timer.totalElapsedSeconds)}
          </p>
        </div>

        <div class="flex items-center gap-1">
          {#if session.timer.status === 'idle'}
            <button class="btn btn-sm btn-circle btn-primary" type="button" onclick={() => handleTimerAction('start_timer')} aria-label="Start timer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          {:else if session.timer.status === 'running'}
            <button class="btn btn-sm btn-circle btn-warning" type="button" onclick={() => handleTimerAction('pause_timer')} aria-label="Pause timer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          {:else if session.timer.status === 'paused'}
            <button class="btn btn-sm btn-circle btn-success" type="button" onclick={() => handleTimerAction('resume_timer')} aria-label="Resume timer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          {/if}
          <button class="btn btn-sm btn-circle btn-ghost border border-white/10" type="button" onclick={() => handleTimerAction('reset_timer')} aria-label="Reset timer">
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
            onclick={copyRoomDisplayUrl}
            aria-label="Copy URL to clipboard"
          >
            {#if copySuccess}
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
            onclick={openRoomDisplay}
            aria-label="Open in new tab"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>

        {#if offlineNotice}
          <p class="text-xs text-warning text-right">{offlineNotice} ({queuedCommands} queued)</p>
        {:else if queuedCommands}
          <div class="flex flex-wrap items-center justify-end gap-2 text-xs text-accent">
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
