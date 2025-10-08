<svelte:options runes={true} />

<script lang="ts">
	import { page } from '$app/stores';

	let errorMessage = $derived($page.error?.message || 'An unexpected error occurred');
	let errorStatus = $derived($page.status || 500);
	let isDev = $derived(import.meta.env.DEV);
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
	<div class="card w-full max-w-md bg-base-100 shadow-xl">
		<div class="card-body items-center text-center">
			<!-- Error Icon -->
			<div class="text-6xl mb-4">
				{#if errorStatus === 404}
					🔍
				{:else if errorStatus >= 500}
					⚠️
				{:else}
					❌
				{/if}
			</div>

			<!-- Error Title -->
			<h1 class="card-title text-3xl mb-2">
				{#if errorStatus === 404}
					Page Not Found
				{:else if errorStatus >= 500}
					Server Error
				{:else}
					Error {errorStatus}
				{/if}
			</h1>

			<!-- Error Message -->
			<p class="text-base-content/70 mb-6">
				{errorMessage}
			</p>

			<!-- Development Info (only in dev mode) -->
			{#if isDev && $page.error}
				<details class="collapse collapse-arrow bg-base-200 w-full mb-4">
					<summary class="collapse-title text-sm font-medium">
						Developer Information
					</summary>
					<div class="collapse-content">
						<pre class="text-xs text-left overflow-auto max-h-64 p-2 bg-base-300 rounded">
{JSON.stringify($page.error, null, 2)}
						</pre>
					</div>
				</details>
			{/if}

			<!-- Actions -->
			<div class="card-actions flex-col sm:flex-row gap-2 w-full">
				<button
					onclick={() => window.history.back()}
					class="btn btn-outline btn-sm sm:btn-md flex-1"
				>
					← Go Back
				</button>
				<a href="/dashboard" class="btn btn-primary btn-sm sm:btn-md flex-1">
					🏠 Dashboard
				</a>
			</div>

			<!-- Additional Help -->
			<p class="text-xs text-base-content/50 mt-4">
				If this problem persists, please contact your system administrator.
			</p>
		</div>
	</div>
</div>
