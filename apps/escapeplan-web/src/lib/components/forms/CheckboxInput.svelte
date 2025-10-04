<script lang="ts">
  interface Props {
    label: string;
    name: string;
    checked?: boolean;
    required?: boolean;
    hint?: string;
    error?: string;
    class?: string;
  }

  let {
    label,
    name,
    checked = $bindable(false),
    required = false,
    hint,
    error,
    class: className = ''
  } = $props();
</script>

<label class="form-control {className}">
  <label class="label cursor-pointer justify-start gap-3">
    <input
      type="checkbox"
      class="checkbox validator"
      {name}
      {required}
      bind:checked
    />
    <span class="label-text">
      {label}
      {#if required}<span class="text-error">*</span>{/if}
    </span>
  </label>
  {#if error}
    <div class="validator-hint">{error}</div>
  {:else if hint}
    <span class="label-text-alt text-base-content/60">{hint}</span>
  {/if}
</label>
