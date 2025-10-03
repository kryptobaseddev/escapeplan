<svelte:options runes={true} />

<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import VideoPlayerModal from '../media/VideoPlayerModal.svelte';

	interface AssetRecord {
		id: string;
		filename: string;
		original_filename: string;
		mime_type: string;
		size_bytes: number;
		asset_type: string;
		media_type: string | null;
		game_id: string | null;
		puzzle_id: string | null;
		hint_order: number | null;
		is_reusable: number;
		uploaded_at: string;
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
	let puzzles = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let filterType = $state<'all' | 'images' | 'audio' | 'video'>('all');
	let selectedAssets = $state<Set<string>>(new Set());
	let videoModalOpen = $state(false);
	let currentVideoSrc = $state('');
	let currentVideoTitle = $state('');

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

			// Client-side filtering by type
			if (filterType !== 'all') {
				allAssets = allAssets.filter((asset) => {
					if (filterType === 'images') return asset.mime_type.startsWith('image/');
					if (filterType === 'audio') return asset.mime_type.startsWith('audio/');
					if (filterType === 'video') return asset.mime_type.startsWith('video/');
					return true;
				});
			}

			assets = allAssets;

			// Load game names
			const gameIds = new Set(allAssets.map((a) => a.game_id).filter(Boolean) as string[]);
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
			// Assuming there's an endpoint to get game names - if not, we'll fetch all games
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

	function handleSelect(asset: AssetRecord) {
		onSelect?.(asset);
	}

	function toggleSelectAsset(assetId: string) {
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
				const url = `/assets/${asset.filename}`;
				const link = document.createElement('a');
				link.href = url;
				link.download = asset.original_filename;
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

	function playAsset(asset: AssetRecord) {
		const url = `/assets/${asset.filename}`;
		if (asset.mime_type.startsWith('video/')) {
			currentVideoSrc = url;
			currentVideoTitle = asset.original_filename;
			videoModalOpen = true;
		} else if (asset.mime_type.startsWith('audio/')) {
			const audio = new Audio(url);
			audio.play();
		}
	}

	function getAssetTypeIcon(mimeType: string): string {
		if (mimeType.includes('image'))
			return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
		if (mimeType.includes('audio'))
			return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
		if (mimeType.includes('video'))
			return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
		return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
	}

	$effect(() => {
		loadAssets();
	});

	$effect(() => {
		searchQuery;
		const timeout = setTimeout(() => loadAssets(), 300);
		return () => clearTimeout(timeout);
	});

	$effect(() => {
		filterType;
		loadAssets();
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
			<select class="select select-bordered select-sm" bind:value={filterType}>
				<option value="all">All Types</option>
				<option value="images">Images</option>
				<option value="audio">Audio</option>
				<option value="video">Video</option>
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
					class={`card card-compact bg-base-200 shadow-sm transition-all hover:shadow-md ${
						selectedAssets.has(asset.id) ? 'ring-2 ring-primary' : ''
					}`}
				>
					<!-- Thumbnail -->
					<figure class="relative h-32 bg-base-300 cursor-pointer" onclick={() => handleSelect(asset)}>
						{#if asset.mime_type.startsWith('image/')}
							<img
								src={`/assets/${asset.filename}`}
								alt={asset.original_filename}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						{:else}
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
										d={getAssetTypeIcon(asset.mime_type)}
									/>
								</svg>
							</div>
						{/if}
						<!-- Select Checkbox -->
						<div class="absolute top-2 left-2">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								checked={selectedAssets.has(asset.id)}
								onchange={() => toggleSelectAsset(asset.id)}
							/>
						</div>
						<!-- Reusable Badge -->
						{#if asset.is_reusable}
							<div class="badge badge-secondary badge-xs absolute top-2 right-2">Reusable</div>
						{/if}
					</figure>

					<!-- Card Body -->
					<div class="card-body p-2">
						<!-- Filenames -->
						<h3
							class="text-xs font-medium truncate"
							title={asset.original_filename}
						>
							{asset.original_filename}
						</h3>
						<p class="text-[10px] text-base-content/60 truncate" title={asset.filename}>
							{asset.filename}
						</p>

						<!-- Metadata -->
						<div class="flex flex-col gap-1 text-[10px] text-base-content/60">
							{#if asset.game_id && games[asset.game_id]}
								<div class="flex items-center gap-1">
									<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"></path>
									</svg>
									<span class="truncate">{games[asset.game_id]}</span>
								</div>
							{/if}
							{#if asset.puzzle_id}
								<div class="flex items-center gap-1">
									<span>Puzzle #{asset.hint_order || '?'}</span>
								</div>
							{/if}
							<span>{formatFileSize(asset.size_bytes)}</span>
						</div>

						<!-- Action Buttons -->
						<div class="card-actions justify-end mt-1">
							{#if asset.mime_type.startsWith('video/') || asset.mime_type.startsWith('audio/')}
								<button
									type="button"
									class="btn btn-xs btn-circle btn-ghost"
									onclick={() => playAsset(asset)}
									title="Play"
								>
									<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
										<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
									</svg>
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Video Player Modal -->
<VideoPlayerModal
	src={currentVideoSrc}
	title={currentVideoTitle}
	isOpen={videoModalOpen}
	onClose={() => (videoModalOpen = false)}
/>
