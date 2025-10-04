<svelte:options runes={true} />

<script lang="ts">
  import { invalidate, goto } from '$app/navigation';
  import { openConfirmDialog } from '$lib/components/confirm-dialog';
  import ArchiveReasonContent from '$lib/components/ArchiveReasonContent.svelte';
  import GameDetailsModal from '$lib/components/games/GameDetailsModal.svelte';
  import { apiFetch } from '$lib/api/client';
  import type { GameDetails } from '@escapeplan/contracts';
  import { formatDistanceToNow } from 'date-fns';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let viewingGame = $state<GameDetails | null>(null);
  let showDetailsModal = $state(false);
  let pending = $state(false);
  let feedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  let statusFilter = $state<'active' | 'archived' | 'all'>('active');
  let categoryFilter = $state<'all' | string>('all');
  let searchTerm = $state('');

  const uid = (prefix: string) => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    feedback = { type, message };
    setTimeout(() => {
      if (feedback?.message === message) {
        feedback = null;
      }
    }, 4500);
  };

  const refreshGames = async () => {
    await invalidate('app:admin:games');
  };

  const handleDuplicate = async (game: GameDetails) => {
    // Navigate to create page with duplicate query param
    await goto(`/admin/games/create?duplicate=${game.id}`);
  };

  const handleArchive = async (game: GameDetails) => {
    let reason = '';
    const confirmed = await openConfirmDialog({
      title: `Archive ${game.name}`,
      message: 'Archived games disappear from default lists but remain restorable. Provide an optional archive note.',
      confirmText: 'Archive game',
      variant: 'warning',
      customContent: {
        component: ArchiveReasonContent,
        props: {
          onReasonChange: (value: string) => {
            reason = value;
          }
        }
      }
    });
    if (!confirmed) return;
    pending = true;
    try {
      await apiFetch(fetch, `/admin/games/${game.id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      });
      await refreshGames();
      handleFeedback(`${game.name} archived.`, 'success');
    } catch (error) {
      console.error('Failed to archive game', error);
      handleFeedback('Unable to archive game.', 'error');
    } finally {
      pending = false;
    }
  };

  const handleUnarchive = async (game: GameDetails) => {
    const confirmed = await openConfirmDialog({
      title: `Restore ${game.name}`,
      message: 'Restored games return to active listings immediately.',
      confirmText: 'Restore game',
      variant: 'info'
    });
    if (!confirmed) return;
    pending = true;
    try {
      await apiFetch(fetch, `/admin/games/${game.id}/unarchive`, { method: 'PATCH' });
      await refreshGames();
      handleFeedback(`${game.name} restored.`, 'success');
    } catch (error) {
      console.error('Failed to restore game', error);
      handleFeedback('Unable to restore game.', 'error');
    } finally {
      pending = false;
    }
  };

  const handleDelete = async (game: GameDetails) => {
    const confirmed = await openConfirmDialog({
      title: `Delete ${game.name}`,
      message: 'This permanently removes the game configuration and cannot be undone. Type the slug to confirm.',
      confirmText: 'Delete forever',
      variant: 'danger',
      requiresTypedConfirm: true,
      confirmWord: game.slug
    });
    if (!confirmed) return;
    pending = true;
    try {
      const formData = new FormData();
      formData.set('id', game.id);
      await fetch('?/delete', {
        method: 'POST',
        body: formData
      });
      await refreshGames();
      handleFeedback(`${game.name} deleted.`, 'success');
    } catch (error) {
      console.error('Failed to delete game', error);
      handleFeedback('Unable to delete game.', 'error');
    } finally {
      pending = false;
    }
  };

  const openDetailsModal = (game: GameDetails) => {
    viewingGame = game;
    showDetailsModal = true;
  };

  const closeDetailsModal = () => {
    showDetailsModal = false;
    viewingGame = null;
  };

  const openEditFromDetails = (game: GameDetails) => {
    closeDetailsModal();
    goto(`/admin/games/${game.id}/edit`);
  };

  let gamesForFiltering = $state<GameDetails[]>(data.games ?? []);

  $effect(() => {
    gamesForFiltering = data.games ?? [];
  });

  let allCategories = $derived(
    Array.from(
      new Set(
        gamesForFiltering.flatMap((game: GameDetails) => game.categories ?? [])
      )
    ).sort((a: string, b: string) => a.localeCompare(b)) as string[]
  );

  const matchesStatus = (game: GameDetails) => {
    if (statusFilter === 'active') return !game.archivedAt;
    if (statusFilter === 'archived') return Boolean(game.archivedAt);
    return true;
  };

  const matchesCategory = (game: GameDetails) => {
    if (categoryFilter === 'all') return true;
    return game.categories?.includes(categoryFilter) ?? false;
  };

  const matchesSearch = (game: GameDetails) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const haystack = [game.name, game.slug, game.difficulty, ...(game.categories ?? [])].join(' ').toLowerCase();
    return haystack.includes(query);
  };

  let filteredGames = $derived(
    gamesForFiltering
      .filter(matchesStatus)
      .filter(matchesCategory)
      .filter(matchesSearch)
      .sort((a: GameDetails, b: GameDetails) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) as GameDetails[]
  );

  const formatUpdatedAt = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="section-heading">Game Management</h1>
      <p class="mt-2 max-w-2xl text-sm text-base-content/60">
        Configure EscapePlan games with mobile-first modals covering rooms, puzzles, pricing, and booking rules. Changes apply instantly across the operator console.
      </p>
    </div>
    <a href="/admin/games/create" class="btn btn-primary w-full lg:w-auto">
      + Add game
    </a>
  </header>

  <div class="glass-panel border-white/10 bg-base-200/70 p-5 rounded-2xl space-y-4">
    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
      <label class="form-control">
        <span class="label-text">Search</span>
        <input
          class="input input-bordered"
          placeholder="Search name, slug, difficulty, or category"
          bind:value={searchTerm}
        />
      </label>
      <label class="form-control">
        <span class="label-text">Status</span>
        <select class="select select-bordered" bind:value={statusFilter}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All games</option>
        </select>
      </label>
      <label class="form-control">
        <span class="label-text">Category</span>
        <select class="select select-bordered" bind:value={categoryFilter}>
          <option value="all">All categories</option>
          {#each allCategories as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
      </label>
    </div>
    {#if feedback}
      <div
        class={`alert ${feedback.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'}`}
      >
        <span>{feedback.message}</span>
      </div>
    {/if}
  </div>

  {#if filteredGames.length === 0}
    <p class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-12 text-center text-sm text-base-content/60">
      No games match the current filters.
    </p>
  {:else}
    <div class="space-y-4 sm:hidden">
      {#each filteredGames as game (game.id)}
        <article class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button
                type="button"
                class="text-left hover:text-primary transition-colors"
                onclick={() => openDetailsModal(game)}
              >
                <h2 class="text-lg font-semibold text-base-content">{game.name}</h2>
              </button>
              <p class="text-xs text-base-content/50">Slug: {game.slug}</p>
              <p class="text-xs text-base-content/40">Updated {formatUpdatedAt(game.updatedAt)}</p>
            </div>
            <span class={`badge ${game.archivedAt ? 'badge-warning' : 'badge-success'}`}>
              {game.archivedAt ? 'Archived' : 'Active'}
            </span>
          </header>
          <p class="mt-3 text-sm text-base-content/70">{game.description}</p>
          {#if game.categories?.length}
            <div class="mt-4 flex flex-wrap gap-2">
              {#each game.categories as category}
                <span class="badge badge-outline border-white/15 text-xs text-base-content/60">{category}</span>
              {/each}
            </div>
          {/if}
          <dl class="mt-4 grid grid-cols-2 gap-3 text-xs text-base-content/60">
            <div>
              <dt class="uppercase tracking-[0.25em] text-base-content/40">Duration</dt>
              <dd class="text-base-content">{game.durationMinutes} min</dd>
            </div>
            <div>
              <dt class="uppercase tracking-[0.25em] text-base-content/40">Difficulty</dt>
              <dd class="text-base-content">{game.difficulty}</dd>
            </div>
            <div>
              <dt class="uppercase tracking-[0.25em] text-base-content/40">Players</dt>
              <dd class="text-base-content">{game.minPlayers} - {game.maxPlayers}</dd>
            </div>
          </dl>
          <div class="mt-5">
            <div class="dropdown dropdown-end dropdown-bottom w-full">
              <button type="button" class="btn btn-sm btn-ghost w-full" tabindex="0">
                Actions
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                  <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </button>
              <ul class="dropdown-content menu menu-sm z-[1] w-full max-w-xs rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                <li><a href="/admin/games/{game.id}/edit">Edit details</a></li>
                <li><button type="button" onclick={() => handleDuplicate(game)}>Duplicate</button></li>
                {#if game.archivedAt}
                  <li><button type="button" onclick={() => handleUnarchive(game)} disabled={pending}>Restore</button></li>
                {:else}
                  <li><button type="button" onclick={() => handleArchive(game)} disabled={pending}>Archive</button></li>
                {/if}
                <li>
                  <button type="button" class="text-error" onclick={() => handleDelete(game)} disabled={pending}>
                    Delete permanently
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </article>
      {/each}
    </div>

    <div class="hidden sm:block">
      <div class="rounded-2xl border border-white/10 bg-base-200/70">
        <table class="table table-zebra">
        <thead class="bg-base-300/60 uppercase tracking-[0.28em] text-xs text-base-content/40">
            <tr>
              <th class="text-left">Game</th>
              <th class="text-left">Duration</th>
              <th class="text-left">Difficulty</th>
              <th class="text-left">Players</th>
              <th class="text-left">Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredGames as game (game.id)}
              <tr class="text-sm">
                <td>
                  <div class="flex flex-col gap-1">
                    <button
                      type="button"
                      class="text-left font-medium text-base-content hover:text-primary transition-colors"
                      onclick={() => openDetailsModal(game)}
                    >
                      {game.name}
                    </button>
                    <span class="text-xs text-base-content/50">{game.slug}</span>
                    {#if game.categories?.length}
                      <div class="flex flex-wrap gap-1">
                        {#each game.categories.slice(0, 3) as category}
                          <span class="badge badge-outline border-white/15 text-[11px] text-base-content/50">{category}</span>
                        {/each}
                        {#if game.categories.length > 3}
                          <span class="badge badge-outline border-white/15 text-[11px] text-base-content/50">+{game.categories.length - 3}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </td>
                <td>{game.durationMinutes} min</td>
                <td>{game.difficulty}</td>
                <td>{game.minPlayers}–{game.maxPlayers}</td>
                <td>{formatUpdatedAt(game.updatedAt)}</td>
                <td>
                  <div class="flex justify-end">
                    <div class="dropdown dropdown-end dropdown-bottom">
                      <button type="button" class="btn btn-xs btn-ghost" tabindex="0">
                        Actions
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                          <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                        </svg>
                      </button>
                      <ul class="dropdown-content menu menu-sm z-[1] w-56 rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                        <li><a href="/admin/games/{game.id}/edit">Edit details</a></li>
                        <li><button type="button" onclick={() => handleDuplicate(game)}>Duplicate</button></li>
                        {#if game.archivedAt}
                          <li><button type="button" onclick={() => handleUnarchive(game)} disabled={pending}>Restore</button></li>
                        {:else}
                          <li><button type="button" onclick={() => handleArchive(game)} disabled={pending}>Archive</button></li>
                        {/if}
                        <li>
                          <button type="button" class="text-error" onclick={() => handleDelete(game)} disabled={pending}>
                            Delete permanently
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Game Details Modal -->
  {#if viewingGame}
    <GameDetailsModal
      bind:open={showDetailsModal}
      game={viewingGame}
      onclose={closeDetailsModal}
      onedit={openEditFromDetails}
    />
  {/if}
</section>
