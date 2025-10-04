<svelte:options runes={true} />

<script lang="ts">
	import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
</script>

<SkeletonLoader type="table" rows={5} />
