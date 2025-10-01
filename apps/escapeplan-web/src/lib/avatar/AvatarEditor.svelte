<svelte:options runes={true} />

<script lang="ts">
  import Avatar from './Avatar.svelte';
  import type { BotttsAvatarConfig } from '@escapeplan/contracts';
  import { randomizeAvatarConfig } from './avatar-utils';

  interface Props {
    config: BotttsAvatarConfig;
    onUpdate: (config: BotttsAvatarConfig) => void;
  }

  let { config = $bindable(), onUpdate }: Props = $props();

  // Active tab state - each feature gets its own tab
  let activeTab = $state<'background' | 'baseColor' | 'eyes' | 'face' | 'mouth' | 'sides' | 'texture' | 'top'>('background');

  // Bottts options
  const backgroundTypes = ['solid', 'gradientLinear'];

  // Expanded color palettes
  const backgroundColors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'ffe5e5',
    'a8e6cf', 'ffd3b6', 'ffaaa5', 'ff8b94', '88d8b0', 'c7ceea',
    'ff6f61', '6a0572', 'f39c12', 'e74c3c', '6c757d', '495057'
  ];

  const baseColors = [
    'ffb300', '1e88e5', '546e7a', '6d4c41', '00acc1',
    'f4511e', '5e35b1', '43a047', '757575', '3949ab',
    '039be5', '7cb342', 'c0ca33', 'fb8c00', 'd81b60',
    '8e24aa', 'e53935', '00897b', 'fdd835'
  ];

  const eyesOptions = ['bulging', 'dizzy', 'eva', 'frame1', 'frame2', 'glow', 'happy', 'hearts', 'robocop', 'round', 'roundFrame01', 'roundFrame02', 'sensor', 'shade01'];
  const faceOptions = ['round01', 'round02', 'square01', 'square02', 'square03', 'square04'];
  const mouthOptions = ['bite', 'diagram', 'grill01', 'grill02', 'grill03', 'smile01', 'smile02', 'square01', 'square02'];
  const sidesOptions = ['antenna01', 'antenna02', 'cables01', 'cables02', 'round', 'square', 'squareAssymetric'];
  const textureOptions = ['camo01', 'camo02', 'circuits', 'dirty01', 'dirty02', 'dots', 'grunge01', 'grunge02'];
  const topOptions = ['antenna', 'antennaCrooked', 'bulb01', 'glowingBulb01', 'glowingBulb02', 'horns', 'lights', 'pyramid', 'radar'];

  // Custom color states
  let customBackgroundColor = $state('#ffffff');
  let customBaseColor = $state('#000000');

  function updateConfig(key: keyof BotttsAvatarConfig, value: string[]) {
    const updated = { ...config, [key]: value };
    config = updated;
    onUpdate(updated);
  }

  function toggleOption(key: keyof BotttsAvatarConfig, value: string) {
    const current = (config[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateConfig(key, updated);
  }

  function isSelected(key: keyof BotttsAvatarConfig, value: string): boolean {
    const current = (config[key] as string[]) || [];
    return current.includes(value);
  }

  function setCustomBackgroundColor() {
    const hexColor = customBackgroundColor.replace('#', '');
    updateConfig('backgroundColor', [hexColor]);
  }

  function setCustomBaseColor() {
    const hexColor = customBaseColor.replace('#', '');
    updateConfig('baseColor', [hexColor]);
  }

  function randomizeAll() {
    const randomized = randomizeAvatarConfig();
    config = randomized;
    onUpdate(randomized);
  }
</script>

<div class="avatar-editor glass-panel p-6">
  <!-- Preview Section -->
  <div class="preview-section mb-6 flex flex-col items-center gap-4">
    <Avatar config={config} size={128} class="rounded-2xl bg-base-300/50 p-4" />
    <button
      type="button"
      class="btn btn-sm btn-outline"
      onclick={randomizeAll}
    >
      🎲 Randomize
    </button>
  </div>

  <!-- Tabs Navigation - Each feature gets its own tab -->
  <div role="tablist" class="tabs tabs-boxed mb-6">
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'background' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'background'}
    >
      Background
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'baseColor' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'baseColor'}
    >
      Base Color
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'eyes' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'eyes'}
    >
      Eyes
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'face' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'face'}
    >
      Face
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'mouth' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'mouth'}
    >
      Mouth
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'sides' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'sides'}
    >
      Sides
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'texture' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'texture'}
    >
      Texture
    </button>
    <button
      type="button"
      role="tab"
      class="tab {activeTab === 'top' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'top'}
    >
      Top
    </button>
  </div>

  <!-- Debug info -->
  <div class="mb-4 text-xs text-base-content/60">
    Active Tab: {activeTab} | Eyes Options: {eyesOptions.length} | Face Options: {faceOptions.length}
  </div>

  <!-- Tab Content - Each tab shows only its specific options -->
  <div class="tab-content min-h-[300px] border border-primary/20 p-4 rounded-lg bg-base-100">
    <!-- Background Tab -->
    {#if activeTab === 'background'}
      <div class="space-y-6">
        <!-- Background Type -->
        <div class="config-section">
          <h4 class="mb-3 text-sm font-semibold text-base-content">Background Type ({backgroundTypes.length} options)</h4>
          <div class="options-grid">
            {#each backgroundTypes as option}
              <button
                type="button"
                class="option-btn {isSelected('backgroundType', option) ? 'selected' : ''}"
                onclick={() => toggleOption('backgroundType', option)}
              >
                {option}
              </button>
            {/each}
          </div>
        </div>

        <!-- Background Color -->
        <div class="config-section">
          <h4 class="mb-3 text-sm font-semibold text-base-content">Background Color ({backgroundColors.length} options)</h4>
          <div class="color-grid">
            {#each backgroundColors as color}
              <button
                type="button"
                class="color-btn {isSelected('backgroundColor', color) ? 'selected' : ''}"
                style="background-color: #{color};"
                onclick={() => toggleOption('backgroundColor', color)}
                aria-label="Color {color}"
              >
                {#if isSelected('backgroundColor', color)}
                  <span class="checkmark">✓</span>
                {/if}
              </button>
            {/each}
            <!-- Custom Color Picker -->
            <div class="custom-color-picker">
              <input
                type="color"
                bind:value={customBackgroundColor}
                onchange={setCustomBackgroundColor}
                class="sr-only"
                id="custom-bg-picker"
              />
              <label for="custom-bg-picker" class="color-btn custom-picker" title="Choose custom color">
                <span class="picker-icon" aria-hidden="true">🎨</span>
                <span class="sr-only">Choose custom background color</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    {:else if activeTab === 'baseColor'}
      <!-- Base Color Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Base Color ({baseColors.length} options)</h4>
        <div class="color-grid">
          {#each baseColors as color}
            <button
              type="button"
              class="color-btn {isSelected('baseColor', color) ? 'selected' : ''}"
              style="background-color: #{color};"
              onclick={() => toggleOption('baseColor', color)}
              aria-label="Color {color}"
            >
              {#if isSelected('baseColor', color)}
                <span class="checkmark">✓</span>
              {/if}
            </button>
          {/each}
          <!-- Custom Color Picker -->
          <div class="custom-color-picker">
            <input
              type="color"
              bind:value={customBaseColor}
              onchange={setCustomBaseColor}
              class="sr-only"
              id="custom-base-picker"
            />
            <label for="custom-base-picker" class="color-btn custom-picker" title="Choose custom color">
              <span class="picker-icon" aria-hidden="true">🎨</span>
              <span class="sr-only">Choose custom base color</span>
            </label>
          </div>
        </div>
      </div>
    {:else if activeTab === 'eyes'}
      <!-- Eyes Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Eyes ({eyesOptions.length} options)</h4>
        <div class="options-grid">
          {#each eyesOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('eyes', option) ? 'selected' : ''}"
              onclick={() => toggleOption('eyes', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'face'}
      <!-- Face Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Face ({faceOptions.length} options)</h4>
        <div class="options-grid">
          {#each faceOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('face', option) ? 'selected' : ''}"
              onclick={() => toggleOption('face', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'mouth'}
      <!-- Mouth Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Mouth ({mouthOptions.length} options)</h4>
        <div class="options-grid">
          {#each mouthOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('mouth', option) ? 'selected' : ''}"
              onclick={() => toggleOption('mouth', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'sides'}
      <!-- Sides Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Sides ({sidesOptions.length} options)</h4>
        <div class="options-grid">
          {#each sidesOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('sides', option) ? 'selected' : ''}"
              onclick={() => toggleOption('sides', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'texture'}
      <!-- Texture Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Texture ({textureOptions.length} options)</h4>
        <div class="options-grid">
          {#each textureOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('texture', option) ? 'selected' : ''}"
              onclick={() => toggleOption('texture', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'top'}
      <!-- Top Tab -->
      <div class="config-section">
        <h4 class="mb-3 text-sm font-semibold text-base-content">Top ({topOptions.length} options)</h4>
        <div class="options-grid">
          {#each topOptions as option}
            <button
              type="button"
              class="option-btn {isSelected('top', option) ? 'selected' : ''}"
              onclick={() => toggleOption('top', option)}
            >
              {option}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .tabs-boxed {
    background: var(--fallback-b2,oklch(var(--b2)/1));
  }

  .tab {
    font-size: 0.875rem;
  }

  .options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 0.75rem;
  }

  .option-btn {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--fallback-bc,oklch(var(--bc)/0.2));
    background: var(--fallback-b2,oklch(var(--b2)/1));
    color: var(--fallback-bc,oklch(var(--bc)/1));
    font-size: 0.75rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .option-btn:hover {
    background: var(--fallback-b3,oklch(var(--b3)/1));
    border-color: var(--fallback-p,oklch(var(--p)/1));
  }

  .option-btn.selected {
    background: var(--fallback-p,oklch(var(--p)/1));
    color: var(--fallback-pc,oklch(var(--pc)/1));
    border-color: var(--fallback-p,oklch(var(--p)/1));
    font-weight: 600;
  }

  .color-btn {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    border: 2px solid var(--fallback-bc,oklch(var(--bc)/0.2));
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-btn:hover {
    transform: scale(1.1);
    border-color: var(--fallback-p,oklch(var(--p)/1));
  }

  .color-btn.selected {
    border-color: var(--fallback-p,oklch(var(--p)/1));
    border-width: 3px;
    box-shadow: 0 0 0 2px var(--fallback-b1,oklch(var(--b1)/1)), 0 0 0 4px var(--fallback-p,oklch(var(--p)/1));
  }

  .custom-picker {
    background: linear-gradient(135deg,
      #ff0000 0%, #ff7f00 16.67%, #ffff00 33.33%,
      #00ff00 50%, #0000ff 66.67%, #4b0082 83.33%, #9400d3 100%);
    border: 2px solid var(--fallback-bc,oklch(var(--bc)/0.3));
  }

  .custom-picker:hover {
    border-color: var(--fallback-p,oklch(var(--p)/1));
    box-shadow: 0 0 0 2px var(--fallback-b1,oklch(var(--b1)/1)), 0 0 0 4px var(--fallback-p,oklch(var(--p)/1));
  }

  .picker-icon {
    font-size: 1.5rem;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .checkmark {
    color: white;
    font-weight: bold;
    font-size: 1.25rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .config-section {
    padding-bottom: 1rem;
  }

  .custom-color-picker {
    position: relative;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
