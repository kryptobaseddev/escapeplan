<!-- FormField.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		name?: string;
		error?: string;
		hint?: string;
		required?: boolean;
		class?: string;
		children: Snippet;
	}

	let { label, name, error, hint, required = false, class: className, children }: Props = $props();
</script>

<label class="form-control {className || ''}">
	<div class="label pb-2">
		<span class="label-text font-medium">
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</div>

	{@render children()}

	{#if error || hint}
		<div class="label pt-1">
			{#if error}
				<span class="label-text-alt text-error">{error}</span>
			{:else if hint}
				<span class="label-text-alt text-base-content/60">{hint}</span>
			{/if}
		</div>
	{/if}
</label>
