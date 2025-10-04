<!-- LoadingButton.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?:
			| 'primary'
			| 'secondary'
			| 'accent'
			| 'ghost'
			| 'outline'
			| 'link'
			| 'neutral'
			| 'success'
			| 'warning'
			| 'error';
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		loading?: boolean;
		disabled?: boolean;
		wide?: boolean;
		block?: boolean;
		circle?: boolean;
		square?: boolean;
		class?: string;
		form?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		type = 'button',
		variant,
		size,
		loading = false,
		disabled = false,
		wide = false,
		block = false,
		circle = false,
		square = false,
		class: className,
		form,
		onclick,
		children
	}: Props = $props();

	// Derived classes
	let variantClass = $derived(variant ? `btn-${variant}` : '');
	let sizeClass = $derived(size ? `btn-${size}` : '');
	let shapeClass = $derived(
		circle ? 'btn-circle' : square ? 'btn-square' : wide ? 'btn-wide' : block ? 'btn-block' : ''
	);
</script>

<button
	{type}
	class="btn {variantClass} {sizeClass} {shapeClass} {className || ''}"
	disabled={disabled || loading}
	{form}
	{onclick}
>
	{#if loading}
		<span class="loading loading-infinity loading-sm"></span>
	{/if}
	{@render children()}
</button>
