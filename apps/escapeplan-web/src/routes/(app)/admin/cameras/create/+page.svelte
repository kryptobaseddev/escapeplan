<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type {
    CameraBrand,
    CameraProtocol,
    CameraResolution,
    CameraTransport,
    CameraTemplate
  } from '@escapeplan/contracts';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const protocolOptions: CameraProtocol[] = ['rtsp', 'mjpeg', 'onvif'];
  const resolutionOptions: CameraResolution[] = ['480p', '720p', '1080p', 'native'];
  const transportOptions: CameraTransport[] = ['tcp', 'udp', 'http'];
  const irModeOptions = ['auto', 'on', 'off'] as const;

  let errorMessage = $state<string | null>(null);
  let testResult = $state<{ success: boolean; errorMessage?: string; diagnostics?: any } | null>(null);
  let isTesting = $state(false);
  let isSubmitting = $state(false);

  // Brand/Model/Template selection
  let selectedBrand = $state<CameraBrand>('generic');
  let selectedTemplateId = $state<string>('');
  let availableTemplatesForBrand = $derived<CameraTemplate[]>(
    selectedBrand === 'generic'
      ? data.templates.templates.filter((t) => t.brand === 'generic')
      : data.templates.templates.filter((t) => t.brand === selectedBrand)
  );

  // Form fields
  let nameValue = $state('');
  let modelValue = $state('');
  let protocolValue = $state<CameraProtocol>('rtsp');
  let hostValue = $state('');
  let portValue = $state(554);
  let usernameValue = $state('');
  let passwordValue = $state('');
  let mainStreamPathValue = $state('');
  let subStreamPathValue = $state('');
  let resolutionValue = $state<CameraResolution>('720p');
  let frameRateValue = $state(15);
  let transportValue = $state<CameraTransport>('tcp');
  let gameIdValue = $state<string>('');

  // Camera capabilities
  let hasPtzValue = $state(false);
  let hasAudioValue = $state(false);
  let hasIrControlValue = $state(false);

  // Feature settings
  let irModeValue = $state<'auto' | 'on' | 'off'>('auto');
  let audioVolumeValue = $state(50);

  function applyTemplate(template: CameraTemplate | undefined) {
    if (!template) return;

    // Apply network settings
    portValue = template.defaultPort;
    protocolValue = template.protocol as CameraProtocol;
    mainStreamPathValue = template.mainStreamPath || '';
    subStreamPathValue = template.subStreamPath || '';
    transportValue = template.recommendedSettings.transport as CameraTransport;

    // Apply capabilities
    hasPtzValue = template.hasPtz;
    hasAudioValue = template.hasAudio;
    hasIrControlValue = template.hasIr || false;

    // Apply model if not already set
    if (!modelValue) {
      modelValue = template.model;
    }

    // Apply recommended settings
    frameRateValue = template.recommendedSettings.mainFps || 15;

    console.log('[Camera Create] Applied template:', template.id);
  }

  function handleBrandChange() {
    selectedTemplateId = '';
    modelValue = '';
    // Reset to brand defaults
    const brandDefaults = data.templates.brandDefaults?.[selectedBrand];
    if (brandDefaults) {
      portValue = brandDefaults.defaultPort || 554;
      protocolValue = brandDefaults.protocol as CameraProtocol;
      transportValue = brandDefaults.transport as CameraTransport;
    }
  }

  function handleTemplateChange() {
    const template = data.templates.templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      applyTemplate(template);
    }
  }

  function handleProtocolChange() {
    if (protocolValue === 'rtsp') {
      if (!selectedTemplateId) portValue = 554;
    } else if (protocolValue === 'mjpeg') {
      portValue = 80;
    } else if (protocolValue === 'onvif') {
      portValue = 554;
    }
  }

  const handleTestConnection = createFormHandler({
    onSubmit: () => {
      isTesting = true;
      errorMessage = null;
      testResult = null;
    },
    onSuccess: (result) => {
      isTesting = false;
      const successData = result.data as { testResult?: any } | undefined;
      testResult = successData?.testResult ?? null;
    },
    onError: (result) => {
      isTesting = false;
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Test failed. Please try again.';
      testResult = null;
    }
  });

  const handleSubmit = createFormHandler({
    onSubmit: () => {
      isSubmitting = true;
      errorMessage = null;
    },
    onSuccess: async () => {
      // Redirect handled by server-side action
    },
    onError: (result) => {
      isSubmitting = false;
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please try again.';
    },
    onFinally: () => {
      isSubmitting = false;
    }
  });

  function handleCancel() {
    goto('/admin/cameras');
  }
</script>

<div class="flex flex-col h-screen">
  <!-- Header -->
  <header class="sticky top-0 z-10 bg-base-100 border-b border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-base-content">Add Camera</h1>
          <p class="text-sm text-base-content/60">Select a camera brand/model or configure manually.</p>
        </div>
      </div>

      {#if errorMessage}
        <Alert type="error" class="mb-4">
          {errorMessage}
        </Alert>
      {/if}

      {#if testResult}
        <Alert type={testResult.success ? 'success' : 'warning'} class="mb-4">
          {#if testResult.success}
            <div>
              <p class="font-semibold">✓ Connection successful!</p>
              {#if testResult.diagnostics?.resolution}
                <p class="text-sm mt-1">
                  Resolution: {testResult.diagnostics.resolution} @ {testResult.diagnostics.frameRate}fps
                </p>
              {/if}
            </div>
          {:else}
            <div>
              <p class="font-semibold">✗ Connection failed</p>
              <p class="text-sm mt-1">{testResult.errorMessage ?? 'Unknown error'}</p>
              {#if testResult.diagnostics}
                <p class="text-xs mt-1">
                  {testResult.diagnostics.reachable ? '✓' : '✗'} Reachable •
                  {testResult.diagnostics.authValid ? '✓' : '✗'} Auth •
                  {testResult.diagnostics.streamAvailable ? '✓' : '✗'} Stream
                </p>
              {/if}
            </div>
          {/if}
        </Alert>
      {/if}
    </div>
  </header>

  <!-- Scrollable content area -->
  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <!-- Test Connection Form -->
      <form method="POST" action="?/testConnection" use:enhance={handleTestConnection} class="mb-6">
        <div class="space-y-6">
          <!-- Camera Name -->
          <label class="form-control">
            <span class="label-text">Camera Name <span class="text-error">*</span></span>
            <input
              type="text"
              name="name"
              class="input input-bordered"
              bind:value={nameValue}
              required
              minlength="3"
              placeholder="Main Entrance Camera"
            />
            <span class="label-text-alt">Enter a descriptive name (minimum 3 characters)</span>
          </label>

          <!-- Brand & Model Selection -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Camera Brand & Model</h3>
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control">
                <span class="label-text">Brand <span class="text-error">*</span></span>
                <select
                  name="brand"
                  class="select select-bordered"
                  bind:value={selectedBrand}
                  onchange={handleBrandChange}
                  required
                >
                  <option value="reolink">Reolink</option>
                  <option value="hikvision">Hikvision</option>
                  <option value="dahua">Dahua</option>
                  <option value="amcrest">Amcrest</option>
                  <option value="axis">Axis</option>
                  <option value="tapo">TP-Link Tapo</option>
                  <option value="tplink">TP-Link VIGI</option>
                  <option value="foscam">Foscam</option>
                  <option value="generic">Generic/Other</option>
                </select>
              </label>

              <label class="form-control">
                <span class="label-text">Model Template</span>
                <select
                  class="select select-bordered"
                  bind:value={selectedTemplateId}
                  onchange={handleTemplateChange}
                >
                  <option value="">Select model...</option>
                  {#each availableTemplatesForBrand as template}
                    <option value={template.id}>{template.displayName}</option>
                  {/each}
                </select>
                <span class="label-text-alt">Auto-fills connection settings</span>
              </label>
            </div>

            {#if selectedTemplateId}
              {@const template = data.templates.templates.find((t) => t.id === selectedTemplateId)}
              {#if template?.notes}
                <div class="bg-info/10 border border-info/30 rounded p-3 text-sm text-info-content">
                  <p class="font-semibold mb-1">📝 Template Notes:</p>
                  <p>{template.notes}</p>
                </div>
              {/if}
            {/if}

            <label class="form-control">
              <span class="label-text">Model Name (Optional)</span>
              <input
                type="text"
                name="model"
                class="input input-bordered"
                bind:value={modelValue}
                placeholder="RLC-810A"
              />
              <span class="label-text-alt">Specific model number for your records</span>
            </label>
          </div>

          <!-- Network Configuration -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Network Configuration</h3>
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control">
                <span class="label-text">Protocol <span class="text-error">*</span></span>
                <select
                  name="protocol"
                  class="select select-bordered"
                  bind:value={protocolValue}
                  onchange={handleProtocolChange}
                  required
                >
                  {#each protocolOptions as protocol}
                    <option value={protocol}>{protocol.toUpperCase()}</option>
                  {/each}
                </select>
              </label>

              <label class="form-control">
                <span class="label-text">Transport</span>
                <select
                  name="transport"
                  class="select select-bordered"
                  bind:value={transportValue}
                >
                  {#each transportOptions as transport}
                    <option value={transport}>{transport.toUpperCase()}</option>
                  {/each}
                </select>
              </label>

              <label class="form-control">
                <span class="label-text">IP Address <span class="text-error">*</span></span>
                <input
                  type="text"
                  name="host"
                  class="input input-bordered"
                  bind:value={hostValue}
                  required
                  placeholder="10.10.10.100"
                />
              </label>

              <label class="form-control">
                <span class="label-text">Port <span class="text-error">*</span></span>
                <input
                  type="number"
                  name="port"
                  class="input input-bordered"
                  bind:value={portValue}
                  required
                  min="1"
                  max="65535"
                />
              </label>
            </div>
          </div>

          <!-- Authentication -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Authentication (Optional)</h3>
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control">
                <span class="label-text">Username</span>
                <input
                  type="text"
                  name="username"
                  class="input input-bordered"
                  bind:value={usernameValue}
                  placeholder="admin"
                />
              </label>

              <label class="form-control">
                <span class="label-text">Password</span>
                <input
                  type="password"
                  name="password"
                  class="input input-bordered"
                  bind:value={passwordValue}
                  placeholder="••••••••"
                />
              </label>
            </div>
          </div>

          <!-- Dual Stream Configuration -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Stream Configuration</h3>
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control col-span-2">
                <span class="label-text">Main Stream Path</span>
                <input
                  type="text"
                  name="mainStreamPath"
                  class="input input-bordered"
                  bind:value={mainStreamPathValue}
                  placeholder="/Preview_01_main"
                />
                <span class="label-text-alt">High-res stream for recording</span>
              </label>

              <label class="form-control col-span-2">
                <span class="label-text">Sub Stream Path</span>
                <input
                  type="text"
                  name="subStreamPath"
                  class="input input-bordered"
                  bind:value={subStreamPathValue}
                  placeholder="/Preview_01_sub"
                />
                <span class="label-text-alt">Low-res stream for live view (saves bandwidth)</span>
              </label>

              <label class="form-control">
                <span class="label-text">Resolution</span>
                <select
                  name="resolution"
                  class="select select-bordered"
                  bind:value={resolutionValue}
                >
                  {#each resolutionOptions as resolution}
                    <option value={resolution}>{resolution}</option>
                  {/each}
                </select>
              </label>

              <label class="form-control">
                <span class="label-text">Frame Rate (FPS)</span>
                <input
                  type="number"
                  name="frameRate"
                  class="input input-bordered"
                  bind:value={frameRateValue}
                  min="1"
                  max="60"
                />
              </label>

              <label class="form-control col-span-2">
                <span class="label-text">Assign to Game</span>
                <select
                  name="gameId"
                  class="select select-bordered"
                  bind:value={gameIdValue}
                >
                  <option value="">None</option>
                  {#each data.games as game}
                    <option value={game.id}>{game.name}</option>
                  {/each}
                </select>
              </label>
            </div>
          </div>

          <!-- Camera Capabilities -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Camera Capabilities</h3>
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm" bind:checked={hasPtzValue} />
                <input type="hidden" name="hasPtz" value={hasPtzValue ? 'true' : 'false'} />
                <span class="label-text">PTZ (Pan/Tilt/Zoom)</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm" bind:checked={hasAudioValue} />
                <input type="hidden" name="hasAudio" value={hasAudioValue ? 'true' : 'false'} />
                <span class="label-text">Audio</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm" bind:checked={hasIrControlValue} />
                <input type="hidden" name="hasIrControl" value={hasIrControlValue ? 'true' : 'false'} />
                <span class="label-text">IR Control</span>
              </label>
            </div>

            {#if hasIrControlValue}
              <label class="form-control max-w-xs">
                <span class="label-text">IR Mode</span>
                <select name="irMode" class="select select-bordered select-sm" bind:value={irModeValue}>
                  {#each irModeOptions as mode}
                    <option value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                  {/each}
                </select>
              </label>
            {/if}

            {#if hasAudioValue}
              <label class="form-control max-w-xs">
                <span class="label-text">Audio Volume: {audioVolumeValue}%</span>
                <input
                  type="range"
                  name="audioVolume"
                  class="range range-sm"
                  min="0"
                  max="100"
                  step="5"
                  bind:value={audioVolumeValue}
                />
              </label>
            {/if}
          </div>

          <div class="flex justify-end">
            <LoadingButton
              type="submit"
              variant="secondary"
              loading={isTesting}
            >
              Test Connection
            </LoadingButton>
          </div>
        </div>
      </form>

      <!-- Main Submit Form -->
      <form method="POST" action="?/create" use:enhance={handleSubmit}>
        <!-- Hidden fields to carry over values -->
        <input type="hidden" name="name" value={nameValue} />
        <input type="hidden" name="brand" value={selectedBrand} />
        <input type="hidden" name="model" value={modelValue} />
        <input type="hidden" name="protocol" value={protocolValue} />
        <input type="hidden" name="host" value={hostValue} />
        <input type="hidden" name="port" value={portValue} />
        <input type="hidden" name="username" value={usernameValue} />
        <input type="hidden" name="password" value={passwordValue} />
        <input type="hidden" name="mainStreamPath" value={mainStreamPathValue} />
        <input type="hidden" name="subStreamPath" value={subStreamPathValue} />
        <input type="hidden" name="resolution" value={resolutionValue} />
        <input type="hidden" name="frameRate" value={frameRateValue} />
        <input type="hidden" name="transport" value={transportValue} />
        <input type="hidden" name="gameId" value={gameIdValue} />
        <input type="hidden" name="hasPtz" value={hasPtzValue ? 'true' : 'false'} />
        <input type="hidden" name="hasAudio" value={hasAudioValue ? 'true' : 'false'} />
        <input type="hidden" name="hasIrControl" value={hasIrControlValue ? 'true' : 'false'} />
        <input type="hidden" name="irMode" value={irModeValue} />
        <input type="hidden" name="audioVolume" value={audioVolumeValue} />
      </form>
    </div>
  </main>

  <!-- Fixed footer with Cancel/Save -->
  <footer class="sticky bottom-0 z-10 bg-base-100 border-t border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-ghost" onclick={handleCancel}>Cancel</button>
        <LoadingButton
          type="submit"
          variant="primary"
          loading={isSubmitting}
          onclick={() => {
            const form = document.querySelector('form[method="POST"]:not([action])') as HTMLFormElement;
            form?.requestSubmit();
          }}
        >
          Add Camera
        </LoadingButton>
      </div>
    </div>
  </footer>
</div>
