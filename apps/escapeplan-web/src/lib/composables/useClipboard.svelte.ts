/**
 * Svelte 5 composable for clipboard operations with auto-reset success state.
 *
 * Provides a reactive `copySuccess` state that automatically resets to false after 2 seconds,
 * making it ideal for showing temporary "Copied!" feedback in the UI.
 *
 * @returns An object containing the copySuccess state and copyToClipboard function
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useClipboard } from '$lib/composables/useClipboard.svelte';
 *
 *   const { copySuccess, copyToClipboard } = useClipboard();
 *
 *   function handleCopy() {
 *     copyToClipboard('https://example.com');
 *   }
 * </script>
 *
 * <button onclick={handleCopy}>
 *   {copySuccess ? 'Copied!' : 'Copy URL'}
 * </button>
 * ```
 */
export function useClipboard() {
  let copySuccess = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Copy text to clipboard and set success state with auto-reset.
   *
   * Uses the modern Clipboard API to write text to the user's clipboard.
   * On success, sets `copySuccess` to true for 2 seconds before automatically
   * resetting to false. Errors are logged to console but do not throw.
   *
   * @param text - The text content to copy to clipboard
   * @returns Promise that resolves when the copy operation completes
   */
  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);

      // Clear any existing timeout to prevent race conditions
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      copySuccess = true;

      // Auto-reset after 2 seconds
      timeoutId = setTimeout(() => {
        copySuccess = false;
        timeoutId = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      copySuccess = false;
    }
  }

  return {
    get copySuccess() {
      return copySuccess;
    },
    copyToClipboard
  };
}
