<svelte:options runes={true} />

<script lang="ts">
	import type { Camera } from '@escapeplan/contracts';

	interface Props {
		camera: Camera;
		showControls?: boolean;
		autoplay?: boolean;
	}

	let { camera, showControls = true, autoplay = true }: Props = $props();

	let videoElement = $state<HTMLVideoElement | null>(null);
	let hls = $state<any>(null);
	let isMuted = $state(true);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// PTZ state
	let ptzPan = $state(camera.ptzPan || 0);
	let ptzTilt = $state(camera.ptzTilt || 0);
	let ptzZoom = $state(camera.ptzZoom || 0);

	// IR state
	let irMode = $state(camera.irMode || 'auto');

	// Audio state
	let audioVolume = $state(camera.audioVolume || 50);

	const streamUrl = $derived(`/api/admin/cameras/${camera.id}/stream.m3u8`);

	// Initialize HLS stream when video element is available
	$effect(() => {
		if (!videoElement) return;

		// Capture the video element reference for use in async function
		const video = videoElement;

		const initializeStream = async () => {
			if (video.canPlayType('application/vnd.apple.mpegurl')) {
				// Native HLS support (Safari)
				video.src = streamUrl;
				video.addEventListener('loadedmetadata', () => {
					isLoading = false;
					if (autoplay) {
						video.play().catch(err => {
							error = 'Failed to autoplay: ' + err.message;
						});
					}
				});
			} else {
				// Use HLS.js for browsers without native support
				try {
					const Hls = (await import('hls.js')).default;
					if (Hls.isSupported()) {
						hls = new Hls({
							enableWorker: true,
							lowLatencyMode: true,
							backBufferLength: 90,
						});
						hls.loadSource(streamUrl);
						hls.attachMedia(video);
						hls.on(Hls.Events.MANIFEST_PARSED, () => {
							isLoading = false;
							if (autoplay) {
								video.play().catch(err => {
									error = 'Failed to autoplay: ' + err.message;
								});
							}
						});
						hls.on(Hls.Events.ERROR, (event: any, data: any) => {
							if (data.fatal) {
								if (data.details === 'manifestLoadError' && data.response?.code === 503) {
									error = 'HLS streaming not yet configured. RTSP→HLS transcoding service required.';
								} else {
									error = `Stream error: ${data.type} - ${data.details || 'Unknown error'}`;
								}
								isLoading = false;
							}
						});
					} else {
						error = 'HLS is not supported in this browser';
						isLoading = false;
					}
				} catch (err) {
					error = 'Failed to load HLS player';
					isLoading = false;
				}
			}
		};

		initializeStream();

		// Cleanup function
		return () => {
			if (hls) {
				hls.destroy();
				hls = null;
			}
		};
	});

	function toggleMute() {
		isMuted = !isMuted;
		if (videoElement) {
			videoElement.muted = isMuted;
		}
	}

	async function updatePtz() {
		try {
			await fetch(`/api/admin/cameras/${camera.id}/ptz`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pan: ptzPan, tilt: ptzTilt, zoom: ptzZoom })
			});
		} catch (err) {
			console.error('Failed to update PTZ:', err);
		}
	}

	async function updateIrMode() {
		try {
			await fetch(`/api/admin/cameras/${camera.id}/ir`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ irMode })
			});
		} catch (err) {
			console.error('Failed to update IR mode:', err);
		}
	}

	async function updateAudioVolume() {
		try {
			await fetch(`/api/admin/cameras/${camera.id}/audio`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ volume: audioVolume })
			});
			if (videoElement) {
				videoElement.volume = audioVolume / 100;
			}
		} catch (err) {
			console.error('Failed to update audio volume:', err);
		}
	}
</script>

<div class="camera-viewer">
	<div class="video-container relative">
		<video
			bind:this={videoElement}
			class="w-full h-auto bg-black rounded-lg"
			muted={isMuted}
			playsinline
			controls={false}
		></video>

		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{/if}

		{#if error}
			<div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
				<div class="alert alert-error max-w-sm">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{error}</span>
				</div>
			</div>
		{/if}

		<!-- Camera name overlay -->
		<div class="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded-md text-sm font-medium">
			{camera.name}
		</div>

		<!-- Status indicator -->
		<div class="absolute top-2 right-2">
			{#if camera.status === 'online'}
				<div class="badge badge-success gap-1">
					<div class="w-2 h-2 rounded-full bg-white animate-pulse"></div>
					LIVE
				</div>
			{:else}
				<div class="badge badge-error">{camera.status.toUpperCase()}</div>
			{/if}
		</div>
	</div>

	{#if showControls}
		<div class="controls-container mt-4 space-y-4">
			<!-- Audio Controls -->
			{#if camera.hasAudio}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<h3 class="card-title text-sm">Audio Controls</h3>
						<div class="flex items-center gap-4">
							<button class="btn btn-sm" onclick={toggleMute}>
								{#if isMuted}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
									</svg>
									Unmute
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
									</svg>
									Mute
								{/if}
							</button>
							<input
								type="range"
								bind:value={audioVolume}
								onchange={updateAudioVolume}
								min="0"
								max="100"
								class="range range-sm flex-1"
							/>
							<span class="text-sm font-mono w-12 text-right">{audioVolume}%</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- PTZ Controls -->
			{#if camera.hasPtz}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<h3 class="card-title text-sm">PTZ Controls</h3>
						<div class="space-y-3">
							<div>
								<label class="label label-text-alt">Pan: {ptzPan}°</label>
								<input
									type="range"
									bind:value={ptzPan}
									onchange={updatePtz}
									min="-180"
									max="180"
									step="5"
									class="range range-sm"
								/>
							</div>
							<div>
								<label class="label label-text-alt">Tilt: {ptzTilt}°</label>
								<input
									type="range"
									bind:value={ptzTilt}
									onchange={updatePtz}
									min="-90"
									max="90"
									step="5"
									class="range range-sm"
								/>
							</div>
							<div>
								<label class="label label-text-alt">Zoom: {ptzZoom}%</label>
								<input
									type="range"
									bind:value={ptzZoom}
									onchange={updatePtz}
									min="0"
									max="100"
									step="5"
									class="range range-sm"
								/>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- IR Controls -->
			{#if camera.hasIrControl}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<h3 class="card-title text-sm">Night Vision (IR)</h3>
						<div class="btn-group w-full">
							<button
								class="btn btn-sm flex-1"
								class:btn-active={irMode === 'auto'}
								onclick={() => { irMode = 'auto'; updateIrMode(); }}
							>
								Auto
							</button>
							<button
								class="btn btn-sm flex-1"
								class:btn-active={irMode === 'on'}
								onclick={() => { irMode = 'on'; updateIrMode(); }}
							>
								On
							</button>
							<button
								class="btn btn-sm flex-1"
								class:btn-active={irMode === 'off'}
								onclick={() => { irMode = 'off'; updateIrMode(); }}
							>
								Off
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.video-container {
		aspect-ratio: 16 / 9;
	}
</style>
