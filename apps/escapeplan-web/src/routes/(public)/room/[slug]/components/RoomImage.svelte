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

  onMount(() => {
    if (autoDismiss && displayDuration && onDismiss) {
      timer = setTimeout(() => {
        onDismiss();
      }, displayDuration * 1000);
    }
  });

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
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
    <img
      src={src}
      alt="Hint image"
      class="h-full w-full object-contain"
    />

    <!-- Dismiss hint at bottom -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
      <p class="text-xs text-white/60">
        {autoDismiss ? `Auto-dismiss in ${displayDuration}s` : 'Click anywhere to dismiss'}
      </p>
    </div>
  </div>
</div>
