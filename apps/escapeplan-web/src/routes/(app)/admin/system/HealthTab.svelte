<svelte:options runes={true} />

<script lang="ts">
	import { onMount } from 'svelte';
	import Alert from '$lib/components/ui/Alert.svelte';

	let systemStats = $state({
		cpu: 0,
		memory: { used: 0, total: 4096 },
		disk: { used: 0, total: 64 },
		uptime: '0m'
	});

	let services = $state<Array<{
		name: string;
		status: 'online' | 'offline' | 'degraded';
		uptime: string;
		details: string;
	}>>([]);

	let loading = $state(true);
	let error = $state<string | null>(null);

	async function fetchSystemHealth() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/admin/system/health', {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to fetch system health');
			}

			const data = await response.json();

			systemStats = {
				cpu: data.cpu,
				memory: data.memory,
				disk: data.disk,
				uptime: data.uptime
			};

			services = data.services;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load system health';
			console.error('Error fetching system health:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchSystemHealth();

		// Refresh every 30 seconds
		const interval = setInterval(fetchSystemHealth, 30000);
		return () => clearInterval(interval);
	});

	const memoryPercent = $derived(
		systemStats.memory.total > 0
			? Math.round((systemStats.memory.used / systemStats.memory.total) * 100)
			: 0
	);
	const diskPercent = $derived(
		systemStats.disk.total > 0
			? Math.round((systemStats.disk.used / systemStats.disk.total) * 100)
			: 0
	);

	function formatMB(mb: number): string {
		if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
		return `${mb} MB`;
	}

	function formatGB(gb: number): string {
		return `${gb} GB`;
	}

	function getStatusBadgeClass(status: 'online' | 'offline' | 'degraded'): string {
		switch (status) {
			case 'online':
				return 'badge-success';
			case 'offline':
				return 'badge-error';
			case 'degraded':
				return 'badge-warning';
			default:
				return 'badge-ghost';
		}
	}

	// Power management
	let powerAction = $state<'shutdown' | 'restart' | null>(null);
	let powerLoading = $state(false);
	let powerMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	async function handlePowerAction(action: 'shutdown' | 'restart') {
		if (!confirm(`Are you sure you want to ${action} the system? This will disconnect all users.`)) {
			return;
		}

		try {
			powerLoading = true;
			powerMessage = null;

			const response = await fetch(`/api/admin/system/${action}`, {
				method: 'POST',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to ${action} system`);
			}

			const data = await response.json();
			powerMessage = {
				type: 'success',
				text: `System ${action} initiated. ${action === 'shutdown' ? 'You can unplug the device in 15 seconds.' : 'System will restart in a few seconds.'}`
			};
		} catch (err) {
			powerMessage = {
				type: 'error',
				text: err instanceof Error ? err.message : `Failed to ${action} system`
			};
		} finally {
			powerLoading = false;
		}
	}
</script>

<div class="space-y-6">
	{#if error}
		<Alert type="error">
			<span>{error}</span>
			<button class="btn btn-sm" onclick={fetchSystemHealth}>Retry</button>
		</Alert>
	{/if}

	{#if loading && services.length === 0}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<!-- Service Status Cards -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			{#each services as service}
				<div class="card bg-base-200">
					<div class="card-body p-5">
						<div class="flex items-start justify-between">
							<h3 class="card-title text-base">{service.name}</h3>
							<span class={`badge ${getStatusBadgeClass(service.status)} badge-sm`}>●</span>
						</div>
						<p class="text-xs text-base-content/60">{service.details}</p>
						<div class="mt-2 text-xs text-base-content/40">
							Uptime: {service.uptime}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- System Resources -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h3 class="card-title">System Resources</h3>
				<div class="mt-4 space-y-4">
					<!-- CPU -->
					<div>
						<div class="mb-2 flex items-center justify-between text-sm">
							<span>CPU Usage</span>
							<span class="font-mono">{systemStats.cpu}%</span>
						</div>
						<progress
							class={`progress ${systemStats.cpu > 80 ? 'progress-warning' : 'progress-primary'}`}
							value={systemStats.cpu}
							max="100"
						></progress>
					</div>

					<!-- Memory -->
					<div>
						<div class="mb-2 flex items-center justify-between text-sm">
							<span>Memory</span>
							<span class="font-mono"
								>{formatMB(systemStats.memory.used)} / {formatMB(systemStats.memory.total)}</span
							>
						</div>
						<progress
							class={`progress ${memoryPercent > 80 ? 'progress-warning' : 'progress-primary'}`}
							value={memoryPercent}
							max="100"
						></progress>
					</div>

					<!-- Disk -->
					<div>
						<div class="mb-2 flex items-center justify-between text-sm">
							<span>Disk</span>
							<span class="font-mono"
								>{formatGB(systemStats.disk.used)} / {formatGB(systemStats.disk.total)}</span
							>
						</div>
						<progress
							class={`progress ${diskPercent > 80 ? 'progress-warning' : 'progress-primary'}`}
							value={diskPercent}
							max="100"
						></progress>
					</div>

					<!-- Uptime -->
					<div>
						<div class="flex items-center justify-between text-sm">
							<span>System Uptime</span>
							<span class="font-mono">{systemStats.uptime}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Power Management -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h3 class="card-title">Power Management</h3>
			<p class="text-sm text-base-content/60">Safely shutdown or restart the system</p>

			{#if powerMessage}
				<div class={`alert mt-4 ${powerMessage.type === 'error' ? 'alert-error' : 'alert-success'}`}>
					<span>{powerMessage.text}</span>
				</div>
			{/if}

			<div class="mt-4 flex flex-wrap gap-2">
				<button
					class="btn btn-warning btn-sm"
					onclick={() => handlePowerAction('restart')}
					disabled={powerLoading}
				>
					{#if powerLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					🔄 Restart System
				</button>
				<button
					class="btn btn-error btn-sm"
					onclick={() => handlePowerAction('shutdown')}
					disabled={powerLoading}
				>
					{#if powerLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					⏻ Shutdown System
				</button>
			</div>
			<p class="mt-2 text-xs text-base-content/40">
				⚠️ Shutdown: Wait 15 seconds for LED to stop blinking before unplugging
			</p>
		</div>
	</div>

	<!-- Diagnostics -->
	<div class="card bg-base-200">
		<div class="card-body">
			<h3 class="card-title">Diagnostics</h3>
			<p class="text-sm text-base-content/60">Run system diagnostics and health checks</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<button class="btn btn-sm btn-outline">Test Network Connectivity</button>
				<button class="btn btn-sm btn-outline">Test Camera Streams</button>
				<button class="btn btn-sm btn-outline">Test Database Connection</button>
				<button class="btn btn-sm btn-outline">Download Diagnostic Bundle</button>
			</div>
		</div>
	</div>
</div>
