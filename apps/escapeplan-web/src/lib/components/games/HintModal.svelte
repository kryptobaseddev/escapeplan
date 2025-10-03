<svelte:options runes={false} />

<script lang="ts">
  import type { GameHintDefinition } from '@escapeplan/contracts';

  export let open = false;
  export let puzzleName = '';
  export let hint: GameHintDefinition | null = null;
  export let gameId: string | undefined = undefined;
  export let puzzleId: string | undefined = undefined;
  export let hintOrder: number | undefined = undefined;
  export let onclose: (() => void) | undefined;
  export let onsave: ((hint: GameHintDefinition) => void) | undefined;

  let dialogElement: HTMLDialogElement | null = null;
  let initialised = false;

  type HintType = 'text' | 'image' | 'audio' | 'video';
  type EditableHint = {
    uuid: string;
    type: HintType;
    content: string;
    assetUrl?: string;
    order: number;
    countAsHint: boolean;
  };

  let workingHint: EditableHint = createEmptyHint();
  let fileInputElement: HTMLInputElement | null = null;

  function createEmptyHint(): EditableHint {
    return {
      uuid: hint?.uuid ?? `hint-${crypto.randomUUID()}`,
      type: 'text',
      content: '',
      assetUrl: '',
      order: hint?.order ?? 1,
      countAsHint: true
    };
  }

  function resetState() {
    workingHint = createEmptyHint();
  }

  function close() {
    onclose?.();
  }

  function handleSave() {
    const savedHint: GameHintDefinition = {
      uuid: workingHint.uuid,
      type: workingHint.type,
      content: workingHint.content,
      assetUrl: workingHint.assetUrl || undefined,
      order: workingHint.order,
      countAsHint: workingHint.countAsHint
    };
    onsave?.(savedHint);
    close();
  }

  function handleFileSelect() {
    fileInputElement?.click();
  }

  let uploading = false;
  let uploadError: string | null = null;

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

  $: if (!open && initialised) {
    initialised = false;
    resetState();
  }

  $: if (open && !initialised) {
    if (hint) {
      workingHint = {
        uuid: hint.uuid,
        type: hint.type as HintType,
        content: hint.content ?? '',
        assetUrl: hint.assetUrl ?? '',
        order: hint.order,
        countAsHint: hint.countAsHint ?? true // Default to true if not set
      };
    } else {
      workingHint = createEmptyHint();
    }
    initialised = true;
  }

  $: isMediaType = workingHint.type === 'image' || workingHint.type === 'audio' || workingHint.type === 'video';
  $: showAutoplayWarning = workingHint.type === 'audio' || workingHint.type === 'video';
</script>

{#if open}
  <dialog
    class="modal modal-bottom sm:modal-middle"
    open
    bind:this={dialogElement}
    oncancel={(event) => {
      event.preventDefault();
      close();
    }}
  >
    <div class="modal-box max-h-[90vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
      <header class="mb-4">
        <h2 class="text-lg font-semibold text-base-content">
          {hint ? 'Edit hint' : `Add a new hint for ${puzzleName}`}
        </h2>
      </header>

      <div class="space-y-4">
        <!-- Hint Type -->
        <label class="form-control">
          <span class="label">
            <span class="label-text font-medium">Hint type</span>
          </span>
          <select
            class="select select-bordered w-full"
            bind:value={workingHint.type}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
        </label>

        <!-- Media Upload (Image/Audio/Video) -->
        {#if workingHint.type === 'image'}
          <div class="form-control">
            <span class="label">
              <span class="label-text font-medium">Image</span>
            </span>
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
                <p class="mt-2 text-xs text-success">✓ File uploaded successfully</p>
              {/if}
            </div>
          </div>
        {:else if workingHint.type === 'audio' || workingHint.type === 'video'}
          <div class="form-control">
            <span class="label">
              <span class="label-text font-medium">{workingHint.type === 'audio' ? 'Audio' : 'Video'}</span>
            </span>

            {#if showAutoplayWarning}
              <div class="alert mb-4 border border-info/30 bg-info/20 text-sm text-info-content">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Most modern browsers do not allow autoplay with sound by default. Please whitelist https://escapeplan.local/ in your browser settings in order for audio and video hints to work.</span>
              </div>
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
                <p class="mt-2 text-xs text-success">✓ File uploaded successfully</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Hint Text / Content -->
        <label class="form-control">
          <span class="label">
            <span class="label-text font-medium">
              {#if workingHint.type === 'text'}
                Hint text
              {:else}
                Description
              {/if}
            </span>
          </span>
          <textarea
            class="textarea textarea-bordered h-24 w-full resize-none"
            placeholder={workingHint.type === 'text' ? 'Enter hint text here...' : 'Type custom text here...'}
            bind:value={workingHint.content}
          ></textarea>
        </label>

        <!-- Count as Hint -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              bind:checked={workingHint.countAsHint}
            />
            <span class="label-text">Count as a hint</span>
          </label>
        </div>
      </div>

      <!-- Actions -->
      <footer class="mt-6 flex justify-end gap-3">
        <button type="button" class="btn btn-ghost" onclick={close}>
          Cancel
        </button>
        <button type="button" class="btn btn-primary" onclick={handleSave}>
          Save
        </button>
      </footer>
    </div>

    <div class="modal-backdrop" onclick={close}></div>
  </dialog>
{/if}
