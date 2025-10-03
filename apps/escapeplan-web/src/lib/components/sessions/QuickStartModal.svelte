<svelte:options runes={true} />

<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import { formatTime } from '$lib/utils/datetime';
  import type {
    GameDetails,
    GameRoomDefinition,
    QuickStartSessionRequest,
    QuickStartSessionResponse,
    GameSessionDetails
  } from '@escapeplan/contracts';

  interface Props {
    open?: boolean;
    games?: GameDetails[];
    activeSessions?: GameSessionDetails[];
    onclose?: () => void;
    onsuccess?: (session: GameSessionDetails) => void;
  }

  const props: Props = $props();

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let selectedGameId = $state<string | null>(null);
  let selectedRoomId = $state<string | null>(null);
  let partySize = $state(4);
  let durationMinutes = $state<number | string | null>(null);
  let notes = $state('');
  let autoStartTimer = $state(true); // Auto-start timer by default
  let errorMessage = $state<string | null>(null);
  let submitting = $state(false);
  let occupiedRoomMap = $state(new Map<string, GameSessionDetails>());
  let availableRooms = $state<GameRoomDefinition[]>([]);
  let occupiedSummaries = $state<Array<{ room: GameRoomDefinition; session: GameSessionDetails }>>([]);
  let lastGameId = $state<string | null>(null);

  const occupancyForRoom = (room: GameRoomDefinition | undefined | null) => {
    if (!room) return undefined;
    return occupiedRoomMap.get(room.id);
  };

  const firstAvailableRoomId = (game: GameDetails | null | undefined) => {
    if (!game) return null;
    const rooms = game.rooms ?? [];
    const available = rooms.find((room: GameRoomDefinition) => !occupancyForRoom(room));
    return available?.id ?? null;
  };

  const clampPartySize = (game: GameDetails | null, requested: number) => {
    if (!game) return requested;
    const min = game.minPlayers ?? 1;
    const max = game.maxPlayers ?? min;
    if (!Number.isFinite(requested)) return min;
    return Math.min(Math.max(requested, min), max);
  };

  const resetState = () => {
    const games = props.games ?? [];
    const firstGame = games[0] ?? null;
    selectedGameId = firstGame?.id ?? null;
    selectedRoomId = firstAvailableRoomId(firstGame) ?? firstGame?.rooms?.[0]?.id ?? null;
    partySize = firstGame ? clampPartySize(firstGame, 4) : 4;
    durationMinutes = null;
    notes = '';
    errorMessage = null;
  };

  const close = () => {
    props.onclose?.();
  };

  // Build occupiedRoomMap from activeSessions
  $effect(() => {
    const map = new Map<string, GameSessionDetails>();
    const activeSessions = props.activeSessions ?? [];
    for (const session of activeSessions) {
      if (session.roomId) map.set(session.roomId, session);
    }
    occupiedRoomMap = map;
  });

  const currentGame = () => {
    const games = props.games ?? [];
    return games.find((game: GameDetails) => game.id === selectedGameId) ?? null;
  };

  const currentRoom = () => currentGame()?.rooms.find((room: GameRoomDefinition) => room.id === selectedRoomId) ?? null;

  // Reset state when modal opens if selected game is invalid
  $effect(() => {
    const open = props.open;
    const games = props.games ?? [];
    if (open) {
      if (!selectedGameId || !games.find((game: GameDetails) => game.id === selectedGameId)) {
        resetState();
      }
    }
  });

  // Update availableRooms and occupiedSummaries when game or occupancy changes
  $effect(() => {
    const game = currentGame();
    if (game) {
      const rooms = game.rooms ?? [];
      availableRooms = rooms.filter((room: GameRoomDefinition) => !occupancyForRoom(room));
      occupiedSummaries = rooms
        .map((room: GameRoomDefinition) => ({ room, session: occupancyForRoom(room) }))
        .filter((entry: { room: GameRoomDefinition; session: GameSessionDetails | undefined }): entry is { room: GameRoomDefinition; session: GameSessionDetails } => Boolean(entry.session));
    } else {
      availableRooms = [];
      occupiedSummaries = [];
    }
  });

  // Auto-select available room when game changes or room becomes unavailable
  $effect(() => {
    if (!selectedGameId) {
      selectedRoomId = null;
    } else {
      const game = currentGame();
      if (!game) {
        selectedRoomId = null;
      } else {
        const rooms = game.rooms ?? [];
        const stillAvailable = rooms.some((room: GameRoomDefinition) => room.id === selectedRoomId && !occupancyForRoom(room));
        if (!stillAvailable) {
          selectedRoomId = firstAvailableRoomId(game);
        }
      }
    }
  });

  // Clamp party size when game changes
  $effect(() => {
    if (selectedGameId !== lastGameId) {
      lastGameId = selectedGameId;
      const game = currentGame();
      if (game) {
        partySize = clampPartySize(game, Number(partySize) || game.minPlayers || 1);
      }
    }
  });

  const submitQuickStart = async () => {
    if (!selectedGameId || !selectedRoomId) {
      errorMessage = 'Select a game and room to start a session.';
      return;
    }
    const game = currentGame();
    const room = currentRoom();
    if (!game || !room) {
      errorMessage = 'Selected game or room is no longer available.';
      return;
    }

    const occupancy = occupancyForRoom(room);
    if (occupancy) {
      const until = formatTime(occupancy.scheduledEnd);
      errorMessage = `Room is occupied until ${until}. Choose another room or end the active session first.`;
      return;
    }

    const overrideMinutes = durationMinutes !== null && durationMinutes !== '' ? Number(durationMinutes) : null;

    const normalizedPartySize = Number(partySize) || (game.minPlayers ?? 1);

    const request: QuickStartSessionRequest = {
      gameId: game.id,
      roomId: room.id,
      partySize: normalizedPartySize,
      durationMinutes: overrideMinutes && overrideMinutes > 0 ? overrideMinutes : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
      autoStartTimer
    };

    submitting = true;
    errorMessage = null;
    try {
      const result = await apiFetch<QuickStartSessionResponse>(fetch, '/sessions/quick-start', {
        method: 'POST',
        body: JSON.stringify(request)
      });
      props.onsuccess?.(result.session);
      close();
    } catch (error) {
      console.error('Quick start failed', error);
      const maybe = error as { details?: unknown };
      if (maybe?.details && typeof maybe.details === 'object' && maybe.details !== null && 'message' in maybe.details) {
        errorMessage = String((maybe.details as { message?: string }).message ?? 'Unable to start session.');
      } else {
        errorMessage = 'Unable to start session. Please try again.';
      }
    } finally {
      submitting = false;
    }
  };
</script>

{#if props.open}
  <dialog
    class="modal modal-bottom sm:modal-middle"
    open
    bind:this={dialogElement}
    oncancel={(event) => {
      event.preventDefault();
      close();
    }}
  >
    <div class="modal-box max-h-[90vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
      <header class="space-y-2">
        <h2 class="text-lg font-semibold text-base-content">Quick start session</h2>
        <p class="text-sm text-base-content/60">
          Launch an ad-hoc session without a booking. Choose the game, adjust party size, and optionally override the default timer.
        </p>
      </header>

      {#if errorMessage}
        <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form
        class="mt-6 space-y-5"
        onsubmit={(event) => {
          event.preventDefault();
          submitQuickStart();
        }}
      >
        <label class="form-control">
          <span class="label-text">Game</span>
          <select
            class="select select-bordered"
            bind:value={selectedGameId}
            required
          >
            {#each props.games ?? [] as game}
              <option value={game.id}>{game.name}</option>
            {/each}
          </select>
        </label>

        <!-- Room auto-selected to 'Main' - hidden from UI -->
        <input type="hidden" bind:value={selectedRoomId} />
        {#if occupiedSummaries.length}
          <div class="alert alert-warning border border-warning/30 bg-warning/10 text-sm">
            <span>Currently running until {formatTime(occupiedSummaries[0].session.scheduledEnd)}</span>
          </div>
        {/if}

        <div class="grid gap-4 md:grid-cols-2">
          <label class="form-control">
            <span class="label-text">Party size</span>
            <input
              class="input input-bordered"
              type="number"
              min={currentGame()?.minPlayers ?? 1}
              max={currentGame()?.maxPlayers ?? 12}
              bind:value={partySize}
              onblur={(event) => {
                const game = currentGame();
                if (game) {
                  const value = Number((event.currentTarget as HTMLInputElement).value);
                  partySize = clampPartySize(game, Number.isFinite(value) ? value : game.minPlayers ?? 1);
                }
              }}
            />
            <span class="label-text-alt text-xs text-base-content/60">
              {#if currentGame()}
                Min {currentGame()?.minPlayers ?? 1} · Max {currentGame()?.maxPlayers ?? 12}
              {/if}
            </span>
          </label>
          <label class="form-control">
            <span class="label-text">Duration override (minutes)</span>
            <input
              class="input input-bordered"
              type="number"
              min="5"
              max="240"
              bind:value={durationMinutes}
              placeholder={(currentGame()?.durationMinutes ?? 60).toString()}
            />
            <span class="label-text-alt text-xs">Leave blank to use the default {currentGame()?.durationMinutes ?? 60}-minute timer.</span>
          </label>
        </div>

        <label class="form-control">
          <span class="label-text">Internal notes</span>
          <textarea
            class="textarea textarea-bordered"
            rows={3}
            bind:value={notes}
            placeholder="e.g., Walk-in birthday group"
          ></textarea>
        </label>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              class="toggle toggle-primary"
              bind:checked={autoStartTimer}
            />
            <div class="flex flex-col">
              <span class="label-text font-medium">Auto-start timer</span>
              <span class="label-text-alt text-xs text-base-content/60">
                {autoStartTimer ? 'Timer will start immediately when session is created' : 'Timer will remain idle until manually started'}
              </span>
            </div>
          </label>
        </div>

        <footer class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close}>Cancel</button>
          <button type="submit" class="btn btn-primary w-full sm:w-auto" disabled={submitting || !selectedGameId || !selectedRoomId}>
            {submitting ? 'Starting…' : 'Start session'}
          </button>
        </footer>
      </form>
    </div>
  </dialog>
{/if}
