<script lang="ts">
  import { apiFetch } from '$lib/api/client';

  let {
    gameId = undefined,
    assetType = undefined,
    mediaType = undefined,
    isReusable = undefined,
    onSelect = undefined,
    selectedAssetId = undefined,
    showSearch = true
  }: {
    gameId?: string;
    assetType?: string;
    mediaType?: string;
    isReusable?: boolean;
    onSelect?: (asset: any) => void;
    selectedAssetId?: string;
    showSearch?: boolean;
  } = $props();

  let assets = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');

  async function loadAssets() {
    loading = true;
    error = null;

    try {
      const queryParams = new URLSearchParams();
      if (gameId) queryParams.append('gameId', gameId);
      if (assetType) queryParams.append('assetType', assetType);
      if (mediaType) queryParams.append('mediaType', mediaType);
      if (isReusable !== undefined) queryParams.append('isReusable', String(isReusable));
      if (searchQuery) queryParams.append('search', searchQuery);

      const result = await apiFetch<{ assets: any[] }>(
        fetch,
        `/assets/list?${queryParams.toString()}`,
        { credentials: 'include' }
      );

      assets = result.assets || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load assets';
      assets = [];
    } finally {
      loading = false;
    }
  }

  function handleSelect(asset: any) {
    onSelect?.(asset);
  }

  function getAssetUrl(asset: any): string {
    return asset.url || `/assets/${asset.filename}`;
  }

  function getAssetTypeIcon(asset: any): string {
    const type = asset.media_type || asset.asset_type;
    if (type?.includes('image')) {
      return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
    } else if (type?.includes('audio')) {
      return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    } else if (type?.includes('video')) {
      return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
    }
    return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  // Load assets when component mounts
  $effect(() => {
    loadAssets();
  });

  // Debounced search effect
  $effect(() => {
    // Reference searchQuery to track it
    searchQuery;

    const timeout = setTimeout(() => {
      loadAssets();
    }, 300);

    return () => clearTimeout(timeout);
  });
</script>

<div class="space-y-4">
  {#if showSearch}
    <div class="flex gap-2">
      <input
        type="search"
        placeholder="Search assets..."
        class="input input-bordered flex-1"
        bind:value={searchQuery}
      />
      <button type="button" class="btn btn-secondary" onclick={loadAssets}>
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center p-12">
      <svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
    </div>
  {:else if assets.length === 0}
    <div class="rounded-xl border border-dashed border-base-content/20 bg-base-100/70 p-12 text-center">
      <svg class="mx-auto h-12 w-12 text-base-content/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="mt-4 text-sm text-base-content/60">No assets found</p>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each assets as asset (asset.id)}
        <button
          type="button"
          class={`card overflow-hidden border transition-all ${
            selectedAssetId === asset.id
              ? 'border-primary shadow-lg'
              : 'border-white/10 hover:border-primary/50 hover:shadow-md'
          }`}
          onclick={() => handleSelect(asset)}
        >
          <figure class="relative h-40 bg-base-200">
            {#if asset.media_type === 'image'}
              <img
                src={getAssetUrl(asset)}
                alt={asset.original_filename}
                class="h-full w-full object-cover"
                loading="lazy"
              />
            {:else}
              <div class="flex h-full w-full items-center justify-center">
                <svg class="h-16 w-16 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getAssetTypeIcon(asset)} />
                </svg>
              </div>
            {/if}
            {#if asset.is_reusable}
              <div class="badge badge-secondary absolute right-2 top-2 badge-sm">
                Reusable
              </div>
            {/if}
          </figure>
          <div class="card-body p-3">
            <h3 class="truncate text-sm font-medium text-base-content" title={asset.original_filename}>
              {asset.original_filename}
            </h3>
            <div class="flex items-center justify-between text-xs text-base-content/60">
              <span>{formatFileSize(asset.size_bytes)}</span>
              <span class="badge badge-ghost badge-xs">{asset.asset_type}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
