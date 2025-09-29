<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  const categoriesText = (categories: string[]) => categories.join(', ');
  let hasGames = $derived(data.games.length > 0);
  const roomsPlaceholder = `[
  { "name": "Harbor Hold", "isMobileCapable": false, "themeToken": "escapeplan-pirate" }
]`;
  const puzzlesPlaceholder = `[
  { "title": "Intro Audio", "description": "Launch the intro audio", "displayOrder": 1 }
]`;
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-2">
    <h1 class="section-heading">Game Settings</h1>
    <p class="text-sm text-base-content/60">
      Configure EscapePlan game metadata, rooms, and puzzles. Provide authentic content sourced from the operations docs—no mock data.
    </p>
  </header>

  {#if hasGames}
    <div class="space-y-6">
      {#each data.games as game}
        <article class="glass-panel border-white/10 bg-base-200/70 p-6">
          <header class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-display text-base-content">{game.name}</h2>
              <p class="text-sm text-base-content/60">Slug: {game.slug}</p>
              <p class="text-xs text-base-content/40">Last updated {new Date(game.updatedAt).toLocaleString()}</p>
            </div>
            <form method="POST" action="?/delete" use:enhance class="flex flex-col items-end gap-2">
              <input type="hidden" name="id" value={game.id} />
              <button class="btn btn-sm btn-ghost border border-error/40 text-error" type="submit">Delete game</button>
            </form>
          </header>
          <form method="POST" action="?/update" use:enhance class="mt-6 space-y-4">
            <input type="hidden" name="id" value={game.id} />
            <div class="grid gap-4 md:grid-cols-2">
              <label class="form-control">
                <span class="label-text">Game name</span>
                <input class="input input-bordered" name="name" value={game.name} required />
              </label>
              <label class="form-control">
                <span class="label-text">Slug</span>
                <input class="input input-bordered" name="slug" value={game.slug} required />
              </label>
              <label class="form-control md:col-span-2">
                <span class="label-text">Description</span>
                <textarea class="textarea textarea-bordered" name="description" rows={3}>{game.description}</textarea>
              </label>
              <label class="form-control md:col-span-2">
                <span class="label-text">Story intro</span>
                <textarea class="textarea textarea-bordered" name="storyIntro" rows={3}>{game.storyIntro ?? ''}</textarea>
              </label>
              <label class="form-control">
                <span class="label-text">Duration (minutes)</span>
                <input class="input input-bordered" type="number" min="1" name="durationMinutes" value={game.durationMinutes} />
              </label>
              <label class="form-control">
                <span class="label-text">Difficulty</span>
                <input class="input input-bordered" name="difficulty" value={game.difficulty} />
              </label>
              <label class="form-control">
                <span class="label-text">Pricing model</span>
                <input class="input input-bordered" name="pricingModel" value={game.pricingModel} />
              </label>
              <label class="form-control">
                <span class="label-text">Categories (comma separated)</span>
                <input class="input input-bordered" name="categories" value={categoriesText(game.categories)} />
              </label>
              <label class="form-control">
                <span class="label-text">Minimum players</span>
                <input class="input input-bordered" type="number" min="1" name="minPlayers" value={game.minPlayers} />
              </label>
              <label class="form-control">
                <span class="label-text">Maximum players</span>
                <input class="input input-bordered" type="number" min="1" name="maxPlayers" value={game.maxPlayers} />
              </label>
              <label class="form-control">
                <span class="label-text">Price per player (cents)</span>
                <input class="input input-bordered" type="number" min="0" name="pricePerPlayerCents" value={game.pricePerPlayerCents} />
              </label>
              <label class="form-control">
                <span class="label-text">Resources required</span>
                <input class="input input-bordered" type="number" min="1" name="resourcesRequired" value={game.resourcesRequired} />
              </label>
              <label class="form-control md:col-span-2">
                <span class="label-text">Validation notes</span>
                <textarea class="textarea textarea-bordered" name="validationNotes" rows={2}>{game.validationNotes ?? ''}</textarea>
              </label>
            </div>
            <label class="form-control">
              <span class="label-text">Rooms JSON</span>
              <textarea class="textarea textarea-bordered font-mono text-xs" name="rooms" rows={Math.max(4, game.rooms.length * 3)}>
{JSON.stringify(game.rooms, null, 2)}
</textarea>
            </label>
            <label class="form-control">
              <span class="label-text">Puzzles JSON</span>
              <textarea class="textarea textarea-bordered font-mono text-xs" name="puzzles" rows={Math.max(6, game.puzzles.length * 3)}>
{JSON.stringify(game.puzzles, null, 2)}
</textarea>
            </label>
            <button class="btn btn-primary" type="submit">Save game</button>
          </form>
        </article>
      {/each}
    </div>
  {/if}

  <article class="glass-panel border-white/10 bg-base-200/70 p-6">
    <h2 class="text-lg font-semibold text-base-content">Add new game</h2>
    <p class="text-xs text-base-content/50">Provide real EscapePlan game content sourced from operations notes.</p>
    <form method="POST" action="?/create" use:enhance class="mt-4 space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Game name</span>
          <input class="input input-bordered" name="name" required />
        </label>
        <label class="form-control">
          <span class="label-text">Slug</span>
          <input class="input input-bordered" name="slug" required />
        </label>
        <label class="form-control md:col-span-2">
          <span class="label-text">Description</span>
          <textarea class="textarea textarea-bordered" name="description" rows={3} required></textarea>
        </label>
        <label class="form-control md:col-span-2">
          <span class="label-text">Story intro</span>
          <textarea class="textarea textarea-bordered" name="storyIntro" rows={3}></textarea>
        </label>
        <label class="form-control">
          <span class="label-text">Duration (minutes)</span>
          <input class="input input-bordered" type="number" min="1" name="durationMinutes" required />
        </label>
        <label class="form-control">
          <span class="label-text">Difficulty</span>
          <input class="input input-bordered" name="difficulty" required />
        </label>
        <label class="form-control">
          <span class="label-text">Pricing model</span>
          <input class="input input-bordered" name="pricingModel" value="PER_PERSON" required />
        </label>
        <label class="form-control">
          <span class="label-text">Categories (comma separated)</span>
          <input class="input input-bordered" name="categories" placeholder="e.g. Private, Mobile" />
        </label>
        <label class="form-control">
          <span class="label-text">Minimum players</span>
          <input class="input input-bordered" type="number" min="1" name="minPlayers" value="1" required />
        </label>
        <label class="form-control">
          <span class="label-text">Maximum players</span>
          <input class="input input-bordered" type="number" min="1" name="maxPlayers" value="5" required />
        </label>
        <label class="form-control">
          <span class="label-text">Price per player (cents)</span>
          <input class="input input-bordered" type="number" min="0" name="pricePerPlayerCents" value="0" />
        </label>
        <label class="form-control">
          <span class="label-text">Resources required</span>
          <input class="input input-bordered" type="number" min="1" name="resourcesRequired" value="1" />
        </label>
      </div>
      <label class="form-control">
        <span class="label-text">Validation notes</span>
        <textarea class="textarea textarea-bordered" name="validationNotes" rows={2}></textarea>
      </label>
      <label class="form-control">
        <span class="label-text">Rooms JSON</span>
        <textarea class="textarea textarea-bordered font-mono text-xs" name="rooms" rows={6} placeholder={roomsPlaceholder} required></textarea>
      </label>
      <label class="form-control">
        <span class="label-text">Puzzles JSON</span>
        <textarea class="textarea textarea-bordered font-mono text-xs" name="puzzles" rows={8} placeholder={puzzlesPlaceholder} required></textarea>
      </label>
      <button class="btn btn-primary" type="submit">Create game</button>
    </form>
  </article>
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
