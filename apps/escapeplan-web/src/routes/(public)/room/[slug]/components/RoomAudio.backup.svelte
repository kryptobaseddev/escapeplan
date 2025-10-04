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

  // Watch for src changes and trigger reload
  $effect(() => {
    if (audioElement && src) {
      console.log('[RoomAudio] Source changed, reloading:', src);
      audioElement.load();
    }
  });

  function handleCanPlay() {
    if (audioElement) {
      console.log('[RoomAudio] Can play, starting playback:', src);
      audioElement.volume = volumeLevel / 100;
      audioElement.play().catch(err => {
        console.error('[RoomAudio] Play failed:', err);
      });
    }
  }

  function handleEnded() {
    playCount++;
    if (loop) {
      if (loopCount && playCount >= loopCount) {
        if (autoDismiss && onFinish) onFinish();
      } else {
        audioElement?.play();
      }
    } else {
      if (autoDismiss && onFinish) onFinish();
    }
  }

  onDestroy(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
  });
</script>

<audio
  bind:this={audioElement}
  {src}
  style="display: none;"
  oncanplay={handleCanPlay}
  onended={handleEnded}
  preload="auto"
  playsinline
>
  <track kind="captions" />
</audio>
