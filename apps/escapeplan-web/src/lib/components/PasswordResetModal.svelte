<svelte:options runes={false} />

<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { OperatorSummary } from '@escapeplan/contracts';

  export let open = false;
  export let action = '';
  export let user: OperatorSummary | null = null;
  export let onclose: (() => void) | undefined = undefined;
  export let onsuccess: (() => void) | undefined = undefined;

  let errorMessage: string | null = null;
  let dialogElement: HTMLDialogElement | null = null;
  let password = '';
  let forceReset = true;
  let initialised = false;

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
        onsuccess?.();
        return;
      }
      await update();
    };
  };

  function close() {
    onclose?.();
  }

  $: if (!open && initialised) {
    initialised = false;
    password = '';
  }

  $: if (open && !initialised) {
    password = '';
    forceReset = true;
    errorMessage = null;
    initialised = true;
  }
</script>

{#if open}
  <dialog class="modal modal-bottom sm:modal-middle" open bind:this={dialogElement} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="modal-box max-h-[90vh] w-full max-w-lg overflow-y-auto px-6 py-6">
      <header class="space-y-1">
        <h2 class="text-lg font-semibold text-base-content">Reset password</h2>
        <p class="text-sm text-base-content/70">Generate a new password for {user?.name ?? 'this user'}.</p>
      </header>

      {#if errorMessage}
        <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form method="POST" action={action} class="mt-6 space-y-4" use:enhance={handleSubmit}>
        <input type="hidden" name="id" value={user?.id} />

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
