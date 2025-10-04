<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails } from '@escapeplan/contracts';

  let {
    session,
    hintFormError = null,
    onSubmit
  }: {
    session: GameSessionDetails;
    hintFormError?: string | null;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();

  let showAllHints = $state(false);

  // Show most recent 3 hints by default
  const visibleHints = $derived(
    showAllHints ? session.hintLog : session.hintLog.slice(-3).reverse()
  );

  // Check if text hint is currently playing on room display
  const isTextHintPlaying = $derived(
    session.currentRoomDisplayMedia?.status === 'playing' &&
    session.currentRoomDisplayMedia?.source === 'hint' &&
    session.currentRoomDisplayMedia?.mediaType === 'text'
  );
</script>

<div id="hint-log" class="glass-panel border-white/10 bg-base-200/70 p-4">
  <div class="flex items-center justify-between">
    <h2 class="text-base md:text-lg font-semibold text-base-content">Hint console</h2>
    {#if hintFormError}
      <span class="text-xs text-error">{hintFormError}</span>
    {/if}
  </div>

  <form class="mt-3 space-y-2" onsubmit={onSubmit}>
    <label class="form-control">
      <span class="label-text text-[10px] md:text-xs uppercase tracking-[0.3em] text-base-content/50">Hint message</span>
      <textarea class="textarea textarea-bordered textarea-sm mt-1 bg-base-100/60" name="message" required rows="2" placeholder="Team is stuck on the cipher..."></textarea>
    </label>

    <button class={`btn btn-primary btn-sm w-full mt-3 ${isTextHintPlaying ? 'media-playing' : ''}`} type="submit">
      Send hint
      {#if isTextHintPlaying}
        <span class="badge badge-xs badge-warning ml-2">Playing on Room Display</span>
      {/if}
    </button>
  </form>

  <div class="mt-4 space-y-2">
    {#if session.hintLog.length === 0}
      <p class="rounded-lg border border-dashed border-base-content/20 bg-base-100/50 px-3 py-4 text-xs text-base-content/60">
        No hints sent yet.
      </p>
    {:else}
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-base-content/50">Recent hints</span>
        {#if session.hintLog.length > 3}
          <button
            type="button"
            class="btn btn-xs btn-ghost"
            onclick={() => showAllHints = !showAllHints}
          >
            {showAllHints ? 'Show less' : `Show all (${session.hintLog.length})`}
          </button>
        {/if}
      </div>
      {#each visibleHints as hint}
        <article class="rounded-lg border border-white/10 bg-base-100/60 p-3 text-xs">
          <header class="flex items-center justify-between">
            <span class="font-semibold text-base-content/90">{hint.deliveredBy}</span>
            <span class="text-[10px] uppercase tracking-[0.3em] text-base-content/50">{new Date(hint.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </header>
          <p class="mt-1 text-base-content/80">{hint.message}</p>
          <footer class="mt-1 text-[10px] uppercase tracking-[0.25em] text-base-content/50">{hint.type}</footer>
        </article>
      {/each}
    {/if}
  </div>
</div>
