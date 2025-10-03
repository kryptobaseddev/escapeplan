import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type {
	NetworkProfile,
	GetAlertRulesResponse,
	GetSystemLogsResponse
} from '@escapeplan/contracts';

export const load: PageServerLoad = async (event) => {
	const { locals, fetch, url } = event;
	const user = locals.user;

	// Check if user has any system permissions
	const canViewSystemLogs = user?.permissions?.includes('view_system_logs') ?? false;
	const canViewNetwork = user?.permissions?.includes('view_network') ?? false;
	const canManageAlerts = user?.permissions?.includes('manage_alert_rules') ?? false;
	const canManageFiles = user?.permissions?.includes('manage_assets') ?? false;
	const canManageNetwork = user?.permissions?.includes('manage_network') ?? false;

	if (!canViewSystemLogs && !canViewNetwork && !canManageAlerts && !canManageFiles) {
		throw error(403, 'Permission denied');
	}

	const apiFetch = makeServerFetcher(event);

	const allowedTabs = new Set(['health', 'network', 'alerts', 'logs', 'storage']);
	const requestedTab = url.searchParams.get('tab')?.toLowerCase() ?? '';
	const activeTab = allowedTabs.has(requestedTab)
		? (requestedTab as typeof requestedTab)
		: 'health';

	// Load data for all tabs in parallel
	const [networkData, alertsData, logsData, storageData] = await Promise.allSettled([
		// Network tab
		canViewNetwork ? apiFetch<NetworkProfile>('/admin/network').catch(() => null) : null,

		// Alerts tab
		canManageAlerts || canViewSystemLogs
			? fetch('/api/admin/alert-rules')
					.then((res) => (res.ok ? res.json() : { rules: [] }))
					.then((data: GetAlertRulesResponse) => data.rules)
					.catch(() => [])
			: [],

		// Logs tab
		canViewSystemLogs
			? (async () => {
					const params = new URLSearchParams({
						limit: '100',
						offset: '0'
					});

					const level = url.searchParams.get('level');
					const category = url.searchParams.get('category');
					const search = url.searchParams.get('search');
					const page = parseInt(url.searchParams.get('page') || '1', 10);

					if (level && level !== 'all') params.set('level', level);
					if (category && category !== 'all') params.set('category', category);
					if (search) params.set('search', search);
					params.set('offset', ((page - 1) * 100).toString());

					const response = await fetch(`/api/admin/logs?${params}`);
					if (!response.ok) return { logs: [], total: 0, page };

					const data: GetSystemLogsResponse = await response.json();
					return { logs: data.logs, total: data.total, page };
				})()
			: { logs: [], total: 0, page: 1 },

		// Storage tab
		canManageFiles
			? apiFetch<any>('/admin/storage/metrics').catch(() => null)
			: null
	]);

	return {
		activeTab,
		permissions: {
			canViewSystemLogs,
			canViewNetwork,
			canManageAlerts,
			canManageFiles,
			canManageNetwork
		},
		networkProfile: networkData.status === 'fulfilled' ? networkData.value : null,
		alertRules: alertsData.status === 'fulfilled' ? alertsData.value : [],
		logsData: logsData.status === 'fulfilled' ? logsData.value : { logs: [], total: 0, page: 1 },
		storageMetrics: storageData.status === 'fulfilled' ? storageData.value : null
	};
};
