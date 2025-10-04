<script lang="ts">
  interface Props {
    label: string;
    name: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    minlength?: number;
    maxlength?: number;
    rows?: number;
    hint?: string;
    error?: string;
    class?: string;
  }

  let {
    label,
    name,
    value = $bindable(''),
    placeholder,
    required = false,
    minlength,
    maxlength,
    rows = 3,
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
  <textarea
    class="textarea validator"
    {name}
    {placeholder}
    {required}
    {minlength}
    {maxlength}
    {rows}
    bind:value
  ></textarea>
  {#if error}
    <div class="validator-hint">{error}</div>
  {:else if hint}
    <span class="label-text-alt text-base-content/60">{hint}</span>
  {/if}
</label>
