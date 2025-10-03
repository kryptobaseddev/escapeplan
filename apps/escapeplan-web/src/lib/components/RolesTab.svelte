<svelte:options runes={true} />

<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { openConfirmDialog } from '$lib/components/confirm-dialog';
  import RoleModal from './RoleModal.svelte';
  import type { RoleWithPermissions } from '@escapeplan/contracts';

  let {
    roles,
    canManageRoles,
    canManagePermissions,
    onfeedback = undefined
  }: {
    roles: RoleWithPermissions[];
    canManageRoles: boolean;
    canManagePermissions: boolean;
    onfeedback?: (msg: { type: 'success' | 'error'; message: string }) => void;
  } = $props();

  let editingRole = $state<RoleWithPermissions | null>(null);
  let isSubmitting = $state(false);

  async function refreshData() {
    await invalidate('app:admin:users');
  }

  async function handleDelete(role: RoleWithPermissions) {
    if (role.isSystem) return;

    const confirmed = await openConfirmDialog({
      title: `Delete ${role.name}`,
      message: 'This will permanently remove this custom role. Type the role name to confirm.',
      confirmText: 'Delete',
      variant: 'danger',
      requiresTypedConfirm: true,
      confirmWord: role.name
    });

    if (!confirmed) return;

    isSubmitting = true;
    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to delete role' } }));
        throw new Error(error?.error?.message || 'Failed to delete role');
      }

      await refreshData();
      if (onfeedback) onfeedback({ type: 'success', message: `Role "${role.name}" deleted.` });
    } catch (error) {
      console.error('Delete role failed', error);
      if (onfeedback) {
        onfeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to delete role.'
        });
      }
    } finally {
      isSubmitting = false;
    }
  }

  function handleEdit(role: RoleWithPermissions) {
    if (role.isSystem) return;
    editingRole = role;
  }
</script>

<div class="space-y-4">
  <p class="text-sm text-base-content/60">
    {#if canManageRoles}
      Manage system and custom roles with specific permission sets.
    {:else}
      View role definitions and their permission assignments.
    {/if}
  </p>

  <!-- Mobile View (Cards) -->
  <div class="space-y-3 sm:hidden">
    {#each roles as role (role.id)}
      <article class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
        <header class="flex items-start justify-between">
          <div>
            <h3 class="text-base font-semibold text-base-content">
              {role.name}
              {#if role.isSystem}
                <span class="badge badge-sm badge-info ml-2">System</span>
              {/if}
            </h3>
            {#if role.description}
              <p class="mt-1 text-sm text-base-content/60">{role.description}</p>
            {/if}
          </div>
        </header>

        <div class="mt-4">
          <p class="text-xs font-medium uppercase tracking-wider text-base-content/40">Permissions</p>
          <p class="mt-1 text-sm text-base-content/70">{role.permissions.length} assigned</p>
        </div>

        {#if canManageRoles && !role.isSystem}
          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm flex-1"
              onclick={() => handleEdit(role)}
              disabled={isSubmitting}
            >
              Edit
            </button>
            <button
              type="button"
              class="btn btn-error btn-outline btn-sm flex-1"
              onclick={() => handleDelete(role)}
              disabled={isSubmitting}
            >
              Delete
            </button>
          </div>
        {/if}
      </article>
    {/each}
  </div>

  <!-- Desktop View (Table) -->
  <div class="hidden sm:block">
    <div class="rounded-2xl border border-white/10 bg-base-200/70">
      <table class="table table-zebra">
        <thead class="bg-base-300/60 uppercase tracking-[0.28em] text-xs text-base-content/40">
          <tr>
            <th class="text-left">Role Name</th>
            <th class="text-left">Description</th>
            <th class="text-center">Permissions</th>
            <th class="text-center">Type</th>
            {#if canManageRoles}
              <th class="text-right">Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each roles as role (role.id)}
            <tr class="text-sm">
              <td class="font-medium text-base-content">{role.name}</td>
              <td class="text-base-content/70">{role.description ?? '—'}</td>
              <td class="text-center">{role.permissions.length}</td>
              <td class="text-center">
                {#if role.isSystem}
                  <span class="badge badge-info text-xs">System</span>
                {:else}
                  <span class="badge badge-outline border-white/10 text-xs text-base-content/50">Custom</span>
                {/if}
              </td>
              {#if canManageRoles}
                <td>
                  {#if !role.isSystem}
                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost"
                        onclick={() => handleEdit(role)}
                        disabled={isSubmitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="btn btn-xs btn-error btn-outline"
                        onclick={() => handleDelete(role)}
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  {:else}
                    <div class="flex justify-end">
                      <span class="text-xs text-base-content/40">Protected</span>
                    </div>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if editingRole}
  <RoleModal
    open={true}
    role={editingRole}
    onclose={() => (editingRole = null)}
    onsuccess={async () => {
      editingRole = null;
      await refreshData();
      if (onfeedback) onfeedback({ type: 'success', message: 'Role updated successfully.' });
    }}
  />
{/if}
