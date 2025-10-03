<svelte:options runes={true} />

<script lang="ts">
	import VideoPlayer from './VideoPlayer.svelte';

	interface VideoPlayerModalProps {
		src: string;
		poster?: string;
		title?: string;
		isOpen?: boolean;
		onClose?: () => void;
	}

	let { src, poster, title = '', isOpen = false, onClose }: VideoPlayerModalProps = $props();

	function handleClose() {
		if (onClose) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div class="modal modal-open" role="dialog">
		<div class="modal-box w-11/12 max-w-5xl p-0">
			<!-- Header -->
			<div class="flex items-center justify-between bg-base-200 px-6 py-4">
				<h3 class="text-lg font-bold">{title || 'Video Player'}</h3>
				<button
					type="button"
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<!-- Video Player -->
			<div class="p-6">
				<VideoPlayer {src} {poster} {title} autoplay muted />
			</div>

			<!-- Footer (optional actions) -->
			<div class="modal-action px-6 pb-6 pt-0">
				<button type="button" class="btn btn-sm" onclick={handleClose}>Close</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			onclick={handleClose}
			aria-label="Close modal"
		></button>
	</div>
{/if}

<style>
	.modal-backdrop {
		background-color: rgba(0, 0, 0, 0.7);
	}
</style>
