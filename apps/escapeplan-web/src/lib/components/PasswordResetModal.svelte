<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type { OperatorSummary } from '@escapeplan/contracts';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { createFormHandler } from '$lib/utils/forms';

  interface Props {
    open?: boolean;
    action?: string;
    user?: OperatorSummary | null;
    onclose?: () => void;
    onsuccess?: () => void;
  }

  const props = $props();

  let errorMessage = $state<string | null>(null);
  let password = $state('');
  let confirmPassword = $state('');
  let forceReset = $state(true);
  let initialised = $state(false);
  let isSubmitting = $state(false);

  const openFlag = $derived(Boolean(props.open as boolean | undefined));
  const actionValue = $derived((props.action as string | undefined) ?? '');
  const userValue = $derived((props.user as OperatorSummary | null | undefined) ?? null);

  // Strong password pattern: 8+ chars with number, lowercase, and uppercase
  const passwordPattern = '(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}';

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
      errorMessage = failureData?.message ?? 'Request failed.';
    }
  });

  function close() {
    if (!isSubmitting) {
      (props.onclose as (() => void) | undefined)?.();
    }
  }

  $effect(() => {
    if (!openFlag && initialised) {
      initialised = false;
      password = '';
      confirmPassword = '';
    }
  });

  $effect(() => {
    if (openFlag && !initialised) {
      password = '';
      confirmPassword = '';
      forceReset = true;
      errorMessage = null;
      initialised = true;
    }
  });
</script>

<Modal
  open={openFlag}
  title="Reset password"
  description="Generate a new password for {userValue?.name ?? 'this user'}."
  size="lg"
  onClose={close}
>
  {#if errorMessage}
    <Alert type="error" class="mb-6">
      {errorMessage}
    </Alert>
  {/if}

  <form method="POST" action={actionValue} class="space-y-4" use:enhance={handleSubmit}>
    <input type="hidden" name="id" value={userValue?.id} />

    <fieldset class="border border-base-300 rounded-lg p-4 space-y-4">
      <legend class="text-sm font-semibold px-2">Reset Password</legend>

      <label class="form-control">
        <div class="label">
          <span class="label-text">New Password <span class="text-error">*</span></span>
        </div>
        <input
          type="password"
          class="input input-bordered validator"
          name="password"
          required
          minlength="8"
          pattern={passwordPattern}
          placeholder="Enter new password"
          title="Must be 8+ characters with number, lowercase, and uppercase letter"
          bind:value={password}
          disabled={isSubmitting}
        />
        <div class="validator-hint">
          Must be at least 8 characters including:
          <br/>• At least one number
          <br/>• At least one lowercase letter
          <br/>• At least one uppercase letter
        </div>
      </label>

      <label class="form-control">
        <div class="label">
          <span class="label-text">Confirm Password <span class="text-error">*</span></span>
        </div>
        <input
          type="password"
          class="input input-bordered validator"
          name="confirmPassword"
          required
          minlength="8"
          pattern={password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
          placeholder="Re-enter new password"
          title="Passwords must match"
          bind:value={confirmPassword}
          disabled={isSubmitting}
        />
        <div class="validator-hint">
          Please re-enter the password to confirm
        </div>
      </label>
    </fieldset>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          name="forceReset"
          bind:checked={forceReset}
          disabled={isSubmitting}
        />
        <span class="label-text">Require reset on next login</span>
      </label>
    </div>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close} disabled={isSubmitting}>
      Cancel
    </button>
    <LoadingButton
      type="submit"
      variant="secondary"
      loading={isSubmitting}
      class="w-full sm:w-auto min-h-[44px]"
    >
      Reset password
    </LoadingButton>
  {/snippet}
</Modal>
