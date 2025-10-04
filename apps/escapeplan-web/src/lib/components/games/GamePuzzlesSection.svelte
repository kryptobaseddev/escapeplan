<script lang="ts">
  import type { GamePuzzleDefinition, GameHintDefinition } from '@escapeplan/contracts';

  interface EditableHint extends GameHintDefinition {
    // All fields inherited from GameHintDefinition
  }
  interface EditablePuzzle extends GamePuzzleDefinition {
    id: string; // Required for UI operations
    hints: EditableHint[];
  }

  interface Props {
    puzzles: EditablePuzzle[];
    draggingPuzzleId: string | null;
    draggingHint: { puzzleId: string; hintId: string } | null;
    onPuzzlesChange: (puzzles: EditablePuzzle[]) => void;
    onDraggingPuzzleIdChange: (id: string | null) => void;
    onDraggingHintChange: (hint: { puzzleId: string; hintId: string } | null) => void;
    onOpenHintModal: (puzzle: EditablePuzzle, hint: GameHintDefinition | null) => void;
    onAddPuzzle: () => void;
    onRemovePuzzle: (id: string) => void;
    onMarkDirty: () => void;
  }

  let {
    puzzles = $bindable([]),
    draggingPuzzleId = $bindable(null),
    draggingHint = $bindable(null),
    onPuzzlesChange,
    onDraggingPuzzleIdChange,
    onDraggingHintChange,
    onOpenHintModal,
    onAddPuzzle,
    onRemovePuzzle,
    onMarkDirty
  }: Props = $props();

  // Hint tab state - tracks active hint type tab per puzzle
  let activeHintTab = $state<Record<string, 'text' | 'image' | 'audio' | 'video'>>({});

  function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return [...items];
    }
    const clone = [...items];
    const [removed] = clone.splice(from, 1);
    clone.splice(to, 0, removed);
    return clone;
  }

  function applyPuzzleOrder(reordered: EditablePuzzle[]) {
    return reordered.map((puzzle, index) => ({
      ...puzzle,
      displayOrder: index + 1
    }));
  }

  function applyHintOrder(puzzle: EditablePuzzle, reordered: EditableHint[]) {
    return reordered.map((hint, index) => ({
      ...hint,
      order: index + 1
    }));
  }

  function handlePuzzleDragStart(id: string, event: DragEvent) {
    onDraggingPuzzleIdChange(id);
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', id);
    event.dataTransfer!.setDragImage(event.currentTarget as Element, 20, 20);
  }

  function handlePuzzleDragOver(id: string, event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    if (!draggingPuzzleId || draggingPuzzleId === id) return;

    const from = puzzles.findIndex((puzzle) => puzzle.id === draggingPuzzleId);
    const to = puzzles.findIndex((puzzle) => puzzle.id === id);

    if (from === -1 || to === -1) return;

    const reordered = moveItem(puzzles, from, to);
    const withOrder = applyPuzzleOrder(reordered);
    onPuzzlesChange(withOrder);
  }

  function handlePuzzleDrop(event: DragEvent) {
    event.preventDefault();
    onDraggingPuzzleIdChange(null);
  }

  function handlePuzzleListDrop(event: DragEvent) {
    if (!draggingPuzzleId) return;

    const from = puzzles.findIndex((puzzle) => puzzle.id === draggingPuzzleId);
    if (from === -1) return;

    event.preventDefault();
    const reordered = moveItem(puzzles, from, puzzles.length - 1);
    const withOrder = applyPuzzleOrder(reordered);
    onPuzzlesChange(withOrder);
    onDraggingPuzzleIdChange(null);
  }

  function handleHintDragStart(puzzleId: string, hintId: string, event: DragEvent) {
    onDraggingHintChange({ puzzleId, hintId });
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', `${puzzleId}:${hintId}`);
    event.dataTransfer!.setDragImage(event.currentTarget as Element, 20, 20);
  }

  function handleHintDragOver(puzzle: EditablePuzzle, overHintId: string, event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    if (!draggingHint || draggingHint.puzzleId !== puzzle.id) return;
    if (draggingHint.hintId === overHintId) return;
    if (!puzzle.hints) return;

    const hints = puzzle.hints;
    const from = hints.findIndex((hint) => hint.uuid === draggingHint.hintId);
    const to = hints.findIndex((hint) => hint.uuid === overHintId);

    if (from === -1 || to === -1) return;

    const reordered = moveItem(hints, from, to);
    const withOrder = applyHintOrder(puzzle, reordered);

    // Update the puzzle's hints and trigger parent update
    const updatedPuzzles = puzzles.map(p =>
      p.id === puzzle.id ? { ...p, hints: withOrder } : p
    );
    onPuzzlesChange(updatedPuzzles);
  }

  function handleHintDrop(event: DragEvent) {
    event.preventDefault();
    onDraggingHintChange(null);
  }

  function handleHintListDrop(puzzle: EditablePuzzle, event: DragEvent) {
    if (!draggingHint || draggingHint.puzzleId !== puzzle.id) return;
    if (!puzzle.hints) return;

    const hints = puzzle.hints;
    const from = hints.findIndex((hint) => hint.uuid === draggingHint.hintId);
    if (from === -1) return;

    event.preventDefault();
    const reordered = moveItem(hints, from, hints.length - 1);
    const withOrder = applyHintOrder(puzzle, reordered);

    // Update the puzzle's hints and trigger parent update
    const updatedPuzzles = puzzles.map(p =>
      p.id === puzzle.id ? { ...p, hints: withOrder } : p
    );
    onPuzzlesChange(updatedPuzzles);
    onDraggingHintChange(null);
  }

  function groupHintsByType(hints: EditableHint[]) {
    return {
      text: hints.filter(h => h.type === 'text'),
      image: hints.filter(h => h.type === 'image'),
      audio: hints.filter(h => h.type === 'audio'),
      video: hints.filter(h => h.type === 'video')
    };
  }

  function getActiveHintTab(puzzleId: string): 'text' | 'image' | 'audio' | 'video' {
    return activeHintTab[puzzleId] ?? 'text';
  }

  function setActiveHintTab(puzzleId: string, tab: 'text' | 'image' | 'audio' | 'video') {
    activeHintTab[puzzleId] = tab;
    activeHintTab = { ...activeHintTab }; // trigger reactivity
  }

  function removeHint(puzzle: EditablePuzzle, hintId: string) {
    if (!puzzle.hints) return;

    const filtered = puzzle.hints.filter((hint) => hint.uuid !== hintId);
    const withOrder = applyHintOrder(puzzle, filtered);

    // Update the puzzle's hints and trigger parent update
    const updatedPuzzles = puzzles.map(p =>
      p.id === puzzle.id ? { ...p, hints: withOrder } : p
    );
    onPuzzlesChange(updatedPuzzles);
  }
</script>

<div class="space-y-4">
  {#if puzzles.length === 0}
    <p class="rounded-lg border border-dashed border-base-content/20 bg-base-100/70 p-4 text-sm text-base-content/60">
      No puzzles configured. Add puzzles to capture hint flows.
    </p>
  {/if}
  {#each puzzles as puzzle, index (puzzle.id)}
    <article
      class="rounded-2xl border border-white/10 bg-base-100/70 p-4 shadow-sm"
      ondragover={(event) => handlePuzzleDragOver(puzzle.id, event)}
      ondrop={handlePuzzleDrop}
    >
      <header class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-base-content">Puzzle {index + 1}</h3>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-xs btn-ghost text-base-content/60"
            aria-label="Reorder puzzle"
            draggable="true"
            ondragstart={(event) => handlePuzzleDragStart(puzzle.id, event)}
            ondragend={handlePuzzleDrop}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
              <path fill="currentColor" d="M4 10h16v2H4zm0-4h16v2H4zm0 8h16v2H4zm0 4h16v2H4z" />
            </svg>
          </button>
          <button type="button" class="btn btn-xs btn-ghost text-error" onclick={() => onRemovePuzzle(puzzle.id)}>
            Remove
          </button>
        </div>
      </header>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Title</span>
          <input class="input input-bordered" bind:value={puzzle.title} required oninput={onMarkDirty} />
        </label>
        <label class="form-control">
          <span class="label-text">Display order</span>
          <input class="input input-bordered" type="number" min="1" bind:value={puzzle.displayOrder} oninput={onMarkDirty} />
        </label>
        <label class="form-control md:col-span-2">
          <span class="label-text">Description</span>
          <textarea class="textarea textarea-bordered" rows={2} bind:value={puzzle.description} oninput={onMarkDirty}></textarea>
        </label>
        <label class="form-control md:col-span-2">
          <span class="label-text">Solution</span>
          <textarea class="textarea textarea-bordered" rows={2} bind:value={puzzle.solution} oninput={onMarkDirty}></textarea>
        </label>
        <label class="form-control">
          <span class="label-text">Media asset</span>
          <input class="input input-bordered" bind:value={puzzle.mediaAsset} placeholder="optional asset id" oninput={onMarkDirty} />
        </label>
        <label class="form-control">
          <span class="label-text">Operator actions</span>
          <input class="input input-bordered" bind:value={puzzle.operatorActions} placeholder="reset instructions" oninput={onMarkDirty} />
        </label>
      </div>
      <section class="mt-4 rounded-xl border border-dashed border-white/10 bg-base-200/70 p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h4 class="text-sm font-semibold text-base-content">Hints</h4>
          <button type="button" class="btn btn-xs btn-secondary" onclick={() => onOpenHintModal(puzzle, null)}>
            + Add hint
          </button>
        </div>

        {#if !puzzle.hints || puzzle.hints.length === 0}
          <p class="rounded-lg border border-white/5 bg-base-100/70 p-3 text-xs text-base-content/60">No hints yet. Click "+ Add hint" to create one.</p>
        {:else}
          {@const hintGroups = groupHintsByType(puzzle.hints)}

          <!-- Hint Type Tabs -->
          <div class="tabs tabs-boxed mb-3 bg-base-300/50">
            <button
              type="button"
              class={`tab ${getActiveHintTab(puzzle.id) === 'text' ? 'tab-active' : ''}`}
              onclick={() => setActiveHintTab(puzzle.id, 'text')}
            >
              Text
            </button>
            <button
              type="button"
              class={`tab ${getActiveHintTab(puzzle.id) === 'image' ? 'tab-active' : ''}`}
              onclick={() => setActiveHintTab(puzzle.id, 'image')}
            >
              Image
            </button>
            <button
              type="button"
              class={`tab ${getActiveHintTab(puzzle.id) === 'audio' ? 'tab-active' : ''}`}
              onclick={() => setActiveHintTab(puzzle.id, 'audio')}
            >
              Audio
            </button>
            <button
              type="button"
              class={`tab ${getActiveHintTab(puzzle.id) === 'video' ? 'tab-active' : ''}`}
              onclick={() => setActiveHintTab(puzzle.id, 'video')}
            >
              Video
            </button>
          </div>

          <!-- Hints Table -->
          {@const hintsForTab = hintGroups[getActiveHintTab(puzzle.id)]}
          {#if hintsForTab.length === 0}
            <p class="rounded-lg border border-white/5 bg-base-100/70 p-3 text-xs text-base-content/60">
              No {getActiveHintTab(puzzle.id)} hints yet.
            </p>
          {:else}
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th class="text-xs uppercase text-base-content/60">File Name</th>
                    <th class="text-xs uppercase text-base-content/60">Description</th>
                    <th class="text-center text-xs uppercase text-base-content/60">Count as Hint</th>
                    <th class="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each hintsForTab as hint (hint.uuid)}
                    <tr
                      class="hover"
                      draggable="true"
                      ondragstart={(e) => handleHintDragStart(puzzle.id, hint.uuid, e)}
                      ondragover={(e) => handleHintDragOver(puzzle, hint.uuid, e)}
                      ondrop={handleHintDrop}
                      ondragend={handleHintDrop}
                    >
                      <td class="text-sm">{hint.assetUrl || '—'}</td>
                      <td class="max-w-xs truncate text-sm">{hint.content || '—'}</td>
                      <td class="text-center">
                        <input type="checkbox" checked={hint.countAsHint ?? true} class="checkbox checkbox-primary checkbox-sm" disabled />
                      </td>
                      <td>
                        <div class="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            class="btn btn-xs btn-ghost text-base-content/70 hover:text-primary"
                            onclick={() => onOpenHintModal(puzzle, hint)}
                            aria-label="Edit hint"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="btn btn-xs btn-ghost text-base-content/70 hover:text-error"
                            onclick={() => removeHint(puzzle, hint.uuid)}
                            aria-label="Delete hint"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div
              class="h-3"
              role="presentation"
              aria-hidden="true"
              ondragover={(event) => {
                event.preventDefault();
                handleHintListDrop(puzzle, event);
              }}
              ondrop={(event) => handleHintListDrop(puzzle, event)}
            ></div>
          {/if}
        {/if}
      </section>
    </article>
  {/each}
  <div
    class="h-3"
    role="presentation"
    aria-hidden="true"
    ondragover={(event) => {
      event.preventDefault();
      handlePuzzleListDrop(event);
    }}
    ondrop={handlePuzzleListDrop}
  ></div>
  <button type="button" class="btn btn-secondary" onclick={onAddPuzzle}>
    + Add puzzle
  </button>
</div>
