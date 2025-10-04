<svelte:options runes={true} />

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface TableMobileProps<T> {
		items: T[];
		keyField: keyof T;
		mobileCard: Snippet<[T]>;
		breakpoint: 'sm' | 'md' | 'lg';
	}

	let { items, keyField, mobileCard, breakpoint }: TableMobileProps<T> = $props();

	const hideClass =
		breakpoint === 'md' ? 'md:hidden' : breakpoint === 'lg' ? 'lg:hidden' : 'sm:hidden';
</script>

<!-- Mobile: Card Layout -->
<div class="space-y-4 {hideClass}">
	{#each items as item (item[keyField])}
		{@render mobileCard(item)}
	{/each}
</div>
