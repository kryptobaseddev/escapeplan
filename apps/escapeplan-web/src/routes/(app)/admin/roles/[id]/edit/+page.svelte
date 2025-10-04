<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { PermissionSummary, RoleWithPermissions, Permission } from '@escapeplan/contracts';
  import { PERMISSION_LABELS } from '@escapeplan/contracts';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  const role: RoleWithPermissions = data.role;
  const isSystemRole = role.isSystem;

  // Form fields - pre-populate from loaded role data
  let name = $state(role.name);
  let description = $state(role.description || '');
  let selectedPermissions = $state<Set<string>>(
    new Set(data.rolePermissions.map((p: Permission) => p.id))
  );

  // Group permissions by category
  const permissionsByCategory = $derived(() => {
    const grouped = new Map<string, PermissionSummary[]>();
    for (const perm of data.permissions) {
      const category = perm.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(perm);
    }
    return grouped;
  });

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }

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

  function handleCancel() {
    goto('/admin/users?tab=roles');
  }

  const handleSubmit = createFormHandler({
    onSubmit: () => {
      errorMessage = null;

      if (!isSystemRole && !name.trim()) {
        errorMessage = 'Role name is required.';
        throw new Error(errorMessage);
      }

      if (selectedPermissions.size === 0) {
        errorMessage = 'At least one permission must be selected.';
        throw new Error(errorMessage);
      }

      isSubmitting = true;
    },
    onSuccess: async () => {
      // Redirect handled by server-side action
    },
    onError: (result) => {
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please review your input.';
      isSubmitting = false;
    },
    onFinally: () => {
      isSubmitting = false;
    }
  });
</script>

<div class="flex flex-col h-screen">
  <!-- Header -->
  <header class="sticky top-0 z-10 bg-base-100 border-b border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-base-content">
            Edit Role: {role.name}{isSystemRole ? ' (System)' : ''}
          </h1>
          <p class="text-sm text-base-content/60">
            {#if isSystemRole}
              Modify permissions for this system role.
            {:else}
              Update role name, description, and permissions.
            {/if}
          </p>
        </div>
      </div>

      {#if isSystemRole}
        <Alert type="warning" class="mb-4">
          This is a system role. You can modify permissions but cannot change the role name or delete the role.
        </Alert>
      {/if}

      {#if errorMessage}
        <Alert type="error" class="mb-4">{errorMessage}</Alert>
      {/if}
    </div>
  </header>

  <!-- Scrollable content area -->
  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <form method="POST" use:enhance={handleSubmit} class="space-y-6">
        <!-- Role Name (disabled for system roles) -->
        {#if !isSystemRole}
          <label class="form-control">
            <div class="label">
              <span class="label-text">Role Name <span class="text-error">*</span></span>
            </div>
            <input
              type="text"
              name="name"
              class="input input-bordered"
              bind:value={name}
              required
              minlength="3"
              placeholder="e.g., Manager, Senior Operator"
              disabled={isSubmitting}
            />
            <div class="label">
              <span class="label-text-alt">Minimum 3 characters</span>
            </div>
          </label>

          <!-- Description -->
          <label class="form-control">
            <div class="label">
              <span class="label-text">Description (optional)</span>
            </div>
            <textarea
              name="description"
              class="textarea textarea-bordered"
              rows={3}
              bind:value={description}
              placeholder="Describe this role's responsibilities and purpose..."
              maxlength="200"
              disabled={isSubmitting}
            ></textarea>
            <div class="label">
              <span class="label-text-alt">Maximum 200 characters</span>
            </div>
          </label>
        {:else}
          <!-- Hidden fields for system roles -->
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="description" value={description} />
        {/if}

        <!-- Permissions grouped by category -->
        <div class="form-control">
          <div class="label">
            <span class="label-text font-semibold">Permissions <span class="text-error">*</span></span>
            <span class="label-text-alt">{selectedPermissions.size} selected</span>
          </div>

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
                      class="checkbox checkbox-sm"
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
                        class="checkbox checkbox-xs"
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
        </div>

        <!-- Hidden field for selected permissions -->
        <input type="hidden" name="permissionIds" value={JSON.stringify(Array.from(selectedPermissions))} />
      </form>
    </div>
  </main>

  <!-- Fixed footer with Cancel/Save -->
  <footer class="sticky bottom-0 z-10 bg-base-100 border-t border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-ghost" onclick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <LoadingButton
          type="submit"
          variant="primary"
          loading={isSubmitting}
          onclick={() => {
            const form = document.querySelector('form[method="POST"]') as HTMLFormElement;
            form?.requestSubmit();
          }}
        >
          Save Changes
        </LoadingButton>
      </div>
    </div>
  </footer>
</div>
