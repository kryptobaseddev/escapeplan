<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onReasonChange?: (value: string) => void;
    label?: string;
    placeholder?: string;
  }

  const props = $props();

  const onReasonChangeFunc = $derived((props.onReasonChange as ((value: string) => void) | undefined) ?? (() => {}));
  const labelValue = $derived((props.label as string | undefined) ?? 'Add an optional note describing why this account is being archived.');
  const placeholderValue = $derived((props.placeholder as string | undefined) ?? 'e.g., Seasonal staff, returning next quarter.');

  let reason = $state('');
  const textareaId = `archive-reason-${Math.random().toString(36).slice(2, 8)}`;

  function handleInput(event: Event) {
    reason = (event.target as HTMLTextAreaElement).value;
    onReasonChangeFunc(reason.trim() ? reason : '');
  }

  onMount(() => {
    onReasonChangeFunc('');
  });
</script>

<section class="mt-5 space-y-2">
  <label class="text-xs font-medium uppercase tracking-[0.28em] text-base-content/50" for={textareaId}>{labelValue}</label>
  <textarea
    class="textarea textarea-bordered min-h-[5rem] w-full"
    maxlength="500"
    placeholder={placeholderValue}
    id={textareaId}
    oninput={handleInput}
  ></textarea>
</section>
