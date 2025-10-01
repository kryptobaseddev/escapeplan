<svelte:options runes={true} />

<script lang="ts">
  import '../app.css';
  import ConfirmDialogHost from '$lib/components/ConfirmDialogHost.svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import { pwaAssetsHead } from 'virtual:pwa-assets/head';

  const { children } = $props<{ children: () => unknown }>();

  const manifestLinkTag = pwaInfo?.webManifest?.linkTag ?? '';
</script>

<svelte:head>
  {@html manifestLinkTag}
  {#if pwaAssetsHead.themeColor}
    <meta name="theme-color" content={pwaAssetsHead.themeColor.content} />
  {/if}
  {#each pwaAssetsHead.links as link}
    <link {...link} />
  {/each}
  <title>EscapePlan Operator Console</title>
  <meta
    name="description"
    content="EscapePlan operator tools for bookings, dashboards, and live game control."
  />
</svelte:head>

<div class="min-h-screen bg-base-200 text-base-content" data-theme="escapeplan">
  {@render children()}
</div>

<ConfirmDialogHost />

{#await import('$lib/pwa/ReloadPrompt.svelte') then { default: ReloadPrompt }}
  <ReloadPrompt />
{/await}
