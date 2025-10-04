<svelte:options runes={true} />

<script lang="ts">
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	interface TableEmptyProps {
		emptyMessage: string;
	}

	let { emptyMessage }: TableEmptyProps = $props();
</script>

<EmptyState message={emptyMessage} />
