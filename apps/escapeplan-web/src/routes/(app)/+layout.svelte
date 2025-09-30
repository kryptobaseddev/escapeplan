<svelte:options runes={false} />

<script lang="ts">
  import '../../app.css';
  import { pwaInfo } from 'virtual:pwa-info';
  import { pwaAssetsHead } from 'virtual:pwa-assets/head';
  import type { LayoutData } from './$types';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { initializeRealtime } from '$lib/realtime';
  import { ROLE_LABELS } from '@escapeplan/contracts';
  import Avatar from '$lib/avatar/Avatar.svelte';

  export let data: LayoutData;
  export let children: Snippet;

  const manifestLinkTag = pwaInfo?.webManifest?.linkTag ?? '';

  let adminLinks: { href: string; label: string; icon: string }[] = [];
  let roleLabel = data.user ? data.user.role.replace(/_/g, ' ') : '';
  let allNavItems: { href: string; label: string; icon: string }[] = [];
  let currentPageTitle = 'EscapePlan Console';
  let userInitials = 'EP';
  const canManageUsers = data.user?.permissions?.includes('manage_users') ?? false;
  const canManageGames = data.user?.permissions?.includes('manage_games') ?? false;
  const canViewNetwork = data.user?.permissions?.includes('view_network') ?? false;
  const canManageNetwork = data.user?.permissions?.includes('manage_network') ?? false;

  let drawerOpen = false;
  let sidebarCollapsed = false;
  let lastPathname = '';

  onMount(() => {
    initializeRealtime();

    // Load sidebar state from localStorage
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState !== null) {
      sidebarCollapsed = savedState === 'true';
    }
  });

  $: {
    const pathname = $page.url.pathname;
    if (lastPathname && pathname !== lastPathname) {
      drawerOpen = false;
    }
    lastPathname = pathname;
  }

  function toggleDrawer(force?: boolean) {
    drawerOpen = typeof force === 'boolean' ? force : !drawerOpen;
  }

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }

  const primaryLinks = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: 'M3 12a9 9 0 0118 0v7a1 1 0 01-1 1h-6v-5h-4v5H4a1 1 0 01-1-1z'
    },
    {
      href: '/bookings',
      label: 'Bookings',
      icon: 'M4 7a2 2 0 012-2h1V4a2 2 0 012-2h2a2 2 0 012 2v1h1a2 2 0 012 2v2H4zM4 11h16v7a2 2 0 01-2 2H6a2 2 0 01-2-2z'
    },
    {
      href: '/games',
      label: 'Game Runner',
      icon: 'M4 5a2 2 0 012-2h8.5a2 2 0 011.414.586l3.5 3.5A2 2 0 0120 8.5V19a2 2 0 01-2 2H6a2 2 0 01-2-2z'
    }
  ];

  const accountLink = {
    href: '/account/profile',
    label: 'Account',
    icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm7 7a6 6 0 10-14 0h2a4 4 0 118 0h2z'
  };

  $: adminLinks = [
    ...(canManageGames
      ? [
          {
            href: '/admin/games',
            label: 'Game Settings',
            icon: 'M4 6h16v2H4zm2 4h12v2H6zm3 4h6v2H9z'
          }
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            href: '/admin/users',
            label: 'User Management',
            icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm7 7a6 6 0 10-14 0h2a4 4 0 118 0h2z'
          }
        ]
      : []),
    ...(canViewNetwork
      ? [
          {
            href: '/admin/network',
            label: 'Network Control',
            icon: 'M4 5h16v2H4zm2 4h12v2H6zm3 4h6v2H9zm-5 4h16v2H4z'
          }
        ]
      : [])
  ];

  $: roleLabel = data.user ? ROLE_LABELS[data.user.role] ?? data.user.role.replace(/_/g, ' ') : '';
  $: allNavItems = [...primaryLinks, ...adminLinks, accountLink];

  $: currentPageTitle = (() => {
    const explicit = $page.data?.pageTitle;
    if (explicit) return explicit;
    const path = $page.url.pathname;
    const entry = allNavItems.find((link) => path === link.href || path.startsWith(`${link.href}/`));
    return entry?.label ?? 'EscapePlan Console';
  })();

  $: userInitials = (() => {
    const source = data.user?.name || data.user?.username || 'EP';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0)?.toUpperCase() ?? '')
      .join('') || 'EP';
  })();
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
  <meta name="description" content="EscapePlan operator tools for bookings, dashboards, and live game control." />
</svelte:head>

<div class="drawer lg:drawer-open">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} aria-hidden="true" />
  <div class="drawer-content flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-white/5 bg-base-100/70 px-4 py-3 backdrop-blur lg:px-6">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <!-- Mobile hamburger (2-line → X) -->
          <button
            type="button"
            class="group relative flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-base-300/60 lg:hidden"
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            aria-controls="app-drawer-panel"
            onclick={() => toggleDrawer()}
          >
            <div class="flex flex-col items-center justify-center gap-1.5">
              <span class="block h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 {drawerOpen ? 'translate-y-1 rotate-45' : ''}"></span>
              <span class="block h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 {drawerOpen ? '-translate-y-1 -rotate-45' : ''}"></span>
            </div>
          </button>

          <!-- Desktop collapse toggle (2-line → X) -->
          <button
            type="button"
            class="group hidden size-10 items-center justify-center rounded-lg transition-colors hover:bg-base-300/60 lg:flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onclick={toggleSidebar}
          >
            <div class="flex flex-col items-center justify-center gap-1.5">
              <span class="block h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 {sidebarCollapsed ? 'translate-y-1 rotate-45' : ''}"></span>
              <span class="block h-0.5 w-5 origin-center rounded-full bg-current transition-all duration-300 {sidebarCollapsed ? '-translate-y-1 -rotate-45' : ''}"></span>
            </div>
          </button>

          <div class="flex flex-col">
            <h1 class="font-display text-base text-base-content sm:text-lg">{currentPageTitle}</h1>
            <p class="hidden text-xs uppercase tracking-[0.3em] text-base-content/40 sm:block">EscapePlan Console</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="badge-pill hidden md:inline-flex">
            <span class="inline-flex size-2 rounded-full bg-success shadow shadow-success/50"></span>
            <span>Pi appliance · Offline ready</span>
          </div>
        </div>
      </div>
    </header>

    <main class="relative flex-1 px-4 py-8 lg:px-10">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5" aria-hidden="true"></div>
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8">
        {@render children()}
      </div>
    </main>
  </div>
  <aside class="drawer-side">
    <label for="app-drawer" aria-label="Close navigation" class="drawer-overlay"></label>
    <div
      id="app-drawer-panel"
      class="flex min-h-full flex-col justify-between border-r border-white/5 bg-base-100/80 backdrop-blur-xl transition-all duration-300 ease-in-out
             w-72 px-4 py-5
             lg:px-4 lg:py-6
             {sidebarCollapsed ? 'lg:w-20 sidebar-collapsed' : 'lg:w-72'}"
    >
      <div class="flex flex-col gap-6">
        <!-- Logo and branding -->
        <div class="flex items-center gap-3 {sidebarCollapsed ? 'lg:justify-center' : ''}">
          <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 shadow-inner shadow-primary/20 transition-all">
            <img src="/logo.png" alt="EscapePlan" class="h-7 w-auto" />
          </span>
          <div class="brand-text flex flex-col text-base-content transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:flex'}">
            <span class="font-display text-base">EscapePlan Ops</span>
            <span class="text-xs uppercase tracking-[0.35em] text-base-content/50">Control Room</span>
          </div>
          <button
            type="button"
            class="ml-auto flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-base-300/60 lg:hidden"
            aria-label="Close navigation"
            onclick={() => toggleDrawer(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current" focusable="false" aria-hidden="true">
              <path d="M6.225 4.811 4.81 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z" />
            </svg>
          </button>
        </div>

        <!-- Main navigation -->
        <nav class="flex flex-1 flex-col gap-2">
          {#each primaryLinks as link}
            <a
              href={link.href}
              class="nav-link group relative {sidebarCollapsed ? 'lg:justify-center' : ''}"
              data-active={$page.url.pathname.startsWith(link.href)}
              title={sidebarCollapsed ? link.label : undefined}
            >
              <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60 transition-colors group-hover:bg-base-300 group-hover:text-base-content">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
                  <path d={link.icon} />
                </svg>
              </span>
              <span class="truncate font-medium transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}" data-label>{link.label}</span>
            </a>
          {/each}

          {#if adminLinks.length}
            <div class="nav-section-title mt-6 mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-base-content/40 transition-all {sidebarCollapsed ? 'lg:hidden' : ''}">
              Admin
            </div>
            {#each adminLinks as link}
              <a
                href={link.href}
                class="nav-link group relative {sidebarCollapsed ? 'lg:justify-center' : ''}"
                data-active={$page.url.pathname.startsWith(link.href)}
                title={sidebarCollapsed ? link.label : undefined}
              >
                <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60 transition-colors group-hover:bg-base-300 group-hover:text-base-content">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
                    <path d={link.icon} />
                  </svg>
                </span>
                <span class="truncate font-medium transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}" data-label>{link.label}</span>
              </a>
            {/each}
          {/if}
        </nav>
      </div>

      <!-- User profile section -->
      <div class="flex flex-col gap-3 border-t border-white/5 pt-5">
        <!-- User info -->
        <div class="flex items-center gap-3 {sidebarCollapsed ? 'lg:justify-center' : ''}">
          <div class="shrink-0 overflow-hidden rounded-2xl">
            <Avatar config={data.user?.avatarConfig} username={data.user?.username} size={48} />
          </div>
          <div class="profile-meta flex flex-col text-xs text-base-content/60 transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:flex'}">
            <span class="truncate text-sm font-semibold text-base-content/80">{data.user?.name}</span>
            <span class="truncate text-[0.65rem] uppercase tracking-[0.35em]">{roleLabel}</span>
          </div>
        </div>

        <!-- Account link -->
        <a
          href={accountLink.href}
          class="nav-link group {sidebarCollapsed ? 'lg:justify-center' : ''}"
          data-active={$page.url.pathname.startsWith('/account')}
          title={sidebarCollapsed ? accountLink.label : undefined}
        >
          <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60 transition-colors group-hover:bg-base-300 group-hover:text-base-content">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
              <path d={accountLink.icon} />
            </svg>
          </span>
          <span class="truncate font-medium transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}" data-label>{accountLink.label}</span>
        </a>

        <!-- Sign out -->
        <form action="/logout" method="POST">
          <button
            class="nav-link group w-full text-secondary {sidebarCollapsed ? 'lg:justify-center' : ''}"
            type="submit"
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/20 text-secondary transition-colors group-hover:bg-secondary/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
                <path d="M10 4a2 2 0 0 1 2 2v3h-2V6H6v12h4v-3h2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4zm5.586 7-1.293-1.293 1.414-1.414L21.414 12l-5.707 5.707-1.414-1.414L15.586 13H11v-2h4.586z" />
              </svg>
            </span>
            <span class="truncate font-medium transition-all {sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}" data-label>Sign out</span>
          </button>
        </form>

        <!-- Version info -->
        <p class="text-center text-[0.65rem] text-base-content/40 transition-all {sidebarCollapsed ? 'lg:hidden' : ''}">
          EscapePlan Platform v0.1.0 · Offline-first
        </p>
      </div>
    </div>
  </aside>
</div>
