<svelte:options runes={true} />

<script lang="ts">
  interface Props {
    value?: number;
    label?: string;
    disabled?: boolean;
    step?: number;
    showLabel?: boolean;
    onchange?: (value: number) => void;
  }

  let {
    value = $bindable(80),
    label = 'Volume',
    disabled = false,
    step = 5,
    showLabel = true,
    onchange = undefined
  }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = Number(target.value);
    onchange?.(value);
  }
</script>

<label class="form-control">
  {#if showLabel}
    <span class="label-text">{label}</span>
  {/if}
  <div class="flex items-center gap-2">
    <input
      type="range"
      min="0"
      max="100"
      {step}
      {value}
      {disabled}
      oninput={handleInput}
      class="range range-xs range-primary flex-1"
    />
    <span class="text-sm text-base-content/70 w-12 text-right">{value}%</span>
  </div>
</label>
