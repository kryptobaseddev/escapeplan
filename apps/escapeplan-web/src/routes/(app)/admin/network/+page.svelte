<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';

  let { data } = $props<{ data: PageData }>();

  let showDetails = $state(Boolean(data.profile.details));
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-2">
    <h1 class="section-heading">Network Control Center</h1>
    <p class="text-sm text-base-content/60">
      Manage the EscapePlan appliance broadcast network and review current status for the control SSID.
    </p>
  </header>

  <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
    <article class="glass-panel border-white/10 bg-base-200/70 p-6">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.35em] text-base-content/40">Primary SSID</p>
          <h2 class="text-2xl font-display text-base-content">{data.profile.ssid}</h2>
        </div>
        <span
          class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${data.profile.status === 'online' ? 'bg-success/15 text-success' : data.profile.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
        >
          <span class="inline-flex size-2 rounded-full bg-current"></span>
          {data.profile.status}
        </span>
      </header>
      <dl class="mt-4 grid gap-3 text-sm text-base-content/70 sm:grid-cols-2">
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Network name</dt>
          <dd class="mt-1 text-base-content">{data.profile.name}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Band</dt>
          <dd class="mt-1 text-base-content">{data.profile.band ?? '—'}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Security</dt>
          <dd class="mt-1 text-base-content">{data.profile.security ?? '—'}</dd>
        </div>
        <div>
          <dt class="uppercase tracking-[0.3em] text-xs text-base-content/40">Channel</dt>
          <dd class="mt-1 text-base-content">{data.profile.channel ?? 'auto'}</dd>
        </div>
      </dl>
      <p class="mt-4 text-sm text-base-content/60">{data.profile.statusMessage ?? 'No controller messages yet.'}</p>
      <p class="mt-2 text-xs text-base-content/40">Last updated {new Date(data.profile.lastUpdated).toLocaleString()}</p>
    </article>

    <article class="glass-panel border-white/10 bg-base-200/70 p-6">
      <header class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-base-content">Broadcast settings</h2>
        <span class={`badge ${data.profile.broadcastEnabled ? 'badge-success' : 'badge-ghost text-base-content/60'}`}>
          {data.profile.broadcastEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </header>
      {#if !data.canManage}
        <p class="mt-4 text-sm text-base-content/60">
          You have read-only access to the network configuration. Contact an administrator to adjust broadcast settings.
        </p>
      {:else}
        <form method="POST" use:enhance class="mt-4 space-y-4">
          <input type="hidden" name="/" value="" />
          <input type="hidden" name="intent" value="update" />
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Network name</span>
              <input class="input input-bordered" name="name" value={data.profile.name} required />
            </label>
            <label class="form-control">
              <span class="label-text">SSID</span>
              <input class="input input-bordered" name="ssid" value={data.profile.ssid} required />
            </label>
            <label class="form-control">
              <span class="label-text">Band</span>
              <input class="input input-bordered" name="band" value={data.profile.band ?? ''} placeholder="e.g. 5GHz" />
            </label>
            <label class="form-control">
              <span class="label-text">Channel</span>
              <input class="input input-bordered" type="number" min="1" name="channel" value={data.profile.channel ?? ''} />
            </label>
            <label class="form-control">
              <span class="label-text">Security</span>
              <input class="input input-bordered" name="security" value={data.profile.security ?? ''} placeholder="WPA2-PSK" />
            </label>
            <label class="form-control">
              <span class="label-text">Broadcast</span>
              <input type="checkbox" name="broadcastEnabled" checked={data.profile.broadcastEnabled} class="toggle toggle-primary" />
            </label>
          </div>
          <label class="form-control">
            <span class="label-text">Description</span>
            <textarea class="textarea textarea-bordered" name="description" rows={2}>{data.profile.description ?? ''}</textarea>
          </label>
          <label class="form-control">
            <span class="label-text">Status note</span>
            <textarea class="textarea textarea-bordered" name="statusMessage" rows={2}>{data.profile.statusMessage ?? ''}</textarea>
          </label>
          <details class="rounded-xl border border-white/10 bg-base-100/70 p-4" bind:open={showDetails}>
            <summary class="cursor-pointer text-sm font-medium">Advanced details</summary>
            <label class="form-control mt-3">
              <span class="label-text">Operational details</span>
              <textarea class="textarea textarea-bordered" name="details" rows={4}>{data.profile.details ?? ''}</textarea>
            </label>
          </details>
          <button class="btn btn-primary" type="submit">Save network settings</button>
        </form>
      {/if}
    </article>
  </div>
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
