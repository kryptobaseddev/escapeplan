<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { openConfirmDialog } from '$lib/components/confirm-dialog';
  import ArchiveReasonContent from '$lib/components/ArchiveReasonContent.svelte';
  import GameModal from '$lib/components/games/GameModal.svelte';
  import { apiFetch } from '$lib/api/client';
  import type { GameDetails } from '@escapeplan/contracts';
  import { formatDistanceToNow } from 'date-fns';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  let createModalOpen = $state(false);
  let createModalGame = $state<GameDetails | null>(null);
  let editingGame = $state<GameDetails | null>(null);
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

  const cloneForDuplicate = (game: GameDetails): GameDetails => {
    const timestamp = new Date().toISOString();
    return {
      ...game,
      id: uid('game'),
      slug: `${game.slug}-copy`,
      name: `${game.name} Copy`,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      archivedBy: null,
      archivedReason: null,
      rooms: game.rooms.map((room) => ({
        ...room,
        id: uid('room'),
        uuid: uid('room')
      })),
      puzzles: game.puzzles.map((puzzle) => ({
        ...puzzle,
        id: uid('puzzle'),
        uuid: uid('puzzle'),
        hints: puzzle.hints?.map((hint) => ({ ...hint, uuid: uid('hint') })) ?? []
      }))
    };
  };

  const handleCreateSuccess = async () => {
    createModalOpen = false;
    createModalGame = null;
    await refreshGames();
    handleFeedback('Game created successfully.');
  };

  const handleEditSuccess = async () => {
    editingGame = null;
    await refreshGames();
    handleFeedback('Game updated successfully.');
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

  const openDuplicateModal = (game: GameDetails) => {
    createModalGame = cloneForDuplicate(game);
    createModalOpen = true;
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
    <button class="btn btn-primary w-full lg:w-auto" onclick={() => { createModalGame = null; createModalOpen = true; }}>
      + Add game
    </button>
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
              <h2 class="text-lg font-semibold text-base-content">{game.name}</h2>
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
            <div>
              <dt class="uppercase tracking-[0.25em] text-base-content/40">Rooms</dt>
              <dd class="text-base-content">{game.rooms.length}</dd>
            </div>
          </dl>
          <div class="mt-5">
            <div class="dropdown dropdown-end w-full">
              <button type="button" class="btn btn-sm btn-ghost w-full" tabindex="0">
                Actions
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                  <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                </svg>
              </button>
              <ul class="dropdown-content menu menu-sm w-full max-w-xs rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                <li><button type="button" onclick={() => { editingGame = game; }}>Edit details</button></li>
                <li><button type="button" onclick={() => openDuplicateModal(game)}>Duplicate</button></li>
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
      <div class="overflow-x-auto rounded-2xl border border-white/10 bg-base-200/70">
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
                    <span class="font-medium text-base-content">{game.name}</span>
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
                    <div class="dropdown dropdown-end">
                      <button type="button" class="btn btn-xs btn-ghost" tabindex="0">
                        Actions
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                          <path fill="currentColor" d="M12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-7-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                        </svg>
                      </button>
                      <ul class="dropdown-content menu menu-sm w-56 rounded-2xl border border-white/10 bg-base-200/95 p-2 text-sm shadow-lg">
                        <li><button type="button" onclick={() => { editingGame = game; }}>Edit details</button></li>
                        <li><button type="button" onclick={() => openDuplicateModal(game)}>Duplicate</button></li>
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
</section>

<GameModal
  open={createModalOpen}
  mode="create"
  action="?/create"
  game={createModalGame}
  onclose={() => { createModalOpen = false; createModalGame = null; }}
  onsuccess={handleCreateSuccess}
/>

{#if editingGame}
  <GameModal
    open={true}
    mode="edit"
    action="?/update"
    game={editingGame}
    onclose={() => (editingGame = null)}
    onsuccess={handleEditSuccess}
  />
{/if}
