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

  onMount(() => {
    if (audioElement) {
      audioElement.volume = volumeLevel / 100;
      audioElement.play().catch((err) => {
        console.error('Audio autoplay failed:', err);
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
        audioElement?.play();
      }
    } else {
      // Single playback finished
      if (autoDismiss && onFinish) {
        onFinish();
      }
    }
  }

  onDestroy(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
  });
</script>

<!-- Headless audio element -->
<audio bind:this={audioElement} {src} onended={handleEnded}>
  <track kind="captions" />
</audio>
