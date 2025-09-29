<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(serviceWorker: ServiceWorkerRegistration | undefined) {
      console.debug('PWA service worker registered', serviceWorker);
    },
    onRegisterError(error: unknown) {
      console.error('PWA service worker registration failed', error);
    }
  });

  const close = () => {
    offlineReady.set(false);
    needRefresh.set(false);
  };

  $: isVisible = $offlineReady || $needRefresh;
</script>

{#if isVisible}
  <div
    class="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-base-200/70 bg-base-300/90 px-5 py-4 text-base-content shadow-xl backdrop-blur"
    role="status"
    aria-live="polite"
  >
    <div class="flex flex-col gap-3">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#00D5C8]">EscapePlan Update</p>
      <p class="text-sm leading-snug">
        {#if $offlineReady}
          EscapePlan is cached and ready to run without an internet connection.
        {:else}
          A newer build is available. Reload now to apply the latest EscapePlan controls.
        {/if}
      </p>
      <div class="ml-auto flex gap-2">
        {#if $needRefresh}
          <button
            class="rounded-lg bg-[#00D5C8] px-3 py-2 text-sm font-semibold text-[#0B0F10] shadow transition hover:bg-[#04b9af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D5C8]"
            type="button"
            on:click={() => updateServiceWorker(true)}
          >
            Reload
          </button>
        {/if}
        <button
          class="rounded-lg border border-[#C43131] px-3 py-2 text-sm font-semibold text-[#C43131] transition hover:bg-[#C43131] hover:text-[#0B0F10] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C43131]"
          type="button"
          on:click={close}
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
{/if}
