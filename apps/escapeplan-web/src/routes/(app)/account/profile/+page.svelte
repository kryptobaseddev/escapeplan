<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { ROLE_LABELS } from '@escapeplan/contracts';
  import type { OperatorRole, BotttsAvatarConfig } from '@escapeplan/contracts';
  import type { ActionData, PageData } from './$types';
  import Avatar from '$lib/avatar/Avatar.svelte';
  import AvatarEditor from '$lib/avatar/AvatarEditor.svelte';

  let { data, form } = $props<{ data: PageData; form: ActionData | null }>();

  let profile = $derived(form?.profile ?? data.profile);
  let success = $derived(Boolean(form?.success));
  let errorMessage = $derived(form && 'message' in form ? (form as { message?: string }).message : null);

  // Avatar editing state
  let avatarConfig = $state<BotttsAvatarConfig>({ seed: '' });
  $effect.pre(() => {
    avatarConfig = profile.avatarConfig ?? { seed: profile.username };
  });
  let showAvatarEditor = $state(false);

  function handleAvatarUpdate(config: BotttsAvatarConfig) {
    avatarConfig = config;
  }
</script>

<section class="space-y-6">
  {#if success}
    <div class="alert alert-success border border-success/40 bg-success/10 text-success-content">
      <span>Profile updated successfully.</span>
    </div>
  {:else if errorMessage}
    <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
      <span>{errorMessage}</span>
    </div>
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
        onclick={() => showAvatarEditor = !showAvatarEditor}
      >
        {showAvatarEditor ? 'Hide' : 'Edit'} Avatar
      </button>
    </header>

    {#if showAvatarEditor}
      <div class="mt-6">
        <AvatarEditor config={avatarConfig} onUpdate={handleAvatarUpdate} />
      </div>
    {/if}

    <form
      method="POST"
      action="?/update"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') {
            await invalidateAll();
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
        <button class="btn btn-primary" type="submit">Save profile</button>
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
