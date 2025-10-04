<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';

  let { data }: { data: PageData } = $props();
  let isSubmitting = $state(false);
</script>

<section class="mx-auto w-full max-w-3xl space-y-8">
  <header class="space-y-2">
    <h1 class="section-heading">Account Security</h1>
    <p class="text-sm text-base-content/60">
      Update your EscapePlan password. Changes take effect immediately across all operator consoles.
    </p>
  </header>

  <article class="glass-panel border-white/10 bg-base-200/70 p-6">
    <h2 class="text-lg font-semibold text-base-content">Change password</h2>
    <form
      method="POST"
      action="?/change"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ result, update }) => {
          await update();
          isSubmitting = false;
        };
      }}
      class="mt-4 space-y-4"
    >
      <label class="form-control">
        <span class="label-text">Current password</span>
        <input class="input input-bordered" type="password" name="currentPassword" autocomplete="current-password" required />
      </label>
      <label class="form-control">
        <span class="label-text">New password</span>
        <input class="input input-bordered" type="password" name="newPassword" autocomplete="new-password" minlength="12" required />
        <span class="label-text-alt">Use at least 12 characters. Avoid shared credentials.</span>
      </label>
      <LoadingButton type="submit" variant="primary" loading={isSubmitting}>
        Update password
      </LoadingButton>
    </form>
  </article>
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
