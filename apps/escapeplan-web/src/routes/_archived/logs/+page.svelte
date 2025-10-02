<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import type { SystemLog, LogLevel, LogCategory } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';
  import { goto } from '$app/navigation';

  let { data } = $props<{ data: PageData }>();

  let logs = $state<SystemLog[]>(data.logs ?? []);
  let total = $state(data.total ?? 0);
  let currentPage = $state(data.page ?? 1);
  let totalPages = $derived(Math.ceil(total / 100));

  // Filters
  let levelFilter = $state<LogLevel | 'all'>('all');
  let categoryFilter = $state<LogCategory | 'all'>('all');
  let searchQuery = $state('');
  let isLoading = $state(false);

  const loadLogs = async () => {
    isLoading = true;
    try {
      const params = new URLSearchParams({
        limit: '100',
        offset: ((currentPage - 1) * 100).toString()
      });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const data = await apiFetch<{logs: SystemLog[], total: number}>(fetch, `/api/admin/logs?${params}`, {});
      logs = data.logs;
      total = data.total;
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      isLoading = false;
    }
  };

  const applyFilters = () => {
    currentPage = 1;
    loadLogs();
  };

  const changePage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadLogs();
  };

  const getLevelBadge = (level: string) => {
    const badges: Record<string, string> = {
      error: 'badge-error',
      warn: 'badge-warning',
      info: 'badge-info',
      debug: 'badge-ghost'
    };
    return badges[level] || 'badge-ghost';
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Level', 'Category', 'Message', 'Context'],
      ...logs.map((log) => [
        log.timestamp,
        log.level,
        log.category,
        log.message,
        log.context ? JSON.stringify(log.context) : ''
      ])
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
</script>

<div class="container mx-auto max-w-7xl space-y-6 p-6">
  <header>
    <h1 class="text-3xl font-bold">System Logs</h1>
    <p class="mt-2 text-sm text-base-content/60">
      View and search system activity logs
    </p>
  </header>

  <!-- Filters -->
  <div class="card bg-base-200">
    <div class="card-body">
      <div class="grid gap-4 md:grid-cols-4">
        <div>
          <label class="label">
            <span class="label-text text-xs">Level</span>
          </label>
          <select class="select select-bordered select-sm w-full" bind:value={levelFilter}>
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div>
          <label class="label">
            <span class="label-text text-xs">Category</span>
          </label>
          <select class="select select-bordered select-sm w-full" bind:value={categoryFilter}>
            <option value="all">All Categories</option>
            <option value="session">Session</option>
            <option value="auth">Authentication</option>
            <option value="system">System</option>
            <option value="network">Network</option>
            <option value="api">API</option>
          </select>
        </div>

        <div class="md:col-span-2">
          <label class="label">
            <span class="label-text text-xs">Search Message</span>
          </label>
          <div class="join w-full">
            <input
              type="text"
              class="input input-bordered input-sm join-item w-full"
              placeholder="Search log messages..."
              bind:value={searchQuery}
              onkeydown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <button class="btn btn-primary btn-sm join-item" onclick={applyFilters}>
              Search
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-base-300 pt-4">
        <div class="text-sm text-base-content/60">
          Showing {logs.length} of {total} logs
        </div>
        <button class="btn btn-ghost btn-sm" onclick={exportLogs} disabled={logs.length === 0}>
          Export CSV
        </button>
      </div>
    </div>
  </div>

  <!-- Logs Table -->
  <div class="card bg-base-200">
    <div class="card-body p-0">
      {#if isLoading}
        <div class="flex items-center justify-center p-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if logs.length === 0}
        <div class="p-12 text-center">
          <p class="text-base-content/60">No logs found matching your filters</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th class="w-[160px]">Timestamp</th>
                <th class="w-[80px]">Level</th>
                <th class="w-[100px]">Category</th>
                <th>Message</th>
                <th class="w-[60px]">Context</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as log}
                <tr class="hover">
                  <td class="font-mono text-xs">{formatTimestamp(log.timestamp)}</td>
                  <td>
                    <span class={`badge badge-sm ${getLevelBadge(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-outline badge-sm">{log.category}</span>
                  </td>
                  <td class="max-w-2xl truncate">{log.message}</td>
                  <td>
                    {#if log.context}
                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() => {
                          alert(JSON.stringify(log.context, null, 2));
                        }}
                      >
                        View
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-center gap-2">
      <button
        class="btn btn-sm"
        onclick={() => changePage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      <div class="flex gap-1">
        {#if currentPage > 2}
          <button class="btn btn-sm btn-ghost" onclick={() => changePage(1)}>1</button>
          {#if currentPage > 3}
            <span class="btn btn-sm btn-disabled">...</span>
          {/if}
        {/if}

        {#if currentPage > 1}
          <button class="btn btn-sm btn-ghost" onclick={() => changePage(currentPage - 1)}>
            {currentPage - 1}
          </button>
        {/if}

        <button class="btn btn-sm btn-active">{currentPage}</button>

        {#if currentPage < totalPages}
          <button class="btn btn-sm btn-ghost" onclick={() => changePage(currentPage + 1)}>
            {currentPage + 1}
          </button>
        {/if}

        {#if currentPage < totalPages - 1}
          {#if currentPage < totalPages - 2}
            <span class="btn btn-sm btn-disabled">...</span>
          {/if}
          <button class="btn btn-sm btn-ghost" onclick={() => changePage(totalPages)}>
            {totalPages}
          </button>
        {/if}
      </div>

      <button
        class="btn btn-sm"
        onclick={() => changePage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  {/if}
</div>
