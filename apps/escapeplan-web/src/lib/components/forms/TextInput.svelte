<script lang="ts">
  interface Props {
    label: string;
    name: string;
    type?: 'text' | 'email' | 'password' | 'url' | 'tel';
    value?: string;
    placeholder?: string;
    required?: boolean;
    pattern?: string;
    minlength?: number;
    maxlength?: number;
    hint?: string;
    error?: string;
    class?: string;
  }

  let {
    label,
    name,
    type = 'text',
    value = $bindable(''),
    placeholder,
    required = false,
    pattern,
    minlength,
    maxlength,
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
  <input
    class="input validator"
    {type}
    {name}
    {placeholder}
    {required}
    {pattern}
    {minlength}
    {maxlength}
    bind:value
  />
  {#if error}
    <div class="validator-hint">{error}</div>
  {:else if hint}
    <span class="label-text-alt text-base-content/60">{hint}</span>
  {/if}
</label>
