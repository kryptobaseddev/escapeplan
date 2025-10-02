<svelte:options runes={true} />

<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import type { NetworkProfile, WiFiNetwork, WiFiClientStatus } from '@escapeplan/contracts';

	interface NetworkTabProps {
		profile: NetworkProfile | null;
		canManage: boolean;
	}

	let { profile: initialProfile, canManage }: NetworkTabProps = $props();

	let profile = $state<NetworkProfile | null>(initialProfile);
	let saving = $state(false);
	let applying = $state(false);
	let showDetails = $state(false);
	let showProvision = $state(false);
	let toast = $state<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
	let scanning = $state(false);
	let connecting = $state(false);
	let wifiNetworks = $state<WiFiNetwork[]>([]);
	let wifiStatus = $state<WiFiClientStatus | null>(null);
	let selectedNetwork = $state<WiFiNetwork | null>(null);
	let wifiPassword = $state('');

	const setToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
		toast = { message, type };
		setTimeout(() => (toast = null), 5000);
	};

	async function handleUpdate(event: SubmitEvent) {
		event.preventDefault();
		if (!canManage || !profile) return;

		saving = true;
		try {
			const formData = new FormData(event.target as HTMLFormElement);
			const data = {
				name: formData.get('name') as string,
				ssid: formData.get('ssid') as string,
				band: (formData.get('band') as string) || undefined,
				channel: formData.get('channel') ? Number(formData.get('channel')) : undefined,
				security: (formData.get('security') as string) || undefined,
				broadcastEnabled: formData.get('broadcastEnabled') === 'on',
				description: (formData.get('description') as string) || undefined,
				statusMessage: (formData.get('statusMessage') as string) || undefined,
				details: (formData.get('details') as string) || undefined
			};

			const updated = await apiFetch<NetworkProfile>(fetch, '/admin/network', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			profile = updated;
			setToast('Network settings saved successfully', 'success');
		} catch (error: any) {
			console.error('Failed to update network:', error);
			setToast(error?.message || 'Failed to save network settings', 'error');
		} finally {
			saving = false;
		}
	}

	async function handleProvision(event: SubmitEvent) {
		event.preventDefault();
		if (!canManage) return;

		applying = true;
		try {
			const formData = new FormData(event.target as HTMLFormElement);
			const data = {
				wifiSsid: formData.get('wifiSsid') as string,
				wifiPassphrase: formData.get('wifiPassphrase') as string,
				wifiChannel: Number(formData.get('wifiChannel')),
				wifiBand: formData.get('wifiBand') as string,
				wifiCountry: formData.get('wifiCountry') as string,
				serverName: formData.get('serverName') as string,
				networkRouter: formData.get('networkRouter') as string,
				networkDns: formData.get('networkDns') as string,
				networkDhcpStart: formData.get('networkDhcpStart') as string,
				networkDhcpEnd: formData.get('networkDhcpEnd') as string,
				enableWifi: true
			};

			const result = await apiFetch<any>(fetch, '/admin/network/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			setToast('Network configuration applied successfully', 'success');
			showProvision = false;

			// Reload profile
			const updated = await apiFetch<NetworkProfile>(fetch, '/admin/network', {});
			profile = updated;
		} catch (error: any) {
			console.error('Failed to apply network config:', error);
			setToast(error?.message || 'Failed to apply configuration', 'error');
		} finally {
			applying = false;
		}
	}

	async function scanWiFi() {
		scanning = true;
		try {
			const result = await apiFetch<{ networks: WiFiNetwork[]; scannedAt: string }>(
				fetch,
				'/admin/network/scan',
				{}
			);
			wifiNetworks = result.networks;
			setToast(`Found ${result.networks.length} networks`, 'success');
		} catch (error: any) {
			console.error('WiFi scan failed:', error);
			setToast(error?.message || 'Failed to scan WiFi networks', 'error');
		} finally {
			scanning = false;
		}
	}

	async function loadWiFiStatus() {
		try {
			wifiStatus = await apiFetch<WiFiClientStatus>(fetch, '/admin/network/client', {});
		} catch (error) {
			console.error('Failed to load WiFi status:', error);
		}
	}

	async function connectWiFi() {
		if (!selectedNetwork || !canManage) return;

		connecting = true;
		try {
			const result = await apiFetch<WiFiClientStatus>(fetch, '/admin/network/client', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ssid: selectedNetwork.ssid,
					password: wifiPassword || undefined,
					security: selectedNetwork.security
				})
			});

			wifiStatus = result;
			selectedNetwork = null;
			wifiPassword = '';
			setToast(`Connected to ${result.ssid}`, 'success');
		} catch (error: any) {
			console.error('WiFi connection failed:', error);
			setToast(error?.message || 'Failed to connect to WiFi', 'error');
		} finally {
			connecting = false;
		}
	}

	async function disconnectWiFi() {
		if (!canManage) return;

		try {
			await apiFetch(fetch, '/admin/network/client', { method: 'DELETE' });
			wifiStatus = { connected: false };
			setToast('Disconnected from WiFi', 'success');
		} catch (error: any) {
			console.error('WiFi disconnection failed:', error);
			setToast(error?.message || 'Failed to disconnect', 'error');
		}
	}

	function getSignalIcon(signal: number): string {
		if (signal >= 75) return '📶';
		if (signal >= 50) return '📶';
		if (signal >= 25) return '📡';
		return '📉';
	}

	function getSecurityIcon(security: string): string {
		if (security.toLowerCase().includes('open')) return '🔓';
		return '🔒';
	}

	// Load WiFi status on mount
	$effect(() => {
		loadWiFiStatus();
	});

	const displayProfile = $derived(
		profile ?? {
			id: '',
			name: '',
			ssid: 'N/A',
			status: 'offline' as const,
			broadcastEnabled: false,
			lastUpdated: new Date().toISOString()
		}
	);
</script>

<div class="space-y-6">
	<!-- Toast Notifications -->
	{#if toast}
		<div class="alert alert-{toast.type}">
			<span>{toast.message}</span>
		</div>
	{/if}

	<!-- Current Network Status -->
	<div class="card bg-base-200 shadow-xl">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-semibold uppercase tracking-wider text-base-content/40">
						Broadcast SSID
					</h3>
					<p class="mt-1 text-2xl font-bold">{displayProfile.ssid}</p>
				</div>
				<span
					class={`badge ${displayProfile.status === 'online' ? 'badge-success' : displayProfile.status === 'degraded' ? 'badge-warning' : 'badge-error'}`}
				>
					{displayProfile.status}
				</span>
			</div>

			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-xs uppercase tracking-wider text-base-content/40">Network Name</dt>
					<dd class="mt-1">{displayProfile.name || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wider text-base-content/40">Band</dt>
					<dd class="mt-1">{displayProfile.band || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wider text-base-content/40">Security</dt>
					<dd class="mt-1">{displayProfile.security || '—'}</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wider text-base-content/40">Channel</dt>
					<dd class="mt-1">{displayProfile.channel || 'auto'}</dd>
				</div>
			</div>

			<p class="mt-4 text-sm text-base-content/60">
				{displayProfile.statusMessage || 'No status messages.'}
			</p>
			<p class="mt-2 text-xs text-base-content/40">
				Last updated {new Date(displayProfile.lastUpdated).toLocaleString()}
			</p>
		</div>
	</div>

	<!-- Broadcast Settings Form -->
	{#if !canManage}
		<div class="alert alert-info">
			<svg
				class="h-6 w-6"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span
				>You have read-only access to the network configuration. Contact an administrator to
				adjust settings.</span
			>
		</div>
	{:else if profile}
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Broadcast Settings</h2>
				<form onsubmit={handleUpdate} class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="form-control">
							<span class="label-text">Network Name</span>
							<input
								class="input input-bordered"
								name="name"
								value={profile.name}
								required
							/>
						</label>
						<label class="form-control">
							<span class="label-text">SSID</span>
							<input
								class="input input-bordered"
								name="ssid"
								value={profile.ssid}
								required
							/>
						</label>
						<label class="form-control">
							<span class="label-text">Band</span>
							<input
								class="input input-bordered"
								name="band"
								value={profile.band || ''}
								placeholder="e.g. 5GHz"
							/>
						</label>
						<label class="form-control">
							<span class="label-text">Channel</span>
							<input
								class="input input-bordered"
								type="number"
								min="1"
								name="channel"
								value={profile.channel || ''}
								placeholder="auto"
							/>
						</label>
						<label class="form-control">
							<span class="label-text">Security</span>
							<input
								class="input input-bordered"
								name="security"
								value={profile.security || ''}
								placeholder="WPA2-PSK"
							/>
						</label>
						<label class="form-control">
							<div class="label">
								<span class="label-text">Broadcast Enabled</span>
							</div>
							<input
								type="checkbox"
								name="broadcastEnabled"
								checked={profile.broadcastEnabled}
								class="toggle toggle-primary"
							/>
						</label>
					</div>

					<label class="form-control">
						<span class="label-text">Description</span>
						<textarea
							class="textarea textarea-bordered"
							name="description"
							rows={2}
							value={profile.description || ''}
						></textarea>
					</label>

					<label class="form-control">
						<span class="label-text">Status Message</span>
						<textarea
							class="textarea textarea-bordered"
							name="statusMessage"
							rows={2}
							value={profile.statusMessage || ''}
						></textarea>
					</label>

					<details
						class="rounded-xl border border-base-content/10 bg-base-100/70 p-4"
						bind:open={showDetails}
					>
						<summary class="cursor-pointer text-sm font-medium">Advanced Details</summary>
						<label class="form-control mt-3">
							<span class="label-text">Operational Details</span>
							<textarea
								class="textarea textarea-bordered"
								name="details"
								rows={4}
								value={profile.details || ''}
							></textarea>
						</label>
					</details>

					<button class="btn btn-primary" type="submit" disabled={saving}>
						{#if saving}
							<span class="loading loading-spinner"></span>
							Saving...
						{:else}
							Save Network Settings
						{/if}
					</button>
				</form>
			</div>
		</div>

		<!-- Provision Network Configuration -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="card-title">Provision Appliance Network</h2>
						<p class="text-sm text-base-content/60">
							Configure hostapd, dnsmasq, and network services
						</p>
					</div>
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						onclick={() => (showProvision = !showProvision)}
					>
						{showProvision ? 'Hide' : 'Show'} Provisioning
					</button>
				</div>

				{#if showProvision}
					<div class="divider"></div>
					<form onsubmit={handleProvision} class="space-y-4">
						<div class="grid gap-4 md:grid-cols-2">
							<label class="form-control">
								<span class="label-text">SSID</span>
								<input
									class="input input-bordered"
									name="wifiSsid"
									value={profile.ssid}
									required
								/>
							</label>
							<label class="form-control">
								<span class="label-text">Passphrase</span>
								<input
									class="input input-bordered"
									name="wifiPassphrase"
									type="password"
									minlength="8"
									maxlength="63"
									placeholder="WPA2 passphrase"
									required
								/>
							</label>
							<label class="form-control">
								<span class="label-text">Channel</span>
								<input
									class="input input-bordered"
									name="wifiChannel"
									type="number"
									min="1"
									max="165"
									value={profile.channel || 36}
									required
								/>
							</label>
							<label class="form-control">
								<span class="label-text">Band</span>
								<select class="select select-bordered" name="wifiBand" value={profile.band || 'auto'}>
									<option value="auto">Auto</option>
									<option value="5g">5 GHz</option>
									<option value="2g">2.4 GHz</option>
								</select>
							</label>
							<label class="form-control">
								<span class="label-text">Country Code</span>
								<input class="input input-bordered" name="wifiCountry" maxlength="2" value="US" />
							</label>
							<label class="form-control">
								<span class="label-text">Server Name</span>
								<input class="input input-bordered" name="serverName" value={profile.name} />
							</label>
						</div>

						<div class="divider">Network Configuration</div>

						<div class="grid gap-4 md:grid-cols-2">
							<label class="form-control">
								<span class="label-text">Router IP</span>
								<input
									class="input input-bordered"
									name="networkRouter"
									value="10.10.10.1"
									required
								/>
							</label>
							<label class="form-control">
								<span class="label-text">DNS IP</span>
								<input class="input input-bordered" name="networkDns" value="10.10.10.1" required />
							</label>
							<label class="form-control">
								<span class="label-text">DHCP Start</span>
								<input
									class="input input-bordered"
									name="networkDhcpStart"
									value="10.10.10.10"
									required
								/>
							</label>
							<label class="form-control">
								<span class="label-text">DHCP End</span>
								<input
									class="input input-bordered"
									name="networkDhcpEnd"
									value="10.10.10.250"
									required
								/>
							</label>
						</div>

						<div class="alert alert-warning">
							<svg
								class="h-6 w-6"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<div>
								<div class="font-medium">Warning</div>
								<div class="text-xs">
									Applying this configuration will restart network services and may cause temporary
									disconnection.
								</div>
							</div>
						</div>

						<button class="btn btn-primary" type="submit" disabled={applying}>
							{#if applying}
								<span class="loading loading-spinner"></span>
								Applying Configuration...
							{:else}
								Apply Network Configuration
							{/if}
						</button>
					</form>
				{/if}
			</div>
		</div>

		<!-- WiFi Client Connection -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<h2 class="card-title">WiFi Client Connection</h2>
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						onclick={scanWiFi}
						disabled={scanning || !canManage}
					>
						{#if scanning}
							<span class="loading loading-spinner"></span>
							Scanning...
						{:else}
							<svg
								class="h-4 w-4"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
								/>
							</svg>
							Scan Networks
						{/if}
					</button>
				</div>

				<!-- Current Connection Status -->
				{#if wifiStatus?.connected}
					<div class="alert alert-success">
						<svg
							class="h-6 w-6"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<div class="flex-1">
							<div class="font-medium">Connected to {wifiStatus.ssid}</div>
							<div class="text-xs">
								{#if wifiStatus.signal}Signal: {wifiStatus.signal}% |{/if}
								{#if wifiStatus.ipAddress}IP: {wifiStatus.ipAddress}{/if}
							</div>
						</div>
						{#if canManage}
							<button type="button" class="btn btn-error btn-sm" onclick={disconnectWiFi}>
								Disconnect
							</button>
						{/if}
					</div>
				{:else}
					<div class="alert alert-info">
						<svg
							class="h-6 w-6"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Not connected to external WiFi</span>
					</div>
				{/if}

				<!-- Available Networks -->
				{#if wifiNetworks.length > 0}
					<div class="divider">Available Networks</div>
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each wifiNetworks as network}
							<div class="card bg-base-100 border border-base-content/10">
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<span class="text-xl">{getSignalIcon(network.signal)}</span>
											<div>
												<div class="font-medium flex items-center gap-2">
													{network.ssid}
													{#if network.inUse}
														<span class="badge badge-primary badge-sm">In Use</span>
													{/if}
												</div>
												<div class="text-xs text-base-content/60">
													{getSecurityIcon(network.security)} {network.security} | Channel {network.channel}
													| {network.signal}%
												</div>
											</div>
										</div>
										{#if canManage && !network.inUse}
											<button
												type="button"
												class="btn btn-primary btn-sm"
												onclick={() => (selectedNetwork = network)}
											>
												Connect
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else if !scanning}
					<div class="text-center py-8 text-base-content/60">
						<svg
							class="mx-auto h-12 w-12 mb-2"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
							/>
						</svg>
						<p>Click "Scan Networks" to find available WiFi networks</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Connect to Network Modal -->
		{#if selectedNetwork}
			<dialog class="modal modal-open">
				<div class="modal-box">
					<h3 class="text-lg font-bold">Connect to {selectedNetwork.ssid}</h3>
					<div class="py-4">
						<div class="mb-4">
							<div class="text-sm text-base-content/60">
								{getSecurityIcon(selectedNetwork.security)} {selectedNetwork.security} |
								Signal: {selectedNetwork.signal}%
							</div>
						</div>

						{#if !selectedNetwork.security.toLowerCase().includes('open')}
							<label class="form-control">
								<span class="label-text">Password</span>
								<input
									type="password"
									class="input input-bordered"
									bind:value={wifiPassword}
									placeholder="Enter network password"
								/>
							</label>
						{/if}
					</div>

					<div class="modal-action">
						<button type="button" class="btn" onclick={() => (selectedNetwork = null)}>
							Cancel
						</button>
						<button
							type="button"
							class="btn btn-primary"
							onclick={connectWiFi}
							disabled={connecting}
						>
							{#if connecting}
								<span class="loading loading-spinner"></span>
								Connecting...
							{:else}
								Connect
							{/if}
						</button>
					</div>
				</div>
				<form method="dialog" class="modal-backdrop">
					<button type="button" onclick={() => (selectedNetwork = null)}>close</button>
				</form>
			</dialog>
		{/if}
	{/if}
</div>
