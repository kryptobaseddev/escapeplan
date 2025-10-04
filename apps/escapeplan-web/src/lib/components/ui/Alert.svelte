<!-- Alert.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'info' | 'success' | 'warning' | 'error';
		dismissible?: boolean;
		class?: string;
		onDismiss?: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let {
		type = 'info',
		dismissible = false,
		class: className,
		onDismiss,
		children,
		actions
	}: Props = $props();

	let visible = $state(true);

	// Proper Tailwind classes with readable contrast on dark backgrounds
	// Using white/light text on semi-transparent colored backgrounds
	const typeClasses = {
		info: 'border-info/50 bg-info/10 text-white',
		success: 'border-success/50 bg-success/10 text-white',
		warning: 'border-warning/50 bg-warning/10 text-white',
		error: 'border-error/50 bg-error/10 text-white'
	};
	let typeClass = $derived(typeClasses[type as keyof typeof typeClasses]);

	function handleDismiss() {
		visible = false;
		onDismiss?.();
	}
</script>

{#if visible}
	<div class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm {typeClass} {className || ''}">
		<div class="flex-1">
			{@render children()}
		</div>

		{#if actions}
			<div class="flex gap-2">
				{@render actions()}
			</div>
		{/if}

		{#if dismissible}
			<button class="btn btn-circle btn-ghost btn-sm" onclick={handleDismiss} aria-label="Dismiss">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		{/if}
	</div>
{/if}
