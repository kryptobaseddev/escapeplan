<svelte:options runes={true} />

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface AudioProps {
    src: string;
    volumeLevel?: number;
    loop?: boolean;
    loopCount?: number;
    autoDismiss?: boolean;
    onFinish?: () => void;
  }

  let { src, volumeLevel = 80, loop = false, loopCount, autoDismiss = true, onFinish }: AudioProps = $props();

  let audioElement: HTMLAudioElement | null = $state(null);
  let playCount = $state(0);
  let error = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = $state(null);

  onMount(() => {
    if (audioElement) {
      audioElement.volume = volumeLevel / 100;
      audioElement.play().catch((err) => {
        console.error('Audio autoplay failed:', err);
        error = 'Failed to play audio';
        // Auto-dismiss after error if configured
        if (autoDismiss && onFinish) {
          errorTimer = setTimeout(() => onFinish(), 3000);
        }
      });
    }
  });

  function handleError(e: Event) {
    console.error('Audio load error:', e);
    error = 'Failed to load audio file';
    // Auto-dismiss after error if configured
    if (autoDismiss && onFinish) {
      errorTimer = setTimeout(() => onFinish(), 3000);
    }
  }

  function handleEnded() {
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
        audioElement?.play();
      }
    } else {
      // Single playback finished
      if (autoDismiss && onFinish) {
        onFinish();
      }
    }
  }

  function handleClick() {
    if (onFinish) {
      onFinish();
    }
  }

  onDestroy(() => {
    if (errorTimer) {
      clearTimeout(errorTimer);
      errorTimer = null;
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
      audioElement = null;
    }
  });
</script>

<!-- Headless audio element -->
<audio bind:this={audioElement} {src} onended={handleEnded} onerror={handleError}>
  <track kind="captions" />
</audio>

<!-- Visual overlay (always shown to indicate audio is playing) -->
<div
  class="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
  role="dialog"
  aria-label="Audio hint playing"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Escape' && handleClick()}
>
  <div class="relative text-center">
    {#if error}
      <!-- Error state -->
      <div class="p-8 bg-error/20 rounded-lg border border-error/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-error" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <p class="text-white text-lg font-semibold">{error}</p>
        <p class="text-white/60 text-sm mt-2">Dismissing in 3 seconds...</p>
      </div>
    {:else}
      <!-- Audio playing state -->
      <div class="p-12 bg-base-300/20 rounded-lg border border-white/20 backdrop-blur-md">
        <!-- Animated audio icon -->
        <div class="mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-primary animate-pulse" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- Audio hint label -->
        <p class="text-white text-2xl font-semibold mb-4">Audio Hint</p>

        <!-- Volume indicator -->
        <div class="flex items-center justify-center gap-2 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white/60" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <span class="text-white/60 text-sm">Volume: {volumeLevel}%</span>
        </div>

        <!-- Playback status -->
        <div class="text-white/60 text-sm">
          {#if loop && !loopCount}
            <p>Looping - Click to dismiss</p>
          {:else if loop && loopCount}
            <p>Playing {playCount + 1}/{loopCount}</p>
          {:else if autoDismiss}
            <p>Will dismiss when finished</p>
          {:else}
            <p>Click anywhere to dismiss</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
