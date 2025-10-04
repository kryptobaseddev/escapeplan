<svelte:options runes={true} />

<script lang="ts">
  interface TextHintProps {
    content: string;
    colors?: {
      textColor: string;
      backgroundColor: string;
    };
  }

  let { content, colors }: TextHintProps = $props();

  const bgColor = $derived(colors?.backgroundColor ?? 'rgba(251, 191, 36, 0.9)'); // Default: warning/amber
  const textColor = $derived(colors?.textColor ?? 'rgba(0, 0, 0, 1)'); // Default: black
</script>

<div class="absolute inset-x-0 top-1/4 z-20 flex items-center justify-center px-6">
  <div
    class="rounded-2xl border px-8 py-4 shadow-xl backdrop-blur-sm"
    style="background-color: {bgColor}; color: {textColor}; border-color: {textColor}40;"
  >
    <p class="text-xl font-semibold tracking-tight text-center" style="color: {textColor};">
      {content}
    </p>
  </div>
</div>
