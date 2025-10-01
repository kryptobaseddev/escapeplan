<svelte:options runes={true} />

<script lang="ts">
  import { createAvatar } from '@dicebear/core';
  import * as bottts from '@dicebear/bottts';
  import type { BotttsAvatarConfig } from '@escapeplan/contracts';

  interface Props {
    config?: BotttsAvatarConfig;
    username?: string;
    size?: number;
    class?: string;
  }

  let { config, username = 'user', size = 48, class: className = '' }: Props = $props();

  // Generate data URI from config or default seed
  const avatarDataUri = $derived.by(() => {
    const seed = config?.seed || username;
    const options: any = { seed, size };

    // Apply config options if provided
    if (config) {
      if (config.backgroundType) options.backgroundType = config.backgroundType;
      if (config.backgroundColor) options.backgroundColor = config.backgroundColor;
      if (config.baseColor) options.baseColor = config.baseColor;
      if (config.eyes) options.eyes = config.eyes;
      if (config.face) options.face = config.face;
      if (config.mouth) options.mouth = config.mouth;
      if (config.sides) options.sides = config.sides;
      if (config.texture) options.texture = config.texture;
      if (config.top) options.top = config.top;
    }

    const avatar = createAvatar(bottts, options);
    return avatar.toDataUri();
  });
</script>

<img
  src={avatarDataUri}
  alt="User avatar"
  class="avatar-container {className}"
  style="width: {size}px; height: {size}px;"
/>

<style>
  .avatar-container {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
