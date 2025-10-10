<script lang="ts">
  import { apiFetch } from '$lib/api/client';

  let {
    gameId,
    assetType,
    puzzleId = undefined,
    mediaType = undefined,
    order = undefined,
    isReusable = false,
    onSuccess = undefined,
    onError = undefined,
    accept = '*/*',
    maxSizeMB = 50,
    disabled = false
  }: {
    gameId: string;
    assetType: 'thumbnail' | 'room_background' | 'gallery' | 'puzzle_media' | 'hint_media';
    puzzleId?: string;
    mediaType?: 'text' | 'image' | 'audio' | 'video';
    order?: number;
    isReusable?: boolean;
    onSuccess?: (asset: any) => void;
    onError?: (error: string) => void;
    accept?: string;
    maxSizeMB?: number;
    disabled?: boolean;
  } = $props();

  let uploading = $state(false);
  let progress = $state(0);
  let error = $state<string | null>(null);
  let dragOver = $state(false);
  let fileInput = $state<HTMLInputElement>();

  // Define allowed MIME types for each asset type
  const ALLOWED_MIME_TYPES: Record<string, string[]> = {
    thumbnail: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    room_background: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    gallery: [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
      // Video
      'video/mp4', 'video/webm', 'video/ogg'
    ],
    puzzle_media: [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
      // Video
      'video/mp4', 'video/webm', 'video/ogg'
    ],
    hint_media: [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
      // Video
      'video/mp4', 'video/webm', 'video/ogg'
    ]
  };

  async function uploadFile(file: File) {
    if (disabled || uploading) return;

    error = null;
    uploading = true;
    progress = 0;

    try {
      // Validate file size
      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
      }

      // Validate MIME type
      const allowedTypes = ALLOWED_MIME_TYPES[assetType];
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        const typeCategory = assetType === 'thumbnail' || assetType === 'room_background' || assetType === 'gallery'
          ? 'image'
          : mediaType || 'media';
        throw new Error(`Invalid file type. Please upload a valid ${typeCategory} file.`);
      }

      // Additional validation: check file extension matches MIME type
      const extension = file.name.split('.').pop()?.toLowerCase();
      const mimeExtensionMap: Record<string, string[]> = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/jpg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/gif': ['gif'],
        'audio/mpeg': ['mp3', 'mpeg'],
        'audio/mp3': ['mp3'],
        'audio/wav': ['wav'],
        'audio/ogg': ['ogg', 'oga'],
        'audio/webm': ['webm'],
        'video/mp4': ['mp4'],
        'video/webm': ['webm'],
        'video/ogg': ['ogg', 'ogv']
      };

      const expectedExtensions = mimeExtensionMap[file.type];
      if (extension && expectedExtensions && !expectedExtensions.includes(extension)) {
        throw new Error(`File extension .${extension} does not match the file type ${file.type}`);
      }

      // Build query params
      const queryParams = new URLSearchParams({
        gameId,
        assetType,
        ...(puzzleId && { puzzleId }),
        ...(mediaType && { mediaType }),
        ...(order !== undefined && { order: String(order) }),
        ...(isReusable && { isReusable: 'true' })
      });

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          progress = Math.round((event.loaded / event.total) * 100);
        }
      });

      const result = await new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', `/api/assets/upload?${queryParams.toString()}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      uploading = false;
      progress = 100;

      // Pass the asset object, not the whole response
      onSuccess?.(result.asset);

      // Reset after success
      setTimeout(() => {
        progress = 0;
      }, 1000);
    } catch (err) {
      uploading = false;
      progress = 0;
      const message = err instanceof Error ? err.message : 'Upload failed';
      error = message;
      onError?.(message);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !uploading) {
      dragOver = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragOver = false;
    if (!disabled && !uploading) {
      handleFiles(event.dataTransfer?.files ?? null);
    }
  }

  function triggerFileInput() {
    if (!disabled && !uploading) {
      fileInput?.click();
    }
  }

  const dropzoneClass = $derived([
    'relative rounded-xl border-2 border-dashed p-8 text-center transition-all',
    dragOver ? 'border-primary bg-primary/10' : 'border-base-content/20 bg-base-100/70',
    disabled || uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/60 hover:bg-base-100',
  ].join(' '));
</script>

<div
  class={dropzoneClass}
  role="button"
  tabindex={disabled || uploading ? -1 : 0}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onclick={triggerFileInput}
  onkeydown={(e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
      e.preventDefault();
      triggerFileInput();
    }
  }}
>
  <input
    bind:this={fileInput}
    type="file"
    class="hidden"
    {accept}
    {disabled}
    onchange={(e) => handleFiles(e.currentTarget.files)}
  />

  {#if uploading}
    <div class="space-y-3">
      <div class="flex items-center justify-center">
        <svg class="h-12 w-12 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div class="space-y-2">
        <div class="text-sm font-medium text-base-content">Uploading... {progress}%</div>
        <progress class="progress progress-primary w-full" value={progress} max="100"></progress>
      </div>
    </div>
  {:else if error}
    <div class="space-y-3">
      <div class="flex items-center justify-center">
        <svg class="h-12 w-12 text-error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="text-sm font-medium text-error">{error}</div>
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        onclick={(e) => {
          e.stopPropagation();
          error = null;
        }}
      >
        Try again
      </button>
    </div>
  {:else}
    <div class="space-y-3">
      <div class="flex items-center justify-center">
        <svg class="h-12 w-12 text-base-content/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-base-content">
          {dragOver ? 'Drop file to upload' : 'Drag & drop or click to upload'}
        </p>
        <p class="text-xs text-base-content/60">
          Max size: {maxSizeMB}MB
        </p>
      </div>
    </div>
  {/if}
</div>
