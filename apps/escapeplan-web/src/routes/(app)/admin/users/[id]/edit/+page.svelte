<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { BotttsAvatarConfig, OperatorRole } from '@escapeplan/contracts';
  import { ROLE_LABELS, ROLE_PERMISSIONS, PERMISSION_LABELS } from '@escapeplan/contracts';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { randomizeAvatarConfig } from '$lib/avatar/avatar-utils';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const roleOptions: OperatorRole[] = ['admin', 'manager', 'game_master', 'customer'];

  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  // Form fields - pre-populated from loaded user
  let nameValue = $state(data.user.name);
  let emailValue = $state(data.user.email ?? '');
  let bioValue = $state(data.user.bio ?? '');
  let selectedRole = $state<OperatorRole>(data.user.role);
  let mustReset = $state(data.user.mustResetPassword);

  // Avatar state
  let avatarConfig = $state<BotttsAvatarConfig>(
    data.user.avatarConfig ? JSON.parse(JSON.stringify(data.user.avatarConfig)) : { seed: data.user.username }
  );
  let avatarOriginal = $state<BotttsAvatarConfig | null>(
    data.user.avatarConfig ? JSON.parse(JSON.stringify(data.user.avatarConfig)) : null
  );
  let avatarCustomized = $state(false);
  let avatarPayload = $derived(JSON.stringify(avatarConfig));

  // Disable admin option if user can't assign admin
  let disableAdminOption = $derived(!data.canAssignAdmin && data.user.role !== 'admin');

  // Permission labels for role description
  const roleDefaults = (role: OperatorRole) => ROLE_PERMISSIONS[role] ?? [];
  const roleLabel = (role: OperatorRole) => ROLE_LABELS[role] ?? role;
  const permissionLabel = (permission: string) =>
    PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] ?? permission.replace(/_/g, ' ');

  function copyAvatarConfig(config: BotttsAvatarConfig): BotttsAvatarConfig {
    return JSON.parse(JSON.stringify(config)) as BotttsAvatarConfig;
  }

  function randomizeAvatar() {
    avatarConfig = randomizeAvatarConfig();
    avatarCustomized = true;
  }

  function resetAvatar() {
    if (avatarOriginal) {
      avatarConfig = copyAvatarConfig(avatarOriginal);
      avatarCustomized = false;
    }
  }

  const handleSubmit = createFormHandler({
    onSubmit: () => {
      isSubmitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      // Redirect handled by server-side action
    },
    onError: (result) => {
      isSubmitting = false;
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please try again.';
    },
    onFinally: () => {
      isSubmitting = false;
    }
  });

  function handleCancel() {
    goto('/admin/users');
  }
</script>

<div class="flex flex-col h-screen">
  <!-- Header -->
  <header class="sticky top-0 z-10 bg-base-100 border-b border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-base-content">Edit User</h1>
          <p class="text-sm text-base-content/60">Update operator information and settings.</p>
        </div>
      </div>

      {#if errorMessage}
        <Alert type="error" class="mb-4">{errorMessage}</Alert>
      {/if}
    </div>
  </header>

  <!-- Scrollable content area -->
  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <form method="POST" action="?/update" class="space-y-6" use:enhance={handleSubmit}>
        <!-- Hidden user ID -->
        <input type="hidden" name="id" value={data.user.id} />
        <!-- Hidden avatar config -->
        <input type="hidden" name="avatarConfig" value={avatarPayload} />

        <!-- User Information -->
        <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
          <legend class="fieldset-legend">User Information</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Username</span>
              <input
                class="input input-bordered"
                type="text"
                value={data.user.username}
                readonly
                disabled
              />
              <div class="label-text-alt text-xs">Username cannot be changed</div>
            </label>

            <label class="form-control">
              <span class="label-text">Display name <span class="text-error">*</span></span>
              <input
                class="input input-bordered validator"
                name="name"
                type="text"
                required
                minlength="2"
                bind:value={nameValue}
                placeholder="Liv Operator"
              />
              <div class="label-text-alt text-xs">At least 2 characters</div>
            </label>

            <label class="form-control">
              <span class="label-text">Email</span>
              <input
                class="input input-bordered validator"
                type="email"
                name="email"
                bind:value={emailValue}
                placeholder="liv@escapeplan.local"
              />
              <div class="label-text-alt text-xs">Enter a valid email address</div>
            </label>
          </div>
        </fieldset>

        <!-- Bio -->
        <label class="form-control">
          <span class="label-text">Bio</span>
          <textarea
            class="textarea textarea-bordered validator"
            name="bio"
            maxlength="500"
            placeholder="Operator details visible to managers."
            bind:value={bioValue}
          ></textarea>
          <div class="label-text-alt text-xs">Optional. Maximum 500 characters</div>
        </label>

        <!-- Avatar Section -->
        <section class="rounded-2xl border border-white/10 bg-base-200/70 p-4">
          <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-sm font-semibold text-base-content">Profile avatar</h3>
              <p class="text-xs text-base-content/60">
                Adjust or randomize the avatar shown across the console.
              </p>
            </div>
            <Avatar
              config={avatarConfig}
              username={data.user.username}
              size={64}
              class="overflow-hidden rounded-xl border border-white/10 bg-base-100/70 p-2"
            />
          </header>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-xs text-base-content/60">
              Save changes to persist any avatar updates.
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-sm btn-outline" onclick={randomizeAvatar}>
                Randomize
              </button>
              {#if avatarOriginal}
                <button
                  type="button"
                  class="btn btn-sm btn-ghost border border-white/10"
                  onclick={resetAvatar}
                  disabled={!avatarCustomized}
                >
                  Reset
                </button>
              {/if}
            </div>
          </div>
        </section>

        <!-- Access Control -->
        <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
          <legend class="fieldset-legend">Access Control</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Role <span class="text-error">*</span></span>
              <select
                class="select select-bordered validator"
                name="role"
                required
                bind:value={selectedRole}
              >
                {#each roleOptions as roleOption}
                  <option
                    value={roleOption}
                    disabled={roleOption === 'admin' && disableAdminOption}
                  >
                    {roleLabel(roleOption)}
                  </option>
                {/each}
              </select>
              <div class="label-text-alt text-xs">
                Defaults: {roleDefaults(selectedRole).map(permissionLabel).join(', ') || 'No default permissions'}
              </div>
            </label>

            <label class="form-control">
              <span class="label-text">Require password reset</span>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                name="mustResetPassword"
                bind:checked={mustReset}
              />
              <span class="label-text-alt text-xs">Forces new password on next login.</span>
            </label>
          </div>
        </fieldset>

        <!-- Password Reset Note -->
        <Alert type="info">To change the password, use the "Reset password" action from the users list.</Alert>
      </form>
    </div>
  </main>

  <!-- Fixed footer with Cancel/Save -->
  <footer class="sticky bottom-0 z-10 bg-base-100 border-t border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-ghost" onclick={handleCancel}>Cancel</button>
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
