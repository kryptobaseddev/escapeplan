<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { BotttsAvatarConfig, OperatorRole } from '@escapeplan/contracts';
  import { ROLE_LABELS, ROLE_PERMISSIONS, PERMISSION_LABELS } from '@escapeplan/contracts';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { randomSeed, randomizeAvatarConfig } from '$lib/avatar/avatar-utils';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import { createFormHandler } from '$lib/utils/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const roleOptions: OperatorRole[] = ['admin', 'manager', 'game_master', 'customer'];

  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  // Form fields
  let nameValue = $state('');
  let usernameValue = $state('');
  let emailValue = $state('');
  let passwordValue = $state('');
  let bioValue = $state('');
  let selectedRole = $state<OperatorRole>('manager');
  let mustReset = $state(true);

  // Avatar state
  let avatarConfig = $state<BotttsAvatarConfig>({ seed: randomSeed() });
  let avatarCustomized = $state(false);
  let avatarPayload = $derived(JSON.stringify(avatarConfig));

  // Disable admin option if user can't assign admin
  let disableAdminOption = $derived(!data.canAssignAdmin);

  // Permission labels for role description
  const roleDefaults = (role: OperatorRole) => ROLE_PERMISSIONS[role] ?? [];
  const roleLabel = (role: OperatorRole) => ROLE_LABELS[role] ?? role;
  const permissionLabel = (permission: string) =>
    PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] ?? permission.replace(/_/g, ' ');

  // Hash function to generate deterministic seed from username
  function hashSeed(source: string): string {
    const normalized = source.toLowerCase().replace(/[^a-z0-9]/g, '');
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash << 5) - hash + normalized.charCodeAt(i);
      hash |= 0;
    }
    const hex = (hash >>> 0).toString(16).padStart(6, '0');
    const base = normalized.slice(0, 12) || 'operator';
    return `${base}-${hex.slice(0, 8)}`;
  }

  function copyAvatarConfig(config: BotttsAvatarConfig): BotttsAvatarConfig {
    return JSON.parse(JSON.stringify(config)) as BotttsAvatarConfig;
  }

  function syncAvatarToUsername(force = false) {
    const username = usernameValue.trim();
    if (!username) return;
    if (!force && avatarCustomized) return;

    const nextSeed = hashSeed(username);
    const copy = copyAvatarConfig(avatarConfig);
    copy.seed = nextSeed;
    avatarConfig = copy;
    avatarCustomized = false;
  }

  function randomizeAvatar() {
    avatarConfig = randomizeAvatarConfig();
    avatarCustomized = true;
  }

  // Auto-sync avatar to username as user types (unless customized)
  $effect(() => {
    if (!avatarCustomized && usernameValue.trim()) {
      const nextSeed = hashSeed(usernameValue.trim());
      if (avatarConfig.seed !== nextSeed) {
        const copy = copyAvatarConfig(avatarConfig);
        copy.seed = nextSeed;
        avatarConfig = copy;
      }
    }
  });

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
          <h1 class="text-2xl font-bold text-base-content">Create User</h1>
          <p class="text-sm text-base-content/60">Add a new operator to the system.</p>
        </div>
      </div>

      {#if errorMessage}
        <div class="alert alert-error mb-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}
    </div>
  </header>

  <!-- Scrollable content area -->
  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto px-4 py-6 max-w-4xl">
      <form method="POST" action="?/create" class="space-y-6" use:enhance={handleSubmit}>
        <!-- Hidden avatar config -->
        <input type="hidden" name="avatarConfig" value={avatarPayload} />

        <!-- User Information -->
        <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
          <legend class="fieldset-legend">User Information</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Username <span class="text-error">*</span></span>
              <input
                class="input input-bordered validator"
                name="username"
                type="text"
                required
                minlength="3"
                pattern="^[a-zA-Z0-9._\-]+$"
                bind:value={usernameValue}
                placeholder="liv.operator"
              />
              <div class="label-text-alt text-xs">At least 3 characters, alphanumeric with dots, dashes, or underscores</div>
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
              <span class="label-text">Email <span class="text-error">*</span></span>
              <input
                class="input input-bordered validator"
                type="email"
                name="email"
                required
                bind:value={emailValue}
                placeholder="liv@escapeplan.local"
              />
              <div class="label-text-alt text-xs">Enter a valid email address</div>
            </label>

            <label class="form-control">
              <span class="label-text">Initial password <span class="text-error">*</span></span>
              <input
                class="input input-bordered validator"
                type="password"
                name="password"
                minlength="12"
                required
                bind:value={passwordValue}
                placeholder="At least 12 characters"
              />
              <div class="label-text-alt text-xs">Minimum 12 characters required</div>
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
                Avatar previews update as you type the username. Randomize for a new look.
              </p>
            </div>
            <Avatar
              config={avatarConfig}
              username={usernameValue || ''}
              size={64}
              class="overflow-hidden rounded-xl border border-white/10 bg-base-100/70 p-2"
            />
          </header>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-xs text-base-content/60">
              Use "Use username seed" to return to the deterministic avatar for the current username.
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-sm btn-outline" onclick={randomizeAvatar}>
                Randomize
              </button>
              {#if usernameValue.trim().length}
                <button
                  type="button"
                  class="btn btn-sm btn-ghost border border-white/10"
                  onclick={() => syncAvatarToUsername(true)}
                  disabled={!avatarCustomized}
                >
                  Use username seed
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
          Create User
        </LoadingButton>
      </div>
    </div>
  </footer>
</div>
