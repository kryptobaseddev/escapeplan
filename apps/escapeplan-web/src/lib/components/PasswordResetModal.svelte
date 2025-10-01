<svelte:options runes={true} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { OperatorSummary } from '@escapeplan/contracts';

  interface Props {
    open?: boolean;
    action?: string;
    user?: OperatorSummary | null;
    onclose?: () => void;
    onsuccess?: () => void;
  }

  const props = $props();

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let errorMessage = $state<string | null>(null);
  let password = $state('');
  let forceReset = $state(true);
  let initialised = $state(false);

  const openFlag = $derived(Boolean(props.open as boolean | undefined));
  const actionValue = $derived((props.action as string | undefined) ?? '');
  const userValue = $derived((props.user as OperatorSummary | null | undefined) ?? null);

  const handleSubmit: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        const failureData = result.data as { message?: string } | undefined;
        errorMessage = failureData?.message ?? 'Request failed.';
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        errorMessage = null;
        (props.onsuccess as (() => void) | undefined)?.();
        return;
      }
      await update();
    };
  };

  function close() {
    (props.onclose as (() => void) | undefined)?.();
  }

  $effect(() => {
    if (!openFlag && initialised) {
      initialised = false;
      password = '';
    }
  });

  $effect(() => {
    if (openFlag && !initialised) {
      password = '';
      forceReset = true;
      errorMessage = null;
      initialised = true;
    }
  });
</script>

{#if openFlag}
  <dialog class="modal modal-bottom sm:modal-middle" open bind:this={dialogElement} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="modal-box max-h-[90vh] w-full max-w-lg overflow-y-auto px-6 py-6">
      <header class="space-y-1">
        <h2 class="text-lg font-semibold text-base-content">Reset password</h2>
        <p class="text-sm text-base-content/70">Generate a new password for {userValue?.name ?? 'this user'}.</p>
      </header>

      {#if errorMessage}
        <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form method="POST" action={actionValue} class="mt-6 space-y-4" use:enhance={handleSubmit}>
        <input type="hidden" name="id" value={userValue?.id} />

        <label class="form-control">
          <span class="label-text">New password</span>
          <input
            class="input input-bordered"
            type="password"
            name="password"
            minlength="12"
            required
            bind:value={password}
            placeholder="At least 12 characters"
          />
        </label>

        <label class="form-control">
          <span class="label-text">Require reset on next login</span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            name="forceReset"
            bind:checked={forceReset}
          />
        </label>

        <footer class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close}>
            Cancel
          </button>
          <button type="submit" class="btn btn-secondary w-full sm:w-auto min-h-[44px]">
            Reset password
          </button>
        </footer>
      </form>
    </div>
  </dialog>
{/if}

<!-- no component-scoped styles; rely on DaisyUI theme utilities -->
