<svelte:options runes={true} />

<script lang="ts">
  import { goto, invalidate, invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { openConfirmDialog } from '$lib/components/confirm-dialog';
  import ArchiveReasonContent from '$lib/components/ArchiveReasonContent.svelte';
  import PasswordResetModal from '$lib/components/PasswordResetModal.svelte';
  import RolesTab from '$lib/components/RolesTab.svelte';
  import PermissionsTab from '$lib/components/PermissionsTab.svelte';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { formatDistanceToNow } from 'date-fns';
  import type { OperatorRole, OperatorSummary } from '@escapeplan/contracts';
  import { ROLE_LABELS } from '@escapeplan/contracts';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let isLoading = $state(true);

  onMount(() => {
    setTimeout(() => {
      isLoading = false;
    }, 500);
  });

  // Determine default tab based on permissions
  const defaultTab = data.canManageUsers ? 'users' : data.canViewRoles ? 'roles' : 'permissions';
  let activeTab = $state<'users' | 'roles' | 'permissions'>(defaultTab);

  let resettingUser = $state<OperatorSummary | null>(null);
  let isSubmitting = $state(false);
  let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  const roles = data.roles;
  const statusOptions = data.statusOptions;

  const initialRole = data.filters.role ?? 'all';
  const initialStatus = data.filters.status ?? 'active';

  let searchTerm = $state(data.filters.search ?? '');
  let roleFilter = $state(initialRole);
  let statusFilter = $state(initialStatus);
  let filtersOpen = $state(initialRole !== 'all' || initialStatus !== 'active');
  let filterInitialized = $state(false);
  let activeFilterCount = $derived((roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'active' ? 1 : 0));
  let hasActiveFilters = $derived(
    searchTerm.trim().length > 0 || roleFilter !== 'all' || statusFilter !== 'active'
  );

  $effect(() => {
    if (!browser) return;

    const trimmed = searchTerm.trim();
    const role = roleFilter;
    const status = statusFilter;

    const params = new URLSearchParams();
    if (trimmed) params.set('search', trimmed);
    if (role !== 'all') params.set('role', role);
    if (status !== 'active') params.set('status', status);

    const nextSearch = params.toString();
    const target = nextSearch ? `?${nextSearch}` : '';
    const currentSearch = $page.url.search;

    if (!filterInitialized) {
      filterInitialized = true;
      if (currentSearch !== target) {
        goto(`/admin/users${target}`, { replaceState: true, keepFocus: true, noScroll: true });
      }
      return;
    }

    if (currentSearch === target) return;

    const timeout = setTimeout(() => {
      goto(`/admin/users${target}`, { replaceState: true, keepFocus: true, noScroll: true });
    }, trimmed ? 200 : 100);

    return () => clearTimeout(timeout);
  });

  function clearFilters() {
    if (!hasActiveFilters) return;
    searchTerm = '';
    roleFilter = 'all';
    statusFilter = 'active';
  }

  function roleLabel(role: OperatorRole) {
    return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
  }

  function lastSeen(user: OperatorSummary) {
    if (!user.lastLoginAt) return 'Never';
    return formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true });
  }

  function statusBadges(user: OperatorSummary) {
    const badges: Array<{ text: string; variant: 'info' | 'warning' | 'error' }> = [];
    if (user.archivedAt) badges.push({ text: 'Archived', variant: 'warning' });
    if (user.mustResetPassword) badges.push({ text: 'Reset required', variant: 'info' });
    if (user.banned) badges.push({ text: 'Banned', variant: 'error' });
    return badges;
  }

  function isCurrentUser(user: OperatorSummary) {
    return data.currentUserId === user.id;
  }

  async function refreshData() {
    await invalidate('app:admin:users');
  }

  async function handleResetSuccess() {
    resettingUser = null;
    await refreshData();
    feedback = { type: 'success', message: 'Password reset successfully.' };
  }

  async function submitAction(action: string, fields: Record<string, string | null | undefined>) {
    isSubmitting = true;
    feedback = null;
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
          formData.set(key, value);
        }
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
      console.error('User action failed', error);
      const message = error instanceof Error ? error.message : 'Unable to complete the request.';
      feedback = { type: 'error', message };
      return false;
    } finally {
      isSubmitting = false;
    }
  }

  async function handleArchive(user: OperatorSummary) {
    if (isCurrentUser(user)) return;
    let reason = '';
    const confirmed = await openConfirmDialog({
      title: `Archive ${user.name}`,
      message:
        'The operator will lose access immediately and move to the archived list. You can restore access later.',
      confirmText: 'Archive',
      variant: 'warning',
      customContent: {
        component: ArchiveReasonContent,
        props: {
          onReasonChange: (value: string) => {
            reason = value;
          }
        }
      }
    });
    if (!confirmed) return;
    const success = await submitAction('?/archive', { id: user.id, reason });
    if (success) {
      feedback = { type: 'success', message: `${user.name} archived.` };
    }
  }

  async function handleUnarchive(user: OperatorSummary) {
    const confirmed = await openConfirmDialog({
      title: `Restore ${user.name}`,
      message: 'Restoring will immediately allow this operator to sign in again.',
      confirmText: 'Restore',
      variant: 'info'
    });
    if (!confirmed) return;
    const success = await submitAction('?/unarchive', { id: user.id });
    if (success) {
      feedback = { type: 'success', message: `${user.name} restored.` };
    }
  }

  async function handleDelete(user: OperatorSummary) {
    if (isCurrentUser(user)) return;
    const confirmed = await openConfirmDialog({
      title: `Delete ${user.name}`,
      message: 'This permanently removes the operator. Type their username to confirm.',
      confirmText: 'Delete',
      variant: 'danger',
      requiresTypedConfirm: true,
      confirmWord: user.username
    });
    if (!confirmed) return;
    const success = await submitAction('?/delete', { id: user.id });
    if (success) {
      feedback = { type: 'success', message: `${user.name} deleted.` };
    }
  }

  function handleReset(user: OperatorSummary) {
    resettingUser = user;
    feedback = null;
  }
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="section-heading">User Management</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Manage operators, roles, and permissions.
      </p>
    </div>
    {#if activeTab === 'users' && data.canManageUsers}
      <a href="/admin/users/create" class="btn btn-primary w-full sm:w-auto">
        + Add user
      </a>
    {/if}
    {#if activeTab === 'roles' && data.canManageRoles}
      <a href="/admin/roles/create" class="btn btn-primary w-full sm:w-auto">
        + Create role
      </a>
    {/if}
  </header>

  <!-- Tab Navigation -->
  <div role="tablist" class="tabs tabs-boxed bg-base-200/70 p-1">
    {#if data.canManageUsers}
      <button
        role="tab"
        class="tab"
        class:tab-active={activeTab === 'users'}
        onclick={() => (activeTab = 'users')}
      >
        Users
      </button>
    {/if}
    {#if data.canViewRoles}
      <button
        role="tab"
        class="tab"
        class:tab-active={activeTab === 'roles'}
        onclick={() => (activeTab = 'roles')}
      >
        Roles
      </button>
    {/if}
    {#if data.canViewPermissions}
      <button
        role="tab"
        class="tab"
        class:tab-active={activeTab === 'permissions'}
        onclick={() => (activeTab = 'permissions')}
      >
        Permissions
      </button>
    {/if}
  </div>

  <!-- Feedback Messages -->
  {#if feedback}
    <div
      class={`alert ${feedback.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'}`}
    >
      <span>{feedback.message}</span>
    </div>
  {/if}

  <!-- Users Tab -->
  {#if activeTab === 'users' && data.canManageUsers}
  <div class="glass-panel border-white/10 bg-base-200/70 p-5 space-y-4 rounded-2xl">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative w-full sm:max-w-sm">
        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base-content/40">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14" />
          </svg>
        </span>
        <input
          class="input input-bordered w-full pl-10"
          type="search"
          placeholder="Search name, username, or email"
          bind:value={searchTerm}
        />
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-sm self-end sm:btn-outline sm:self-auto"
        onclick={() => (filtersOpen = !filtersOpen)}
        aria-expanded={filtersOpen}
        aria-controls="user-filter-panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
          <path
            fill="currentColor"
            d="M3 5h18v2l-6 7v4l-6 3v-7l-6-7z"
          />
        </svg>
        <span class="hidden sm:inline">Filters</span>
        {#if activeFilterCount > 0}
          <span class="badge badge-sm badge-primary ml-2">{activeFilterCount}</span>
        {/if}
      </button>
    </div>

    {#if filtersOpen}
      <div
        id="user-filter-panel"
        class="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)]"
      >
        <label class="form-control">
          <span class="label-text">Role</span>
          <select class="select select-bordered" bind:value={roleFilter}>
            {#each roles as roleOption}
              <option value={roleOption}>
                {roleOption === 'all' ? 'All roles' : roleLabel(roleOption as OperatorRole)}
              </option>
            {/each}
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Status</span>
          <select class="select select-bordered" bind:value={statusFilter}>
            {#each statusOptions as statusOption}
              <option value={statusOption}>
                {statusOption === 'all'
                  ? 'All users'
                  : statusOption === 'archived'
                  ? 'Archived only'
                  : 'Active only'}
              </option>
            {/each}
          </select>
        </label>
        <div class="flex items-end justify-end">
          <button
            type="button"
            class="btn btn-ghost btn-sm sm:btn-outline"
            onclick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Clear filters
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if isLoading}
    <SkeletonLoader type="table" rows={8} />
  {:else if data.users.length === 0}
    <EmptyState
      title="No users"
      message="Add your first operator to get started."
    />
  {:else}
    <div class="space-y-4 sm:hidden">
      {#each data.users as user (user.id)}
        <article class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
          <header class="flex items-center gap-4">
            <div class="shrink-0 overflow-hidden rounded-2xl">
              <Avatar config={user.avatarConfig} username={user.username} size={48} />
            </div>
            <div class="min-w-0">
              <p class="text-base font-semibold text-base-content">{user.name}</p>
              <p class="text-xs text-base-content/50">{user.username} · {roleLabel(user.role)}</p>
              <p class="text-xs text-base-content/40">Last login {lastSeen(user)}</p>
            </div>
          </header>

          {#if user.bio}
            <p class="mt-3 text-sm text-base-content/70">{user.bio}</p>
          {/if}

          {#if statusBadges(user).length}
            <div class="mt-4 flex flex-wrap gap-2">
              {#each statusBadges(user) as badge}
                <span
                  class={`badge ${badge.variant === 'info' ? 'badge-info' : badge.variant === 'warning' ? 'badge-warning' : 'badge-error'}`}
                >
                  {badge.text}
                </span>
              {/each}
            </div>
          {/if}

          <div class="mt-5">
            <div class="dropdown dropdown-end dropdown-bottom w-full">
              <button type="button" class="btn btn-sm btn-ghost w-full sm:w-auto" tabindex="0">
                Actions
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                  <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </button>
              <ul class="dropdown-content menu menu-sm z-[1] w-full max-w-xs rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                <li><a href="/admin/users/{user.id}/edit">Edit details</a></li>
                <li><button type="button" onclick={() => handleReset(user)}>Reset password</button></li>
                {#if user.archivedAt}
                  <li>
                    <button type="button" onclick={() => handleUnarchive(user)} disabled={isSubmitting}>
                      Restore access
                    </button>
                  </li>
                {:else}
                  <li>
                    <button
                      type="button"
                      onclick={() => handleArchive(user)}
                      disabled={isSubmitting || isCurrentUser(user)}
                    >
                      Archive user
                    </button>
                  </li>
                {/if}
                <li>
                  <button
                    type="button"
                    class="text-error"
                    onclick={() => handleDelete(user)}
                    disabled={isSubmitting || isCurrentUser(user)}
                  >
                    Delete permanently
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </article>
      {/each}
    </div>

    <div class="hidden sm:block">
      <div class="rounded-2xl border border-white/10 bg-base-200/70">
        <table class="table table-zebra">
        <thead class="bg-base-300/60 uppercase tracking-[0.28em] text-xs text-base-content/40">
            <tr>
              <th class="text-left">Operator</th>
              <th class="text-left">Role</th>
              <th class="text-left">Email</th>
              <th class="text-left">Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.users as user (user.id)}
              <tr class="text-sm">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="shrink-0 overflow-hidden rounded-2xl">
                      <Avatar config={user.avatarConfig} username={user.username} size={40} />
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-base-content">{user.name}</p>
                      <p class="text-xs text-base-content/50">{user.username}</p>
                      <p class="text-[11px] text-base-content/40">Last login {lastSeen(user)}</p>
                    </div>
                  </div>
                </td>
                <td>{roleLabel(user.role)}</td>
                <td class="break-words text-base-content/70">{user.email ?? '—'}</td>
                <td>
                  <div class="flex flex-wrap gap-1.5">
                    {#if statusBadges(user).length === 0}
                      <span class="badge badge-outline border-white/10 text-xs text-base-content/50">Active</span>
                    {:else}
                      {#each statusBadges(user) as badge}
                        <span
                          class={`badge text-xs ${badge.variant === 'info' ? 'badge-info' : badge.variant === 'warning' ? 'badge-warning' : 'badge-error'}`}
                        >
                          {badge.text}
                        </span>
                      {/each}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="flex justify-end">
                    <div class="dropdown dropdown-end dropdown-bottom">
                      <button type="button" class="btn btn-xs btn-ghost" tabindex="0">
                        Actions
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                          <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                        </svg>
                      </button>
                      <ul class="dropdown-content menu menu-sm z-[1] w-48 rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                        <li><a href="/admin/users/{user.id}/edit">Edit details</a></li>
                        <li><button type="button" onclick={() => handleReset(user)}>Reset password</button></li>
                        {#if user.archivedAt}
                          <li>
                            <button type="button" onclick={() => handleUnarchive(user)} disabled={isSubmitting}>
                              Restore access
                            </button>
                          </li>
                        {:else}
                          <li>
                            <button
                              type="button"
                              onclick={() => handleArchive(user)}
                              disabled={isSubmitting || isCurrentUser(user)}
                            >
                              Archive user
                            </button>
                          </li>
                        {/if}
                        <li>
                          <button
                            type="button"
                            class="text-error"
                            onclick={() => handleDelete(user)}
                            disabled={isSubmitting || isCurrentUser(user)}
                          >
                            Delete permanently
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
  {/if}
  <!-- End Users Tab -->

  <!-- Roles Tab -->
  {#if activeTab === 'roles' && data.canViewRoles}
    <RolesTab
      roles={data.rolesData}
      canManageRoles={data.canManageRoles}
      canManagePermissions={data.canManagePermissions}
      onfeedback={(msg) => (feedback = msg)}
    />
  {/if}

  <!-- Permissions Tab -->
  {#if activeTab === 'permissions' && data.canViewPermissions}
    <PermissionsTab
      roles={data.rolesData}
      permissions={data.permissionsData}
      canManagePermissions={data.canManagePermissions}
      onfeedback={(msg) => (feedback = msg)}
    />
  {/if}
</section>

{#if resettingUser}
  <PasswordResetModal
    open={true}
    action="?/reset"
    user={resettingUser}
    onclose={() => (resettingUser = null)}
    onsuccess={handleResetSuccess}
  />
{/if}
