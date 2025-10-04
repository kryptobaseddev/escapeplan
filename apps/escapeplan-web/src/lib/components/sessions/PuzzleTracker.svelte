<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails, GameHintDefinition } from '@escapeplan/contracts';

  let {
    session,
    puzzleFormError = null,
    onPuzzleStatusChange,
    onSendPuzzleHint
  }: {
    session: GameSessionDetails;
    puzzleFormError?: string | null;
    onPuzzleStatusChange: (puzzleId: string, status: string) => void;
    onSendPuzzleHint: (puzzleId: string, hint: GameHintDefinition) => void;
  } = $props();

  let showCompleted = $state(false);

  const visiblePuzzles = $derived(
    showCompleted
      ? (session?.puzzles ?? [])
      : (session?.puzzles ?? []).filter((p) => p.status !== 'completed')
  );

  const completedPuzzles = $derived(
    (session?.puzzles ?? []).filter((p) => p.status === 'completed')
  );

  /**
   * Type guard to check if hints array is valid and non-empty
   */
  function hasHints(hints: GameHintDefinition[] | undefined | null): hints is GameHintDefinition[] {
    return Array.isArray(hints) && hints.length > 0;
  }

  /**
   * Safely sort hints by order field
   */
  function sortHintsByOrder(hints: GameHintDefinition[]): GameHintDefinition[] {
    return [...hints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
</script>

<div id="puzzles" class="glass-panel border-white/10 bg-base-200/70 p-4">
  <div class="flex items-center justify-between">
    <h2 class="text-base md:text-lg font-semibold text-base-content">Puzzle tracker</h2>
    <div class="flex items-center gap-2">
      {#if puzzleFormError}
        <span class="text-xs text-error">{puzzleFormError}</span>
      {/if}
      {#if completedPuzzles.length > 0}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            bind:checked={showCompleted}
          />
          <span class="text-xs text-base-content/70">Show Completed</span>
        </label>
      {/if}
    </div>
  </div>
  <div class="mt-4 space-y-2">
    {#each visiblePuzzles as puzzle}
      {#if puzzle.status === 'completed'}
        <!-- Collapsed view for completed puzzles -->
        <details class="rounded-lg border border-success/40 bg-success/10">
          <summary class="flex cursor-pointer items-center justify-between gap-2 p-3 hover:bg-success/15 transition">
            <h3 class="text-sm font-semibold text-base-content">{puzzle.title}</h3>
            <span class="badge badge-xs badge-success uppercase tracking-[0.25em]">
              Completed
            </span>
          </summary>
          <div class="px-3 pb-3 space-y-2">
            <!-- Description -->
            {#if puzzle.description}
              <p class="text-xs text-base-content/70">{puzzle.description}</p>
            {/if}

            <!-- Solution -->
            {#if puzzle.solution}
              <details class="collapse collapse-arrow bg-base-200/50 rounded-lg">
                <summary class="collapse-title text-xs font-medium min-h-0 py-2">
                  Show Solution
                </summary>
                <div class="collapse-content">
                  <p class="text-xs text-base-content/90 font-mono bg-base-300/50 p-2 rounded">
                    {puzzle.solution}
                  </p>
                </div>
              </details>
            {/if}

            <!-- Undo button -->
            <div class="flex items-center gap-2">
              <button
                class="btn btn-xs btn-ghost"
                type="button"
                onclick={() => onPuzzleStatusChange(puzzle.id, 'in_progress')}
              >
                Undo Completion
              </button>
            </div>
          </div>
        </details>
      {:else}
        <!-- Expanded view for available/in_progress puzzles -->
        <article
          class={`rounded-lg border p-3 transition ${
            puzzle.status === 'in_progress'
              ? 'border-info/40 bg-info/10'
              : 'border-white/10 bg-base-100/60'
          }`}
        >
          <!-- Header -->
          <header class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-base-content">{puzzle.title}</h3>
            <span
              class={`badge badge-xs uppercase tracking-[0.25em] ${
                puzzle.status === 'in_progress'
                  ? 'badge-info'
                  : 'badge-ghost'
              }`}
            >
              {puzzle.status.replace('_', ' ')}
            </span>
          </header>

          <!-- Description -->
          {#if puzzle.description}
            <p class="mt-2 text-xs text-base-content/70">{puzzle.description}</p>
          {/if}

          <!-- Solution -->
          {#if puzzle.solution}
            <details class="mt-2 collapse collapse-arrow bg-base-200/50 rounded-lg">
              <summary class="collapse-title text-xs font-medium min-h-0 py-2">
                Show Solution
              </summary>
              <div class="collapse-content">
                <p class="text-xs text-base-content/90 font-mono bg-base-300/50 p-2 rounded">
                  {puzzle.solution}
                </p>
              </div>
            </details>
          {/if}

          <!-- Status Controls -->
          <div class="mt-3 flex flex-wrap gap-2">
            {#if puzzle.status === 'available'}
              <button
                class="btn btn-xs btn-info gap-1"
                type="button"
                onclick={() => onPuzzleStatusChange(puzzle.id, 'in_progress')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                Start Puzzle
              </button>
            {:else if puzzle.status === 'in_progress'}
              <button
                class="btn btn-xs btn-success gap-1"
                type="button"
                onclick={() => onPuzzleStatusChange(puzzle.id, 'completed')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                Mark Complete
              </button>
              <button
                class="btn btn-xs btn-ghost border border-white/10 gap-1"
                type="button"
                onclick={() => onPuzzleStatusChange(puzzle.id, 'available')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Reset
              </button>
            {/if}
          </div>

          <!-- Quick-Send Hints -->
          {#if hasHints(puzzle.hints)}
            <div class="mt-3 pt-3 border-t border-white/10">
              <h4 class="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">Quick Send Hints:</h4>
              <div class="flex flex-wrap gap-1">
                {#each sortHintsByOrder(puzzle.hints) as hint (hint.uuid)}
                  {@const isPlaying = session.currentRoomDisplayMedia?.status === 'playing' && session.currentRoomDisplayMedia?.source === 'hint' && session.currentRoomDisplayMedia?.mediaType === hint.type}
                  <button
                    type="button"
                    class={`btn btn-xs gap-1 ${
                      isPlaying ? 'media-playing' : ''
                    } ${
                      hint.type === 'text'
                        ? 'btn-primary'
                        : hint.type === 'image'
                          ? 'btn-info'
                          : hint.type === 'audio'
                            ? 'btn-secondary'
                            : 'btn-accent'
                    }`}
                    onclick={() => onSendPuzzleHint(puzzle.id, hint)}
                    title={hint.content ?? 'Hint'}
                  >
                    {#if hint.type === 'text'}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                      </svg>
                    {:else if hint.type === 'image'}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                      </svg>
                    {:else if hint.type === 'audio'}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                      </svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    {/if}
                    Hint {hint.order ?? 1}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </article>
      {/if}
    {/each}
  </div>
</div>
