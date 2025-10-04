<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { ROLE_LABELS } from '@escapeplan/contracts';
  import type { OperatorRole, BotttsAvatarConfig } from '@escapeplan/contracts';
  import type { ActionData, PageData } from './$types';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import { randomizeAvatarConfig } from '$lib/avatar/avatar-utils';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let { data, form }: { data: PageData; form: ActionData | null } = $props();

  let profile = $derived(form?.profile ?? data.profile);
  let success = $derived(Boolean(form?.success));
  let errorMessage = $derived(form && 'message' in form ? (form as { message?: string }).message : null);

  // Avatar editing state - initialize from profile but don't auto-reset
  let hasCustomized = $state(false);
  let avatarConfig = $state<BotttsAvatarConfig>({ seed: '' }); // Will be initialized in effect
  let isSubmitting = $state(false);

  // Only sync avatar from profile if user hasn't customized it
  $effect(() => {
    if (!hasCustomized) {
      avatarConfig = profile.avatarConfig ?? { seed: profile.username };
    }
  });

  // Reset after successful save
  $effect(() => {
    if (success) {
      hasCustomized = false;
      isSubmitting = false;
    }
  });

  function randomizeAvatar() {
    avatarConfig = randomizeAvatarConfig();
    hasCustomized = true;
  }
</script>

<section class="space-y-6">
  {#if success}
    <Alert type="success">
      <span>Profile updated successfully.</span>
    </Alert>
  {:else if errorMessage}
    <Alert type="error">
      <span>{errorMessage}</span>
    </Alert>
  {/if}

  <article class="glass-panel border-white/10 bg-base-200/70 p-6">
    <header class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="shrink-0 overflow-hidden rounded-3xl">
          <Avatar config={avatarConfig} username={profile.username} size={64} />
        </div>
        <div>
          <h1 class="text-2xl font-display text-base-content">{profile.name}</h1>
          <p class="text-sm uppercase tracking-[0.35em] text-base-content/50">
            {ROLE_LABELS[profile.role as OperatorRole] ?? profile.role.replace(/_/g, ' ')}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline"
        onclick={randomizeAvatar}
      >
        Randomize Avatar
      </button>
    </header>

    <form
      method="POST"
      action="?/update"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') {
            await invalidateAll();
          } else {
            isSubmitting = false;
          }
        };
      }}
      class="mt-6 grid gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="avatarConfig" value={JSON.stringify(avatarConfig)} />

      <label class="form-control md:col-span-2">
        <span class="label-text">Display name</span>
        <input class="input input-bordered" name="name" required value={profile.name} />
      </label>
      <label class="form-control md:col-span-2">
        <span class="label-text">Email</span>
        <input class="input input-bordered" type="email" name="email" value={profile.email ?? ''} placeholder="name@example.com" />
      </label>
      <label class="form-control md:col-span-2">
        <span class="label-text">Bio</span>
        <textarea class="textarea textarea-bordered min-h-[6rem]" name="bio" maxlength="500" placeholder="Share a short operator bio.">{profile.bio ?? ''}</textarea>
        <span class="label-text-alt">Max 500 characters. Visible to managers and admins.</span>
      </label>
      <div class="md:col-span-2 flex justify-end">
        <LoadingButton type="submit" variant="primary" loading={isSubmitting}>
          Save profile
        </LoadingButton>
      </div>
    </form>
  </article>
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
