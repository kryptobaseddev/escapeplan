<svelte:options runes={true} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import Alert from '$lib/components/ui/Alert.svelte';
	import type { PageData } from './$types';
	import HealthTab from './HealthTab.svelte';
	import NetworkTab from './NetworkTab.svelte';
	import AlertsTab from './AlertsTab.svelte';
	import LogsTab from './LogsTab.svelte';
	import StorageTab from './StorageTab.svelte';
	import SettingsTab from './SettingsTab.svelte';

	let { data }: { data: PageData } = $props();

	type TabKey = 'health' | 'network' | 'alerts' | 'logs' | 'storage' | 'settings';
	const validTabs: TabKey[] = ['health', 'network', 'alerts', 'logs', 'storage', 'settings'];

	let activeTab = $state<TabKey>((data.activeTab as TabKey) || 'health');

	// Sync tab state with URL hash or query parameter
	$effect(() => {
		if (!browser) return;

		const hash = window.location.hash.slice(1) as TabKey;
		if (hash && validTabs.includes(hash)) {
			activeTab = hash;
			return;
		}

		const paramsTab = new URL(window.location.href).searchParams.get('tab') as TabKey | null;
		if (paramsTab && validTabs.includes(paramsTab)) {
			activeTab = paramsTab;
		}
	});

	function setTab(tab: TabKey) {
		activeTab = tab;
		if (browser) {
			replaceState(`${$page.url.pathname}?tab=${tab}#${tab}`, {});
		}
	}

	const tabs = $derived([
		{
			key: 'health' as const,
			label: 'Health',
			icon: '⚙️',
			visible: true, // Always visible
			description: 'System status and diagnostics'
		},
		{
			key: 'network' as const,
			label: 'Network',
			icon: '🌐',
			visible: data.permissions.canViewNetwork,
			description: 'Wi-Fi and network configuration'
		},
		{
			key: 'alerts' as const,
			label: 'Alerts',
			icon: '🔔',
			visible: data.permissions.canManageAlerts || data.permissions.canViewSystemLogs,
			description: 'Alert rules and thresholds'
		},
		{
			key: 'logs' as const,
			label: 'Logs',
			icon: '📋',
			visible: data.permissions.canViewSystemLogs,
			description: 'System activity and audit logs'
		},
		{
			key: 'storage' as const,
			label: 'Storage',
			icon: '💾',
			visible: data.permissions.canManageFiles,
			description: 'Asset library and backups'
		},
		{
			key: 'settings' as const,
			label: 'Settings',
			icon: '⚙️',
			visible: data.permissions.canManageSystemHealth,
			description: 'System settings and configuration'
		}
	]);

	const visibleTabs = $derived(tabs.filter((t) => t.visible));
</script>

<div class="space-y-6">
	<!-- Header -->
	<header>
		<h1 class="text-3xl font-bold">System Dashboard</h1>
		<p class="mt-2 text-sm text-base-content/60">
			Monitor and configure system health, network, alerts, logs, and storage
		</p>
	</header>

	<!-- Tab Navigation -->
	<div role="tablist" class="tabs tabs-boxed bg-base-200/70">
		{#each visibleTabs as tab}
			<button
				role="tab"
				class="tab gap-2"
				class:tab-active={activeTab === tab.key}
				onclick={() => setTab(tab.key)}
				aria-selected={activeTab === tab.key}
			>
				<span class="text-lg">{tab.icon}</span>
				<span class="hidden sm:inline">{tab.label}</span>
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="mt-6">
		{#if activeTab === 'health'}
			<HealthTab />
		{:else if activeTab === 'network' && data.permissions.canViewNetwork}
			<NetworkTab
				profile={data.networkProfile}
				canManage={data.permissions.canManageNetwork}
			/>
		{:else if activeTab === 'alerts' && (data.permissions.canManageAlerts || data.permissions.canViewSystemLogs)}
			<AlertsTab rules={data.alertRules} />
		{:else if activeTab === 'logs' && data.permissions.canViewSystemLogs}
			<LogsTab logsData={data.logsData} />
		{:else if activeTab === 'storage' && data.permissions.canManageFiles}
			<StorageTab
				metrics={data.storageMetrics}
				canManage={data.permissions.canManageFiles}
			/>
		{:else if activeTab === 'settings' && data.permissions.canManageSystemHealth}
			<SettingsTab settings={data.systemSettings} availableRoles={data.availableRoles} />
		{:else}
			<Alert type="warning">You do not have permission to view this tab.</Alert>
		{/if}
	</div>
</div>

<style>
	.tab-active {
		background-color: hsl(var(--p));
		color: hsl(var(--pc));
	}
</style>
