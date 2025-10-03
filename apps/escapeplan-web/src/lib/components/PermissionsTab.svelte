<svelte:options runes={true} />

<script lang="ts">
  import { invalidate } from '$app/navigation';
  import type { RoleWithPermissions, PermissionSummary, UpdateRolePermissionsRequest } from '@escapeplan/contracts';
  import { PERMISSION_LABELS } from '@escapeplan/contracts';

  interface Props {
    roles: RoleWithPermissions[];
    permissions: PermissionSummary[];
    canManagePermissions?: boolean;
    onfeedback?: (msg: { type: 'success' | 'error'; message: string }) => void;
  }

  let { roles, permissions, canManagePermissions = false, onfeedback }: Props = $props();

  let isUpdating = $state<string | null>(null); // roleId being updated

  // Group permissions by category
  const permissionsByCategory = $derived(() => {
    const grouped = new Map<string, PermissionSummary[]>();
    for (const perm of permissions) {
      const category = perm.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(perm);
    }
    return grouped;
  });

  // Check if role has permission
  function hasPermission(role: RoleWithPermissions, permissionId: string): boolean {
    return role.permissions.some((p) => p.id === permissionId);
  }

  // Capitalize category
  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }

  // Toggle permission for a role
  async function togglePermission(role: RoleWithPermissions, permissionId: string) {
    if (!canManagePermissions || isUpdating || role.isSystem) return;

    const currentPermissionIds = role.permissions.map((p) => p.id);
    const hasIt = currentPermissionIds.includes(permissionId);

    const newPermissionIds = hasIt
      ? currentPermissionIds.filter((id) => id !== permissionId)
      : [...currentPermissionIds, permissionId];

    isUpdating = role.id;
    try {
      const payload: UpdateRolePermissionsRequest = {
        permissionIds: newPermissionIds
      };

      const response = await fetch(`/api/admin/roles/${role.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to update permissions' } }));
        throw new Error(error?.error?.message || 'Failed to update permissions');
      }

      await invalidate('app:admin:users');
      if (onfeedback) {
        const action = hasIt ? 'removed from' : 'added to';
        onfeedback({ type: 'success', message: `Permission ${action} ${role.name}` });
      }
    } catch (error) {
      console.error('Toggle permission failed:', error);
      if (onfeedback) {
        onfeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to update permission'
        });
      }
    } finally {
      isUpdating = null;
    }
  }
</script>

<div class="space-y-6">
  <p class="text-sm text-base-content/60">
    {#if canManagePermissions}
      Click custom role badges to toggle permissions. System roles (Admin, Manager, Game Master, Operator) are read-only.
    {:else}
      View all system permissions and their current role assignments.
    {/if}
  </p>

  <!-- Permission Matrix -->
  {#each Array.from(permissionsByCategory()).sort(([a], [b]) => a.localeCompare(b)) as [category, perms]}
    <div class="rounded-2xl border border-white/10 bg-base-200/70 p-6">
      <h3 class="mb-4 text-lg font-semibold text-base-content">{capitalize(category)}</h3>

      <div class="space-y-3">
        {#each perms as perm}
          <div class="rounded-xl border border-white/5 bg-base-100/30 p-4">
            <div class="mb-3">
              <h4 class="font-medium text-base-content">
                {PERMISSION_LABELS[perm.name] || perm.name}
              </h4>
              <p class="mt-1 text-xs text-base-content/50">
                {perm.name}
                {#if perm.description}
                  · {perm.description}
                {/if}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              {#each roles as role}
                {@const has = hasPermission(role, perm.id)}
                {@const isLoading = isUpdating === role.id}
                {@const isClickable = canManagePermissions && !role.isSystem}
                {#if isClickable}
                  <button
                    type="button"
                    class={`badge text-xs transition-all ${has ? 'badge-success hover:badge-error' : 'badge-ghost border-white/10 text-base-content/30 hover:badge-success'} ${isLoading ? 'opacity-50' : ''}`}
                    onclick={() => togglePermission(role, perm.id)}
                    disabled={isLoading}
                    title={has ? `Remove from ${role.name}` : `Add to ${role.name}`}
                  >
                    {#if isLoading}
                      <span class="loading loading-spinner loading-xs mr-1"></span>
                    {/if}
                    {role.name}
                    {#if has && !isLoading}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="ml-1 size-3">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    {/if}
                  </button>
                {:else}
                  <span
                    class={`badge text-xs ${has ? 'badge-success' : 'badge-ghost border-white/10 text-base-content/30'}`}
                  >
                    {role.name}
                    {#if has}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="ml-1 size-3">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    {/if}
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
