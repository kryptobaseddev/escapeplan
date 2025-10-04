<svelte:options runes={true} />

<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import { formatTime } from '$lib/utils/datetime';
  import type {
    GameDetails,
    QuickStartSessionRequest,
    QuickStartSessionResponse,
    GameSessionDetails
  } from '@escapeplan/contracts';
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  interface Props {
    open?: boolean;
    games?: GameDetails[];
    activeSessions?: GameSessionDetails[];
    onclose?: () => void;
    onsuccess?: (session: GameSessionDetails) => void;
  }

  const props: Props = $props();

  let selectedGameId = $state<string | null>(null);
  let partySize = $state(4);
  let durationMinutes = $state<number | string | null>(null);
  let notes = $state('');
  let autoStartTimer = $state(true);
  let errorMessage = $state<string | null>(null);
  let submitting = $state(false);
  let occupiedGameMap = $state(new Map<string, GameSessionDetails>());
  let lastGameId = $state<string | null>(null);

  // Check if a game has an active session
  const isGameOccupied = (gameId: string | null) => {
    if (!gameId) return false;
    return occupiedGameMap.has(gameId);
  };

  // Get active session for a game
  const getActiveSession = (gameId: string | null) => {
    if (!gameId) return null;
    return occupiedGameMap.get(gameId) ?? null;
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
    const firstAvailableGame = games.find(game => !isGameOccupied(game.id)) ?? games[0] ?? null;
    selectedGameId = firstAvailableGame?.id ?? null;
    partySize = firstAvailableGame ? clampPartySize(firstAvailableGame, 4) : 4;
    durationMinutes = null;
    notes = '';
    errorMessage = null;
    autoStartTimer = true;
  };

  const close = () => {
    if (!submitting) {
      props.onclose?.();
    }
  };

  // Build occupiedGameMap from activeSessions
  $effect(() => {
    const map = new Map<string, GameSessionDetails>();
    const activeSessions = props.activeSessions ?? [];
    for (const session of activeSessions) {
      // Each active session occupies its game
      map.set(session.gameId, session);
    }
    occupiedGameMap = map;
  });

  const currentGame = () => {
    const games = props.games ?? [];
    return games.find((game: GameDetails) => game.id === selectedGameId) ?? null;
  };

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
    if (!selectedGameId) {
      errorMessage = 'Select a game to start a session.';
      return;
    }
    const game = currentGame();
    if (!game) {
      errorMessage = 'Selected game is no longer available.';
      return;
    }

    // Check if game is already occupied
    const activeSession = getActiveSession(selectedGameId);
    if (activeSession) {
      const until = formatTime(activeSession.scheduledEnd);
      errorMessage = `This game has an active session until ${until}. End the current session first.`;
      return;
    }

    const overrideMinutes = durationMinutes !== null && durationMinutes !== '' ? Number(durationMinutes) : null;
    const normalizedPartySize = Number(partySize) || (game.minPlayers ?? 1);

    const request: QuickStartSessionRequest = {
      gameId: game.id,
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

<Modal
  open={props.open ?? false}
  title="Quick start session"
  description="Launch an ad-hoc session without a booking. Choose the game, adjust party size, and optionally override the default timer."
  size="2xl"
  onClose={close}
>
  {#if errorMessage}
    <Alert type="error" class="mb-6">
      {errorMessage}
    </Alert>
  {/if}

  <form
    class="space-y-5"
    onsubmit={(event) => {
      event.preventDefault();
      submitQuickStart();
    }}
  >
    <!-- Session Setup fieldset -->
    <fieldset class="space-y-4 rounded-lg border border-base-300 p-4">
      <legend class="px-2 text-sm font-semibold">Session Setup</legend>

      <!-- Game selector with validator -->
      <label class="form-control">
        <span class="label-text">Game *</span>
        <select
          class="select validator"
          bind:value={selectedGameId}
          required
          disabled={submitting}
        >
          {#each props.games ?? [] as game}
            {@const occupied = isGameOccupied(game.id)}
            <option value={game.id} disabled={occupied}>
              {game.name} {occupied ? '(Active session)' : ''}
            </option>
          {/each}
        </select>
        <div class="validator-hint">Select the game for this session</div>
      </label>

      {#if selectedGameId && isGameOccupied(selectedGameId)}
        {@const session = getActiveSession(selectedGameId)}
        {#if session}
          <Alert type="warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span>Active session until {formatTime(session.scheduledEnd)}. End current session to start new one.</span>
          </Alert>
        {/if}
      {/if}
    </fieldset>

    <!-- Session Configuration fieldset -->
    <fieldset class="space-y-4 rounded-lg border border-base-300 p-4">
      <legend class="px-2 text-sm font-semibold">Session Configuration</legend>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- Party size with suffix -->
        <label class="form-control">
          <span class="label-text">Party Size *</span>
          <label class="input validator flex items-center gap-2">
            <input
              type="number"
              name="partySize"
              required
              min={currentGame()?.minPlayers ?? 1}
              max={currentGame()?.maxPlayers ?? 12}
              bind:value={partySize}
              disabled={submitting}
              class="grow"
              onblur={(event) => {
                const game = currentGame();
                if (game) {
                  const value = Number((event.currentTarget as HTMLInputElement).value);
                  partySize = clampPartySize(game, Number.isFinite(value) ? value : game.minPlayers ?? 1);
                }
              }}
            />
            <span class="label">players</span>
          </label>
          <div class="validator-hint">
            {currentGame() ? `Min ${currentGame()?.minPlayers ?? 1} · Max ${currentGame()?.maxPlayers ?? 12}` : 'Enter number of players'}
          </div>
        </label>

        <!-- Duration override with suffix -->
        <label class="form-control">
          <span class="label-text">Duration Override</span>
          <label class="input validator flex items-center gap-2">
            <input
              type="number"
              name="durationMinutes"
              min="5"
              max="240"
              bind:value={durationMinutes}
              placeholder={(currentGame()?.durationMinutes ?? 60).toString()}
              disabled={submitting}
              class="grow"
            />
            <span class="label">minutes</span>
          </label>
          <div class="validator-hint">
            Leave blank to use the default {currentGame()?.durationMinutes ?? 60}-minute timer
          </div>
        </label>
      </div>
    </fieldset>

    <!-- Internal notes (standalone) -->
    <label class="form-control">
      <span class="label-text">Internal Notes</span>
      <textarea
        class="textarea validator"
        rows={3}
        maxlength="200"
        bind:value={notes}
        placeholder="e.g., Walk-in birthday group"
        disabled={submitting}
      ></textarea>
      <div class="validator-hint">Optional notes for staff reference (max 200 characters)</div>
    </label>

    <!-- Auto-start timer toggle -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          bind:checked={autoStartTimer}
          disabled={submitting}
        />
        <div class="flex flex-col">
          <span class="label-text font-medium">Auto-start timer</span>
          <span class="label-text-alt text-xs text-base-content/60">
            {autoStartTimer ? 'Timer will start immediately when session is created' : 'Timer will remain idle until manually started'}
          </span>
        </div>
      </label>
    </div>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close} disabled={submitting}>
      Cancel
    </button>
    <LoadingButton
      type="submit"
      variant="primary"
      loading={submitting}
      disabled={!selectedGameId || isGameOccupied(selectedGameId)}
      class="w-full sm:w-auto"
      onclick={submitQuickStart}
    >
      Start session
    </LoadingButton>
  {/snippet}
</Modal>
