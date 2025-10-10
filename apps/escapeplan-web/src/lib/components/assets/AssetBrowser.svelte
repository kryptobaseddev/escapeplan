<svelte:options runes={true} />

<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import MediaModal from '../media/MediaModal.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import { openConfirmDialog } from '$lib/components/confirm-dialog';

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
		onSelectMultiple?: (assets: AssetRecord[]) => void;
		selectedAssetId?: string;
		showSearch?: boolean;
		selectionMode?: 'single' | 'multiple';
		refreshKey?: number;
	}

	let {
		gameId = undefined,
		assetType = undefined,
		mediaType = undefined,
		isReusable = undefined,
		onSelect = undefined,
		onSelectMultiple = undefined,
		selectedAssetId = undefined,
		showSearch = true,
		selectionMode = 'single',
		refreshKey = 0
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
	let currentPreviewAsset = $state<AssetRecord | null>(null);

	// Info popup state
	let infoPopupOpen = $state(false);
	let currentAssetInfo = $state<AssetRecord | null>(null);

	// Game info popup state
	let gameInfoPopupOpen = $state(false);
	let currentGameInfo = $state<any | null>(null);

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
		currentPreviewAsset = asset;

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
		currentPreviewAsset = null;
	}

	function selectPreviewAsset() {
		if (currentPreviewAsset && onSelect) {
			onSelect(currentPreviewAsset);
			closeMedia();
		}
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

	async function openGameInfo(asset: AssetRecord, event: Event) {
		event.stopPropagation();
		if (!asset.gameId) return;

		try {
			const gameData = await apiFetch<any>(
				fetch,
				`/admin/games/${asset.gameId}`,
				{ credentials: 'include' }
			);
			currentGameInfo = gameData;
			gameInfoPopupOpen = true;
		} catch (err) {
			console.error('Failed to load game details:', err);
			await openConfirmDialog({
				title: 'Failed to Load Game',
				message: 'Failed to load game information: ' + (err instanceof Error ? err.message : 'Unknown error'),
				confirmText: 'OK',
				variant: 'danger'
			});
		}
	}

	function closeGameInfo() {
		gameInfoPopupOpen = false;
		currentGameInfo = null;
	}

	function toggleSelectAsset(assetId: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedAssets);

		if (selectionMode === 'single') {
			// Single mode: clear all selections first, then add new asset (radio-style)
			if (newSet.has(assetId)) {
				newSet.delete(assetId);
			} else {
				newSet.clear();
				newSet.add(assetId);
			}
		} else {
			// Multiple mode: toggle behavior (checkbox-style)
			if (newSet.has(assetId)) {
				newSet.delete(assetId);
			} else {
				newSet.add(assetId);
			}
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
		const assetCount = selectedAssets.size;
		const assetWord = assetCount === 1 ? 'asset' : 'assets';

		const confirmed = await openConfirmDialog({
			title: `Delete ${assetCount} ${assetWord}`,
			message: `Are you sure you want to delete ${assetCount === 1 ? 'this asset' : `these ${assetCount} assets`}? This action cannot be undone.`,
			confirmText: 'Delete',
			cancelText: 'Cancel',
			variant: 'danger'
		});

		if (!confirmed) {
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
			await openConfirmDialog({
				title: 'Delete Failed',
				message: 'Failed to delete assets: ' + (err instanceof Error ? err.message : 'Unknown error'),
				confirmText: 'OK',
				variant: 'danger'
			});
		}
	}

	function handleSelectMultiple() {
		if (onSelectMultiple) {
			const selectedAssetsList = assets.filter(a => selectedAssets.has(a.id));
			onSelectMultiple(selectedAssetsList);
			clearSelection();
		}
	}

	function handleSelectSingle() {
		if (onSelect && selectedAssets.size > 0) {
			const assetId = Array.from(selectedAssets)[0];
			const asset = assets.find(a => a.id === assetId);
			if (asset) {
				onSelect(asset);
				clearSelection();
			}
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
		// Watch ALL filter inputs including props
		gameId;
		assetType;
		mediaType;
		searchQuery;
		filterAssetType;
		filterMediaType;
		refreshKey; // Watch refreshKey to trigger refresh on parent request

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
			{#if !assetType}
				<select class="select select-bordered select-sm" bind:value={filterAssetType}>
					<option value="all">All Asset Types</option>
					{#each availableAssetTypes as type}
						{#if type}
							<option value={type}>{type.replace(/_/g, ' ')}</option>
						{/if}
					{/each}
				</select>
			{/if}
			{#if !mediaType}
				<select class="select select-bordered select-sm" bind:value={filterMediaType}>
					<option value="all">All Media Types</option>
					<option value="image">Images</option>
					{#each availableMediaTypes as type}
						{#if type}
							<option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
						{/if}
					{/each}
				</select>
			{/if}
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

	<!-- Multi-select Actions (only show in multiple mode) -->
	{#if selectionMode === 'multiple'}
		{#if selectedAssets.size > 0}
			<div class="flex items-center justify-between bg-base-200 rounded-lg p-3">
				<span class="text-sm font-medium">{selectedAssets.size} selected</span>
				<div class="flex gap-2">
					<button type="button" class="btn btn-sm btn-ghost" onclick={clearSelection}>
						Clear
					</button>
					{#if onSelectMultiple}
						<button type="button" class="btn btn-sm btn-primary" onclick={handleSelectMultiple}>
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
									d="M5 13l4 4L19 7"
								/>
							</svg>
							Use Selected
						</button>
					{/if}
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
	{/if}

	<!-- Single-select Actions (only show in single mode with selection) -->
	{#if selectionMode === 'single' && selectedAssets.size > 0}
		<div class="flex items-center justify-between bg-base-200 rounded-lg p-3">
			<span class="text-sm font-medium">1 selected</span>
			<div class="flex gap-2">
				<button type="button" class="btn btn-sm btn-ghost" onclick={clearSelection}>
					Clear
				</button>
				{#if onSelect}
					<button type="button" class="btn btn-success btn-sm" onclick={handleSelectSingle}>
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
								d="M5 13l4 4L19 7"
							/>
						</svg>
						<span class="hidden sm:inline">Use Selected</span>
					</button>
				{/if}
				<button type="button" class="btn btn-error btn-sm" onclick={deleteSelected}>
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
					<span class="hidden sm:inline">Delete</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Loading/Error/Empty States -->
	{#if loading}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<Alert type="error">
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
		</Alert>
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
					} ${selectedAssetId === asset.id ? 'ring-2 ring-accent' : ''}`}
					onclick={() => {
						// Always open preview modal when clicking the card
						openMedia(asset);
					}}
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
						<!-- Select Checkbox (show in both single and multiple modes) -->
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
							<div class="flex items-center gap-1">
								<!-- Game Badge (only show if asset has gameId) -->
								{#if asset.gameId}
									<button
										type="button"
										class="btn btn-xs btn-circle btn-ghost"
										onclick={(e) => openGameInfo(asset, e)}
										title="View game info"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
										</svg>
									</button>
								{/if}
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

<!-- Selection Action Overlay (only in single select mode with onSelect callback) -->
{#if mediaModalOpen && selectionMode === 'single' && onSelect && currentPreviewAsset}
	<div class="fixed inset-y-0 left-64 right-0 z-[10000] flex items-end justify-center pb-12 pointer-events-none">
		<button
			type="button"
			class="btn btn-primary btn-lg pointer-events-auto shadow-2xl"
			onclick={selectPreviewAsset}
		>
			<svg
				class="h-5 w-5"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 13l4 4L19 7"
				/>
			</svg>
			Select This Asset
		</button>
	</div>
{/if}

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

<!-- Game Info Popup Modal - Constrained to main content area -->
{#if gameInfoPopupOpen && currentGameInfo}
	<div class="fixed inset-0 left-64 z-[9998] flex items-center justify-center bg-black/50" onclick={closeGameInfo}>
		<div class="bg-base-100 rounded-lg shadow-xl max-w-lg w-full m-4" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-base-300">
				<div class="flex items-center gap-2">
					<svg class="h-6 w-6 text-warning" fill="currentColor" viewBox="0 0 24 24">
						<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
					</svg>
					<h3 class="text-lg font-bold">Game Information</h3>
				</div>
				<button type="button" class="btn btn-sm btn-circle btn-ghost" onclick={closeGameInfo}>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-4 space-y-3 text-sm">
				<div>
					<span class="font-semibold">Game Name:</span>
					<p class="text-lg text-base-content/90 mt-1">{currentGameInfo.name}</p>
				</div>
				{#if currentGameInfo.description}
					<div>
						<span class="font-semibold">Description:</span>
						<p class="text-base-content/70 mt-1">{currentGameInfo.description}</p>
					</div>
				{/if}
				{#if currentGameInfo.duration}
					<div>
						<span class="font-semibold">Duration:</span>
						<span class="ml-2">{currentGameInfo.duration} minutes</span>
					</div>
				{/if}
				{#if currentGameInfo.difficulty}
					<div>
						<span class="font-semibold">Difficulty:</span>
						<span class="ml-2 capitalize">{currentGameInfo.difficulty}</span>
					</div>
				{/if}
				{#if currentGameInfo.maxPlayers}
					<div>
						<span class="font-semibold">Max Players:</span>
						<span class="ml-2">{currentGameInfo.maxPlayers}</span>
					</div>
				{/if}
				{#if currentGameInfo.minPlayers}
					<div>
						<span class="font-semibold">Min Players:</span>
						<span class="ml-2">{currentGameInfo.minPlayers}</span>
					</div>
				{/if}
				{#if currentGameInfo.basePrice !== null && currentGameInfo.basePrice !== undefined}
					<div>
						<span class="font-semibold">Base Price:</span>
						<span class="ml-2">${(currentGameInfo.basePrice / 100).toFixed(2)}</span>
					</div>
				{/if}
				{#if currentGameInfo.pricePerPlayer !== null && currentGameInfo.pricePerPlayer !== undefined}
					<div>
						<span class="font-semibold">Price Per Player:</span>
						<span class="ml-2">${(currentGameInfo.pricePerPlayer / 100).toFixed(2)}</span>
					</div>
				{/if}
				{#if currentGameInfo.slug}
					<div>
						<span class="font-semibold">Slug:</span>
						<span class="ml-2 font-mono text-xs">{currentGameInfo.slug}</span>
					</div>
				{/if}
				{#if currentGameInfo.isActive !== null && currentGameInfo.isActive !== undefined}
					<div>
						<span class="font-semibold">Status:</span>
						<span class="badge badge-sm ml-2 {currentGameInfo.isActive ? 'badge-success' : 'badge-warning'}">
							{currentGameInfo.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
