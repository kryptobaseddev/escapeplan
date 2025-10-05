<svelte:options runes={true} />

<script lang="ts">
  import type { RoomDisplayConfig } from '@escapeplan/contracts';

  interface BackgroundProps {
    background: { type: 'image' | 'video'; url: string };
    config?: RoomDisplayConfig;
  }

  let { background, config }: BackgroundProps = $props();

  const GRADIENT_DIRECTION_MAP = {
    'to-b': 'to bottom',
    'to-t': 'to top',
    'to-r': 'to right',
    'to-l': 'to left',
    'to-br': 'to bottom right',
    'to-tl': 'to top left',
    'radial': 'circle'
  } as const;

  const opacity = $derived((config?.backgroundOpacity ?? 40) / 100);

  const bgStyle = $derived(() => {
    if (config?.backgroundType === 'solid' && config.backgroundColor) {
      return `background-color: ${config.backgroundColor}; opacity: ${opacity};`;
    }
    if (config?.backgroundType === 'gradient' && config.gradientFrom && config.gradientTo) {
      const rawDirection = config.gradientDirection ?? 'to-b';
      const cssDirection = GRADIENT_DIRECTION_MAP[rawDirection as keyof typeof GRADIENT_DIRECTION_MAP] ?? 'to bottom';
      const gradientType = cssDirection === 'circle' ? 'radial-gradient' : 'linear-gradient';
      const gradientDirection = cssDirection === 'circle' ? cssDirection : cssDirection;
      return `background-image: ${gradientType}(${gradientDirection}, ${config.gradientFrom}, ${config.gradientTo}); opacity: ${opacity};`;
    }
    return '';
  });
</script>

<div class="absolute inset-0" style="z-index: 0;">
  {#if config?.backgroundType === 'asset' && background.url}
    {#if background.type === 'video'}
      <video
        class="h-full w-full object-cover"
        style="opacity: {opacity};"
        src={background.url}
        autoplay
        muted
        loop
        playsinline
      ></video>
    {:else}
      <img
        class="h-full w-full object-cover"
        style="opacity: {opacity};"
        src={background.url}
        alt="Room background"
      />
    {/if}
  {:else if config?.backgroundType === 'solid' || config?.backgroundType === 'gradient'}
    <div class="h-full w-full" style={bgStyle()}></div>
  {:else}
    <!-- Default fallback: asset with default opacity -->
    {#if background.type === 'video'}
      <video
        class="h-full w-full object-cover"
        style="opacity: {opacity};"
        src={background.url}
        autoplay
        muted
        loop
        playsinline
      ></video>
    {:else}
      <img
        class="h-full w-full object-cover"
        style="opacity: {opacity};"
        src={background.url}
        alt="Room background"
      />
    {/if}
  {/if}

  <!-- Readability overlay for low opacity backgrounds -->
  {#if (config?.backgroundOpacity ?? 40) < 50}
    <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/30"></div>
  {/if}
</div>
