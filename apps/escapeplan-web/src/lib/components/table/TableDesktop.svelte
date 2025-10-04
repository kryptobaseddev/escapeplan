<svelte:options runes={true} />

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface DataTableColumn {
		key: string;
		label: string;
		align?: 'left' | 'center' | 'right';
		class?: string;
	}

	interface TableDesktopProps<T> {
		items: T[];
		keyField: keyof T;
		columns: DataTableColumn[];
		desktopCell: Snippet<[T, string]>; // (item, columnKey) => content
		breakpoint: 'sm' | 'md' | 'lg';
	}

	let { items, keyField, columns, desktopCell, breakpoint }: TableDesktopProps<T> = $props();

	const showClass =
		breakpoint === 'md'
			? 'hidden md:block'
			: breakpoint === 'lg'
				? 'hidden lg:block'
				: 'hidden sm:block';
</script>

<!-- Desktop: Table Layout -->
<div class={showClass}>
	<div class="rounded-2xl border border-white/10 bg-base-200/70">
		<table class="table table-zebra">
			<thead class="bg-base-300/60 text-xs uppercase tracking-[0.28em] text-base-content/40">
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
