<script lang="ts">
  import { toastStore } from '$lib/stores/toast.svelte';

  const typeClasses = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error'
  };
</script>

<div class="toast toast-end toast-top z-50">
  {#each toastStore.toasts as toast (toast.id)}
    <div class="alert {typeClasses[toast.type]}">
      <span>{toast.message}</span>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        onclick={() => toastStore.remove(toast.id)}
      >
        ✕
      </button>
    </div>
  {/each}
</div>
