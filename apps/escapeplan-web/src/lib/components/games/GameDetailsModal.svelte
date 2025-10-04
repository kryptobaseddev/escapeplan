<script lang="ts">
  import type { GameDetails, GameHintDefinition, GameMilestone } from '@escapeplan/contracts';
  import MediaModal from '../media/MediaModal.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  type TabId = 'details' | 'media' | 'puzzles' | 'pricing' | 'booking' | 'milestones' | 'cameras';

  let {
    open = $bindable(false),
    game = null,
    onclose = undefined,
    onedit = undefined
  }: {
    open?: boolean;
    game?: GameDetails | null;
    onclose?: (() => void) | undefined;
    onedit?: ((game: GameDetails) => void) | undefined;
  } = $props();

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let activeTab = $state<TabId>('details');

  // MediaModal state
  let mediaModalOpen = $state(false);
  let currentMediaSrc = $state('');
  let currentMediaTitle = $state('');
  let currentMediaType = $state<'audio' | 'video' | 'image'>('audio');

  const tabItems: Array<{ id: TabId; label: string; count?: number }> = $derived([
    { id: 'details', label: 'Game Details' },
    { id: 'media', label: 'Images & Media', count: game?.media?.galleryAssetIds?.length || 0 },
    { id: 'puzzles', label: 'Puzzles & Hints', count: game?.puzzles?.length || 0 },
    { id: 'pricing', label: 'Pricing' },
    { id: 'booking', label: 'Booking Rules' },
    { id: 'milestones', label: 'Milestones', count: game?.milestones?.length || 0 },
    { id: 'cameras', label: 'Cameras', count: game?.cameraIds?.length || 0 }
  ]);

  const difficultyStars = $derived.by(() => {
    const diffMap: Record<string, number> = {
      Beginner: 1,
      Easy: 2,
      Medium: 3,
      Hard: 4,
      Expert: 5
    };
    return diffMap[game?.difficulty || 'Medium'] || 3;
  });

  $effect(() => {
    if (open && dialogElement) {
      dialogElement.showModal();
    } else if (!open && dialogElement) {
      dialogElement.close();
    }
  });

  function handleClose() {
    open = false;
    mediaModalOpen = false;
    onclose?.();
  }

  function handleEdit() {
    if (game && onedit) {
      onedit(game);
      handleClose();
    }
  }

  function playHintMedia(hint: GameHintDefinition, hintOrder: number) {
    if (!hint.assetUrl) return;
    if (hint.type !== 'audio' && hint.type !== 'video') return;

    currentMediaSrc = hint.assetUrl;
    currentMediaTitle = `Hint ${hintOrder} - ${hint.type === 'audio' ? 'Audio' : 'Video'}`;
    currentMediaType = hint.type;
    mediaModalOpen = true;
  }

  function playMilestoneMedia(milestone: GameMilestone) {
    if (!milestone.assetId) return;
    if (milestone.mediaType !== 'audio' && milestone.mediaType !== 'video') return;

    currentMediaSrc = milestone.assetId;
    currentMediaTitle = `${milestone.name} - ${milestone.mediaType}`;
    currentMediaType = milestone.mediaType;
    mediaModalOpen = true;
  }

  function sortPuzzles(puzzles: GameDetails['puzzles'] | undefined) {
    return [...(puzzles ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  function sortHints(hints: GameHintDefinition[] | undefined) {
    return [...(hints ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function sortMilestones(milestones: GameMilestone[] | undefined) {
    return [...(milestones ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<dialog
  bind:this={dialogElement}
  class="modal"
  onclose={handleClose}
>
  <div class="modal-box max-w-6xl bg-base-200/95 p-0 overflow-hidden">
    {#if game}
      <!-- Header -->
      <div class="sticky top-0 z-10 bg-base-100 border-b border-white/10 px-6 py-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h2 class="text-2xl font-display text-base-content">{game.name}</h2>
              <span class="badge badge-outline badge-sm">{game.slug}</span>
            </div>
            <div class="mt-2 flex items-center gap-4 text-sm text-base-content/70">
              <div class="flex items-center gap-1">
                {#each Array(5) as _, i}
                  <svg
                    class={`h-4 w-4 ${i < difficultyStars ? 'text-warning' : 'text-base-content/20'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                {/each}
                <span class="ml-1">{game.difficulty}</span>
              </div>
              <span>•</span>
              <span>{game.durationMinutes} min</span>
              <span>•</span>
              <span>{game.minPlayers}-{game.maxPlayers} players</span>
              <span>•</span>
              <span class="badge badge-sm">{game.pricingModel?.replace('_', ' ')}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if onedit}
              <button
                type="button"
                class="btn btn-sm btn-primary"
                onclick={handleEdit}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit Game
              </button>
            {/if}
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-circle"
              onclick={handleClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs tabs-boxed mt-4 bg-base-200/50 p-1 gap-1" role="tablist">
          {#each tabItems as tab}
            <button
              type="button"
              role="tab"
              class="tab"
              class:tab-active={activeTab === tab.id}
              onclick={() => activeTab = tab.id}
            >
              {tab.label}
              {#if tab.count !== undefined && tab.count > 0}
                <span class="ml-1 badge badge-xs">{tab.count}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {#if activeTab === 'details'}
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Description</h3>
                <p class="text-base-content/90">{game.description || 'No description provided'}</p>
              </div>
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Story Intro</h3>
                <p class="text-base-content/90">{game.storyIntro || 'No story intro'}</p>
              </div>
            </div>

            <div class="divider"></div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Categories</h3>
                <div class="flex flex-wrap gap-2">
                  {#each game.categories || [] as category}
                    <span class="badge badge-outline">{category}</span>
                  {/each}
                </div>
              </div>
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Resources Required</h3>
                <p class="text-base-content/90">{game.resourcesRequired}</p>
              </div>
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Default Volume</h3>
                <div class="flex items-center gap-2">
                  <progress class="progress progress-primary w-56" value={game.defaultVolume ?? 80} max="100"></progress>
                  <span class="text-sm">{game.defaultVolume ?? 80}%</span>
                </div>
              </div>
            </div>

            {#if game.validationNotes}
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Validation Notes</h3>
                <Alert type="info">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                  <span>{game.validationNotes}</span>
                </Alert>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'puzzles'}
          <div class="space-y-4">
            {#if game.puzzles.length === 0}
              <div class="alert">
                <span>No puzzles configured for this game</span>
              </div>
            {:else}
              {#each sortPuzzles(game.puzzles) as puzzle}
                <article class="card bg-base-100 border border-white/10">
                  <div class="card-body">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h3 class="card-title text-lg">
                          {puzzle.title}
                          <span class="badge badge-outline badge-sm">#{puzzle.displayOrder}</span>
                        </h3>
                        {#if puzzle.description}
                          <p class="mt-2 text-sm text-base-content/70">{puzzle.description}</p>
                        {/if}
                      </div>
                    </div>

                    {#if puzzle.solution}
                      <div class="mt-3">
                        <details class="collapse collapse-arrow bg-base-200/50">
                          <summary class="collapse-title text-sm font-medium">
                            Solution
                          </summary>
                          <div class="collapse-content">
                            <p class="text-base-content/90 font-mono">{puzzle.solution}</p>
                          </div>
                        </details>
                      </div>
                    {/if}

                    <!-- Hints -->
                    {#if puzzle.hints && puzzle.hints.length > 0}
                      <div class="mt-4">
                        <h4 class="text-sm font-semibold mb-3">
                          Hints ({puzzle.hints.length})
                        </h4>
                        <div class="space-y-2">
                          {#each sortHints(puzzle.hints) as hint}
                            <div class="bg-base-200/70 rounded-lg p-3">
                              <div class="flex items-start gap-3">
                                <div class="flex-shrink-0">
                                  <span class="badge badge-sm">
                                    {#if hint.type === 'text'}📝{/if}
                                    {#if hint.type === 'image'}🖼️{/if}
                                    {#if hint.type === 'audio'}🔊{/if}
                                    {#if hint.type === 'video'}🎥{/if}
                                    Hint {hint.order}
                                  </span>
                                </div>
                                <div class="flex-1">
                                  <p class="text-sm text-base-content/90">{hint.content}</p>

                                  {#if hint.assetUrl && (hint.type === 'audio' || hint.type === 'video')}
                                    <div class="mt-2 flex items-center gap-2">
                                      <button
                                        type="button"
                                        class="btn btn-xs btn-primary"
                                        onclick={() => playHintMedia(hint, hint.order)}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                                        </svg>
                                        Play {hint.type}
                                      </button>

                                      <div class="flex items-center gap-2">
                                        <span class="text-xs text-base-content/50">Volume:</span>
                                        <progress
                                          class="progress progress-primary w-20"
                                          value={hint.volumeLevel || game?.defaultVolume || 80}
                                          max="100"
                                        ></progress>
                                        <span class="text-xs text-base-content/70">
                                          {hint.volumeLevel || game?.defaultVolume || 80}%
                                        </span>
                                      </div>
                                    </div>
                                  {/if}
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </article>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'media'}
          <div class="space-y-4">
            {#if game.media?.thumbnailAssetId}
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Thumbnail</h3>
                <div class="w-48 h-48 rounded-lg overflow-hidden border border-white/10">
                  <img src="/api/assets/{game.media.thumbnailAssetId}" alt="Game thumbnail" class="w-full h-full object-cover" />
                </div>
              </div>
            {/if}

            {#if game.media?.galleryAssetIds && game.media.galleryAssetIds.length > 0}
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Gallery ({game.media.galleryAssetIds.length})</h3>
                <div class="grid grid-cols-4 gap-4">
                  {#each game.media.galleryAssetIds as assetId}
                    <div class="aspect-square rounded-lg overflow-hidden border border-white/10">
                      <img src="/api/assets/{assetId}" alt="Gallery image" class="w-full h-full object-cover" />
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'pricing'}
          <div class="space-y-6">
            <div>
              <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Base Price</h3>
              <p class="text-2xl font-bold">{formatPrice(game.pricePerPlayerCents ?? 0)} per player</p>
            </div>

            {#if game.pricing?.tiers && game.pricing.tiers.length > 0}
              <div>
                <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-3">Pricing Tiers</h3>
                <div class="space-y-2">
                  {#each game.pricing.tiers as tier}
                    <div class="card bg-base-100 border border-white/10">
                      <div class="card-body p-4">
                        <div class="flex justify-between items-center">
                          <div>
                            <h4 class="font-semibold">{tier.label}</h4>
                            <p class="text-sm text-base-content/60">
                              {tier.minPlayers || 0}-{tier.maxPlayers || game.maxPlayers} players
                            </p>
                          </div>
                          <span class="text-lg font-bold">{formatPrice(tier.priceCents)}</span>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'booking'}
          <div class="space-y-4">
            {#if game.bookingRules}
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Reservation Style</h3>
                  <span class="badge badge-lg">{game.bookingRules.reservationStyle}</span>
                </div>
                {#if game.bookingRules.isMobile}
                  <div>
                    <h3 class="text-sm uppercase tracking-wider text-base-content/50 mb-2">Mobile</h3>
                    <span class="badge badge-success">Mobile Game</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'milestones'}
          <div class="space-y-4">
            {#if !game.milestones || game.milestones.length === 0}
              <div class="alert">
                <span>No milestones configured for this game</span>
              </div>
            {:else}
              {#each sortMilestones(game.milestones) as milestone}
                <div class="card bg-base-100 border border-white/10">
                  <div class="card-body">
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="card-title text-base">
                          {milestone.name}
                          <span class="badge badge-sm badge-outline">{milestone.type}</span>
                        </h3>
                        {#if milestone.content}
                          <p class="mt-2 text-sm text-base-content/70">{milestone.content}</p>
                        {/if}
                      </div>
                      {#if !milestone.enabled}
                        <span class="badge badge-ghost">Disabled</span>
                      {/if}
                    </div>

                    <div class="mt-3 flex items-center gap-4 text-sm">
                      {#if milestone.mediaType}
                        <span class="badge badge-primary badge-sm">{milestone.mediaType}</span>
                      {/if}
                      <span class="badge badge-outline badge-sm">{milestone.triggerType}</span>
                      {#if milestone.triggerConfig}
                        {#if milestone.triggerConfig.minutes}
                          <span class="text-base-content/60">at {milestone.triggerConfig.minutes} min</span>
                        {/if}
                        {#if milestone.triggerConfig.interval}
                          <span class="text-base-content/60">every {milestone.triggerConfig.interval} min</span>
                        {/if}
                        {#if milestone.triggerConfig.hintsUsed}
                          <span class="text-base-content/60">after {milestone.triggerConfig.hintsUsed} hints</span>
                        {/if}
                      {/if}
                      {#if milestone.mediaType === 'audio' || milestone.mediaType === 'video'}
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-base-content/50">Volume:</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={milestone.volumeLevel || game?.defaultVolume || 80}
                            disabled
                            class="range range-xs range-primary w-20"
                          />
                          <span class="text-xs text-base-content/70">
                            {milestone.volumeLevel || game?.defaultVolume || 80}%
                          </span>
                        </div>
                      {/if}
                    </div>

                    {#if milestone.assetId && (milestone.mediaType === 'audio' || milestone.mediaType === 'video')}
                      <div class="mt-3">
                        <button
                          type="button"
                          class="btn btn-xs btn-primary"
                          onclick={() => playMilestoneMedia(milestone)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                          </svg>
                          Play {milestone.mediaType}
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'cameras'}
          <div class="space-y-4">
            {#if !game.cameraIds || game.cameraIds.length === 0}
              <div class="alert">
                <span>No cameras associated with this game</span>
              </div>
              <p class="text-sm text-base-content/60">
                Cameras can be associated from the <a href="/admin/cameras" class="link link-primary">Camera Management</a> page.
              </p>
            {:else}
              <Alert type="info">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="font-semibold">Camera Association</p>
                  <p class="text-sm">
                    This game has {game.cameraIds.length} camera{game.cameraIds.length === 1 ? '' : 's'} associated.
                    Manage cameras from the <a href="/admin/cameras" class="link link-primary">Camera Management</a> page.
                  </p>
                </div>
              </Alert>

              <div class="space-y-2">
                {#each game.cameraIds as cameraId}
                  <div class="card bg-base-100 border border-white/10">
                    <div class="card-body p-4">
                      <div class="flex items-center gap-3">
                        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-base-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            class="w-5 h-5 text-base-content/50"
                          >
                            <path
                              fill="currentColor"
                              d="M4 6.5h2L7 5h10l1 1.5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zm8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p class="font-mono text-sm text-base-content/70">{cameraId}</p>
                          <p class="text-xs text-base-content/50">Camera ID</p>
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="p-6">
        <p class="text-center text-base-content/60">No game data available</p>
      </div>
    {/if}
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>

<!-- Media Modal for hints and milestones -->
<MediaModal
  isOpen={mediaModalOpen}
  src={currentMediaSrc}
  title={currentMediaTitle}
  mediaType={currentMediaType}
  windowScale={75}
  showControls={true}
  autoPlay={true}
  mediaLoop={false}
  onClose={() => mediaModalOpen = false}
/>
