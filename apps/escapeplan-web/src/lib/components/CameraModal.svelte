<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type {
    CameraProtocol,
    CameraResolution,
    CameraTransport,
    CameraSummary,
    GameDetails
  } from '@escapeplan/contracts';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';

  type Mode = 'create' | 'edit';

  interface Props {
    open?: boolean;
    mode?: Mode;
    action?: string;
    testAction?: string;
    camera?: CameraSummary | null;
    games?: GameDetails[];
    onclose?: () => void;
    onsuccess?: () => void;
  }

  const protocolOptions: CameraProtocol[] = ['rtsp', 'mjpeg', 'onvif'];
  const resolutionOptions: CameraResolution[] = ['480p', '720p', '1080p', 'native'];
  const transportOptions: CameraTransport[] = ['tcp', 'udp', 'http'];

  const props = $props();

  let errorMessage = $state<string | null>(null);
  let testResult = $state<{ success: boolean; errorMessage?: string; diagnostics?: any } | null>(
    null
  );
  let isTesting = $state(false);
  let isSubmitting = $state(false);
  let initialised = $state(false);

  // Form fields
  let nameValue = $state('');
  let protocolValue = $state<CameraProtocol>('rtsp');
  let hostValue = $state('');
  let portValue = $state(554);
  let usernameValue = $state('');
  let passwordValue = $state('');
  let streamPathValue = $state('');
  let resolutionValue = $state<CameraResolution>('720p');
  let frameRateValue = $state(15);
  let transportValue = $state<CameraTransport>('tcp');
  let gameIdValue = $state<string>('');

  let openFlag = $derived(Boolean(props.open));
  let modeValue = $derived((props.mode ?? 'create') as Mode);
  let isCreate = $derived(modeValue === 'create');
  let isEdit = $derived(modeValue === 'edit');
  let actionValue = $derived(props.action ?? '');
  let testActionValue = $derived(props.testAction ?? '');
  let cameraValue = $derived(props.camera ?? null);
  let gamesValue = $derived(props.games ?? []);

  const handleSubmit = createFormHandler({
    onSubmit: () => {
      isSubmitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      isSubmitting = false;
      testResult = null;
      props.onsuccess?.();
    },
    onError: (result) => {
      isSubmitting = false;
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please try again.';
    }
  });

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

  function close() {
    props.onclose?.();
  }

  $effect(() => {
    if (!openFlag && initialised) {
      initialised = false;
      nameValue = '';
      protocolValue = 'rtsp';
      hostValue = '';
      portValue = 554;
      usernameValue = '';
      passwordValue = '';
      streamPathValue = '';
      resolutionValue = '720p';
      frameRateValue = 15;
      transportValue = 'tcp';
      gameIdValue = '';
      errorMessage = null;
      testResult = null;
    }
  });

  $effect(() => {
    if (!openFlag || initialised) return;

    if (isEdit && cameraValue) {
      nameValue = cameraValue.name;
      protocolValue = cameraValue.protocol as CameraProtocol;
      hostValue = cameraValue.host;
      portValue = cameraValue.port;
      usernameValue = '';
      passwordValue = '';
      streamPathValue = '';
      resolutionValue = '720p';
      frameRateValue = 15;
      transportValue = 'tcp';
      gameIdValue = cameraValue.gameId ?? '';
    } else {
      nameValue = '';
      protocolValue = 'rtsp';
      hostValue = '';
      portValue = 554;
      usernameValue = '';
      passwordValue = '';
      streamPathValue = '';
      resolutionValue = '720p';
      frameRateValue = 15;
      transportValue = 'tcp';
      gameIdValue = '';
    }

    errorMessage = null;
    testResult = null;
    initialised = true;
  });

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
</script>

<Modal
  open={openFlag}
  title={isCreate ? 'Add Camera' : 'Edit Camera'}
  size="2xl"
  onClose={close}
>
  {#if errorMessage}
    <Alert type="error" class="mb-4">
      {errorMessage}
    </Alert>
  {/if}

  {#if testResult}
    <Alert type={testResult.success ? 'success' : 'warning'} class="mb-4">
      {#if testResult.success}
        <p class="font-semibold">Connection successful!</p>
        {#if testResult.diagnostics?.resolution}
          <p class="text-sm">
            Resolution: {testResult.diagnostics.resolution} @ {testResult.diagnostics.frameRate}fps
          </p>
        {/if}
      {:else}
        <p class="font-semibold">Connection failed</p>
        <p class="text-sm">{testResult.errorMessage ?? 'Unknown error'}</p>
        {#if testResult.diagnostics}
          <p class="text-xs mt-1">
            {testResult.diagnostics.reachable ? '✓' : '✗'} Reachable •
            {testResult.diagnostics.authValid ? '✓' : '✗'} Auth •
            {testResult.diagnostics.streamAvailable ? '✓' : '✗'} Stream
          </p>
        {/if}
      {/if}
    </Alert>
  {/if}

  <!-- Test Connection Form -->
  <form method="POST" action={testActionValue} use:enhance={handleTestConnection} class="mb-6">
    <div class="space-y-6 mb-6">
      <!-- Camera Name (standalone) -->
      <label class="form-control">
        <span class="label-text">Camera Name <span class="text-error">*</span></span>
        <input
          type="text"
          name="name"
          class="input validator"
          bind:value={nameValue}
          required
          minlength="3"
          placeholder="Main Entrance Camera"
        />
        <div class="validator-hint">Enter a descriptive name (minimum 3 characters)</div>
      </label>

      <!-- Network Configuration -->
      <fieldset class="border border-base-300 rounded-lg p-4">
        <legend class="text-sm font-semibold px-2">Network Configuration</legend>
        <div class="grid grid-cols-2 gap-4">
          <label class="form-control">
            <span class="label-text">IP Address <span class="text-error">*</span></span>
            <input
              type="text"
              name="host"
              class="input validator"
              bind:value={hostValue}
              required
              pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
              placeholder="192.168.1.100"
            />
            <div class="validator-hint">Enter a valid IPv4 address</div>
          </label>

          <label class="form-control">
            <span class="label-text">Port <span class="text-error">*</span></span>
            <label class="input validator flex items-center gap-2">
              <span class="label">:</span>
              <input
                type="number"
                name="port"
                class="grow"
                bind:value={portValue}
                required
                min="1"
                max="65535"
              />
            </label>
            <div class="validator-hint">Enter port number (1-65535)</div>
          </label>

          <label class="form-control col-span-2">
            <span class="label-text">Protocol <span class="text-error">*</span></span>
            <select
              name="protocol"
              class="select validator"
              bind:value={protocolValue}
              onchange={handleProtocolChange}
              required
            >
              {#each protocolOptions as protocol}
                <option value={protocol}>{protocol.toUpperCase()}</option>
              {/each}
            </select>
            <div class="validator-hint">Select camera streaming protocol</div>
          </label>
        </div>
      </fieldset>

      <!-- Authentication -->
      <fieldset class="border border-base-300 rounded-lg p-4">
        <legend class="text-sm font-semibold px-2">Authentication</legend>
        <div class="grid grid-cols-2 gap-4">
          <label class="form-control">
            <span class="label-text">Username <span class="text-error">*</span></span>
            <input
              type="text"
              name="username"
              class="input validator"
              bind:value={usernameValue}
              required
              autocomplete="username"
            />
            <div class="validator-hint">Camera login username</div>
          </label>

          <label class="form-control">
            <span class="label-text">Password <span class="text-error">*</span></span>
            <input
              type="password"
              name="password"
              class="input validator"
              bind:value={passwordValue}
              required
              minlength="8"
              autocomplete="current-password"
            />
            <div class="validator-hint">Password (minimum 8 characters)</div>
          </label>
        </div>
      </fieldset>

      <!-- Settings -->
      <fieldset class="border border-base-300 rounded-lg p-4">
        <legend class="text-sm font-semibold px-2">Settings</legend>
        <div class="grid grid-cols-2 gap-4">
          <label class="form-control">
            <span class="label-text">Stream Path <span class="text-error">*</span></span>
            <input
              type="text"
              name="streamPath"
              class="input validator"
              bind:value={streamPathValue}
              required
              placeholder="/stream1"
            />
            <div class="validator-hint">Camera stream URL path</div>
          </label>

          <label class="form-control">
            <span class="label-text">Associated Game</span>
            <select name="gameId" class="select validator" bind:value={gameIdValue}>
              <option value="">None</option>
              {#each gamesValue as game}
                <option value={game.id}>{game.name}</option>
              {/each}
            </select>
            <div class="validator-hint">Optional game association</div>
          </label>

          <label class="form-control">
            <span class="label-text">Resolution</span>
            <select name="resolution" class="select validator" bind:value={resolutionValue}>
              {#each resolutionOptions as resolution}
                <option value={resolution}>{resolution}</option>
              {/each}
            </select>
            <div class="validator-hint">Stream resolution</div>
          </label>

          <label class="form-control">
            <span class="label-text">Frame Rate</span>
            <input
              type="number"
              name="frameRate"
              class="input validator"
              bind:value={frameRateValue}
              min="1"
              max="60"
            />
            <div class="validator-hint">FPS (1-60)</div>
          </label>

          <label class="form-control col-span-2">
            <span class="label-text">Transport</span>
            <select name="transport" class="select validator" bind:value={transportValue}>
              {#each transportOptions as transport}
                <option value={transport}>{transport.toUpperCase()}</option>
              {/each}
            </select>
            <div class="validator-hint">Network transport protocol</div>
          </label>
        </div>
      </fieldset>
    </div>

    <LoadingButton type="submit" variant="outline" size="sm" loading={isTesting}>
      Test Connection
    </LoadingButton>
  </form>

  <!-- Save Form -->
  <form method="POST" action={actionValue} use:enhance={handleSubmit}>
    {#if isEdit && cameraValue}
      <input type="hidden" name="id" value={cameraValue.id} />
    {/if}
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

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
    <LoadingButton
      type="submit"
      variant="primary"
      loading={isSubmitting}
      form={actionValue ? undefined : 'camera-form'}
    >
      {isCreate ? 'Add Camera' : 'Save Changes'}
    </LoadingButton>
  {/snippet}
</Modal>
