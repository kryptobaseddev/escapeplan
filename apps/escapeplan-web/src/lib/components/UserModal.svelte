<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type {
    BotttsAvatarConfig,
    OperatorPermission,
    OperatorRole,
    OperatorSummary
  } from '@escapeplan/contracts';
  import { PERMISSION_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '@escapeplan/contracts';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { randomSeed, randomizeAvatarConfig } from '$lib/avatar/avatar-utils';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';

  type Mode = 'create' | 'edit';

  interface Props {
    open?: boolean;
    mode?: Mode;
    action?: string;
    canAssignAdmin?: boolean;
    user?: OperatorSummary | null;
    onclose?: () => void;
    onsuccess?: () => void;
  }

  const roleOptions: OperatorRole[] = ['admin', 'manager', 'game_master', 'customer'];

  const props = $props();

  let errorMessage = $state<string | null>(null);
  let initialised = $state(false);
  let selectedRole = $state<OperatorRole>('manager');
  let mustReset = $state(true);
  let passwordValue = $state('');
  let usernameDraft = $state('');
  let avatarConfig = $state<BotttsAvatarConfig>({ seed: randomSeed() });
  let avatarOriginal = $state<BotttsAvatarConfig | null>(null);
  let avatarCustomized = $state(false);
  let isSubmitting = $state(false);

  let openFlag = $derived(Boolean(props.open as boolean | undefined));
  let modeValue = $derived(((props.mode as Mode | undefined) ?? 'create') as Mode);
  let isCreate = $derived(modeValue === 'create');
  let isEdit = $derived(modeValue === 'edit');
  let actionValue = $derived((props.action as string | undefined) ?? '');
  let canAssignAdminValue = $derived(Boolean(props.canAssignAdmin as boolean | undefined));
  let userValue = $derived((props.user as OperatorSummary | null | undefined) ?? null);
  let disableAdminOption = $derived(!canAssignAdminValue && (isCreate || userValue?.role !== 'admin'));
  let avatarPayload = $derived(JSON.stringify(avatarConfig));

  const handleSubmit = createFormHandler({
    onSubmit: () => {
      isSubmitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      isSubmitting = false;
      (props.onsuccess as (() => void) | undefined)?.();
    },
    onError: (result) => {
      isSubmitting = false;
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please try again.';
    }
  });

  function close() {
    (props.onclose as (() => void) | undefined)?.();
  }

  const roleDefaults = (role: OperatorRole) => ROLE_PERMISSIONS[role] ?? [];
  const roleLabel = (role: OperatorRole) => ROLE_LABELS[role] ?? role;
  const permissionLabel = (permission: OperatorPermission) =>
    PERMISSION_LABELS[permission] ?? permission.replace(/_/g, ' ');

  $effect(() => {
    if (!openFlag && initialised) {
      initialised = false;
      passwordValue = '';
      usernameDraft = '';
      avatarCustomized = false;
      avatarOriginal = null;
      avatarConfig = cloneAvatarConfig(null);
      errorMessage = null;
    }
  });

  $effect(() => {
    if (!openFlag || initialised) return;

    selectedRole = userValue?.role ?? 'manager';
    mustReset = isCreate ? true : userValue?.mustResetPassword ?? false;
    passwordValue = '';
    errorMessage = null;
    initialised = true;
    usernameDraft = isEdit ? userValue?.username ?? '' : '';
    avatarOriginal = userValue?.avatarConfig ? cloneAvatarConfig(userValue.avatarConfig) : null;
    avatarConfig = cloneAvatarConfig(userValue?.avatarConfig ?? null);
    avatarCustomized = isEdit && !!avatarOriginal;
  });

  $effect(() => {
    if (!openFlag) return;
    if (!isCreate) return;
    if (avatarCustomized) return;

    const username = usernameDraft.trim();
    if (!username) return;

    const nextSeed = hashSeed(username);
    if (avatarConfig.seed !== nextSeed) {
      const copy = copyAvatarConfig(avatarConfig);
      copy.seed = nextSeed;
      avatarConfig = copy;
    }
  });

  function cloneAvatarConfig(config: BotttsAvatarConfig | null | undefined): BotttsAvatarConfig {
    if (!config) {
      return { seed: randomSeed() };
    }
    return copyAvatarConfig(config);
  }

  function copyAvatarConfig(config: BotttsAvatarConfig): BotttsAvatarConfig {
    return JSON.parse(JSON.stringify(config)) as BotttsAvatarConfig;
  }


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

  function syncAvatarToUsername(force = false) {
    if (!isCreate) return;
    const username = usernameDraft.trim();
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

  function resetAvatar() {
    if (isEdit && avatarOriginal) {
      avatarConfig = cloneAvatarConfig(avatarOriginal);
      avatarCustomized = true;
      return;
    }
    if (isCreate) {
      syncAvatarToUsername(true);
    }
  }

</script>

<Modal
  open={openFlag}
  title={isCreate ? 'Add operator' : `Edit ${userValue?.name ?? 'operator'}`}
  description="Provide real operator details. Archived accounts cannot sign in until restored."
  size="2xl"
  onClose={close}
>
  {#if errorMessage}
    <Alert type="error" class="mb-6">
      {errorMessage}
    </Alert>
  {/if}

  <form method="POST" action={actionValue} class="space-y-5" use:enhance={handleSubmit}>
        {#if isEdit}
          <input type="hidden" name="id" value={userValue?.id} />
        {/if}

    <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
      <legend class="fieldset-legend">User Information</legend>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Username</span>
          <input
            class="input validator"
            name="username"
            type="text"
            required
            minlength="3"
            pattern="^[a-zA-Z0-9._-]+$"
            bind:value={usernameDraft}
            readonly={isEdit}
            placeholder="liv.operator"
          />
          <div class="validator-hint">At least 3 characters, alphanumeric with dots, dashes, or underscores</div>
        </label>
        <label class="form-control">
          <span class="label-text">Display name</span>
          <input
            class="input validator"
            name="name"
            type="text"
            required
            minlength="2"
            value={userValue?.name ?? ''}
            placeholder="Liv Operator"
          />
          <div class="validator-hint">At least 2 characters</div>
        </label>
        <label class="form-control">
          <span class="label-text">Email</span>
          <input
            class="input validator"
            type="email"
            name="email"
            required
            value={userValue?.email ?? ''}
            placeholder="liv@escapeplan.local"
          />
          <div class="validator-hint">Enter a valid email address</div>
        </label>
      </div>
    </fieldset>

    <label class="form-control">
      <span class="label-text">Bio</span>
      <textarea
        class="textarea validator"
        name="bio"
        maxlength="500"
        placeholder="Operator details visible to managers."
      >{userValue?.bio ?? ''}</textarea>
      <div class="validator-hint">Optional. Maximum 500 characters</div>
    </label>

        <section class="rounded-2xl border border-white/10 bg-base-200/70 p-4">
          <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-sm font-semibold text-base-content">Profile avatar</h3>
              <p class="text-xs text-base-content/60">
                {isCreate
                  ? 'Avatar previews update as you type the username. Randomize for a new look.'
                  : 'Adjust or randomize the avatar shown across the console.'}
              </p>
            </div>
            <Avatar
              config={avatarConfig}
              username={usernameDraft || userValue?.username || ''}
              size={64}
              class="overflow-hidden rounded-xl border border-white/10 bg-base-100/70 p-2"
            />
          </header>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-xs text-base-content/60">
              {isCreate
                ? 'Use "Use username seed" to return to the deterministic avatar for the current username.'
                : 'Save changes to persist any avatar updates.'}
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-sm btn-outline" onclick={randomizeAvatar}>
                Randomize
              </button>
              {#if isCreate && usernameDraft.trim().length}
                <button
                  type="button"
                  class="btn btn-sm btn-ghost border border-white/10"
                  onclick={() => syncAvatarToUsername(true)}
                  disabled={!avatarCustomized}
                >
                  Use username seed
                </button>
              {:else if isEdit && avatarOriginal}
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

        <input type="hidden" name="avatarConfig" value={avatarPayload} />

        <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
          <legend class="fieldset-legend">Access Control</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Role</span>
              <select
                class="select validator"
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
              <div class="validator-hint">
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

    {#if isCreate}
      <label class="form-control">
        <span class="label-text">Initial password</span>
        <input
          class="input validator"
          type="password"
          name="password"
          minlength="12"
          required
          bind:value={passwordValue}
          placeholder="At least 12 characters"
        />
        <div class="validator-hint">Minimum 12 characters required</div>
      </label>
    {/if}
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close}>
      Cancel
    </button>
    <LoadingButton
      type="submit"
      variant="primary"
      loading={isSubmitting}
      class="w-full sm:w-auto min-h-[44px]"
      form={actionValue ? undefined : 'user-form'}
    >
      {isCreate ? 'Create user' : 'Save changes'}
    </LoadingButton>
  {/snippet}
</Modal>

<!-- Styling handled via global theme utilities -->
