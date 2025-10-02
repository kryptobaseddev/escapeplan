<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import AssetBrowser from '$lib/components/assets/AssetBrowser.svelte';
  import AssetUpload from '$lib/components/assets/AssetUpload.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'overview' | 'library' | 'backups'>('overview');
  let metrics = $state(data.metrics);
  let refreshing = $state(false);

  async function refreshMetrics() {
    refreshing = true;
    try {
      const result = await apiFetch<any>(fetch, '/admin/storage/metrics', {
        credentials: 'include'
      });
      metrics = result;
    } catch (err) {
      console.error('Failed to refresh metrics:', err);
    } finally {
      refreshing = false;
    }
  }

  function formatBytes(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  }

  const usedPercent = $derived(
    metrics?.total?.usedBytes && metrics?.total?.totalBytes
      ? Math.round((metrics.total.usedBytes / metrics.total.totalBytes) * 100)
      : 0
  );
</script>

<svelte:head>
  <title>Storage Management | EscapePlan</title>
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Storage Management</h1>
      <p class="mt-1 text-sm text-base-content/60">
        Monitor disk usage, manage assets, and configure backups
      </p>
    </div>
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      class:loading={refreshing}
      onclick={refreshMetrics}
      disabled={refreshing}
    >
      {#if refreshing}
        Refreshing...
      {:else}
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      {/if}
    </button>
  </header>

  <nav class="tabs tabs-boxed">
    <button
      type="button"
      class="tab {activeTab === 'overview' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'overview'}
    >
      Overview
    </button>
    <button
      type="button"
      class="tab {activeTab === 'library' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'library'}
    >
      Asset Library
    </button>
    <button
      type="button"
      class="tab {activeTab === 'backups' ? 'tab-active' : ''}"
      onclick={() => activeTab = 'backups'}
    >
      Backups
    </button>
  </nav>

  {#if activeTab === 'overview'}
    <div class="space-y-6">
      <!-- Storage Overview -->
      <section class="grid gap-6 md:grid-cols-3">
        <div class="stats shadow">
          <div class="stat">
            <div class="stat-title">Total Capacity</div>
            <div class="stat-value text-2xl">{formatBytes(metrics?.total?.totalBytes)}</div>
            <div class="stat-desc">System storage</div>
          </div>
        </div>
        <div class="stats shadow">
          <div class="stat">
            <div class="stat-title">Used Space</div>
            <div class="stat-value text-2xl text-primary">{formatBytes(metrics?.total?.usedBytes)}</div>
            <div class="stat-desc">{usedPercent}% of capacity</div>
          </div>
        </div>
        <div class="stats shadow">
          <div class="stat">
            <div class="stat-title">Available Space</div>
            <div class="stat-value text-2xl text-success">{formatBytes(metrics?.total?.availableBytes)}</div>
            <div class="stat-desc">{100 - usedPercent}% remaining</div>
          </div>
        </div>
      </section>

      <!-- Disk Usage Chart -->
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Disk Usage</h2>
          <div class="flex items-center gap-6">
            <div class="radial-progress text-primary" style="--value:{usedPercent};" role="progressbar">
              {usedPercent}%
            </div>
            <div class="flex-1 space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-base-content/60">Used</span>
                <span class="font-medium">{formatBytes(metrics?.total?.usedBytes)}</span>
              </div>
              <progress class="progress progress-primary w-full" value={usedPercent} max="100"></progress>
              <div class="flex items-center justify-between text-sm">
                <span class="text-base-content/60">Free</span>
                <span class="font-medium">{formatBytes(metrics?.total?.availableBytes)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Breakdown by Type -->
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Storage Breakdown</h2>
          <div class="grid gap-4 md:grid-cols-3">
            {#if metrics?.byType}
              <div class="stat bg-base-300/50 rounded-lg">
                <div class="stat-figure text-primary">
                  <svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="stat-title">Images</div>
                <div class="stat-value text-2xl">{metrics.byType.images?.totalFiles || 0}</div>
                <div class="stat-desc">{formatBytes(metrics.byType.images?.totalBytes)}</div>
              </div>
              <div class="stat bg-base-300/50 rounded-lg">
                <div class="stat-figure text-secondary">
                  <svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="stat-title">Videos</div>
                <div class="stat-value text-2xl">{metrics.byType.videos?.totalFiles || 0}</div>
                <div class="stat-desc">{formatBytes(metrics.byType.videos?.totalBytes)}</div>
              </div>
              <div class="stat bg-base-300/50 rounded-lg">
                <div class="stat-figure text-accent">
                  <svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div class="stat-title">Audio</div>
                <div class="stat-value text-2xl">{metrics.byType.audio?.totalFiles || 0}</div>
                <div class="stat-desc">{formatBytes(metrics.byType.audio?.totalBytes)}</div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Breakdown by Game -->
      {#if metrics?.byGame && metrics.byGame.length > 0}
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">Storage by Game</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th class="text-right">Files</th>
                    <th class="text-right">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {#each metrics.byGame as game}
                    <tr class="hover">
                      <td class="font-medium">{game.gameName || 'Reusable Assets'}</td>
                      <td class="text-right">{game.totalFiles}</td>
                      <td class="text-right">{formatBytes(game.totalBytes)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      <!-- Last Backup -->
      <div class="alert alert-info">
        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <div class="text-sm font-medium">Last Backup</div>
          <div class="text-xs opacity-80">{formatDate(metrics?.lastBackupAt)}</div>
        </div>
      </div>
    </div>
  {:else if activeTab === 'library'}
    <div class="space-y-6">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Upload New Asset</h2>
          <AssetUpload
            gameId="shared"
            assetType="gallery"
            isReusable={true}
            accept="image/*,audio/*,video/*"
            maxSizeMB={50}
            onSuccess={() => {
              // Reload asset browser
              window.location.reload();
            }}
          />
        </div>
      </div>

      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Asset Library</h2>
          <AssetBrowser
            showSearch={true}
            onSelect={(asset) => {
              console.log('Selected asset:', asset);
            }}
          />
        </div>
      </div>
    </div>
  {:else if activeTab === 'backups'}
    <div class="space-y-6">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Backup Management</h2>
            <button type="button" class="btn btn-primary btn-sm">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Trigger Backup Now
            </button>
          </div>
          <div class="alert alert-warning">
            <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div class="font-medium">Backup Configuration</div>
              <div class="text-xs">Automated backups run daily at 2:00 AM. Last 7 backups are retained.</div>
            </div>
          </div>
          <div class="rounded-xl border border-dashed border-base-content/20 bg-base-100/70 p-12 text-center">
            <svg class="mx-auto h-12 w-12 text-base-content/40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p class="mt-4 text-sm text-base-content/60">No backups available yet</p>
            <p class="mt-1 text-xs text-base-content/40">Backups will appear here after the first automated run</p>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
