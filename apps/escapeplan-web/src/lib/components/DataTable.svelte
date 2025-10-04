<svelte:options runes={true} />

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import TableLoading from './table/TableLoading.svelte';
	import TableEmpty from './table/TableEmpty.svelte';
	import TableMobile from './table/TableMobile.svelte';
	import TableDesktop from './table/TableDesktop.svelte';

	interface DataTableColumn {
		key: string;
		label: string;
		align?: 'left' | 'center' | 'right';
		class?: string;
	}

	interface DataTableProps<T> {
		// Data
		items: T[];
		keyField: keyof T;

		// Mobile card layout
		mobileCard: Snippet<[T]>;

		// Desktop table layout
		columns: DataTableColumn[];
		desktopCell: Snippet<[T, string]>; // (item, columnKey) => content

		// Empty state
		emptyMessage?: string;

		// Loading state
		isLoading?: boolean;

		// Responsive breakpoint (default: 'sm')
		breakpoint?: 'sm' | 'md' | 'lg';

		// Container classes
		class?: string;
	}

	let {
		items,
		keyField,
		mobileCard,
		columns,
		desktopCell,
		emptyMessage = 'No items found',
		isLoading = false,
		breakpoint = 'sm',
		class: className = ''
	}: DataTableProps<T> = $props();
</script>

<div class={className}>
	{#if isLoading}
		<TableLoading />
	{:else if items.length === 0}
		<TableEmpty {emptyMessage} />
	{:else}
		<TableMobile {items} {mobileCard} {keyField} {breakpoint} />
		<TableDesktop {items} {columns} {desktopCell} {keyField} {breakpoint} />
	{/if}
</div>
