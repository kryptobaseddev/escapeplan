<svelte:options runes={true} />

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

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

	const hideClass =
		breakpoint === 'md' ? 'md:hidden' : breakpoint === 'lg' ? 'lg:hidden' : 'sm:hidden';
	const showClass =
		breakpoint === 'md'
			? 'hidden md:block'
			: breakpoint === 'lg'
				? 'hidden lg:block'
				: 'hidden sm:block';
</script>

<div class={className}>
	{#if isLoading}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if items.length === 0}
		<div
			class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center text-sm text-base-content/60"
		>
			{emptyMessage}
		</div>
	{:else}
		<!-- Mobile: Card Layout -->
		<div class="space-y-4 {hideClass}">
			{#each items as item (item[keyField])}
				{@render mobileCard(item)}
			{/each}
		</div>

		<!-- Desktop: Table Layout -->
		<div class={showClass}>
			<div class="rounded-2xl border border-white/10 bg-base-200/70">
				<table class="table table-zebra">
					<thead
						class="bg-base-300/60 text-xs uppercase tracking-[0.28em] text-base-content/40"
					>
						<tr>
							{#each columns as column}
								<th class="text-{column.align || 'left'} {column.class || ''}">
									{column.label}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each items as item (item[keyField])}
							<tr class="hover">
								{#each columns as column}
									<td class="text-{column.align || 'left'}">
										{@render desktopCell(item, column.key)}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
