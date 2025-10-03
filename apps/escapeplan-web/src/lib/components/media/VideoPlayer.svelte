<svelte:options runes={true} />

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { MediaPlayerElement } from 'vidstack/elements';

	interface VideoPlayerProps {
		src: string;
		poster?: string;
		title?: string;
		autoplay?: boolean;
		muted?: boolean;
		controls?: boolean;
	}

	let {
		src,
		poster,
		title = '',
		autoplay = false,
		muted = false,
		controls = true
	}: VideoPlayerProps = $props();

	let player = $state<MediaPlayerElement | undefined>(undefined);
	let mounted = $state(false);

	onMount(async () => {
		// Dynamically import Vidstack to avoid SSR issues
		try {
			// Vidstack uses web components, no registration needed
			mounted = true;
		} catch (err) {
			console.error('Failed to load Vidstack:', err);
		}
	});

	onDestroy(() => {
		// Cleanup player instance
		if (player) {
			player.destroy();
		}
	});
</script>

{#if mounted}
	<media-player
		bind:this={player}
		{src}
		{title}
		poster={poster || ''}
		playsInline
		autoplay={autoplay}
		muted={muted}
		keep-alive
	>
		<media-provider></media-provider>
		<media-video-layout></media-video-layout>
	</media-player>
{:else}
	<div class="flex items-center justify-center h-full bg-base-300 rounded-lg">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{/if}

<style>
	:global(media-player) {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.5rem;
		overflow: hidden;
	}
</style>
