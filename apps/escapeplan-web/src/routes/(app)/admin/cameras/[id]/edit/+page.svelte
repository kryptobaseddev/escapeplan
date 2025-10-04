<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type {
    CameraProtocol,
    CameraResolution,
    CameraTransport,
    GameDetails
  } from '@escapeplan/contracts';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import { createFormHandler } from '$lib/utils/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const protocolOptions: CameraProtocol[] = ['rtsp', 'mjpeg', 'onvif'];
  const resolutionOptions: CameraResolution[] = ['480p', '720p', '1080p', 'native'];
  const transportOptions: CameraTransport[] = ['tcp', 'udp', 'http'];

  let errorMessage = $state<string | null>(null);
  let testResult = $state<{ success: boolean; errorMessage?: string; diagnostics?: any } | null>(null);
  let isTesting = $state(false);
  let isSubmitting = $state(false);

  // Form fields - initialized from camera data
  let nameValue = $state(data.camera.name);
  let protocolValue = $state<CameraProtocol>(data.camera.protocol as CameraProtocol);
  let hostValue = $state(data.camera.host);
  let portValue = $state(data.camera.port);
  let usernameValue = $state('');
  let passwordValue = $state('');
  let streamPathValue = $state('');
  let resolutionValue = $state<CameraResolution>('720p');
  let frameRateValue = $state(15);
  let transportValue = $state<CameraTransport>('tcp');
  let gameIdValue = $state<string>(data.camera.gameId ?? '');

  function handleProtocolChange() {
    if (protocolValue === 'rtsp') {
      portValue = 554;
      streamPathValue = '/';
    } else if (protocolValue === 'mjpeg') {
      portValue = 80;
      streamPathValue = '/video.mjpg';
    } else if (protocolValue === 'onvif') {
      portValue = 554;
      streamPathValue = '/onvif1';
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
          <h1 class="text-2xl font-bold text-base-content">Edit Camera</h1>
          <p class="text-sm text-base-content/60">Update camera configuration and settings.</p>
        </div>
      </div>

      {#if errorMessage}
        <div class="alert alert-error mb-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}

      {#if testResult}
        <div class={`alert mb-4 ${testResult.success ? 'alert-success border-success/30 bg-success/10' : 'alert-warning border-warning/30 bg-warning/10'}`}>
          {#if testResult.success}
            <div>
              <p class="font-semibold">Connection successful!</p>
              {#if testResult.diagnostics?.resolution}
                <p class="text-sm">
                  Resolution: {testResult.diagnostics.resolution} @ {testResult.diagnostics.frameRate}fps
                </p>
              {/if}
            </div>
          {:else}
            <div>
              <p class="font-semibold">Connection failed</p>
              <p class="text-sm">{testResult.errorMessage ?? 'Unknown error'}</p>
              {#if testResult.diagnostics}
                <p class="text-xs mt-1">
                  {testResult.diagnostics.reachable ? '✓' : '✗'} Reachable •
                  {testResult.diagnostics.authValid ? '✓' : '✗'} Auth •
                  {testResult.diagnostics.streamAvailable ? '✓' : '✗'} Stream
                </p>
              {/if}
            </div>
          {/if}
        </div>
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
                  placeholder="192.168.1.100"
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

          <!-- Stream Configuration -->
          <div class="border border-base-300 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-semibold">Stream Configuration</h3>
            <div class="grid grid-cols-3 gap-4">
              <label class="form-control col-span-3">
                <span class="label-text">Stream Path</span>
                <input
                  type="text"
                  name="streamPath"
                  class="input input-bordered"
                  bind:value={streamPathValue}
                  placeholder="/stream1"
                />
                <span class="label-text-alt">Example: /stream1 or /live/main</span>
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
                <span class="label-text">Frame Rate</span>
                <input
                  type="number"
                  name="frameRate"
                  class="input input-bordered"
                  bind:value={frameRateValue}
                  min="1"
                  max="60"
                />
              </label>

              <label class="form-control">
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
      <form method="POST" use:enhance={handleSubmit}>
        <!-- Hidden fields to carry over values -->
        <input type="hidden" name="name" value={nameValue} />
        <input type="hidden" name="protocol" value={protocolValue} />
        <input type="hidden" name="host" value={hostValue} />
        <input type="hidden" name="port" value={portValue} />
        <input type="hidden" name="username" value={usernameValue} />
        <input type="hidden" name="password" value={passwordValue} />
        <input type="hidden" name="streamPath" value={streamPathValue} />
        <input type="hidden" name="resolution" value={resolutionValue} />
        <input type="hidden" name="frameRate" value={frameRateValue} />
        <input type="hidden" name="transport" value={transportValue} />
        <input type="hidden" name="gameId" value={gameIdValue} />
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
          Save Changes
        </LoadingButton>
      </div>
    </div>
  </footer>
</div>
