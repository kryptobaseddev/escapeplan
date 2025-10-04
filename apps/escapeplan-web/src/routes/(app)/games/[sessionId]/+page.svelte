<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api/client';
  import type { CommandRequest, CommandResponse } from '$lib/api/types';
  import { initializeRealtime, enqueueOfflineCommand } from '$lib/realtime';
  import { offlineCommandQueue, sessionsStore } from '$lib/realtime/stores';
  import { get } from 'svelte/store';
  import SessionHeader from '$lib/components/sessions/SessionHeader.svelte';
  import HintConsole from '$lib/components/sessions/HintConsole.svelte';
  import GameMilestones from '$lib/components/sessions/GameMilestones.svelte';
  import PuzzleTracker from '$lib/components/sessions/PuzzleTracker.svelte';
  import LiveFeed from '$lib/components/sessions/LiveFeed.svelte';

  type RunnerActionData = {
    hintError?: string;
    puzzleError?: string;
  } | null;

  let { data, form }: { data: PageData; form: RunnerActionData } = $props();
  let session = $state(data.session);
  let hintFormError = $state(form?.hintError ?? null);
  let puzzleFormError = $state(form?.puzzleError ?? null);
  let offlineNotice = $state<string | null>(null);
  let queuedCommands = $state(0);

  // Sync session from page data when it changes (navigation between different sessions)
  $effect(() => {
    session = data.session;
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

  async function sendPuzzleHint(
    puzzleId: string,
    hint: {
      content: string;
      type: string;
      assetUrl?: string;
      volumeLevel?: number;
      displayDurationSeconds?: number;
      loop?: boolean;
      loopCount?: number;
      autoDismiss?: boolean;
    }
  ) {
    hintFormError = null;
    await dispatchCommand('send_hint', {
      message: hint.content,
      medium: hint.type,
      assetUrl: hint.assetUrl,
      volumeLevel: hint.volumeLevel || session.gameDefaultVolume || 80,
      displayDurationSeconds: hint.displayDurationSeconds,
      loop: hint.loop ?? false,
      loopCount: hint.loopCount,
      autoDismiss: hint.autoDismiss ?? true,
      puzzleId
    });
  }

  async function triggerMilestone(milestoneId: string) {
    await dispatchCommand('trigger_milestone', { milestoneId });
  }

  async function resetMilestone(milestoneId: string) {
    await dispatchCommand('reset_milestone', { milestoneId });
  }

  async function handleHint(event: SubmitEvent) {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formElement);

    const message = String(formData.get('message') ?? '').trim();

    if (!message) {
      hintFormError = 'Hint message required.';
      return;
    }

    hintFormError = null;
    await dispatchCommand('send_hint', {
      message,
      medium: 'text',
      autoDismiss: true
    });
    formElement.reset();
  }
</script>

<section class="space-y-4 md:space-y-6">
  <div class="flex items-center gap-3">
    <a href="/games" class="btn btn-xs md:btn-sm btn-ghost border border-white/10" aria-label="Back to game runner">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      <span class="hidden md:inline">Back to Game Runner</span>
    </a>
  </div>

  <SessionHeader
    {session}
    {queuedCommands}
    {offlineNotice}
    onTimerAction={handleTimerAction}
    onRetryQueued={retryQueued}
  />

  <div class="grid gap-4 md:gap-6 lg:grid-cols-[2fr_1fr]">
    <section class="space-y-4 md:space-y-6 order-2 lg:order-1">
      <GameMilestones
        {session}
        onTriggerMilestone={triggerMilestone}
        onResetMilestone={resetMilestone}
      />

      <PuzzleTracker
        {session}
        {puzzleFormError}
        onPuzzleStatusChange={handlePuzzleStatusChange}
        onSendPuzzleHint={sendPuzzleHint}
      />

      <LiveFeed {session} />
    </section>

    <aside class="space-y-4 md:space-y-6 order-1 lg:order-2">
      <HintConsole
        {session}
        {hintFormError}
        onSubmit={handleHint}
      />

      {#if session.backgroundAudio}
        <div class="glass-panel border-white/10 bg-base-200/70 p-4">
          <h2 class="text-base md:text-lg font-semibold text-base-content">Audio</h2>
          <p class="mt-2 text-xs md:text-sm text-base-content/70">Track · {session.backgroundAudio.trackName}</p>
          <span class={`badge badge-sm mt-3 ${session.backgroundAudio.isPlaying ? 'badge-success' : 'badge-secondary'}`}>
            {session.backgroundAudio.isPlaying ? 'Playing' : 'Paused'}
          </span>
        </div>
      {/if}
    </aside>
  </div>
</section>
