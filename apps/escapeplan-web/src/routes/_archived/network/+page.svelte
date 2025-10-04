<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import type { ApplyNetworkConfigResponse, NetworkProfile } from '$lib/api/types';

  type ActionPayload = { profile?: NetworkProfile; applied?: ApplyNetworkConfigResponse } | undefined;

  let { data }: { data: PageData } = $props();

  let profile = $state<NetworkProfile>(data.profile);
  let lastApplied = $state<ApplyNetworkConfigResponse | null>(null);
  let showDetails = $state(Boolean(data.profile.details));

  const handleEnhance = ((options: any) => {
    const result = options?.result as { type: string; data?: ActionPayload } | undefined;
    if (result?.type === 'success' && result.data) {
      const payload = result.data;
      if (payload.profile) {
        profile = payload.profile;
      }
      if (payload.applied) {
        lastApplied = payload.applied;
      }
    }
  }) as Parameters<typeof enhance>[1];
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-2">
    <h1 class="section-heading">Network Control Center</h1>
    <p class="text-sm text-base-content/60">
      Manage the EscapePlan broadcast network and review current status for the control SSID.
    </p>
  </header>

  <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
    <article class="glass-panel border-white/10 bg-base-200/70 p-6">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/40">Primary SSID</p>
          <h2 class="text-2xl font-display text-base-content">{profile.ssid}</h2>
        </div>
        <span
          class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${profile.status === 'online' ? 'bg-success/15 text-success' : profile.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
        >
          <span class="inline-flex size-2 rounded-full bg-current"></span>
          {profile.status}
        </span>
      </header>
      <dl class="mt-4 grid gap-3 text-sm text-base-content/70 sm:grid-cols-2">
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Network name</dt>
          <dd class="mt-1 text-base-content">{profile.name}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Band</dt>
          <dd class="mt-1 text-base-content">{profile.band ?? '—'}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Security</dt>
          <dd class="mt-1 text-base-content">{profile.security ?? '—'}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Channel</dt>
          <dd class="mt-1 text-base-content">{profile.channel ?? 'auto'}</dd>
        </div>
      </dl>
      <p class="mt-4 text-sm text-base-content/60">{profile.statusMessage ?? 'No controller messages yet.'}</p>
      <p class="mt-2 text-xs text-base-content/40">Last updated {new Date(profile.lastUpdated).toLocaleString()}</p>
    </article>

    <article class="glass-panel border-white/10 bg-base-200/70 p-6">
      {#if lastApplied}
        <div class="alert alert-success mb-4 flex flex-col gap-2">
          <div class="font-semibold">Applied configuration at {new Date(lastApplied.appliedAt).toLocaleString()}</div>
          <div class="text-xs text-base-content/70">
            Service states: API {lastApplied.services.api}, Web {lastApplied.services.web}, hostapd {lastApplied.services.hostapd}, dnsmasq {lastApplied.services.dnsmasq}
          </div>
        </div>
      {/if}
      <header class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-base-content">Broadcast settings</h2>
        <span class={`badge ${profile.broadcastEnabled ? 'badge-success' : 'badge-ghost text-base-content/60'}`}>
          {profile.broadcastEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </header>
      {#if !data.canManage}
        <p class="mt-4 text-sm text-base-content/60">
          You have read-only access to the network configuration. Contact an administrator to adjust broadcast settings.
        </p>
      {:else}
        <form method="POST" action="?/update" use:enhance={handleEnhance} class="mt-4 space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Network name</span>
              <input class="input input-bordered" name="name" value={profile.name} required />
            </label>
            <label class="form-control">
              <span class="label-text">SSID</span>
              <input class="input input-bordered" name="ssid" value={profile.ssid} required />
            </label>
            <label class="form-control">
              <span class="label-text">Band</span>
              <input class="input input-bordered" name="band" value={profile.band ?? ''} placeholder="e.g. 5GHz" />
            </label>
            <label class="form-control">
              <span class="label-text">Channel</span>
              <input class="input input-bordered" type="number" min="1" name="channel" value={profile.channel ?? ''} />
            </label>
            <label class="form-control">
              <span class="label-text">Security</span>
              <input class="input input-bordered" name="security" value={profile.security ?? ''} placeholder="WPA2-PSK" />
            </label>
            <label class="form-control">
              <span class="label-text">Broadcast</span>
              <input type="checkbox" name="broadcastEnabled" checked={profile.broadcastEnabled} class="toggle toggle-primary" />
            </label>
          </div>
          <label class="form-control">
            <span class="label-text">Description</span>
            <textarea class="textarea textarea-bordered" name="description" rows={2}>{profile.description ?? ''}</textarea>
          </label>
          <label class="form-control">
            <span class="label-text">Status note</span>
            <textarea class="textarea textarea-bordered" name="statusMessage" rows={2}>{profile.statusMessage ?? ''}</textarea>
          </label>
          <details class="rounded-xl border border-white/10 bg-base-100/70 p-4" bind:open={showDetails}>
            <summary class="cursor-pointer text-sm font-medium">Advanced details</summary>
            <label class="form-control mt-3">
              <span class="label-text">Operational details</span>
              <textarea class="textarea textarea-bordered" name="details" rows={4}>{profile.details ?? ''}</textarea>
            </label>
          </details>
          <button class="btn btn-primary" type="submit">Save network settings</button>
        </form>
      {/if}
    </article>
  </div>

  {#if data.canManage}
    <article class="glass-panel border-white/10 bg-base-200/70 p-6">
      <header class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-base-content">Provision appliance network</h2>
        <span class="badge badge-outline">CLI bridge</span>
      </header>
      <p class="mt-2 text-sm text-base-content/60">
        Generate hostapd, dnsmasq, nginx, and service configuration directly from operator inputs. Environment blocks accept
        <code>KEY=value</code> entries, one per line.
      </p>
      <form method="POST" action="?/provision" use:enhance={handleEnhance} class="mt-4 space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">SSID</span>
            <input class="input input-bordered" name="wifiSsid" value={profile.ssid} required />
          </label>
          <label class="form-control">
            <span class="label-text">Passphrase</span>
            <input class="input input-bordered" name="wifiPassphrase" type="password" minlength="8" maxlength="63" placeholder="new WPA2 key" required />
          </label>
          <label class="form-control">
            <span class="label-text">Channel</span>
            <input class="input input-bordered" name="wifiChannel" type="number" min="1" max="165" value={profile.channel ?? 36} required />
          </label>
          <label class="form-control">
            <span class="label-text">Band</span>
            <select class="select select-bordered" name="wifiBand" value={profile.band ?? "auto"}>
              <option value="auto" selected>Auto</option>
              <option value="5g">5 GHz</option>
              <option value="2g">2.4 GHz</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text">Country code</span>
            <input class="input input-bordered" name="wifiCountry" maxlength="2" value="US" />
          </label>
          <label class="form-control">
            <span class="label-text">Server name</span>
            <input class="input input-bordered" name="serverName" value={profile.name} />
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">Router IP</span>
            <input class="input input-bordered" name="networkRouter" value="10.10.10.1" required />
          </label>
          <label class="form-control">
            <span class="label-text">DNS IP</span>
            <input class="input input-bordered" name="networkDns" value="10.10.10.1" required />
          </label>
          <label class="form-control">
            <span class="label-text">DHCP range start</span>
            <input class="input input-bordered" name="dhcpStart" value="10.10.10.100" required />
          </label>
          <label class="form-control">
            <span class="label-text">DHCP range end</span>
            <input class="input input-bordered" name="dhcpEnd" value="10.10.10.199" required />
          </label>
          <label class="form-control">
            <span class="label-text">Domain</span>
            <input class="input input-bordered" name="networkDomain" value="escapeplan.local" required />
          </label>
          <label class="form-control">
            <span class="label-text">API upstream</span>
            <input class="input input-bordered" name="apiUpstream" value="http://127.0.0.1:4000" />
          </label>
          <label class="form-control">
            <span class="label-text">Web upstream</span>
            <input class="input input-bordered" name="webUpstream" value="http://127.0.0.1:4173" />
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">API env (KEY=value per line)</span>
            <textarea class="textarea textarea-bordered" name="apiEnv" rows="3"></textarea>
          </label>
          <label class="form-control">
            <span class="label-text">Web env (KEY=value per line)</span>
            <textarea class="textarea textarea-bordered" name="webEnv" rows="3"></textarea>
          </label>
        </div>
        <div class="flex flex-wrap gap-4">
          <label class="label cursor-pointer gap-3">
            <span class="label-text">Enable Wi-Fi services</span>
            <input type="checkbox" class="toggle toggle-primary" name="enableWifi" checked />
          </label>
          <label class="label cursor-pointer gap-3">
            <span class="label-text">Enable API service</span>
            <input type="checkbox" class="toggle toggle-primary" name="enableApi" />
          </label>
          <label class="label cursor-pointer gap-3">
            <span class="label-text">Enable Web service</span>
            <input type="checkbox" class="toggle toggle-primary" name="enableWeb" />
          </label>
        </div>
        <button class="btn btn-secondary" type="submit">Apply configuration</button>
      </form>
    </article>
  {/if}
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
