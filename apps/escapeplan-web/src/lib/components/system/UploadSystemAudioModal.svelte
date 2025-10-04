<svelte:options runes={true} />

<script lang="ts">
  interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: (asset: any) => void;
  }

  let { open, onClose, onSuccess }: Props = $props();

  let file = $state<File | null>(null);
  let uploading = $state(false);
  let error = $state<string | null>(null);
  let progress = $state(0);

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      file = input.files[0];

      // Validate audio file
      if (!file.type.startsWith('audio/')) {
        error = 'Please select an audio file';
        file = null;
        return;
      }

      // Start upload immediately
      await uploadFile();
    }
  }

  async function uploadFile() {
    if (!file) return;

    uploading = true;
    error = null;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          progress = Math.round((e.loaded / e.total) * 100);
        }
      });

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onSuccess(response.asset);
          onClose();
        } else {
          const errorData = JSON.parse(xhr.responseText);
          error = errorData.message || 'Upload failed';
        }
        uploading = false;
      });

      // Error handler
      xhr.addEventListener('error', () => {
        error = 'Network error during upload';
        uploading = false;
      });

      // Send request
      xhr.open('POST', '/api/assets/upload?assetType=system_audio&mediaType=audio');
      xhr.withCredentials = true;
      xhr.send(formData);

    } catch (err: any) {
      error = err.message || 'Upload failed';
      uploading = false;
    }
  }

  function handleClose() {
    if (!uploading) {
      file = null;
      error = null;
      progress = 0;
      onClose();
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onclick={handleClose}>
    <div
      class="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
      onclick={(e) => e.stopPropagation()}
    >
      <h2 class="text-xl font-semibold mb-4">Upload Default Text Hint Sound</h2>

      {#if !file}
        <div class="border-2 border-dashed border-base-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept="audio/*"
            onchange={handleFileSelect}
            class="hidden"
            id="audio-file-input"
          />
          <label for="audio-file-input" class="cursor-pointer">
            <div class="text-4xl mb-2">🎵</div>
            <div class="text-sm text-base-content/70">Click to select audio file</div>
            <div class="text-xs text-base-content/50 mt-1">MP3, WAV, OGG supported</div>
          </label>
        </div>
      {:else if uploading}
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="text-2xl">🎵</div>
            <div class="flex-1">
              <div class="text-sm font-medium">{file.name}</div>
              <div class="text-xs text-base-content/60">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <progress class="progress progress-primary w-full" value={progress} max={100}></progress>
          <div class="text-xs text-center text-base-content/60">{progress}% uploaded</div>
        </div>
      {:else}
        <div class="text-center py-4">
          <div class="text-4xl mb-2">✅</div>
          <div class="text-sm font-medium">Upload complete!</div>
        </div>
      {/if}

      {#if error}
        <div class="alert alert-error mt-4">
          <span>{error}</span>
        </div>
      {/if}

      <div class="flex gap-2 mt-6">
        <button class="btn btn-ghost flex-1" onclick={handleClose} disabled={uploading}>
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
