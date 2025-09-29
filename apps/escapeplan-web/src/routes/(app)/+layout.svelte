<script lang="ts">
import type { LayoutData } from './$types';
import { page } from '$app/stores';
import { setContext, onMount } from 'svelte';
  import { apiFetch } from '$lib/api/client';
  import { initializeRealtime } from '$lib/realtime';
  import { getSocket } from '$lib/realtime/socket';

  let { children, data } = $props<{ children: () => unknown; data: LayoutData }>();

  let sessionToken = $derived(data.sessionToken ?? null);

  $effect(() => {
    setContext('sessionToken', sessionToken);
  });

  let rotationResult = $state<{ username: string; password: string } | null>(null);
  let rotationError = $state<string | null>(null);
  let rotating = $state(false);
  let rotationNotice = $state<string | null>(null);
  let navCollapsed = $state(false);

  let canRotateAdmin = $derived(data.user?.permissions?.includes('rotate_admin_credentials') ?? false);
  let canManageUsers = $derived(data.user?.permissions?.includes('manage_users') ?? false);
  let canManageGames = $derived(data.user?.permissions?.includes('manage_games') ?? false);
  let canViewNetwork = $derived(data.user?.permissions?.includes('view_network') ?? false);
  let canManageNetwork = $derived(data.user?.permissions?.includes('manage_network') ?? false);

  onMount(() => {
    initializeRealtime(sessionToken ?? null);
    const socket = getSocket(sessionToken ?? null);
    socket?.on('admin:credentials:rotated', () => {
      rotationNotice = 'Admin credentials rotated on another console.';
      rotationResult = null;
    });
  });

  async function rotateCredentials() {
    if (!sessionToken) return;
    rotating = true;
    rotationError = null;
    try {
      const result = await apiFetch<{ username: string; password: string }>(fetch, '/admin/rotate-credentials', {
        method: 'POST',
        token: sessionToken
      });
      rotationResult = result;
      rotationNotice = null;
    } catch (error) {
      console.error('Failed to rotate credentials', error);
      rotationError = 'Unable to rotate credentials right now.';
    } finally {
      rotating = false;
    }
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

  let adminLinks = $derived([
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
  ]);

  let roleLabel = $derived(data.user ? data.user.role.replace(/_/g, ' ') : '');
  const allNavItems = $derived([...primaryLinks, ...adminLinks, accountLink]);

  let currentPageTitle = $derived(() => {
    const explicit = ($page.data as { pageTitle?: string } | undefined)?.pageTitle;
    if (explicit) return explicit;
    const path = $page.url.pathname;
    const entry = allNavItems.find((link) => path === link.href || path.startsWith(`${link.href}/`));
    return entry?.label ?? 'EscapePlan Console';
  });

  function toggleNav() {
    navCollapsed = !navCollapsed;
  }

  const userInitials = $derived(() => {
    const source = data.user?.name || data.user?.username || 'EP';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0)?.toUpperCase() ?? '')
      .join('') || 'EP';
  });
</script>

<div class="drawer lg:drawer-open">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-white/5 bg-base-100/70 px-4 py-3 backdrop-blur lg:px-8">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <label for="app-drawer" class="btn btn-ghost btn-square lg:hidden" aria-label="Open navigation">
            <span class="sr-only">Open navigation</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          <button
            type="button"
            class="btn btn-ghost btn-square hidden lg:inline-flex"
            aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            on:click={toggleNav}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
              {#if navCollapsed}
                <path d="M9 4l-1.41 1.41L12.17 10H4v2h8.17l-4.58 4.59L9 18l7-7z" />
              {:else}
                <path d="M15 4l1.41 1.41L11.83 10H20v2h-8.17l4.58 4.59L15 18l-7-7z" />
              {/if}
            </svg>
          </button>
          <div class="flex flex-col">
            <h1 class="font-display text-lg text-base-content sm:text-xl">{currentPageTitle}</h1>
            <p class="text-xs uppercase tracking-[0.3em] text-base-content/40">EscapePlan Console</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="badge-pill hidden md:inline-flex">
            <span class="inline-flex size-2 rounded-full bg-success shadow shadow-success/50"></span>
            <span>Pi appliance · Offline ready</span>
          </div>
          <div class="hidden flex-col text-right text-xs sm:flex">
            <span class="font-semibold text-base-content/80">{data.user?.name}</span>
            <span class="uppercase tracking-[0.35em] text-base-content/40">{roleLabel}</span>
          </div>
          {#if canRotateAdmin}
            <button
              class="btn btn-sm btn-ghost border border-white/10"
              type="button"
              onclick={rotateCredentials}
              disabled={rotating}
            >
              {rotating ? 'Rotating…' : 'Rotate admin credentials'}
            </button>
          {/if}
        </div>
      </div>
    </header>

    <main class="relative flex-1 px-4 py-8 lg:px-10">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5" aria-hidden="true"></div>
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8">
        {#if rotationError}
          <div class="alert alert-error border border-error/40 bg-error/10 text-error-content">
            <span>{rotationError}</span>
          </div>
        {/if}
        {#if rotationNotice}
          <div class="alert alert-warning border border-warning/40 bg-warning/10 text-warning-content">
            <span>{rotationNotice}</span>
          </div>
        {/if}
        {#if rotationResult}
          <div class="alert alert-success border border-success/40 bg-success/10 text-success-content">
            <div>
              <p class="font-semibold">New admin credentials</p>
              <p class="text-xs text-success-content/80">Username: {rotationResult.username} · Password: {rotationResult.password}</p>
            </div>
          </div>
        {/if}
        {@render children()}
      </div>
    </main>
  </div>
  <aside class="drawer-side">
    <label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
    <div
      class={`flex min-h-full w-72 flex-col justify-between border-r border-white/5 bg-base-100/80 px-6 py-6 backdrop-blur-xl transition-all duration-200 ${navCollapsed ? 'lg:w-24 lg:px-3' : 'lg:w-80 lg:px-6'}`}
      data-collapsed={navCollapsed}
    >
      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/15 shadow-inner shadow-primary/20">
              <img src="/logo.png" alt="EscapePlan" class="h-8 w-auto" />
            </span>
            <div class="brand-text flex flex-col text-base-content" class:hidden={navCollapsed}>
              <span class="font-display text-base">EscapePlan Ops</span>
              <span class="text-xs uppercase tracking-[0.35em] text-base-content/50">Control Room</span>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-square hidden lg:inline-flex"
            aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            on:click={toggleNav}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
              {#if navCollapsed}
                <path d="M9 4l-1.41 1.41L12.17 10H4v2h8.17l-4.58 4.59L9 18l7-7z" />
              {:else}
                <path d="M15 4l1.41 1.41L11.83 10H20v2h-8.17l4.58 4.59L15 18l-7-7z" />
              {/if}
            </svg>
          </button>
        </div>

        <nav class="flex flex-1 flex-col gap-2">
          {#each primaryLinks as link}
            <a
              href={link.href}
              class="nav-link"
              data-active={$page.url.pathname.startsWith(link.href)}
              title={navCollapsed ? link.label : undefined}
            >
              <span class="inline-flex size-9 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current">
                  <path d={link.icon} />
                </svg>
              </span>
              <span class="font-medium" data-label>{link.label}</span>
            </a>
          {/each}
          {#if adminLinks.length}
            <div class="nav-section-title mt-6 mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-base-content/40" class:hidden={navCollapsed}>
              Admin
            </div>
            {#each adminLinks as link}
              <a
                href={link.href}
                class="nav-link"
                data-active={$page.url.pathname.startsWith(link.href)}
                title={navCollapsed ? link.label : undefined}
              >
                <span class="inline-flex size-9 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current">
                    <path d={link.icon} />
                  </svg>
                </span>
                <span class="font-medium" data-label>{link.label}</span>
              </a>
            {/each}
          {/if}
        </nav>
      </div>

      <div class="flex flex-col gap-3 border-t border-white/5 pt-5">
        <div class="flex items-center gap-3">
          <div class="inline-flex size-11 items-center justify-center rounded-2xl bg-base-300/70 text-sm font-semibold text-base-content/70">
            {#if data.user?.avatarUrl}
              <img src={data.user.avatarUrl} alt={data.user.name ?? 'Operator avatar'} class="size-full rounded-2xl object-cover" />
            {:else}
              {userInitials}
            {/if}
          </div>
          <div class="profile-meta flex flex-col text-xs text-base-content/60" class:hidden={navCollapsed}>
            <span class="text-sm font-semibold text-base-content/80">{data.user?.name}</span>
            <span class="uppercase tracking-[0.35em]">{roleLabel}</span>
          </div>
        </div>
        <a
          href={accountLink.href}
          class="nav-link"
          data-active={$page.url.pathname.startsWith('/account')}
          title={navCollapsed ? accountLink.label : undefined}
        >
          <span class="inline-flex size-9 items-center justify-center rounded-xl bg-base-300/60 text-base-content/60">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current">
              <path d={accountLink.icon} />
            </svg>
          </span>
          <span class="font-medium" data-label>{accountLink.label}</span>
        </a>
        <form action="/logout" method="POST" class="mt-1">
          <button
            class="nav-link w-full gap-2 text-secondary"
            type="submit"
            title={navCollapsed ? 'Sign out' : undefined}
          >
            <span class="inline-flex size-9 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4 fill-current">
                <path d="M10 4a2 2 0 0 1 2 2v3h-2V6H6v12h4v-3h2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4zm5.586 7-1.293-1.293 1.414-1.414L21.414 12l-5.707 5.707-1.414-1.414L15.586 13H11v-2h4.586z" />
              </svg>
            </span>
            <span class="font-medium" data-label>Sign out</span>
          </button>
        </form>
        <p class="text-[0.65rem] text-base-content/40" class:hidden={navCollapsed}>
          EscapePlan Platform v0.1.0 · Offline-first
        </p>
      </div>
    </div>
  </aside>
</div>
