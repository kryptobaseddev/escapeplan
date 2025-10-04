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

	// Derived type classes with enhanced styling
	const typeClasses = {
		info: 'alert-info border border-info/30 bg-info/10',
		success: 'alert-success border border-success/30 bg-success/10',
		warning: 'alert-warning border border-warning/30 bg-warning/10',
		error: 'alert-error border border-error/30 bg-error/10'
	};
	let typeClass = $derived(typeClasses[type as keyof typeof typeClasses]);

	function handleDismiss() {
		visible = false;
		onDismiss?.();
	}
</script>

{#if visible}
	<div class="alert {typeClass} text-sm {className || ''}">
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
