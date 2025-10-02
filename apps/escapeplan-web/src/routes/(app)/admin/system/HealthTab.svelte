<svelte:options runes={true} />

<script lang="ts">
	import { onMount } from 'svelte';

	let systemStats = $state({
		cpu: 0,
		memory: { used: 0, total: 4096 },
		disk: { used: 0, total: 64000 },
		uptime: '0d 0h 0m'
	});

	let services = $state([
		{ name: 'API Server', status: 'online', uptime: '7d 4h 23m', details: 'Fastify v5.6.1' },
		{ name: 'WebSocket', status: 'online', uptime: '7d 4h 23m', details: '12 clients connected' },
		{ name: 'Database', status: 'online', uptime: '7d 4h 23m', details: '42.3 MB, WAL mode' },
		{
			name: 'Winston Logger',
			status: 'online',
			uptime: '7d 4h 23m',
			details: '14-day rotation'
		}
	]);

	onMount(() => {
		// TODO: Fetch actual system stats from API
		// For now, using mock data
		systemStats = {
			cpu: 35,
			memory: { used: 2304, total: 4096 },
			disk: { used: 45000, total: 64000 },
			uptime: '7d 4h 23m'
		};
	});

	const memoryPercent = $derived(
		Math.round((systemStats.memory.used / systemStats.memory.total) * 100)
	);
	const diskPercent = $derived(Math.round((systemStats.disk.used / systemStats.disk.total) * 100));

	function formatBytes(mb: number): string {
		if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
		return `${mb} MB`;
	}
</script>

<div class="space-y-6">
	<!-- Service Status Cards -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each services as service}
			<div class="card bg-base-200">
				<div class="card-body p-5">
					<div class="flex items-start justify-between">
						<h3 class="card-title text-base">{service.name}</h3>
						<span class="badge badge-success badge-sm">●</span>
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
						class="progress progress-primary"
						value={systemStats.cpu}
						max="100"
					></progress>
				</div>

				<!-- Memory -->
				<div>
					<div class="mb-2 flex items-center justify-between text-sm">
						<span>Memory</span>
						<span class="font-mono"
							>{formatBytes(systemStats.memory.used)} / {formatBytes(
								systemStats.memory.total
							)}</span
						>
					</div>
					<progress class="progress progress-primary" value={memoryPercent} max="100"></progress>
				</div>

				<!-- Disk -->
				<div>
					<div class="mb-2 flex items-center justify-between text-sm">
						<span>Disk</span>
						<span class="font-mono"
							>{formatBytes(systemStats.disk.used)} / {formatBytes(systemStats.disk.total)}</span
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
