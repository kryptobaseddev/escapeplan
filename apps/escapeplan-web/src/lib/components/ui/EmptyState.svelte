<!-- EmptyState.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		message?: string;
		icon?: Snippet;
		action?: Snippet;
		class?: string;
	}

	let { title, message, icon, action, class: className }: Props = $props();
</script>

<div
	class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center {className ||
		''}"
>
	{#if icon}
		<div class="mb-4 flex justify-center">
			{@render icon()}
		</div>
	{/if}

	{#if title}
		<h3 class="mb-2 text-base font-semibold text-base-content">{title}</h3>
	{/if}

	{#if message}
		<p class="text-sm text-base-content/60">{message}</p>
	{/if}

	{#if action}
		<div class="mt-6 flex justify-center">
			{@render action()}
		</div>
	{/if}
</div>
