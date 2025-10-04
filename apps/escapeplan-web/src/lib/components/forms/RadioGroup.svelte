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

<div class="form-control {className}">
  <span class="label-text">
    {label}
    {#if required}<span class="text-error">*</span>{/if}
  </span>
  <div class="flex flex-col gap-2 mt-2">
    {#each options as option}
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="radio"
          class="radio validator"
          {name}
          {required}
          value={option.value}
          bind:group={value}
        />
        <span class="label-text">{option.label}</span>
      </label>
    {/each}
  </div>
  {#if error}
    <div class="validator-hint">{error}</div>
  {:else if hint}
    <span class="label-text-alt text-base-content/60">{hint}</span>
  {/if}
</div>
