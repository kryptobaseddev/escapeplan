<svelte:options runes={false} />

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

  export let open = false;
  export let games: GameDetails[] = [];
  export let activeSessions: GameSessionDetails[] = [];
  export let onclose: (() => void) | undefined;
  export let onsuccess: ((session: GameSessionDetails) => void) | undefined;

  let dialogElement: HTMLDialogElement | null = null;
  let selectedGameId: string | null = null;
  let selectedRoomId: string | null = null;
  let partySize = 4;
  let durationMinutes: number | string | null = null;
  let notes = '';
  let errorMessage: string | null = null;
  let submitting = false;
  let occupiedRoomMap = new Map<string, GameSessionDetails>();
  let availableRooms: GameRoomDefinition[] = [];
  let occupiedSummaries: Array<{ room: GameRoomDefinition; session: GameSessionDetails }> = [];
  let lastGameId: string | null = null;

  const occupancyForRoom = (room: GameRoomDefinition | undefined | null) => {
    if (!room) return undefined;
    return occupiedRoomMap.get(room.id) ?? (room.uuid ? occupiedRoomMap.get(room.uuid) : undefined);
  };

  const firstAvailableRoomId = (game: GameDetails | null | undefined) => {
    if (!game) return null;
    const rooms = game.rooms ?? [];
    const available = rooms.find((room) => !occupancyForRoom(room));
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
    const firstGame = games[0] ?? null;
    selectedGameId = firstGame?.id ?? null;
    selectedRoomId = firstAvailableRoomId(firstGame) ?? firstGame?.rooms?.[0]?.id ?? null;
    partySize = firstGame ? clampPartySize(firstGame, 4) : 4;
    durationMinutes = null;
    notes = '';
    errorMessage = null;
  };

  const close = () => {
    onclose?.();
  };

  $: {
    const map = new Map<string, GameSessionDetails>();
    for (const session of activeSessions ?? []) {
      if (session.roomId) map.set(session.roomId, session);
      if (session.roomUuid) map.set(session.roomUuid, session);
    }
    occupiedRoomMap = map;
  }

  const currentGame = () => games.find((game) => game.id === selectedGameId) ?? null;
  const currentRoom = () => currentGame()?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  $: if (open) {
    if (!selectedGameId || !games.find((game) => game.id === selectedGameId)) {
      resetState();
    }
  }

  $: {
    const game = currentGame();
    if (game) {
      const rooms = game.rooms ?? [];
      availableRooms = rooms.filter((room) => !occupancyForRoom(room));
      occupiedSummaries = rooms
        .map((room) => ({ room, session: occupancyForRoom(room) }))
        .filter((entry): entry is { room: GameRoomDefinition; session: GameSessionDetails } => Boolean(entry.session));
    } else {
      availableRooms = [];
      occupiedSummaries = [];
    }
  }

  $: {
    if (!selectedGameId) {
      selectedRoomId = null;
    } else {
      const game = currentGame();
      if (!game) {
        selectedRoomId = null;
      } else {
        const rooms = game.rooms ?? [];
        const stillAvailable = rooms.some((room) => room.id === selectedRoomId && !occupancyForRoom(room));
        if (!stillAvailable) {
          selectedRoomId = firstAvailableRoomId(game);
        }
      }
    }
  }

  $: if (selectedGameId !== lastGameId) {
    lastGameId = selectedGameId;
    const game = currentGame();
    if (game) {
      partySize = clampPartySize(game, Number(partySize) || game.minPlayers || 1);
    }
  }

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
      durationMinutes: overrideMinutes && overrideMinutes > 0 ? overrideMinutes : null,
      notes: notes.trim() ? notes.trim() : null
    };

    submitting = true;
    errorMessage = null;
    try {
      const result = await apiFetch<QuickStartSessionResponse>(fetch, '/sessions/quick-start', {
        method: 'POST',
        body: JSON.stringify(request)
      });
      onsuccess?.(result.session);
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

{#if open}
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
          Launch an ad-hoc session without a booking. Choose the game and room, adjust party size, and optionally shorten the timer.
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
            {#each games as game}
              <option value={game.id}>{game.name}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label-text">Room</span>
          <select
            class="select select-bordered"
            bind:value={selectedRoomId}
            required
            disabled={!availableRooms.length}
          >
            {#if availableRooms.length}
              {#each availableRooms as room}
                <option value={room.id}>{room.name}{room.isMobileCapable ? ' · Mobile kit' : ''}</option>
              {/each}
            {:else}
              <option value="" disabled>No rooms available</option>
            {/if}
          </select>
          {#if occupiedSummaries.length}
            <span class="label-text-alt text-xs text-base-content/60">
              Currently running: {occupiedSummaries
                .map(({ room, session }) => `${room.name} until ${formatTime(session.scheduledEnd)}`)
                .join(', ')}
            </span>
          {:else if !availableRooms.length}
            <span class="label-text-alt text-xs text-error">All rooms are currently in use.</span>
          {/if}
        </label>

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
