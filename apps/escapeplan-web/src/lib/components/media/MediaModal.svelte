<svelte:options runes={true} />

<script lang="ts">
	interface AssetDetails {
		filename: string;
		size: string;
		type: string;
		uploadedAt?: string;
		[key: string]: any;
	}

	interface MediaModalProps {
		isOpen: boolean;
		src: string;
		title: string;
		mediaType: 'audio' | 'video' | 'image';
		windowScale?: number; // Percentage of viewport area (10-100)
		showControls?: boolean;
		assetDetails?: AssetDetails | null;
		assetDetailsPosition?: 'top' | 'bottom' | 'left' | 'right';
		autoPlay?: boolean;
		mediaLoop?: boolean;
		onClose: () => void;
	}

	let {
		isOpen = false,
		src,
		title,
		mediaType,
		windowScale = 80,
		showControls = true,
		assetDetails = null,
		assetDetailsPosition = 'bottom',
		autoPlay = false,
		mediaLoop = false,
		onClose
	}: MediaModalProps = $props();

	// Clamp windowScale between 10-100
	const scale = $derived(Math.max(10, Math.min(100, windowScale)));

	// Calculate if layout should be horizontal or vertical
	const isHorizontal = $derived(assetDetailsPosition === 'left' || assetDetailsPosition === 'right');

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			onClose();
		}
	}

	function handleBackdropClick() {
		onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal backdrop - fills entire main content area (no sidebar overlap) -->
	<div
		class="fixed inset-y-0 left-64 right-0 z-[9999] flex items-center justify-center bg-black/90 p-6"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="media-modal-title"
	>
		<!-- Modal container - scales based on windowScale prop -->
		<div
			class="relative flex {isHorizontal ? 'flex-row' : 'flex-col'} gap-4 bg-base-300 rounded-lg shadow-2xl"
			style="width: {scale}%; max-height: {scale}vh;"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header: Title and Close Button (always at top) -->
			<div class="flex items-center justify-between gap-4 px-4 py-3 bg-base-200 rounded-t-lg">
				<h2 id="media-modal-title" class="text-lg font-semibold truncate flex-1">
					{title}
				</h2>
				<button
					type="button"
					class="btn btn-sm btn-circle btn-ghost hover:btn-error"
					onclick={onClose}
					aria-label="Close modal"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content area with optional asset details -->
			<div class="flex {isHorizontal ? 'flex-row' : 'flex-col'} gap-4 p-4 flex-1 overflow-hidden">
				<!-- Asset Details - Top/Left -->
				{#if assetDetails && (assetDetailsPosition === 'top' || assetDetailsPosition === 'left')}
					<div
						class="bg-base-200 rounded-lg p-4 {assetDetailsPosition === 'left'
							? 'w-64 overflow-y-auto'
							: 'w-full'}"
					>
						<h3 class="text-sm font-semibold mb-3 text-base-content/70">Asset Details</h3>
						<div class="space-y-2 text-sm">
							<div>
								<span class="font-medium">Filename:</span>
								<p class="text-base-content/70 break-all">{assetDetails.filename}</p>
							</div>
							<div>
								<span class="font-medium">Size:</span>
								<p class="text-base-content/70">{assetDetails.size}</p>
							</div>
							<div>
								<span class="font-medium">Type:</span>
								<p class="text-base-content/70">{assetDetails.type}</p>
							</div>
							{#if assetDetails.uploadedAt}
								<div>
									<span class="font-medium">Uploaded:</span>
									<p class="text-base-content/70">{assetDetails.uploadedAt}</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Media Content -->
				<div class="flex items-center justify-center flex-1 overflow-hidden rounded-lg bg-black">
					{#if mediaType === 'image'}
						<img
							{src}
							alt={title}
							class="max-w-full max-h-full object-contain"
							loading="eager"
						/>
					{:else if mediaType === 'video'}
						<!-- Native HTML5 video - works in Chrome, Safari, Edge, Silk -->
						<video
							{src}
							{title}
							controls={showControls}
							autoplay={autoPlay}
							loop={mediaLoop}
							playsinline
							class="w-full h-full object-contain"
							preload="metadata"
						>
							<track kind="captions" />
							Your browser does not support the video element.
						</video>
					{:else if mediaType === 'audio'}
						<div class="flex flex-col items-center justify-center gap-6 p-8 w-full">
							<!-- Audio icon -->
							<svg
								class="w-24 h-24 text-primary"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
								/>
							</svg>
							<!-- Native HTML5 audio - works in all browsers -->
							{#if showControls}
								<audio
									{src}
									controls
									autoplay={autoPlay}
									loop={mediaLoop}
									class="w-full max-w-md"
									preload="metadata"
								>
									Your browser does not support the audio element.
								</audio>
							{:else}
								<audio {src} autoplay={autoPlay} loop={mediaLoop} preload="metadata">
									<track kind="captions" />
								</audio>
								<p class="text-sm text-base-content/60">Playing in headless mode...</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Asset Details - Bottom/Right -->
				{#if assetDetails && (assetDetailsPosition === 'bottom' || assetDetailsPosition === 'right')}
					<div
						class="bg-base-200 rounded-lg p-4 {assetDetailsPosition === 'right'
							? 'w-64 overflow-y-auto'
							: 'w-full'}"
					>
						<h3 class="text-sm font-semibold mb-3 text-base-content/70">Asset Details</h3>
						<div class="space-y-2 text-sm">
							<div>
								<span class="font-medium">Filename:</span>
								<p class="text-base-content/70 break-all">{assetDetails.filename}</p>
							</div>
							<div>
								<span class="font-medium">Size:</span>
								<p class="text-base-content/70">{assetDetails.size}</p>
							</div>
							<div>
								<span class="font-medium">Type:</span>
								<p class="text-base-content/70">{assetDetails.type}</p>
							</div>
							{#if assetDetails.uploadedAt}
								<div>
									<span class="font-medium">Uploaded:</span>
									<p class="text-base-content/70">{assetDetails.uploadedAt}</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure media fills container properly */
	video,
	audio {
		display: block;
	}

	/* Remove default focus outline on video/audio, use DaisyUI focus instead */
	video:focus,
	audio:focus {
		outline: 2px solid hsl(var(--p));
		outline-offset: 2px;
	}
</style>
