<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails } from '@escapeplan/contracts';

  let {
    session
  }: {
    session: GameSessionDetails;
  } = $props();
</script>

<details id="streams" class="glass-panel border-white/10 bg-base-200/70">
  <summary class="flex cursor-pointer items-center justify-between gap-2 p-4 hover:bg-base-200/90 transition">
    <h2 class="text-base md:text-lg font-semibold text-base-content">Live feed</h2>
    <span class="badge badge-outline border-white/10 text-[10px] md:text-xs uppercase tracking-[0.3em] text-base-content/50">Camera core</span>
  </summary>
  <div class="px-4 pb-4">
    <div class="overflow-hidden rounded-xl border border-white/10 bg-neutral/10">
      <div class="aspect-video w-full overflow-hidden">
        {#if session.streamThumbnailUrl}
          <img src={session.streamThumbnailUrl} alt={`Camera preview for ${session.roomName}`} class="h-full w-full object-cover" />
        {:else}
          <div class="flex h-full items-center justify-center text-xs md:text-sm text-base-content/60">
            Camera stream preview unavailable
          </div>
        {/if}
      </div>
    </div>
  </div>
</details>
