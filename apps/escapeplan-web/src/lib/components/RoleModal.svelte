<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from 'svelte';
  import type { RoleWithPermissions, PermissionSummary, CreateRoleRequest, UpdateRoleRequest, UpdateRolePermissionsRequest } from '@escapeplan/contracts';
  import { PERMISSION_LABELS } from '@escapeplan/contracts';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  interface Props {
    open: boolean;
    role?: RoleWithPermissions | null;
    onclose: () => void;
    onsuccess: () => void;
  }

  let { open = false, role = null, onclose, onsuccess }: Props = $props();

  const isEdit = $derived(!!role);
  const isSystemRole = $derived(role?.isSystem ?? false);

  let name = $state('');
  let description = $state('');
  let selectedPermissions = $state<Set<string>>(new Set());
  let allPermissions = $state<PermissionSummary[]>([]);
  let isLoading = $state(false);
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  // Load permissions on mount
  onMount(async () => {
    if (open) {
      await loadPermissions();
    }
  });

  // Watch open state to reload data
  $effect(() => {
    if (open) {
      loadPermissions();
      if (role) {
        name = role.name;
        description = role.description || '';
        selectedPermissions = new Set(role.permissions.map((p) => p.id));
      } else {
        name = '';
        description = '';
        selectedPermissions = new Set();
      }
      errorMessage = null;
    }
  });

  async function loadPermissions() {
    isLoading = true;
    try {
      const response = await fetch('/api/admin/permissions', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load permissions');
      }

      allPermissions = await response.json();
    } catch (error) {
      console.error('Failed to load permissions:', error);
      errorMessage = 'Unable to load permissions. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Group permissions by category
  const permissionsByCategory = $derived(() => {
    const grouped = new Map<string, PermissionSummary[]>();
    for (const perm of allPermissions) {
      const category = perm.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(perm);
    }
    return grouped;
  });

  function togglePermission(permId: string) {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permId)) {
      newSet.delete(permId);
    } else {
      newSet.add(permId);
    }
    selectedPermissions = newSet;
  }

  function toggleCategory(perms: PermissionSummary[]) {
    const categoryPermIds = perms.map(p => p.id);
    const allSelected = categoryPermIds.every(id => selectedPermissions.has(id));

    const newSet = new Set(selectedPermissions);
    if (allSelected) {
      // Deselect all
      categoryPermIds.forEach(id => newSet.delete(id));
    } else {
      // Select all
      categoryPermIds.forEach(id => newSet.add(id));
    }
    selectedPermissions = newSet;
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }

  async function handleSubmit() {
    errorMessage = null;

    if (!name.trim()) {
      errorMessage = 'Role name is required.';
      return;
    }

    if (selectedPermissions.size === 0) {
      errorMessage = 'At least one permission must be selected.';
      return;
    }

    isSubmitting = true;
    try {
      if (isEdit && role) {
        // Update existing role (name and description)
        if (!isSystemRole) {
          const updatePayload: UpdateRoleRequest = {
            name: name.trim(),
            description: description.trim() || null
          };

          const updateResponse = await fetch(`/api/admin/roles/${role.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updatePayload)
          });

          if (!updateResponse.ok) {
            const error = await updateResponse.json().catch(() => ({ error: { message: 'Failed to update role' } }));
            throw new Error(error?.error?.message || 'Failed to update role');
          }
        }

        // Update permissions (even for system roles if allowed)
        const permPayload: UpdateRolePermissionsRequest = {
          permissionIds: Array.from(selectedPermissions)
        };

        const permResponse = await fetch(`/api/admin/roles/${role.id}/permissions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(permPayload)
        });

        if (!permResponse.ok) {
          const error = await permResponse.json().catch(() => ({ error: { message: 'Failed to update permissions' } }));
          throw new Error(error?.error?.message || 'Failed to update permissions');
        }
      } else {
        // Create new role
        const payload: CreateRoleRequest = {
          name: name.trim(),
          description: description.trim() || null,
          permissionIds: Array.from(selectedPermissions)
        };

        const response = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Failed to create role' } }));
          throw new Error(error?.error?.message || 'Failed to create role');
        }
      }

      onsuccess();
    } catch (error) {
      console.error('Role operation failed:', error);
      errorMessage = error instanceof Error ? error.message : 'An error occurred. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      onclose();
    }
  }
</script>

<Modal
  open={open}
  title={isEdit ? `Edit Role: ${role?.name}${isSystemRole ? ' (System)' : ''}` : 'Create Custom Role'}
  size="4xl"
  onClose={handleClose}
>
  {#if isSystemRole}
    <Alert type="warning" class="mb-6">
      System roles cannot be renamed or deleted. You can only modify their permissions.
    </Alert>
  {/if}

  {#if errorMessage}
    <Alert type="error" class="mb-6">
      {errorMessage}
    </Alert>
  {/if}

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
    <!-- Name and Description -->
    {#if !isSystemRole}
      <div class="form-control">
        <label for="role-name" class="label">
          <span class="label-text">Role Name <span class="text-error">*</span></span>
        </label>
        <input
          id="role-name"
          type="text"
          class="input input-bordered validator"
          bind:value={name}
          placeholder="e.g., senior_operator"
          required
          minlength="3"
          disabled={isSubmitting}
        />
      </div>

      <div class="form-control">
        <label for="role-description" class="label">
          <span class="label-text">Description (optional)</span>
        </label>
        <textarea
          id="role-description"
          class="textarea textarea-bordered validator"
          bind:value={description}
          placeholder="Describe this role's purpose..."
          rows="2"
          maxlength="200"
          disabled={isSubmitting}
        ></textarea>
      </div>
    {/if}

    <!-- Permissions -->
    <div class="form-control">
      <label class="label">
        <span class="label-text font-semibold">Permissions ({selectedPermissions.size} selected)</span>
      </label>

      {#if isLoading}
        <div class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {:else}
        <div class="max-h-96 space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-base-100/30 p-4">
          {#each Array.from(permissionsByCategory()).sort(([a], [b]) => a.localeCompare(b)) as [category, perms]}
            {@const categoryPermIds = perms.map(p => p.id)}
            {@const allSelected = categoryPermIds.every(id => selectedPermissions.has(id))}
            {@const someSelected = categoryPermIds.some(id => selectedPermissions.has(id)) && !allSelected}

            <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
              <legend class="fieldset-legend px-2">
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm validator"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onchange={() => toggleCategory(perms)}
                    disabled={isSubmitting}
                  />
                  <span class="font-semibold text-base-content">{capitalize(category)}</span>
                  <span class="text-xs text-base-content/50">
                    ({perms.filter(p => selectedPermissions.has(p.id)).length}/{perms.length})
                  </span>
                </label>
              </legend>

              <div class="space-y-2 mt-3">
                {#each perms as perm}
                  <label class="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs validator"
                      name="permissions"
                      value={perm.id}
                      checked={selectedPermissions.has(perm.id)}
                      onchange={() => togglePermission(perm.id)}
                      disabled={isSubmitting}
                    />
                    <div class="flex-1">
                      <div class="label-text text-sm">
                        {PERMISSION_LABELS[perm.name] || perm.name}
                      </div>
                      <div class="text-xs text-base-content/40">{perm.name}</div>
                    </div>
                  </label>
                {/each}
              </div>
            </fieldset>
          {/each}
        </div>
      {/if}
    </div>
  </form>

  {#snippet actions()}
    <button
      type="button"
      class="btn btn-ghost w-full sm:w-auto"
      onclick={handleClose}
      disabled={isSubmitting}
    >
      Cancel
    </button>
    <LoadingButton
      type="button"
      variant="primary"
      loading={isSubmitting}
      disabled={isLoading}
      class="w-full sm:w-auto"
      onclick={handleSubmit}
    >
      {#if isEdit}
        Save Changes
      {:else}
        Create Role
      {/if}
    </LoadingButton>
  {/snippet}
</Modal>
