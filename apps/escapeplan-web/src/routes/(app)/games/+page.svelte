<script lang="ts">
  import type { PageData } from './$types';
  import { onDestroy, onMount } from 'svelte';
  import { formatTimer } from '$lib/utils/datetime';
  import QuickStartModal from '$lib/components/sessions/QuickStartModal.svelte';
  import type { GameSessionDetails, GameDetails } from '@escapeplan/contracts';
  import { goto } from '$app/navigation';

  let { data } = $props<{ data: PageData }>();

  let sessions = $state(data.sessions ?? []);
  let generatedAt = $state(data.generatedAt ?? null);
  let games = $state(data.games ?? []);
  let quickStartOpen = $state(false);
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  const setToast = (message: string, type: 'success' | 'error' = 'success') => {
    toast = { message, type };
    setTimeout(() => {
      if (toast?.message === message) {
        toast = null;
      }
    }, 4000);
  };

  const handleQuickStartSuccess = (session: GameSessionDetails) => {
    quickStartOpen = false;
    setToast('Session started successfully.');
    if (!sessions.some((existing: GameSessionDetails) => existing.id === session.id)) {
      sessions = [session, ...sessions];
    }
    goto(`/games/${session.id}`);
  };

  const buildTimerUrl = (session: GameSessionDetails) => {
    const slug = session.gameSlug ?? session.gameId;
    if (!slug) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(`/timer/${slug}`, origin);
    const roomIdentity = session.roomUuid ?? session.roomId;
    if (roomIdentity) {
      url.searchParams.set('room', roomIdentity);
    }
    return url.toString();
  };

  const copyTimerLink = async (session: GameSessionDetails) => {
    const url = buildTimerUrl(session);
    if (!url) {
      setToast('Timer link unavailable for this session.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Timer link copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy timer link', error);
      setToast('Unable to copy timer link.', 'error');
    }
  };

  const openTimerLink = (session: GameSessionDetails) => {
    const url = buildTimerUrl(session);
    if (!url) {
      setToast('Timer link unavailable for this session.', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (games.length) {
          quickStartOpen = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);

    onDestroy(() => {
      window.removeEventListener('keydown', handleKeydown);
    });
  });

  $effect(() => {
    sessions = data.sessions ?? [];
    generatedAt = data.generatedAt ?? null;
    games = data.games ?? [];
  });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="section-heading">Game runner</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Launch into rooms to manage timers, deliver hints, and monitor puzzle flow.
      </p>
    </div>
    {#if games.length}
      <button class="btn btn-secondary w-full lg:w-auto" onclick={() => (quickStartOpen = true)}>
        + Quick start session
      </button>
    {/if}
  </header>

  {#if data.sessionsError}
    <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
      <span>{data.sessionsError}</span>
    </div>
  {:else}
    {#if toast}
      <div
        class={`alert ${toast.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'}`}
      >
        <span>{toast.message}</span>
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
                <h2 class="mt-1 flex items-center gap-2 text-2xl font-display text-base-content">
                  {session.gameName}
                  {#if session.isAdhoc}
                    <span class="badge badge-outline border-primary/40 text-[11px] text-primary">Ad-hoc</span>
                  {/if}
                </h2>
                <p class="text-xs text-base-content/60">{session.players} players · {session.isMobile ? 'Mobile kit' : 'Storefront room'}</p>
              </div>
              <div class="text-right">
                <span class={`text-4xl font-display ${session.timer.remainingSeconds <= 300 ? 'text-warning' : 'text-primary'}`}>
                  {formatTimer(session.timer.remainingSeconds)}
                </span>
                <p class="mt-1 text-xs uppercase tracking-[0.3em] text-base-content/50">{session.status}</p>
              </div>
            </header>
            <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="flex items-center gap-3 text-xs text-base-content/60">
                <span>Hints used: <strong class="text-base-content">{session.hintsUsed}</strong></span>
                {#if session.recentAlert}
                  <span class="badge badge-warning badge-sm">{session.recentAlert}</span>
                {/if}
              </div>
              <div class="flex flex-wrap gap-2">
                <a class="btn btn-sm btn-primary" href={`/games/${session.id}`}>Open runner</a>
                <button type="button" class="btn btn-sm btn-ghost border border-white/10" onclick={() => copyTimerLink(session)}>
                  Copy timer link
                </button>
                <button type="button" class="btn btn-sm btn-ghost border border-white/10" onclick={() => openTimerLink(session)}>
                  Open room display
                </button>
              </div>
            </div>
          </article>
        {/each}
      {/if}
    </div>
  {/if}
</section>

<QuickStartModal
  open={quickStartOpen}
  games={games}
  activeSessions={sessions}
  onclose={() => (quickStartOpen = false)}
  onsuccess={handleQuickStartSuccess}
/>
