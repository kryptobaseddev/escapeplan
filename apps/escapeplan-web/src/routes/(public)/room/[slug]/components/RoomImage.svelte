<svelte:options runes={true} />

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface ImageProps {
    src: string;
    displayDuration?: number; // seconds
    autoDismiss?: boolean;
    scale?: number; // 10-100, default 90
    onDismiss?: () => void;
  }

  let { src, displayDuration = 15, autoDismiss = true, scale = 90, onDismiss }: ImageProps = $props();

  let timer: ReturnType<typeof setTimeout> | null = $state(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = $state(null);
  let error = $state<string | null>(null);

  onMount(() => {
    if (autoDismiss && displayDuration && onDismiss) {
      timer = setTimeout(() => {
        onDismiss();
      }, displayDuration * 1000);
    }
  });

  function handleImageError() {
    error = 'Failed to load image';
    console.error('Image load error:', src);
    // Auto-dismiss after error if configured
    if (autoDismiss && onDismiss) {
      errorTimer = setTimeout(() => onDismiss(), 3000);
    }
  }

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (errorTimer) {
      clearTimeout(errorTimer);
      errorTimer = null;
    }
  });

  function handleClick() {
    if (onDismiss) {
      onDismiss();
    }
  }
</script>

<div
  class="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
  role="dialog"
  aria-label="Image display"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Escape' && handleClick()}
>
  <div class="relative" style="width: {scale}%; height: {scale}%;">
    {#if error}
      <div class="text-center p-8 bg-error/20 rounded-lg border border-error/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-error" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <p class="text-white text-lg font-semibold">{error}</p>
        <p class="text-white/60 text-sm mt-2">Dismissing in 3 seconds...</p>
      </div>
    {:else}
      <img
        src={src}
        alt="Hint image"
        class="h-full w-full object-contain"
        onerror={handleImageError}
      />

      <!-- Dismiss hint at bottom -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p class="text-xs text-white/60">
          {autoDismiss ? `Auto-dismiss in ${displayDuration}s` : 'Click anywhere to dismiss'}
        </p>
      </div>
    {/if}
  </div>
</div>
