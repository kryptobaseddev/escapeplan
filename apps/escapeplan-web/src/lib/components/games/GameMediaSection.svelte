<script lang="ts">
  import AssetUpload from '../assets/AssetUpload.svelte';
  import AssetBrowser from '../assets/AssetBrowser.svelte';

  interface Props {
    gameSlug: string;
    coverImageId: string | undefined;
    roomDisplayBackgroundId: string | undefined;
    galleryImageIds: string[];
    assetCache: Record<string, { url: string; filename: string }>;
    onCoverImageChange: (assetId: string | undefined) => void;
    onRoomDisplayBackgroundChange: (assetId: string | undefined) => void;
    onGalleryImagesChange: (assetIds: string[]) => void;
    onAssetCacheUpdate: (assetId: string, asset: { url: string; filename: string }) => void;
  }

  let {
    gameSlug,
    coverImageId = $bindable(),
    roomDisplayBackgroundId = $bindable(),
    galleryImageIds = $bindable(),
    assetCache,
    onCoverImageChange,
    onRoomDisplayBackgroundChange,
    onGalleryImagesChange,
    onAssetCacheUpdate
  }: Props = $props();
</script>

<div class="space-y-6">
  <!-- Thumbnail / Cover Image -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-base-content">Game Thumbnail</h3>
      {#if coverImageId}
        <button
          type="button"
          class="btn btn-xs btn-ghost text-error"
          onclick={() => {
            onCoverImageChange(undefined);
          }}
        >
          Remove
        </button>
      {/if}
    </div>
    {#if coverImageId}
      {@const cachedAsset = assetCache[coverImageId]}
      <div class="rounded-xl border border-white/10 bg-base-100/70 p-3">
        <div class="flex items-center gap-3">
          <div class="h-16 w-16 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
            {#if cachedAsset?.url}
              <img src={cachedAsset.url} alt="Thumbnail" class="h-full w-full object-cover" />
            {:else}
              <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            {/if}
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-base-content">{cachedAsset?.filename || coverImageId}</p>
            <p class="text-xs text-base-content/60">Thumbnail image</p>
          </div>
        </div>
      </div>
    {:else}
      <AssetUpload
        gameId={gameSlug || 'temp'}
        assetType="thumbnail"
        accept="image/*"
        maxSizeMB={5}
        onSuccess={(asset) => {
          onCoverImageChange(asset.id);
          onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename });
        }}
      />
    {/if}
    <details class="collapse collapse-arrow bg-base-200/50">
      <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
      <div class="collapse-content">
        <AssetBrowser
          gameId={gameSlug}
          assetType="thumbnail"
          selectedAssetId={coverImageId}
          onSelect={(asset) => {
            onCoverImageChange(asset.id);
            onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename });
          }}
        />
      </div>
    </details>
  </section>

  <!-- Room Display Background -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-base-content">Room Display Background</h3>
      {#if roomDisplayBackgroundId}
        <button
          type="button"
          class="btn btn-xs btn-ghost text-error"
          onclick={() => {
            onRoomDisplayBackgroundChange(undefined);
          }}
        >
          Remove
        </button>
      {/if}
    </div>
    <p class="text-xs text-base-content/60">
      Background image or video displayed on the Room Display screen during gameplay. Recommended: 1920x1080 resolution.
    </p>
    {#if roomDisplayBackgroundId}
      {@const cachedAsset = assetCache[roomDisplayBackgroundId]}
      <div class="rounded-xl border border-white/10 bg-base-100/70 p-3">
        <div class="flex items-center gap-3">
          <div class="h-16 w-16 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
            {#if cachedAsset?.url}
              <img src={cachedAsset.url} alt="Room Display Background" class="h-full w-full object-cover" />
            {:else}
              <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            {/if}
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-base-content">{cachedAsset?.filename || roomDisplayBackgroundId}</p>
            <p class="text-xs text-base-content/60">Room Display background</p>
          </div>
        </div>
      </div>
    {:else}
      <AssetUpload
        gameId={gameSlug || 'temp'}
        assetType="room_background"
        accept="image/*,video/*"
        maxSizeMB={20}
        onSuccess={(asset) => {
          onRoomDisplayBackgroundChange(asset.id);
          onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename });
        }}
      />
    {/if}
    <details class="collapse collapse-arrow bg-base-200/50">
      <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
      <div class="collapse-content">
        <AssetBrowser
          gameId={gameSlug}
          assetType="room_background"
          selectedAssetId={roomDisplayBackgroundId}
          onSelect={(asset) => {
            onRoomDisplayBackgroundChange(asset.id);
            onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename });
          }}
        />
      </div>
    </details>
  </section>

  <!-- Gallery Images -->
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-base-content">Gallery Images</h3>
      <span class="text-xs text-base-content/60">
        {galleryImageIds?.length || 0} images
      </span>
    </div>
    {#if galleryImageIds && galleryImageIds.length > 0}
      <div class="grid gap-3 sm:grid-cols-3">
        {#each galleryImageIds as assetId, index (assetId)}
          {@const cachedAsset = assetCache[assetId]}
          <div class="relative rounded-lg border border-white/10 bg-base-100/70 p-2">
            <div class="aspect-video rounded bg-base-200 overflow-hidden flex items-center justify-center">
              {#if cachedAsset?.url}
                <img src={cachedAsset.url} alt="Gallery {index + 1}" class="h-full w-full object-cover" />
              {:else}
                <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              {/if}
            </div>
            <button
              type="button"
              class="btn btn-circle btn-xs btn-error absolute -right-2 -top-2"
              onclick={() => {
                const updatedIds = galleryImageIds.filter(id => id !== assetId);
                onGalleryImagesChange(updatedIds);
              }}
            >
              <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
    <AssetUpload
      gameId={gameSlug || 'temp'}
      assetType="gallery"
      accept="image/*"
      maxSizeMB={5}
      onSuccess={(asset) => {
        const updatedIds = [...(galleryImageIds || []), asset.id];
        onGalleryImagesChange(updatedIds);
        onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename });
      }}
    />
    <details class="collapse collapse-arrow bg-base-200/50">
      <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
      <div class="collapse-content">
        <AssetBrowser
          gameId={gameSlug}
          assetType="gallery"
          selectionMode="multiple"
          onSelectMultiple={(assets) => {
            const currentIds = galleryImageIds || [];
            const newIds = assets.map(a => a.id).filter(id => !currentIds.includes(id));
            if (newIds.length > 0) {
              onGalleryImagesChange([...currentIds, ...newIds]);
              assets.forEach(asset => onAssetCacheUpdate(asset.id, { url: asset.url, filename: asset.filename }));
            }
          }}
        />
      </div>
    </details>
  </section>
</div>
