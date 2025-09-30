<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from 'svelte';

  export let onReasonChange: (value: string) => void = () => {};
  export let label = 'Add an optional note describing why this account is being archived.';
  export let placeholder = 'e.g., Seasonal staff, returning next quarter.';

  let reason = '';
  const textareaId = `archive-reason-${Math.random().toString(36).slice(2, 8)}`;

  function handleInput(event: Event) {
    reason = (event.target as HTMLTextAreaElement).value;
    onReasonChange(reason.trim() ? reason : '');
  }

  onMount(() => {
    onReasonChange('');
  });
</script>

<section class="mt-5 space-y-2">
  <label class="text-xs font-medium uppercase tracking-[0.28em] text-base-content/50" for={textareaId}>{label}</label>
  <textarea
    class="textarea textarea-bordered min-h-[5rem] w-full"
    maxlength="500"
    placeholder={placeholder}
    id={textareaId}
    oninput={handleInput}
  ></textarea>
</section>
