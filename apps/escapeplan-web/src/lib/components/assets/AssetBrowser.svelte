<svelte:options runes={true} />

<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import MediaModal from '../media/MediaModal.svelte';

	interface AssetRecord {
		id: string;
		filename: string;
		originalFilename: string;
		mimeType: string;
		sizeBytes: number;
		assetType: string;
		mediaType: string | null;
		url: string;
		gameId: string | null;
		puzzleId: string | null;
		hintOrder: number | null;
		isReusable: boolean;
		uploadedAt: string;
	}

	interface AssetBrowserProps {
		gameId?: string;
		assetType?: string;
		mediaType?: string;
		isReusable?: boolean;
		onSelect?: (asset: AssetRecord) => void;
		selectedAssetId?: string;
		showSearch?: boolean;
	}

	let {
		gameId = undefined,
		assetType = undefined,
		mediaType = undefined,
		isReusable = undefined,
		onSelect = undefined,
		selectedAssetId = undefined,
		showSearch = true
	}: AssetBrowserProps = $props();

	let assets = $state<AssetRecord[]>([]);
	let games = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let filterAssetType = $state<string>('all');
	let filterMediaType = $state<string>('all');
	let selectedAssets = $state<Set<string>>(new Set());

	// Media player states
	let mediaModalOpen = $state(false);
	let currentMediaSrc = $state('');
	let currentMediaTitle = $state('');
	let currentMediaType = $state<'image' | 'audio' | 'video'>('image');

	// Info popup state
	let infoPopupOpen = $state(false);
	let currentAssetInfo = $state<AssetRecord | null>(null);

	// Dynamic filter options
	let availableAssetTypes = $state<string[]>([]);
	let availableMediaTypes = $state<string[]>([]);

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

			const result = await apiFetch<AssetRecord[]>(
				fetch,
				`/assets/list?${queryParams.toString()}`,
				{ credentials: 'include' }
			);

			let allAssets = Array.isArray(result) ? result : [];

			// Build dynamic filter options from actual data (only on first load)
			if (availableAssetTypes.length === 0) {
				const assetTypesSet = new Set(allAssets.map(a => a.assetType));
				availableAssetTypes = Array.from(assetTypesSet).sort();

				const mediaTypesSet = new Set(
					allAssets.map(a => a.mediaType).filter(Boolean) as string[]
				);
				availableMediaTypes = Array.from(mediaTypesSet).sort();
			}

			// Client-side filtering
			if (filterAssetType !== 'all') {
				allAssets = allAssets.filter((asset) => asset.assetType === filterAssetType);
			}
			if (filterMediaType !== 'all') {
				if (filterMediaType === 'image') {
					// Images have null media_type
					allAssets = allAssets.filter((asset) => !asset.mediaType);
				} else {
					allAssets = allAssets.filter((asset) => asset.mediaType === filterMediaType);
				}
			}

			assets = allAssets;

			// Load game names
			const gameIds = new Set(allAssets.map((a) => a.gameId).filter(Boolean) as string[]);
			if (gameIds.size > 0) {
				await loadGameNames(Array.from(gameIds));
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load assets';
			assets = [];
		} finally {
			loading = false;
		}
	}

	async function loadGameNames(gameIds: string[]) {
		try {
			const result = await apiFetch<Array<{ id: string; name: string }>>(
				fetch,
				'/admin/games',
				{ credentials: 'include' }
			);
			games = Object.fromEntries(result.map((g) => [g.id, g.name]));
		} catch (err) {
			console.error('Failed to load game names:', err);
		}
	}

	function openMedia(asset: AssetRecord) {
		currentMediaSrc = asset.url;
		currentMediaTitle = asset.originalFilename;

		// Determine media type
		if (asset.mediaType === 'video') {
			currentMediaType = 'video';
		} else if (asset.mediaType === 'audio') {
			currentMediaType = 'audio';
		} else {
			currentMediaType = 'image';
		}

		mediaModalOpen = true;
	}

	function closeMedia() {
		mediaModalOpen = false;
		currentMediaSrc = '';
		currentMediaTitle = '';
	}

	function openInfo(asset: AssetRecord, event: Event) {
		event.stopPropagation();
		currentAssetInfo = asset;
		infoPopupOpen = true;
	}

	function closeInfo() {
		infoPopupOpen = false;
		currentAssetInfo = null;
	}

	function toggleSelectAsset(assetId: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedAssets);
		if (newSet.has(assetId)) {
			newSet.delete(assetId);
		} else {
			newSet.add(assetId);
		}
		selectedAssets = newSet;
	}

	function selectAll() {
		selectedAssets = new Set(assets.map((a) => a.id));
	}

	function clearSelection() {
		selectedAssets = new Set();
	}

	async function downloadSelected() {
		for (const assetId of selectedAssets) {
			const asset = assets.find((a) => a.id === assetId);
			if (asset) {
				const link = document.createElement('a');
				link.href = asset.url;
				link.download = asset.originalFilename;
				link.click();
			}
		}
	}

	async function deleteSelected() {
		if (!confirm(`Delete ${selectedAssets.size} asset(s)? This cannot be undone.`)) {
			return;
		}

		try {
			for (const assetId of selectedAssets) {
				await apiFetch(fetch, `/assets/${assetId}`, {
					method: 'DELETE',
					credentials: 'include'
				});
			}
			clearSelection();
			await loadAssets();
		} catch (err) {
			alert('Failed to delete assets: ' + (err instanceof Error ? err.message : 'Unknown error'));
		}
	}

	function getMediaIcon(asset: AssetRecord): string {
		if (asset.mediaType === 'video') {
			return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
		}
		if (asset.mediaType === 'audio') {
			return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
		}
		// Image
		return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
	}

	function formatFileSize(bytes: number): string {
		if (!bytes || bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
	}

	function getFileExtension(filename: string): string {
		const parts = filename.split('.');
		return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
	}

	// Load assets on mount and when user input changes
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		// Watch user inputs
		searchQuery;
		filterAssetType;
		filterMediaType;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			loadAssets();
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<div class="space-y-4">
	<!-- Search & Filter Bar -->
	{#if showSearch}
		<div class="flex flex-wrap gap-2">
			<input
				type="search"
				placeholder="Search assets..."
				class="input input-bordered input-sm flex-1 min-w-[200px]"
				bind:value={searchQuery}
			/>
			<select class="select select-bordered select-sm" bind:value={filterAssetType}>
				<option value="all">All Asset Types</option>
				{#each availableAssetTypes as type}
					{#if type}
						<option value={type}>{type.replace(/_/g, ' ')}</option>
					{/if}
				{/each}
			</select>
			<select class="select select-bordered select-sm" bind:value={filterMediaType}>
				<option value="all">All Media Types</option>
				<option value="image">Images</option>
				{#each availableMediaTypes as type}
					{#if type}
						<option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
					{/if}
				{/each}
			</select>
			<button type="button" class="btn btn-secondary btn-sm" onclick={loadAssets}>
				<svg
					class="h-4 w-4"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
			</button>
		</div>
	{/if}

	<!-- Multi-select Actions -->
	{#if selectedAssets.size > 0}
		<div class="flex items-center justify-between bg-base-200 rounded-lg p-3">
			<span class="text-sm font-medium">{selectedAssets.size} selected</span>
			<div class="flex gap-2">
				<button type="button" class="btn btn-sm btn-ghost" onclick={clearSelection}>
					Clear
				</button>
				<button type="button" class="btn btn-sm btn-info" onclick={downloadSelected}>
					<svg
						class="h-4 w-4"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						/>
					</svg>
					Download
				</button>
				<button type="button" class="btn btn-sm btn-error" onclick={deleteSelected}>
					<svg
						class="h-4 w-4"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Delete
				</button>
			</div>
		</div>
	{:else}
		<div class="flex justify-end">
			<button type="button" class="btn btn-sm btn-ghost" onclick={selectAll}>Select All</button>
		</div>
	{/if}

	<!-- Loading/Error/Empty States -->
	{#if loading}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<svg
				class="h-6 w-6"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	{:else if assets.length === 0}
		<div
			class="rounded-xl border border-dashed border-base-content/20 bg-base-100/70 p-12 text-center"
		>
			<svg
				class="mx-auto h-12 w-12 text-base-content/40"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
				/>
			</svg>
			<p class="mt-4 text-sm text-base-content/60">No assets found</p>
		</div>
	{:else}
		<!-- Asset Grid - Mobile First, Responsive -->
		<div class="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each assets as asset (asset.id)}
				<div
					class={`card card-compact bg-base-200 shadow-sm transition-all hover:shadow-md cursor-pointer ${
						selectedAssets.has(asset.id) ? 'ring-2 ring-primary' : ''
					}`}
					onclick={() => openMedia(asset)}
				>
					<!-- Thumbnail -->
					<figure class="relative h-32 bg-base-300">
						{#if !asset.mediaType}
							<!-- Image thumbnail -->
							<img
								src={asset.url}
								alt={asset.originalFilename}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						{:else}
							<!-- Audio/Video icon -->
							<div class="flex h-full w-full items-center justify-center">
								<svg
									class="h-12 w-12 text-base-content/30"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d={getMediaIcon(asset)}
									/>
								</svg>
							</div>
						{/if}
						<!-- Select Checkbox -->
						<div class="absolute top-2 left-2" onclick={(e) => e.stopPropagation()}>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								checked={selectedAssets.has(asset.id)}
								onchange={(e) => toggleSelectAsset(asset.id, e)}
							/>
						</div>
						<!-- Reusable Badge -->
						{#if asset.isReusable}
							<div class="badge badge-secondary badge-xs absolute top-2 right-2">Reusable</div>
						{/if}
					</figure>

					<!-- Card Body -->
					<div class="card-body p-2">
						<!-- Filename -->
						<h3
							class="text-xs font-medium truncate leading-tight"
							title={asset.originalFilename}
						>
							{asset.originalFilename}
						</h3>

						<!-- Extension & Size -->
						<div class="flex items-center justify-between gap-1 mt-1">
							<div class="flex items-center gap-1">
								<span class="badge badge-xs badge-outline">{getFileExtension(asset.filename).toUpperCase()}</span>
								<span class="text-[10px] text-base-content/60">{formatFileSize(asset.sizeBytes)}</span>
							</div>
							<!-- Info Button -->
							<button
								type="button"
								class="btn btn-xs btn-circle btn-ghost"
								onclick={(e) => openInfo(asset, e)}
								title="View details"
							>
								<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Media Modal -->
<MediaModal
	isOpen={mediaModalOpen}
	src={currentMediaSrc}
	title={currentMediaTitle}
	mediaType={currentMediaType}
	windowScale={85}
	showControls={true}
	autoPlay={true}
	mediaLoop={false}
	onClose={closeMedia}
/>

<!-- Info Popup Modal - Constrained to main content area -->
{#if infoPopupOpen && currentAssetInfo}
	<div class="fixed inset-0 left-64 z-[9998] flex items-center justify-center bg-black/50" onclick={closeInfo}>
		<div class="bg-base-100 rounded-lg shadow-xl max-w-md w-full m-4" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-base-300">
				<h3 class="text-lg font-bold">Asset Details</h3>
				<button type="button" class="btn btn-sm btn-circle btn-ghost" onclick={closeInfo}>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-4 space-y-3 text-sm">
				<div>
					<span class="font-semibold">Original Filename:</span>
					<p class="text-base-content/70">{currentAssetInfo.originalFilename}</p>
				</div>
				<div>
					<span class="font-semibold">Stored Filename:</span>
					<p class="text-base-content/70 break-all">{currentAssetInfo.filename}</p>
				</div>
				<div>
					<span class="font-semibold">Extension:</span>
					<span class="badge badge-outline ml-2">{getFileExtension(currentAssetInfo.filename).toUpperCase()}</span>
				</div>
				<div>
					<span class="font-semibold">File Size:</span>
					<span class="ml-2">{formatFileSize(currentAssetInfo.sizeBytes)}</span>
				</div>
				<div>
					<span class="font-semibold">Type:</span>
					<span class="ml-2">{currentAssetInfo.assetType ? currentAssetInfo.assetType.replace(/_/g, ' ') : 'Unknown'}</span>
				</div>
				{#if currentAssetInfo.mediaType}
					<div>
						<span class="font-semibold">Media Type:</span>
						<span class="ml-2">{currentAssetInfo.mediaType.charAt(0).toUpperCase() + currentAssetInfo.mediaType.slice(1)}</span>
					</div>
				{/if}
				{#if currentAssetInfo.gameId && games[currentAssetInfo.gameId]}
					<div>
						<span class="font-semibold">Game:</span>
						<p class="text-base-content/70">{games[currentAssetInfo.gameId]}</p>
					</div>
				{/if}
				{#if currentAssetInfo.puzzleId}
					<div>
						<span class="font-semibold">Puzzle ID:</span>
						<span class="ml-2">{currentAssetInfo.puzzleId}</span>
					</div>
				{/if}
				{#if currentAssetInfo.hintOrder !== null && currentAssetInfo.hintOrder !== undefined}
					<div>
						<span class="font-semibold">Hint Order:</span>
						<span class="ml-2">#{currentAssetInfo.hintOrder}</span>
					</div>
				{/if}
				{#if currentAssetInfo.isReusable}
					<div>
						<span class="badge badge-secondary">Reusable Asset</span>
					</div>
				{/if}
				<div>
					<span class="font-semibold">Uploaded:</span>
					<p class="text-base-content/70">{new Date(currentAssetInfo.uploadedAt).toLocaleString()}</p>
				</div>
			</div>
		</div>
	</div>
{/if}
