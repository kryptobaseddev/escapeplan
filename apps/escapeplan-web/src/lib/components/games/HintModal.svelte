<svelte:options runes={true} />

<script lang="ts">
  import type { GameHintDefinition } from '@escapeplan/contracts';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import AssetBrowser from '../assets/AssetBrowser.svelte';
  import VolumeSlider from '$lib/components/ui/VolumeSlider.svelte';

  interface Props {
    open?: boolean;
    puzzleName?: string;
    hint?: GameHintDefinition | null;
    gameId?: string;
    puzzleId?: string;
    hintOrder?: number;
    gameDefaultVolume?: number;
    onclose?: () => void;
    onsave?: (hint: GameHintDefinition) => void;
  }

  let {
    open = $bindable(false),
    puzzleName = '',
    hint = null,
    gameId = undefined,
    puzzleId = undefined,
    hintOrder = undefined,
    gameDefaultVolume = 80,
    onclose = undefined,
    onsave = undefined
  }: Props = $props();

  let initialised = $state(false);

  type HintType = 'text' | 'image' | 'audio' | 'video';
  type EditableHint = {
    uuid: string;
    type: HintType;
    content: string;
    assetUrl?: string;
    order: number;
    volumeLevel?: number;
    penaltySeconds: number;
    penaltyEnabled: boolean;
    countAsHint: boolean;
  };

  let workingHint = $state<EditableHint>(createEmptyHint());
  let fileInputElement = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);

  function createEmptyHint(): EditableHint {
    return {
      uuid: hint?.uuid ?? `hint-${crypto.randomUUID()}`,
      type: 'text',
      content: '',
      assetUrl: '',
      order: hint?.order ?? 1,
      volumeLevel: hint?.volumeLevel ?? 80,
      penaltySeconds: hint?.penaltySeconds ?? 0,
      penaltyEnabled: hint?.penaltyEnabled ?? false,
      countAsHint: hint?.countAsHint ?? true
    };
  }

  function resetState() {
    workingHint = createEmptyHint();
    uploadError = null;
  }

  function close() {
    if (!uploading) {
      onclose?.();
    }
  }

  function handleSave() {
    console.log('[HintModal] handleSave called');
    console.log('[HintModal] workingHint:', workingHint);
    const savedHint: GameHintDefinition = {
      uuid: workingHint.uuid,
      type: workingHint.type,
      content: workingHint.content,
      assetUrl: workingHint.assetUrl || undefined,
      order: workingHint.order,
      volumeLevel: workingHint.volumeLevel,
      penaltySeconds: workingHint.penaltySeconds,
      penaltyEnabled: workingHint.penaltyEnabled,
      countAsHint: workingHint.countAsHint,
      loop: false,
      autoDismiss: false
    };
    console.log('[HintModal] Calling onsave with:', savedHint);
    console.log('[HintModal] onsave exists?', !!onsave);
    onsave?.(savedHint);
    console.log('[HintModal] onsave called, now closing modal');
    close();
  }

  function handleFileSelect() {
    fileInputElement?.click();
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Validate we have required info for upload
    if (!gameId || !puzzleId) {
      uploadError = 'Missing game or puzzle information for upload';
      console.error('Cannot upload: missing gameId or puzzleId');
      return;
    }

    // Only upload for media types (not text)
    if (workingHint.type === 'text') {
      uploadError = 'Cannot upload files for text hints';
      return;
    }

    uploading = true;
    uploadError = null;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const order = hintOrder || workingHint.order || 1;
      const uploadUrl = `/api/assets/upload?gameId=${encodeURIComponent(gameId)}&assetType=hint_media&mediaType=${workingHint.type}&puzzleId=${encodeURIComponent(puzzleId)}&order=${order}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();

      // Store the asset URL returned from the server
      workingHint.assetUrl = result.asset.url;
      uploadError = null;
    } catch (error) {
      console.error('Asset upload failed:', error);
      uploadError = error instanceof Error ? error.message : 'Failed to upload file';
      workingHint.assetUrl = ''; // Clear on error
    } finally {
      uploading = false;
    }
  }

  $effect(() => {
    if (!open && initialised) {
      initialised = false;
      resetState();
    }
  });

  $effect(() => {
    if (open && !initialised) {
      if (hint) {
        workingHint = {
          uuid: hint.uuid,
          type: hint.type as HintType,
          content: hint.content ?? '',
          assetUrl: hint.assetUrl ?? '',
          order: hint.order,
          volumeLevel: hint.volumeLevel ?? 80,
          penaltySeconds: hint.penaltySeconds ?? 0,
          penaltyEnabled: hint.penaltyEnabled ?? false,
          countAsHint: hint.countAsHint ?? true
        };
      } else {
        workingHint = createEmptyHint();
      }
      initialised = true;
    }
  });

  let isMediaType = $derived(workingHint.type === 'image' || workingHint.type === 'audio' || workingHint.type === 'video');
  let showAutoplayWarning = $derived(workingHint.type === 'audio' || workingHint.type === 'video');
</script>

<Modal
  open={open}
  title={hint ? 'Edit hint' : `Add a new hint for ${puzzleName}`}
  size="2xl"
  onClose={close}
>
  <form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
    <!-- Hint Content Fieldset -->
    <fieldset class="space-y-4 rounded-lg border border-base-300 p-4">
      <legend class="px-2 text-sm font-semibold">Hint Content</legend>

      <!-- Hint Type -->
      <label class="form-control">
        <div class="label">
          <span class="label-text">Hint type</span>
          <span class="label-text-alt text-error">*</span>
        </div>
        <select
          class="select select-bordered validator w-full"
          bind:value={workingHint.type}
          disabled={uploading}
          required
        >
          <option value="">Select hint type</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
        <div class="validator-hint">Please select a hint type</div>
      </label>

      <!-- Media Upload (Image/Audio/Video) -->
      {#if workingHint.type === 'image'}
        <div class="form-control">
          <div class="label">
            <span class="label-text">Image</span>
          </div>
          <div class="rounded-lg border-2 border-dashed border-base-content/20 bg-base-200/50 p-8 text-center">
            {#if workingHint.assetUrl}
              <div class="mb-4">
                <div class="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-base-300">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p class="mt-2 text-sm text-base-content/70">{workingHint.assetUrl}</p>
              </div>
            {:else}
              <div class="mb-4">
                <div class="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-base-300">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            {/if}
            <button type="button" class="btn btn-primary btn-sm" onclick={handleFileSelect} disabled={uploading}>
              {#if uploading}
                <span class="loading loading-spinner loading-sm"></span>
                Uploading...
              {:else}
                Upload file
              {/if}
            </button>
            <input
              type="file"
              bind:this={fileInputElement}
              onchange={handleFileChange}
              accept="image/*"
              class="hidden"
              disabled={uploading}
            />
            {#if uploadError}
              <p class="mt-2 text-xs text-error">{uploadError}</p>
            {:else if workingHint.assetUrl}
              <p class="mt-2 text-xs text-success">File uploaded successfully</p>
            {/if}
          </div>

          <!-- Browse existing assets -->
          <details class="collapse collapse-arrow bg-base-200/50 mt-3">
            <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
            <div class="collapse-content">
              <AssetBrowser
                gameId={gameId}
                assetType="hint_media"
                mediaType="image"
                selectionMode="single"
                onSelect={(asset) => {
                  workingHint.assetUrl = asset.url;
                }}
              />
            </div>
          </details>
        </div>
      {:else if workingHint.type === 'audio' || workingHint.type === 'video'}
        <div class="form-control">
          <div class="label">
            <span class="label-text">{workingHint.type === 'audio' ? 'Audio' : 'Video'}</span>
          </div>

          {#if showAutoplayWarning}
            <Alert type="info" class="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Most modern browsers do not allow autoplay with sound by default. Please whitelist https://escapeplan.local/ in your browser settings in order for audio and video hints to work.</span>
            </Alert>
          {/if}

          <div class="rounded-lg border-2 border-dashed border-base-content/20 bg-base-200/50 p-6 text-center">
            {#if workingHint.assetUrl && !uploading}
              <p class="mb-3 text-sm text-base-content/70">{workingHint.assetUrl}</p>
            {/if}
            <button type="button" class="btn btn-primary btn-sm" onclick={handleFileSelect} disabled={uploading}>
              {#if uploading}
                <span class="loading loading-spinner loading-sm"></span>
                Uploading...
              {:else}
                Upload file
              {/if}
            </button>
            <input
              type="file"
              bind:this={fileInputElement}
              onchange={handleFileChange}
              accept={workingHint.type === 'audio' ? 'audio/*' : 'video/*'}
              class="hidden"
              disabled={uploading}
            />
            {#if uploadError}
              <p class="mt-2 text-xs text-error">{uploadError}</p>
            {:else if workingHint.assetUrl}
              <p class="mt-2 text-xs text-success">File uploaded successfully</p>
            {/if}
          </div>

          <!-- Browse existing assets -->
          <details class="collapse collapse-arrow bg-base-200/50 mt-3">
            <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
            <div class="collapse-content">
              <AssetBrowser
                gameId={gameId}
                assetType="hint_media"
                mediaType={workingHint.type}
                selectionMode="single"
                onSelect={(asset) => {
                  workingHint.assetUrl = asset.url;
                }}
              />
            </div>
          </details>
        </div>
      {/if}

      <!-- Hint Text / Content -->
      <label class="form-control">
        <div class="label">
          <span class="label-text">{workingHint.type === 'text' ? 'Hint text' : 'Description'}</span>
          {#if workingHint.type === 'text'}
            <span class="label-text-alt text-error">*</span>
          {/if}
        </div>
        <textarea
          class="textarea textarea-bordered validator min-h-[8rem] resize-none"
          placeholder={workingHint.type === 'text' ? 'Enter hint text here...' : 'Type custom text here...'}
          bind:value={workingHint.content}
          disabled={uploading}
          required={workingHint.type === 'text'}
          minlength={workingHint.type === 'text' ? 10 : undefined}
          maxlength="500"
        ></textarea>
        <div class="validator-hint">
          {#if workingHint.type === 'text'}
            Hint text must be 10-500 characters
          {:else}
            Optional description (max 500 characters)
          {/if}
        </div>
      </label>

    </fieldset>

    <!-- Hint Settings Fieldset -->
    <fieldset class="space-y-4 rounded-lg border border-base-300 p-4">
      <legend class="px-2 text-sm font-semibold">Hint Settings</legend>

      <!-- Penalty Toggle -->
      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={workingHint.penaltyEnabled}
            disabled={uploading}
          />
          <span class="label-text">Apply time penalty for using this hint</span>
        </label>
      </div>

      <!-- Penalty Seconds (only show when enabled) -->
      {#if workingHint.penaltyEnabled}
        <label class="form-control">
          <div class="label">
            <span class="label-text">Penalty in Seconds</span>
            <span class="label-text-alt text-error">*</span>
          </div>
          <input
            type="number"
            class="input input-bordered validator"
            bind:value={workingHint.penaltySeconds}
            required={workingHint.penaltyEnabled}
            min="0"
            max="300"
            placeholder="0"
            disabled={uploading}
          />
          <div class="validator-hint">Time penalty (0-300 seconds) added to timer when hint is used</div>
        </label>
      {/if}

      <!-- Count as Hint -->
      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={workingHint.countAsHint}
            disabled={uploading}
          />
          <span class="label-text">Count as a hint</span>
        </label>
      </div>

      <!-- Volume Override -->
      {#if workingHint.type === 'audio' || workingHint.type === 'video'}
        <VolumeSlider
          bind:value={workingHint.volumeLevel}
          label="Volume"
          step={5}
          disabled={uploading}
        />
      {/if}
    </fieldset>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close} disabled={uploading}>
      Cancel
    </button>
    <button
      type="button"
      class="btn btn-primary w-full sm:w-auto"
      disabled={uploading}
      onclick={handleSave}
    >
      {#if uploading}
        <span class="loading loading-infinity loading-sm"></span>
      {/if}
      Save
    </button>
  {/snippet}
</Modal>
