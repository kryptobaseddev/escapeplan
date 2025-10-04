<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    name: string;
    value?: string;
    options: Option[];
    required?: boolean;
    hint?: string;
    error?: string;
    class?: string;
  }

  let {
    label,
    name,
    value = $bindable(''),
    options,
    required = false,
    hint,
    error,
    class: className = ''
  } = $props();
</script>

<label class="form-control {className}">
  <span class="label-text">
    {label}
    {#if required}<span class="text-error">*</span>{/if}
  </span>
  <select
    class="select validator"
    {name}
    {required}
    bind:value
  >
    <option value="" disabled selected>Select an option</option>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if error}
    <div class="validator-hint">{error}</div>
  {:else if hint}
    <span class="label-text-alt text-base-content/60">{hint}</span>
  {/if}
</label>
