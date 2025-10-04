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

  onMount(() => {
    if (videoElement) {
      videoElement.volume = volumeLevel / 100;
      videoElement.play().catch((err) => {
        console.error('Video autoplay failed:', err);
      });
    }
  });

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
        videoElement?.play();
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
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
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
    <video
      bind:this={videoElement}
      {src}
      class="h-full w-full object-contain"
      onended={handleEnded}
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
  </div>
</div>
