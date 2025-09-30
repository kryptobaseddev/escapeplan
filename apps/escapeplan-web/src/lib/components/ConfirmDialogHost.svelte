<svelte:options runes={false} />

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { ConfirmDialogOptions } from './confirm-dialog';
  import { confirmDialogStore, closeConfirmDialog } from './confirm-dialog';

  let options: ConfirmDialogOptions | null = null;
  let typedValue = '';
  let dialogElement: HTMLDialogElement | null = null;
  let currentRequest: unknown = null;
  let cancelButton: HTMLButtonElement | null = null;

  const unsubscribe = confirmDialogStore.subscribe(({ current }) => {
    if (current !== currentRequest) {
      typedValue = '';
      currentRequest = current;
    }

    if (!current) {
      options = null;
      if (dialogElement?.open) {
        dialogElement.close();
      }
      return;
    }

    options = current.options;
  });

  onDestroy(unsubscribe);

  function handleCancel(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    if (options?.disableBackdropClose) return;
    if (dialogElement?.open) {
      dialogElement.close();
    }
    closeConfirmDialog(false);
  }

  function handleConfirm() {
    closeConfirmDialog(true);
    if (dialogElement?.open) {
      dialogElement.close();
    }
  }

  $: confirmWord = options?.confirmWord ?? options?.confirmText ?? 'CONFIRM';

  $: confirmDisabled = Boolean(options?.requiresTypedConfirm && typedValue !== confirmWord);

  $: if (options && cancelButton) {
    tick().then(() => cancelButton?.focus());
  }

  $: variantClass = (() => {
    switch (options?.variant) {
      case 'warning':
        return 'btn-warning';
      case 'danger':
        return 'btn-error';
      default:
        return 'btn-info';
    }
  })();
</script>

{#if options}
  <dialog
    class="modal modal-bottom sm:modal-middle"
    open
    oncancel={handleCancel}
    bind:this={dialogElement}
    onclick={(event) => {
      if (event.target === dialogElement) {
        handleCancel(event);
      }
    }}
  >
    <div class="modal-box max-h-[90vh] w-full max-w-xl overflow-y-auto px-6 py-6">
      <header class="space-y-2">
        <h3 class="text-lg font-semibold text-base-content">{options.title}</h3>
        {#if options.message}
          <p class="text-sm text-base-content/70">{options.message}</p>
        {/if}
      </header>

      {#if options.customContent}
        <svelte:component
          this={options.customContent.component}
          {...options.customContent.props}
        />
      {/if}

      {#if options.requiresTypedConfirm}
        <section class="mt-5 space-y-2">
          <p class="text-xs text-base-content/60">
            Type <span class="font-semibold">{confirmWord}</span> to confirm this action.
          </p>
          <input
            class="input input-bordered w-full"
            name="confirm"
            autocomplete="off"
            placeholder={`Type '${confirmWord}'`}
            bind:value={typedValue}
          />
        </section>
      {/if}

      <footer class="modal-action mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          class="btn btn-ghost w-full min-h-[44px] sm:w-auto"
          onclick={handleCancel}
          bind:this={cancelButton}
        >
          {options.cancelText ?? 'Cancel'}
        </button>
        <button
          type="button"
          class={`btn w-full min-h-[44px] sm:w-auto ${variantClass}`}
          onclick={handleConfirm}
          disabled={confirmDisabled}
        >
          {options.confirmText ?? 'Confirm'}
        </button>
      </footer>
    </div>
  </dialog>
{/if}
