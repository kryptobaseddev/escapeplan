<svelte:options runes={true} />

<script lang="ts">
  import type { LayoutData } from './$types';
  import { page } from '$app/stores';

  const { children } = $props<{ children: () => unknown; data: LayoutData }>();

  const tabs = [
    { href: '/account/profile', label: 'Profile' },
    { href: '/account/security', label: 'Security' }
  ];
</script>

<section class="mx-auto w-full max-w-4xl space-y-6">
  <nav class="flex items-center gap-2 rounded-2xl border border-white/10 bg-base-200/70 p-2 text-sm backdrop-blur">
    {#each tabs as tab}
      <a
        href={tab.href}
        class={`flex-1 rounded-xl px-4 py-2 text-center font-semibold transition ${$page.url.pathname.startsWith(tab.href) ? 'bg-primary/20 text-primary shadow-inner shadow-primary/20' : 'text-base-content/60 hover:bg-base-300/60 hover:text-base-content'}`}
        aria-current={$page.url.pathname.startsWith(tab.href) ? 'page' : undefined}
      >
        {tab.label}
      </a>
    {/each}
  </nav>

  {@render children()}
</section>
