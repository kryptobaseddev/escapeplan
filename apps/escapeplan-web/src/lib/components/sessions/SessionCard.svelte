<script lang="ts">
import type { GameSessionDetails } from '@escapeplan/contracts';
import { buildRoomDisplayUrl, getTimerColorClass, formatSessionTime } from '$lib/utils/session';
import { formatTimer } from '$lib/utils/datetime';
import { useClipboard } from '$lib/composables/useClipboard.svelte';

interface Props {
  session: GameSessionDetails;
  variant?: 'compact' | 'standard';
  onTimerCommand?: (sessionId: string, command: TimerCommand) => void;
  onCopyLink?: (session: GameSessionDetails) => void;
  onOpenLink?: (session: GameSessionDetails) => void;
}

type TimerCommand = 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'stop_session';

let { session, variant = 'compact', onTimerCommand, onCopyLink, onOpenLink }: Props = $props();

const { copySuccess, copyToClipboard } = useClipboard();
let showStopConfirmation = $state(false);

const roomDisplayUrl = $derived(buildRoomDisplayUrl(session));
const timerColorClass = $derived(getTimerColorClass(session.timer.remainingSeconds));
const formattedRemainingTime = $derived(formatTimer(session.timer.remainingSeconds));
const formattedTotalTime = $derived(formatTimer(session.timer.totalElapsedSeconds));

function handleTimerCommand(command: TimerCommand) {
  onTimerCommand?.(session.id, command);
}

function handleCopyRoomLink() {
  copyToClipboard(roomDisplayUrl);
  onCopyLink?.(session);
}

function handleOpenRoomLink() {
  if (roomDisplayUrl) {
    window.open(roomDisplayUrl, '_blank', 'noopener,noreferrer');
  }
  onOpenLink?.(session);
}

function handleStopSessionClick() {
  showStopConfirmation = true;
}

function confirmStopSession() {
  showStopConfirmation = false;
  handleTimerCommand('stop_session');
}

function cancelStopSession() {
  showStopConfirmation = false;
}
</script>

<div class="card bg-base-200 shadow-md p-3 sm:p-5">
  <!-- Main flex container: left content takes available space, right timer stays fixed -->
  <div class="flex gap-3 sm:gap-4">
    <!-- LEFT COLUMN: Game details and controls (flex-1 allows it to grow) -->
    <div class="flex-1 min-w-0 space-y-2 sm:space-y-3">
      <!-- Game name and player count row -->
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <h3 class="text-base sm:text-lg font-bold truncate">{session.gameName}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs sm:text-sm text-base-content/70">
              {session.players} player{session.players !== 1 ? 's' : ''}
            </span>
            {#if session.isAdhoc}
              <span class="badge badge-info badge-xs text-[10px] uppercase tracking-wider">
                Ad-hoc
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Action buttons row -->
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-primary btn-xs sm:btn-sm max-sm:btn-square"
          onclick={() => window.location.href = `/games/${session.id}`}
          aria-label="Open game runner"
          title="Open game runner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
          <span class="hidden sm:inline">Open runner</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary btn-xs sm:btn-sm max-sm:btn-square"
          onclick={() => window.location.href = `/bookings`}
          aria-label="View bookings"
          title="View bookings"
        >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span class="hidden sm:inline">View bookings</span>
          </button>
      </div>

      <!-- Session details -->
      <div class="text-xs sm:text-sm space-y-0.5 text-base-content/70">
        <div class="flex gap-1.5">
          <span class="font-medium min-w-[90px]">Started:</span>
          <span>{formatSessionTime(session.startedAt)}</span>
        </div>
        <div class="flex gap-1.5">
          <span class="font-medium min-w-[90px]">Sched end:</span>
          <span>{formatSessionTime(session.scheduledEnd)}</span>
        </div>
        <div class="flex gap-1.5">
          <span class="font-medium min-w-[90px]">Hints used:</span>
          <span>{session.hintsUsed || 0}</span>
        </div>
      </div>

      <!-- Room Display buttons -->
      {#if roomDisplayUrl}
        <div class="pt-1 sm:pt-2">
          <div class="text-xs sm:text-sm font-medium text-base-content/70 mb-1.5">
            Room Display
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-xs sm:btn-sm btn-outline"
              onclick={handleCopyRoomLink}
              aria-label={copySuccess ? 'Link copied!' : 'Copy room display link'}
              title={copySuccess ? 'Link copied!' : 'Copy room display link'}
            >
              {#if copySuccess}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              {/if}
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              class="btn btn-xs sm:btn-sm btn-outline"
              onclick={handleOpenRoomLink}
              aria-label="Open room display in new window"
              title="Open room display in new window"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span>Open</span>
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- RIGHT COLUMN: Timer display and controls (fixed width, stays on right) -->
    <div class="flex-none w-24 sm:w-32 flex flex-col items-end gap-2">
      <!-- Timer display -->
      <div class="text-right">
        <div class="text-2xl sm:text-4xl font-mono font-bold {timerColorClass}">
          {formattedRemainingTime}
        </div>
        <div class="text-[10px] sm:text-xs uppercase tracking-widest text-base-content/60 mt-1">
          {session.timer.status}
        </div>
        <div class="text-[10px] sm:text-xs text-base-content/50 mt-0.5">
          Total: {formattedTotalTime}
        </div>
      </div>

      <!-- Timer controls -->
      <div class="flex gap-1.5 sm:gap-2 mt-1">
        {#if session.timer.status === 'idle'}
          <button
            type="button"
            class="btn btn-circle btn-xs sm:btn-sm btn-success"
            onclick={() => handleTimerCommand('start_timer')}
            aria-label="Start timer"
            title="Start timer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 sm:h-4 sm:w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        {:else if session.timer.status === 'running'}
          <button
            type="button"
            class="btn btn-circle btn-xs sm:btn-sm btn-warning"
            onclick={() => handleTimerCommand('pause_timer')}
            aria-label="Pause timer"
            title="Pause timer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 sm:h-4 sm:w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </button>
        {:else if session.timer.status === 'paused'}
          <button
            type="button"
            class="btn btn-circle btn-xs sm:btn-sm btn-success"
            onclick={() => handleTimerCommand('resume_timer')}
            aria-label="Resume timer"
            title="Resume timer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 sm:h-4 sm:w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        {/if}

        <!-- Reset/Restart button - always visible so completed games can be restarted -->
        <button
          type="button"
          class="btn btn-circle btn-xs sm:btn-sm btn-ghost"
          onclick={() => handleTimerCommand('reset_timer')}
          aria-label={session.timer.status === 'completed' ? 'Restart game' : 'Reset timer'}
          title={session.timer.status === 'completed' ? 'Restart game' : 'Reset timer'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3 sm:h-4 sm:w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        <!-- Stop button - only show for active games (not completed) -->
        {#if session.timer.status !== 'completed'}
          <button
            type="button"
            class="btn btn-circle btn-xs sm:btn-sm btn-error"
            onclick={handleStopSessionClick}
            aria-label="Stop session"
            title="Stop session (ends game)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 sm:h-4 sm:w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Stop Session Confirmation Dialog -->
{#if showStopConfirmation}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={cancelStopSession}>
    <div
      class="bg-base-200 rounded-lg shadow-xl p-6 max-w-md mx-4"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 class="text-lg font-bold mb-3">Stop Session?</h3>
      <p class="text-sm text-base-content/80 mb-4">
        This will end the game session immediately. The timer will be set to zero and the session will be marked as completed.
      </p>
      <p class="text-sm text-warning mb-5">
        This action cannot be undone.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelStopSession}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-error"
          onclick={confirmStopSession}
        >
          Stop Session
        </button>
      </div>
    </div>
  </div>
{/if}
