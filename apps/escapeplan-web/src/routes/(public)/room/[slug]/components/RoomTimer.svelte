<svelte:options runes={true} />

<script lang="ts">
  import type { TimerState } from '@escapeplan/contracts';
  import { formatTimer } from '$lib/utils/datetime';

  interface TimerProps {
    timer: TimerState;
    gameName: string;
    sessionId: string;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    textColor?: string;
    backgroundColor?: string;
    opacity?: number;
  }

  let { timer, gameName, sessionId, position = 'center', textColor = '#FFFFFF', backgroundColor = '#000000', opacity = 80 }: TimerProps = $props();

  const positionClasses = $derived(() => {
    switch (position) {
      case 'top-left':
        return 'top-8 left-8 items-start';
      case 'top-right':
        return 'top-8 right-8 items-end';
      case 'bottom-left':
        return 'bottom-8 left-8 items-start';
      case 'bottom-right':
        return 'bottom-8 right-8 items-end';
      case 'center':
      default:
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center';
    }
  });

  // Convert hex to RGB for opacity application
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `${r}, ${g}, ${b}`;
    }
    return '0, 0, 0';
  };

  const bgColorRgb = $derived(hexToRgb(backgroundColor));
  const bgOpacityValue = $derived(opacity / 100);
</script>

<div class="absolute flex flex-col gap-8 px-6 {positionClasses()}" style="z-index: 10;">
  <div
    class="rounded-[3rem] border border-white/20 px-16 py-8 shadow-2xl shadow-black/50 backdrop-blur-sm"
    style="background-color: rgba({bgColorRgb}, {bgOpacityValue});"
  >
    <span
      class="text-7xl font-display font-bold drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
      style="color: {textColor};"
    >
      {formatTimer(timer.remainingSeconds)}
    </span>
  </div>

  <!-- Game info badge (only show in non-center positions) -->
  {#if position !== 'center'}
    <div class="text-{position.includes('right') ? 'right' : 'left'}">
      <p class="text-sm font-semibold text-white/90 drop-shadow-md">{gameName}</p>
      <p class="text-xs text-white/50">{sessionId}</p>
    </div>
  {/if}
</div>

{#if position === 'center'}
  <!-- Game info at bottom right when timer is centered -->
  <div class="absolute bottom-6 right-6 z-10 text-right">
    <p class="text-sm font-semibold text-white/90 drop-shadow-md">{gameName}</p>
    <p class="text-xs text-white/50">{sessionId}</p>
  </div>
{/if}
