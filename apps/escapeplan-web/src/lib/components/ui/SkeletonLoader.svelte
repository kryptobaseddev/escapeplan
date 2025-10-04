<!-- SkeletonLoader.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'text' | 'card' | 'table' | 'avatar' | 'custom';
		count?: number;
		rows?: number;
		class?: string;
		children?: Snippet;
	}

	let { type = 'text', count = 1, rows = 5, class: className, children }: Props = $props();
</script>

{#if type === 'text'}
	<div class="space-y-2 {className || ''}">
		{#each Array(count) as _, i (i)}
			<div class="skeleton h-4 w-full"></div>
		{/each}
	</div>
{:else if type === 'card'}
	<div class="space-y-4 {className || ''}">
		{#each Array(count) as _, i (i)}
			<div class="rounded-2xl border border-base-content/10 bg-base-100 p-6">
				<div class="skeleton mb-3 h-32 w-full"></div>
				<div class="skeleton mb-2 h-4 w-28"></div>
				<div class="skeleton mb-1 h-4 w-full"></div>
				<div class="skeleton h-4 w-5/6"></div>
			</div>
		{/each}
	</div>
{:else if type === 'table'}
	<div class="w-full overflow-x-auto {className || ''}">
		<table class="table">
			<thead>
				<tr>
					<th><div class="skeleton h-4 w-24"></div></th>
					<th><div class="skeleton h-4 w-32"></div></th>
					<th><div class="skeleton h-4 w-20"></div></th>
					<th><div class="skeleton h-4 w-16"></div></th>
				</tr>
			</thead>
			<tbody>
				{#each Array(rows) as _, i (i)}
					<tr>
						<td><div class="skeleton h-4 w-full"></div></td>
						<td><div class="skeleton h-4 w-full"></div></td>
						<td><div class="skeleton h-4 w-full"></div></td>
						<td><div class="skeleton h-4 w-full"></div></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if type === 'avatar'}
	<div class="flex items-center gap-4 {className || ''}">
		<div class="skeleton h-12 w-12 shrink-0 rounded-full"></div>
		<div class="flex-1 space-y-2">
			<div class="skeleton h-4 w-32"></div>
			<div class="skeleton h-3 w-48"></div>
		</div>
	</div>
{:else if type === 'custom' && children}
	<div class={className || ''}>
		{@render children()}
	</div>
{/if}
