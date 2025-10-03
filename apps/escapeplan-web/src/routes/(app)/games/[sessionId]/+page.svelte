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
  let copySuccess = $state(false);

  // Sync session from page data when it changes (navigation between different sessions)
  $effect(() => {
    session = data.session;
    // Reset copy success when session changes
    copySuccess = false;
  });

  // Subscribe to WebSocket updates for real-time timer updates
  $effect(() => {
    const currentSessionId = data.session.id;

    const unsubSessions = sessionsStore.subscribe((value) => {
      const next = value.find((s) => s.id === currentSessionId);
      if (next) {
        session = next;
      }
    });

    const unsubQueue = offlineCommandQueue.subscribe((queue) => {
      queuedCommands = queue.filter((entry) => entry.sessionId === currentSessionId).length;
    });

    return () => {
      unsubSessions();
      unsubQueue();
    };
  });

  onMount(() => {
    // Initialize real-time WebSocket connection
    initializeRealtime({});
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

  async function handlePuzzleStatusChange(puzzleId: string, status: string) {
    if (!puzzleId || !status) {
      puzzleFormError = 'Puzzle and status required.';
      return;
    }

    puzzleFormError = null;
    await dispatchCommand('mark_puzzle', { puzzleId, status });
  }

  async function sendPuzzleHint(puzzleId: string, hint: { content: string; type: string; assetUrl?: string; volumeLevel?: number }) {
    hintFormError = null;
    await dispatchCommand('send_hint', {
      message: hint.content,
      medium: hint.type,
      assetUrl: hint.assetUrl,
      volumeLevel: hint.volumeLevel || session.gameDefaultVolume || 80,
      puzzleId
    });
  }

  async function triggerMilestone(milestoneId: string) {
    await dispatchCommand('trigger_milestone', { milestoneId });
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
          {#if session.timer.status === 'idle' || session.timer.status === 'completed'}
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
              class={`rounded-xl border p-4 transition ${
                puzzle.status === 'completed'
                  ? 'border-success/40 bg-success/10'
                  : puzzle.status === 'in_progress'
                    ? 'border-info/40 bg-info/10'
                    : 'border-white/10 bg-base-100/60'
              }`}
            >
              <!-- Header -->
              <header class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-semibold text-base-content">{puzzle.title}</h3>
                <span
                  class={`badge badge-sm uppercase tracking-[0.25em] ${
                    puzzle.status === 'completed'
                      ? 'badge-success'
                      : puzzle.status === 'in_progress'
                        ? 'badge-info'
                        : 'badge-ghost'
                  }`}
                >
                  {puzzle.status.replace('_', ' ')}
                </span>
              </header>

              <!-- Description -->
              {#if puzzle.description}
                <p class="mt-2 text-sm text-base-content/70">{puzzle.description}</p>
              {/if}

              <!-- Solution -->
              {#if puzzle.solution}
                <details class="mt-3 collapse collapse-arrow bg-base-200/50 rounded-lg">
                  <summary class="collapse-title text-sm font-medium min-h-0 py-2">
                    Show Solution
                  </summary>
                  <div class="collapse-content">
                    <p class="text-sm text-base-content/90 font-mono bg-base-300/50 p-2 rounded">
                      {puzzle.solution}
                    </p>
                  </div>
                </details>
              {/if}

              <!-- Status Controls -->
              <div class="mt-4 flex flex-wrap gap-2">
                {#if puzzle.status === 'available'}
                  <button
                    class="btn btn-sm btn-info gap-1"
                    type="button"
                    onclick={() => handlePuzzleStatusChange(puzzle.id, 'in_progress')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                    Start Puzzle
                  </button>
                {:else if puzzle.status === 'in_progress'}
                  <button
                    class="btn btn-sm btn-success gap-1"
                    type="button"
                    onclick={() => handlePuzzleStatusChange(puzzle.id, 'completed')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    Mark Complete
                  </button>
                  <button
                    class="btn btn-sm btn-ghost border border-white/10 gap-1"
                    type="button"
                    onclick={() => handlePuzzleStatusChange(puzzle.id, 'available')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                    </svg>
                    Reset
                  </button>
                {:else if puzzle.status === 'completed'}
                  <div class="flex items-center gap-2">
                    <span class="badge badge-success gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      Completed
                    </span>
                    <button
                      class="btn btn-xs btn-ghost"
                      type="button"
                      onclick={() => handlePuzzleStatusChange(puzzle.id, 'in_progress')}
                    >
                      Undo
                    </button>
                  </div>
                {/if}
              </div>

              <!-- Quick-Send Hints -->
              {#if puzzle.hints && puzzle.hints.length > 0}
                <div class="mt-4 pt-4 border-t border-white/10">
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Quick Send Hints:</h4>
                  <div class="flex flex-wrap gap-2">
                    {#each [...puzzle.hints].sort((a: any, b: any) => a.order - b.order) as hint}
                      <button
                        type="button"
                        class={`btn btn-xs gap-1 ${
                          hint.type === 'text'
                            ? 'btn-primary'
                            : hint.type === 'image'
                              ? 'btn-info'
                              : hint.type === 'audio'
                                ? 'btn-secondary'
                                : 'btn-accent'
                        }`}
                        onclick={() => sendPuzzleHint(puzzle.id, hint)}
                        title={hint.content}
                      >
                        {#if hint.type === 'text'}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                          </svg>
                        {:else if hint.type === 'image'}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                          </svg>
                        {:else if hint.type === 'audio'}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                          </svg>
                        {:else}
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                        {/if}
                        Hint {hint.order}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
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

      {#if session.availableMilestones && session.availableMilestones.length > 0}
        <div id="milestones" class="glass-panel border-white/10 bg-base-200/70 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-base-content">Game Milestones</h2>
            <span class="badge badge-outline border-white/10 text-xs uppercase tracking-[0.3em] text-base-content/50">
              {session.availableMilestones.length} available
            </span>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            {#each session.availableMilestones as milestone}
              <button
                type="button"
                class={`card border transition hover:scale-105 ${
                  milestone.type === 'intro'
                    ? 'border-info/40 bg-info/10 hover:bg-info/20'
                    : milestone.type === 'escaped'
                      ? 'border-success/40 bg-success/10 hover:bg-success/20'
                      : milestone.type === 'failed'
                        ? 'border-error/40 bg-error/10 hover:bg-error/20'
                        : 'border-warning/40 bg-warning/10 hover:bg-warning/20'
                }`}
                onclick={() => triggerMilestone(milestone.id)}
              >
                <div class="card-body p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                      <h3 class="font-semibold text-base-content text-left">{milestone.name}</h3>
                      {#if milestone.content}
                        <p class="mt-1 text-xs text-base-content/70 text-left line-clamp-2">{milestone.content}</p>
                      {/if}
                    </div>
                    <div class="flex-shrink-0">
                      {#if milestone.type === 'intro'}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                        </svg>
                      {:else if milestone.type === 'escaped'}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                      {:else if milestone.type === 'failed'}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                      {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      {/if}
                    </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="badge badge-xs badge-outline">{milestone.type}</span>
                    {#if milestone.mediaType}
                      <span class="badge badge-xs badge-outline">{milestone.mediaType}</span>
                    {/if}
                    {#if milestone.triggerType === 'manual'}
                      <span class="badge badge-xs badge-ghost">Manual Trigger</span>
                    {:else if milestone.triggerType === 'timer' && milestone.triggerConfig?.minutes}
                      <span class="badge badge-xs badge-ghost">@ {milestone.triggerConfig.minutes} min</span>
                    {:else if milestone.triggerType === 'condition' && milestone.triggerConfig?.hintsUsed}
                      <span class="badge badge-xs badge-ghost">After {milestone.triggerConfig.hintsUsed} hints</span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
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
