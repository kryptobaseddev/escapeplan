<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData | null }>();

  let profile = $derived(form?.profile ?? data.profile);
  let success = $derived(Boolean(form?.success));
  let errorMessage = $derived(form && 'message' in form ? (form as { message?: string }).message : null);
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
    <header class="flex items-center gap-4">
      <div class="inline-flex size-16 items-center justify-center rounded-3xl bg-base-300/70 text-xl font-semibold text-base-content/70">
        {#if profile.avatarUrl}
          <img src={profile.avatarUrl} alt={profile.name} class="size-full rounded-3xl object-cover" />
        {:else}
          {profile.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0)?.toUpperCase() ?? '')
            .join('')}
        {/if}
      </div>
      <div>
        <h1 class="text-2xl font-display text-base-content">{profile.name}</h1>
        <p class="text-sm uppercase tracking-[0.35em] text-base-content/50">{profile.role.replace(/_/g, ' ')}</p>
      </div>
    </header>

    <form method="POST" action="?/update" use:enhance class="mt-6 grid gap-4 md:grid-cols-2">
      <label class="form-control md:col-span-2">
        <span class="label-text">Display name</span>
        <input class="input input-bordered" name="name" required value={profile.name} />
      </label>
      <label class="form-control">
        <span class="label-text">Email</span>
        <input class="input input-bordered" type="email" name="email" value={profile.email ?? ''} placeholder="name@example.com" />
      </label>
      <label class="form-control">
        <span class="label-text">Avatar URL</span>
        <input class="input input-bordered" type="url" name="avatarUrl" value={profile.avatarUrl ?? ''} placeholder="https://..." />
        <span class="label-text-alt">Provide an HTTPS image URL; leave blank to use initials.</span>
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
