<svelte:options runes={true} />

<script lang="ts">
  import { onDestroy } from 'svelte';

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

  // Single $effect to handle both initial playback AND src changes
  $effect(() => {
    if (audioElement && src) {
      console.log('[RoomAudio] Playing audio:', src);
      audioElement.volume = volumeLevel / 100;
      audioElement.load(); // Force reload of media
      audioElement.play().catch(err => {
        console.error('[RoomAudio] Play failed:', err);
      });
    }
  });

  function handleEnded() {
    playCount++;

    if (loop) {
      if (loopCount && playCount >= loopCount) {
        if (autoDismiss && onFinish) {
          onFinish();
        }
      } else {
        audioElement?.play();
      }
    } else {
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

<!-- Hidden audio element - no visual UI -->
<audio
  bind:this={audioElement}
  {src}
  style="display: none;"
  onended={handleEnded}
  playsinline
>
  <track kind="captions" />
</audio>
