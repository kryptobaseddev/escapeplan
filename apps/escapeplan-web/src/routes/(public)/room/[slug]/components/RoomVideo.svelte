<svelte:options runes={true} />

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface VideoProps {
    src: string;
    volumeLevel?: number;
    loop?: boolean;
    loopCount?: number;
    autoDismiss?: boolean;
    scale?: number; // 10-100, default 90
    onFinish?: () => void;
  }

  let { src, volumeLevel = 80, loop = false, loopCount, autoDismiss = true, scale = 90, onFinish }: VideoProps = $props();

  let videoElement: HTMLVideoElement | null = $state(null);
  let playCount = $state(0);
  let error = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = $state(null);

  onMount(() => {
    if (videoElement) {
      console.log('[RoomVideo] Playing video:', src);
      videoElement.volume = volumeLevel / 100;
      videoElement.play().catch((err) => {
        console.error('[RoomVideo] Play failed:', err);
        error = 'Failed to play video';
        // Auto-dismiss after error if configured
        if (autoDismiss && onFinish) {
          errorTimer = setTimeout(() => onFinish(), 3000);
        }
      });
    }
  });

  function handleVideoError(e: Event): void {
    console.error('[RoomVideo] Load error:', e);
    error = 'Failed to load video file';
    // Auto-dismiss after error if configured
    if (autoDismiss && onFinish) {
      errorTimer = setTimeout(() => onFinish(), 3000);
    }
  }

  function handleEnded(): void {
    playCount++;

    // Check if we should loop
    if (loop) {
      if (loopCount && playCount >= loopCount) {
        // Reached loop limit
        if (autoDismiss && onFinish) {
          onFinish();
        }
      } else {
        // Continue looping
        videoElement?.play();
      }
    } else {
      // Single playback finished
      if (autoDismiss && onFinish) {
        onFinish();
      }
    }
  }

  function handleClick(): void {
    if (onFinish) {
      onFinish();
    }
  }

  onDestroy(() => {
    if (errorTimer) {
      clearTimeout(errorTimer);
      errorTimer = null;
    }
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
      videoElement.src = '';
      videoElement = null;
    }
  });
</script>

<div
  class="absolute inset-0 z-30 flex items-center justify-center bg-black/90"
  role="dialog"
  aria-label="Video display"
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
      <video
        bind:this={videoElement}
        {src}
        class="h-full w-full object-contain"
        onended={handleEnded}
        onerror={handleVideoError}
        playsinline
      >
        <track kind="captions" />
      </video>

      <!-- Dismiss hint at bottom -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p class="text-xs text-white/60">
          {autoDismiss ? (loop && !loopCount ? 'Looping - Click to dismiss' : `Playing ${playCount + 1}${loopCount ? `/${loopCount}` : ''}`) : 'Click anywhere to dismiss'}
        </p>
      </div>
    {/if}
  </div>
</div>
