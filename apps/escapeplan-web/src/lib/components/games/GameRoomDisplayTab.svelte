<script lang="ts">
  import type { RoomDisplayConfig } from '@escapeplan/contracts';
  import AssetBrowser from '../assets/AssetBrowser.svelte';

  interface Props {
    roomDisplayConfig?: RoomDisplayConfig;
    gameSlug: string;
    onConfigChange: (config: RoomDisplayConfig | undefined) => void;
    onMarkDirty: () => void;
  }

  let {
    roomDisplayConfig = $bindable(),
    gameSlug,
    onConfigChange,
    onMarkDirty
  }: Props = $props();

  // Initialize with defaults if undefined
  $effect(() => {
    if (!roomDisplayConfig) {
      const defaultConfig: RoomDisplayConfig = {
        backgroundType: 'solid',
        backgroundOpacity: 40,
        defaultMediaScale: 90,
        showTimer: true,
        timerPosition: 'center',
        gradientDirection: 'to-b',
        textHintTextColor: '#000000',
        textHintBackgroundColor: '#FFA500',
        timerTextColor: '#FFFFFF',
        timerBackgroundColor: '#000000',
        timerOpacity: 80
      };
      onConfigChange(defaultConfig);
      roomDisplayConfig = defaultConfig;
    }
  });

  function updateConfig(updates: Partial<RoomDisplayConfig>) {
    if (!roomDisplayConfig) return;
    const updated = { ...roomDisplayConfig, ...updates };
    roomDisplayConfig = updated;
    onConfigChange(updated);
    onMarkDirty();
  }

  let config = $derived(roomDisplayConfig || {
    backgroundType: 'solid',
    backgroundOpacity: 40,
    defaultMediaScale: 90,
    showTimer: true,
    timerPosition: 'center',
    gradientDirection: 'to-b',
    textHintTextColor: '#000000',
    textHintBackgroundColor: '#FFA500',
    timerTextColor: '#FFFFFF',
    timerBackgroundColor: '#000000',
    timerOpacity: 80
  } as RoomDisplayConfig);
</script>

<div class="space-y-6">
  <!-- Background Type Section -->
  <section class="space-y-3">
    <h3 class="text-base font-semibold text-base-content">Background Type</h3>
    <div class="flex flex-wrap gap-4" role="group">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          checked={config.backgroundType === 'asset'}
          onclick={() => updateConfig({ backgroundType: 'asset' })}
          class="radio radio-primary"
        />
        <span class="label-text">Asset (Image/Video)</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          checked={config.backgroundType === 'solid'}
          onclick={() => updateConfig({ backgroundType: 'solid' })}
          class="radio radio-primary"
        />
        <span class="label-text">Solid Color</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          checked={config.backgroundType === 'gradient'}
          onclick={() => updateConfig({ backgroundType: 'gradient' })}
          class="radio radio-primary"
        />
        <span class="label-text">Gradient</span>
      </label>
    </div>
  </section>

  <!-- Asset Background Section -->
  {#if config.backgroundType === 'asset'}
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold text-base-content">Background Asset</h3>
        {#if config.backgroundAssetId}
          <button
            type="button"
            class="btn btn-xs btn-ghost text-error"
            onclick={() => updateConfig({ backgroundAssetId: undefined })}
          >
            Remove
          </button>
        {/if}
      </div>
      <p class="text-xs text-base-content/60">
        Select an image or video to display as the room background during gameplay.
      </p>
      {#if config.backgroundAssetId}
        <div class="rounded-xl border border-white/10 bg-base-100/70 p-3">
          <div class="flex items-center gap-3">
            <div class="h-16 w-16 rounded-lg bg-base-200 flex items-center justify-center">
              <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-base-content">{config.backgroundAssetId}</p>
              <p class="text-xs text-base-content/60">Background asset</p>
            </div>
          </div>
        </div>
      {/if}
      <details class="collapse collapse-arrow bg-base-200/50">
        <summary class="collapse-title text-sm font-medium">Browse existing assets</summary>
        <div class="collapse-content">
          <AssetBrowser
            gameId={gameSlug}
            assetType="room_background"
            selectedAssetId={config.backgroundAssetId}
            onSelect={(asset) => updateConfig({ backgroundAssetId: asset.id })}
          />
        </div>
      </details>
    </section>
  {/if}

  <!-- Solid Color Background Section -->
  {#if config.backgroundType === 'solid'}
    <section class="space-y-3">
      <h3 class="text-base font-semibold text-base-content">Background Color</h3>
      <div class="flex items-center gap-3">
        <input
          type="color"
          value={config.backgroundColor || '#000000'}
          oninput={(e) => updateConfig({ backgroundColor: e.currentTarget.value })}
          class="h-12 w-12 rounded-lg cursor-pointer"
        />
        <input
          type="text"
          value={config.backgroundColor || '#000000'}
          oninput={(e) => {
            const val = e.currentTarget.value.toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
              updateConfig({ backgroundColor: val || '#000000' });
            }
          }}
          placeholder="#000000"
          class="input input-bordered flex-1"
          maxlength="7"
        />
      </div>
    </section>
  {/if}

  <!-- Gradient Background Section -->
  {#if config.backgroundType === 'gradient'}
    <section class="space-y-3">
      <h3 class="text-base font-semibold text-base-content">Gradient Settings</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <!-- From Color -->
        <label class="form-control">
          <span class="label-text">From Color</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              value={config.gradientFrom || '#000000'}
              oninput={(e) => updateConfig({ gradientFrom: e.currentTarget.value })}
              class="h-10 w-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={config.gradientFrom || '#000000'}
              oninput={(e) => {
                const val = e.currentTarget.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                  updateConfig({ gradientFrom: val || '#000000' });
                }
              }}
              placeholder="#000000"
              class="input input-bordered flex-1"
              maxlength="7"
            />
          </div>
        </label>

        <!-- To Color -->
        <label class="form-control">
          <span class="label-text">To Color</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              value={config.gradientTo || '#FFFFFF'}
              oninput={(e) => updateConfig({ gradientTo: e.currentTarget.value })}
              class="h-10 w-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={config.gradientTo || '#FFFFFF'}
              oninput={(e) => {
                const val = e.currentTarget.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                  updateConfig({ gradientTo: val || '#FFFFFF' });
                }
              }}
              placeholder="#FFFFFF"
              class="input input-bordered flex-1"
              maxlength="7"
            />
          </div>
        </label>
      </div>

      <!-- Gradient Direction -->
      <label class="form-control">
        <span class="label-text">Direction</span>
        <select
          class="select select-bordered"
          value={config.gradientDirection || 'to-b'}
          onchange={(e) => updateConfig({ gradientDirection: e.currentTarget.value as RoomDisplayConfig['gradientDirection'] })}
        >
          <option value="to-b">Top to Bottom</option>
          <option value="to-t">Bottom to Top</option>
          <option value="to-r">Left to Right</option>
          <option value="to-l">Right to Left</option>
          <option value="to-br">Top-Left to Bottom-Right</option>
          <option value="to-tl">Bottom-Right to Top-Left</option>
          <option value="radial">Radial (Center)</option>
        </select>
      </label>
    </section>
  {/if}

  <!-- Background Opacity -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-base-content">Background Opacity</h3>
      <span class="text-sm text-base-content/60">{config.backgroundOpacity}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={config.backgroundOpacity}
      oninput={(e) => updateConfig({ backgroundOpacity: parseInt(e.currentTarget.value) })}
      class="range range-primary"
    />
  </section>

  <!-- Media Scale -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-base-content">Default Media Scale</h3>
      <span class="text-sm text-base-content/60">{config.defaultMediaScale}%</span>
    </div>
    <p class="text-xs text-base-content/60">
      Controls the default size of media (images, videos) displayed on the room screen.
    </p>
    <input
      type="range"
      min="10"
      max="100"
      value={config.defaultMediaScale}
      oninput={(e) => updateConfig({ defaultMediaScale: parseInt(e.currentTarget.value) })}
      class="range range-primary"
    />
  </section>

  <!-- Timer Settings -->
  <section class="space-y-3">
    <h3 class="text-base font-semibold text-base-content">Timer Settings</h3>
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          checked={config.showTimer}
          onchange={(e) => updateConfig({ showTimer: e.currentTarget.checked })}
          class="checkbox checkbox-primary"
        />
        <span class="label-text">Show timer on room display</span>
      </label>
    </div>

    {#if config.showTimer}
      <label class="form-control">
        <span class="label-text">Timer Position</span>
        <select
          class="select select-bordered"
          value={config.timerPosition}
          onchange={(e) => updateConfig({ timerPosition: e.currentTarget.value as RoomDisplayConfig['timerPosition'] })}
        >
          <option value="center">Center</option>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </label>

      <!-- Timer Colors -->
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Timer Text Color -->
        <label class="form-control">
          <span class="label-text">Timer Text Color</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              value={config.timerTextColor || '#FFFFFF'}
              oninput={(e) => updateConfig({ timerTextColor: e.currentTarget.value })}
              class="h-10 w-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={config.timerTextColor || '#FFFFFF'}
              oninput={(e) => {
                const val = e.currentTarget.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                  updateConfig({ timerTextColor: val || '#FFFFFF' });
                }
              }}
              placeholder="#FFFFFF"
              class="input input-bordered flex-1"
              maxlength="7"
            />
          </div>
        </label>

        <!-- Timer Background Color -->
        <label class="form-control">
          <span class="label-text">Timer Background Color</span>
          <div class="flex items-center gap-2">
            <input
              type="color"
              value={config.timerBackgroundColor || '#000000'}
              oninput={(e) => updateConfig({ timerBackgroundColor: e.currentTarget.value })}
              class="h-10 w-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={config.timerBackgroundColor || '#000000'}
              oninput={(e) => {
                const val = e.currentTarget.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                  updateConfig({ timerBackgroundColor: val || '#000000' });
                }
              }}
              placeholder="#000000"
              class="input input-bordered flex-1"
              maxlength="7"
            />
          </div>
        </label>
      </div>

      <!-- Timer Opacity -->
      <label class="form-control">
        <div class="flex items-center justify-between">
          <span class="label-text">Timer Background Opacity</span>
          <span class="text-sm text-base-content/60">{config.timerOpacity || 80}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={config.timerOpacity || 80}
          oninput={(e) => updateConfig({ timerOpacity: parseInt(e.currentTarget.value) })}
          class="range range-primary"
        />
      </label>

      <!-- Timer Preview -->
      <div class="rounded-lg border border-white/10 bg-base-200/50 p-4">
        <p class="text-xs text-base-content/60 mb-2">Timer Preview:</p>
        <div
          class="inline-block rounded-2xl border border-white/20 px-8 py-4 font-display font-bold text-4xl shadow-lg"
          style="color: {config.timerTextColor || '#FFFFFF'}; background-color: {config.timerBackgroundColor || '#000000'}; opacity: {(config.timerOpacity || 80) / 100};"
        >
          45:00
        </div>
      </div>
    {/if}
  </section>

  <!-- Text Hint Styling -->
  <section class="space-y-3">
    <h3 class="text-base font-semibold text-base-content">Text Hint Styling</h3>
    <p class="text-xs text-base-content/60">
      Customize how text hints appear on the room display screen.
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <!-- Text Color -->
      <label class="form-control">
        <span class="label-text">Text Color</span>
        <div class="flex items-center gap-2">
          <input
            type="color"
            value={config.textHintTextColor}
            oninput={(e) => updateConfig({ textHintTextColor: e.currentTarget.value })}
            class="h-10 w-10 rounded cursor-pointer"
          />
          <input
            type="text"
            value={config.textHintTextColor}
            oninput={(e) => {
              const val = e.currentTarget.value.toUpperCase();
              if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                updateConfig({ textHintTextColor: val || '#000000' });
              }
            }}
            placeholder="#000000"
            class="input input-bordered flex-1"
            maxlength="7"
          />
        </div>
      </label>

      <!-- Background Color -->
      <label class="form-control">
        <span class="label-text">Background Color</span>
        <div class="flex items-center gap-2">
          <input
            type="color"
            value={config.textHintBackgroundColor}
            oninput={(e) => updateConfig({ textHintBackgroundColor: e.currentTarget.value })}
            class="h-10 w-10 rounded cursor-pointer"
          />
          <input
            type="text"
            value={config.textHintBackgroundColor}
            oninput={(e) => {
              const val = e.currentTarget.value.toUpperCase();
              if (/^#[0-9A-F]{6}$/.test(val) || val === '') {
                updateConfig({ textHintBackgroundColor: val || '#FFA500' });
              }
            }}
            placeholder="#FFA500"
            class="input input-bordered flex-1"
            maxlength="7"
          />
        </div>
      </label>
    </div>

    <!-- Preview -->
    <div class="rounded-lg border border-white/10 bg-base-200/50 p-4">
      <p class="text-xs text-base-content/60 mb-2">Preview:</p>
      <div
        class="inline-block rounded px-4 py-2 font-semibold"
        style="color: {config.textHintTextColor}; background-color: {config.textHintBackgroundColor};"
      >
        Sample Hint Text
      </div>
    </div>
  </section>
</div>
