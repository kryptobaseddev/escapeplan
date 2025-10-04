<!-- LoadingState.svelte -->
<script lang="ts">
	interface Props {
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		fullScreen?: boolean;
		message?: string;
		variant?: 'infinity' | 'spinner' | 'dots' | 'ring' | 'ball' | 'bars';
		class?: string;
	}

	let { size = 'lg', fullScreen = false, message, variant = 'infinity', class: className }: Props = $props();

	// Derived size class
	const sizes = {
		xs: 'loading-xs',
		sm: 'loading-sm',
		md: 'loading-md',
		lg: 'loading-lg',
		xl: 'loading-xl'
	};
	let sizeClass = $derived(sizes[size as keyof typeof sizes]);

	// Derived variant class
	const variants = {
		infinity: 'loading-infinity',
		spinner: 'loading-spinner',
		dots: 'loading-dots',
		ring: 'loading-ring',
		ball: 'loading-ball',
		bars: 'loading-bars'
	};
	let variantClass = $derived(variants[variant as keyof typeof variants]);
</script>

{#if fullScreen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-base-100/80 backdrop-blur-sm">
		<div class="flex flex-col items-center gap-4">
			<span class="loading {variantClass} {sizeClass}"></span>
			{#if message}
				<p class="text-sm text-base-content/70">{message}</p>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex items-center justify-center p-12 {className || ''}">
		<div class="flex flex-col items-center gap-4">
			<span class="loading {variantClass} {sizeClass}"></span>
			{#if message}
				<p class="text-sm text-base-content/70">{message}</p>
			{/if}
		</div>
	</div>
{/if}
