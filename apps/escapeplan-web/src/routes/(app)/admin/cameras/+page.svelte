<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { openConfirmDialog } from '$lib/components/confirm-dialog';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { CameraSummary } from '@escapeplan/contracts';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let isSubmitting = $state(false);
  let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let isLoading = $state(true);

  const canViewCameras = $derived(data.canViewCameras);
  const canManageCameras = $derived(data.canManageCameras);

  onMount(() => {
    setTimeout(() => {
      isLoading = false;
    }, 500);
  });

  async function refreshData() {
    await invalidate('app:admin:cameras');
  }

  async function submitAction(action: string, fields: Record<string, string>) {
    isSubmitting = true;
    feedback = null;
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      const response = await fetch(action, {
        method: 'POST',
        body: formData
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const isFailure =
        typeof payload === 'object' &&
        payload !== null &&
        'type' in payload &&
        (payload as Record<string, unknown>).type === 'failure';

      if (!response.ok || isFailure) {
        const message =
          (payload as any)?.data?.message ??
          (payload as any)?.error ??
          `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      await refreshData();
      return true;
    } catch (error) {
      console.error('Camera action failed', error);
      const message = error instanceof Error ? error.message : 'Unable to complete the request.';
      feedback = { type: 'error', message };
      return false;
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDelete(camera: CameraSummary) {
    const confirmed = await openConfirmDialog({
      title: `Delete ${camera.name}`,
      message: 'This will permanently remove the camera. This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) return;
    const success = await submitAction('?/delete', { id: camera.id });
    if (success) {
      feedback = { type: 'success', message: `${camera.name} deleted.` };
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'online':
        return { text: 'Online', class: 'badge-success' };
      case 'offline':
        return { text: 'Offline', class: 'badge-ghost' };
      case 'testing':
        return { text: 'Testing', class: 'badge-warning' };
      case 'error':
        return { text: 'Error', class: 'badge-error' };
      default:
        return { text: status, class: 'badge-ghost' };
    }
  }

  function protocolBadge(protocol: string) {
    switch (protocol) {
      case 'rtsp':
        return 'RTSP';
      case 'mjpeg':
        return 'MJPEG';
      case 'onvif':
        return 'ONVIF';
      default:
        return protocol.toUpperCase();
    }
  }
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="section-heading">Camera Management</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Manage network cameras and associate them with games for live streaming.
      </p>
    </div>
    {#if canManageCameras}
      <a href="/admin/cameras/create" class="btn btn-primary w-full sm:w-auto">
        + Add Camera
      </a>
    {/if}
  </header>

  <!-- Feedback Messages -->
  {#if feedback}
    <div
      class={`alert ${feedback.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'}`}
    >
      <span>{feedback.message}</span>
    </div>
  {/if}

  {#if isLoading}
    <SkeletonLoader type="card" count={4} />
  {:else if data.cameras.length === 0}
    <EmptyState
      title="No cameras configured"
      message="Add your first camera to enable live monitoring."
    >
      {#snippet action()}
        {#if canManageCameras}
          <a href="/admin/cameras/create" class="btn btn-primary btn-sm">
            Add Your First Camera
          </a>
        {/if}
      {/snippet}
    </EmptyState>
  {:else}
    <!-- Mobile Cards -->
    <div class="space-y-4 sm:hidden">
      {#each data.cameras as camera (camera.id)}
        <article class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
          <header class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-base font-semibold text-base-content">{camera.name}</h3>
              <p class="text-xs text-base-content/50">
                {protocolBadge(camera.protocol)} • {camera.host}:{camera.port}
              </p>
              {#if camera.gameName}
                <p class="text-xs text-base-content/40 mt-1">Game: {camera.gameName}</p>
              {/if}
            </div>
            <span class={`badge badge-sm ${statusBadge(camera.status).class}`}>
              {statusBadge(camera.status).text}
            </span>
          </header>

          {#if camera.lastSeen}
            <p class="mt-2 text-xs text-base-content/50">Last seen: {camera.lastSeen}</p>
          {/if}

          {#if canManageCameras}
            <div class="mt-4">
              <div class="dropdown dropdown-end dropdown-bottom w-full">
                <button type="button" class="btn btn-sm btn-ghost w-full" tabindex="0">
                  Actions
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                    <path
                      fill="currentColor"
                      d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
                    />
                  </svg>
                </button>
                <ul
                  class="dropdown-content menu menu-sm z-[1] w-full max-w-xs rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg"
                >
                  <li><a href="/admin/cameras/{camera.id}/edit">Edit camera</a></li>
                  <li>
                    <button
                      type="button"
                      class="text-error"
                      onclick={() => handleDelete(camera)}
                      disabled={isSubmitting}
                    >
                      Delete camera
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          {/if}
        </article>
      {/each}
    </div>

    <!-- Desktop Table -->
    <div class="hidden sm:block">
      <div class="rounded-2xl border border-white/10 bg-base-200/70">
        <table class="table table-zebra">
          <thead class="bg-base-300/60 uppercase tracking-[0.28em] text-xs text-base-content/40">
            <tr>
              <th class="text-left">Camera</th>
              <th class="text-left">Protocol</th>
              <th class="text-left">Host</th>
              <th class="text-left">Game</th>
              <th class="text-left">Status</th>
              {#if canManageCameras}
                <th class="text-right">Actions</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each data.cameras as camera (camera.id)}
              <tr class="text-sm">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-base-300">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        class="w-5 h-5 text-base-content/50"
                      >
                        <path
                          fill="currentColor"
                          d="M4 6.5h2L7 5h10l1 1.5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zm8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p class="font-medium text-base-content">{camera.name}</p>
                      {#if camera.lastSeen}
                        <p class="text-xs text-base-content/50">Last seen: {camera.lastSeen}</p>
                      {/if}
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-outline badge-sm">{protocolBadge(camera.protocol)}</span>
                </td>
                <td class="font-mono text-xs text-base-content/70">
                  {camera.host}:{camera.port}
                </td>
                <td>
                  {#if camera.gameName}
                    <span class="text-base-content/80">{camera.gameName}</span>
                  {:else}
                    <span class="text-base-content/40">—</span>
                  {/if}
                </td>
                <td>
                  <span class={`badge badge-sm ${statusBadge(camera.status).class}`}>
                    {statusBadge(camera.status).text}
                  </span>
                  {#if camera.hlsStreaming}
                    <span class="badge badge-sm badge-info ml-1">Streaming</span>
                  {/if}
                </td>
                {#if canManageCameras}
                  <td>
                    <div class="flex justify-end">
                      <div class="dropdown dropdown-end dropdown-bottom">
                        <button type="button" class="btn btn-xs btn-ghost" tabindex="0">
                          Actions
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                            <path
                              fill="currentColor"
                              d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
                            />
                          </svg>
                        </button>
                        <ul
                          class="dropdown-content menu menu-sm z-[1] w-48 rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg"
                        >
                          <li><a href="/admin/cameras/{camera.id}/edit">Edit camera</a></li>
                          <li>
                            <button
                              type="button"
                              class="text-error"
                              onclick={() => handleDelete(camera)}
                              disabled={isSubmitting}
                            >
                              Delete camera
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</section>
