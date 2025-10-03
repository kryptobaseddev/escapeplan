<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type {
    CameraProtocol,
    CameraResolution,
    CameraTransport,
    CameraSummary,
    GameDetails
  } from '@escapeplan/contracts';

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

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let errorMessage = $state<string | null>(null);
  let testResult = $state<{ success: boolean; errorMessage?: string; diagnostics?: any } | null>(
    null
  );
  let isTesting = $state(false);
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

  const handleSubmit: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        const failureData = result.data as { message?: string } | undefined;
        errorMessage = failureData?.message ?? 'Request failed. Please try again.';
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        errorMessage = null;
        testResult = null;
        props.onsuccess?.();
        return;
      }
      await update();
    };
  };

  const handleTestConnection: SubmitFunction = () => {
    isTesting = true;
    return async ({ result, update }) => {
      isTesting = false;
      if (result.type === 'failure') {
        const failureData = result.data as { message?: string } | undefined;
        errorMessage = failureData?.message ?? 'Test failed. Please try again.';
        testResult = null;
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        const successData = result.data as { testResult?: any } | undefined;
        testResult = successData?.testResult ?? null;
        errorMessage = null;
        return;
      }
      await update();
    };
  };

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

  $effect(() => {
    if (openFlag && dialogElement) {
      dialogElement.showModal();
    } else if (!openFlag && dialogElement) {
      dialogElement.close();
    }
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

<dialog bind:this={dialogElement} class="modal" onclose={close}>
  <div class="modal-box max-w-3xl bg-base-200/95">
    <h2 class="text-xl font-display mb-4">
      {isCreate ? 'Add Camera' : 'Edit Camera'}
    </h2>

    {#if errorMessage}
      <div class="alert alert-error mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{errorMessage}</span>
      </div>
    {/if}

    {#if testResult}
      <div
        class={`alert mb-4 ${testResult.success ? 'alert-success' : 'alert-warning'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <div class="flex-1">
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
        </div>
      </div>
    {/if}

    <!-- Test Connection Form -->
    <form method="POST" action={testActionValue} use:enhance={handleTestConnection} class="mb-4">
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="form-control">
          <span class="label-text">Name *</span>
          <input
            type="text"
            name="name"
            class="input input-bordered"
            bind:value={nameValue}
            required
          />
        </label>

        <label class="form-control">
          <span class="label-text">Protocol *</span>
          <select
            name="protocol"
            class="select select-bordered"
            bind:value={protocolValue}
            onchange={handleProtocolChange}
          >
            {#each protocolOptions as protocol}
              <option value={protocol}>{protocol.toUpperCase()}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text">Host *</span>
          <input
            type="text"
            name="host"
            class="input input-bordered"
            placeholder="192.168.1.100"
            bind:value={hostValue}
            required
          />
        </label>

        <label class="form-control">
          <span class="label-text">Port *</span>
          <input
            type="number"
            name="port"
            class="input input-bordered"
            bind:value={portValue}
            required
          />
        </label>

        <label class="form-control">
          <span class="label-text">Username</span>
          <input
            type="text"
            name="username"
            class="input input-bordered"
            bind:value={usernameValue}
          />
        </label>

        <label class="form-control">
          <span class="label-text">Password</span>
          <input
            type="password"
            name="password"
            class="input input-bordered"
            bind:value={passwordValue}
          />
        </label>

        <label class="form-control">
          <span class="label-text">Stream Path</span>
          <input
            type="text"
            name="streamPath"
            class="input input-bordered"
            placeholder="/stream1"
            bind:value={streamPathValue}
          />
        </label>

        <label class="form-control">
          <span class="label-text">Resolution</span>
          <select name="resolution" class="select select-bordered" bind:value={resolutionValue}>
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
            min="1"
            max="60"
            bind:value={frameRateValue}
          />
        </label>

        <label class="form-control">
          <span class="label-text">Transport</span>
          <select name="transport" class="select select-bordered" bind:value={transportValue}>
            {#each transportOptions as transport}
              <option value={transport}>{transport.toUpperCase()}</option>
            {/each}
          </select>
        </label>

        <label class="form-control col-span-2">
          <span class="label-text">Associated Game</span>
          <select name="gameId" class="select select-bordered" bind:value={gameIdValue}>
            <option value="">None</option>
            {#each gamesValue as game}
              <option value={game.id}>{game.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="flex gap-2">
        <button type="submit" class="btn btn-outline btn-sm" disabled={isTesting}>
          {#if isTesting}
            <span class="loading loading-spinner loading-sm"></span>
            Testing...
          {:else}
            Test Connection
          {/if}
        </button>
      </div>
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

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
        <button type="submit" class="btn btn-primary">
          {isCreate ? 'Add Camera' : 'Save Changes'}
        </button>
      </div>
    </form>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>
