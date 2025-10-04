<svelte:options runes={true} />

<script lang="ts">
  import type { GameSessionDetails } from '@escapeplan/contracts';

  let {
    session,
    onTriggerMilestone,
    onResetMilestone
  }: {
    session: GameSessionDetails;
    onTriggerMilestone: (milestoneId: string) => void;
    onResetMilestone: (milestoneId: string) => void;
  } = $props();
</script>

<div id="milestones" class="glass-panel border-white/10 bg-base-200/70 p-4">
  <div class="flex items-center justify-between">
    <h2 class="text-base md:text-lg font-semibold text-base-content">Game Milestones</h2>
    {#if session.availableMilestones && session.availableMilestones.length > 0}
      <span class="badge badge-outline border-white/10 text-[10px] md:text-xs uppercase tracking-[0.3em] text-base-content/50">
        {session.availableMilestones.length} available
      </span>
    {/if}
  </div>
  {#if session.availableMilestones && session.availableMilestones.length > 0}
    <div class="mt-4 grid grid-cols-2 gap-2 md:gap-3">
      {#each session.availableMilestones as milestone}
        {@const isMilestonePlaying = session.currentRoomDisplayMedia?.status === 'playing' && session.currentRoomDisplayMedia?.source === 'milestone' && session.currentRoomDisplayMedia?.mediaType === milestone.mediaType}
        <div
          role="button"
          tabindex="0"
          class={`card border transition w-full ${isMilestonePlaying ? 'media-playing' : ''} ${milestone.triggered ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'} ${
            milestone.type === 'intro'
              ? 'border-info/40 bg-info/10 hover:bg-info/20'
              : milestone.type === 'escaped'
                ? 'border-success/40 bg-success/10 hover:bg-success/20'
                : milestone.type === 'failed'
                  ? 'border-error/40 bg-error/10 hover:bg-error/20'
                  : 'border-warning/40 bg-warning/10 hover:bg-warning/20'
          }`}
          onclick={() => !milestone.triggered && onTriggerMilestone(milestone.id)}
          onkeydown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !milestone.triggered) {
              e.preventDefault();
              onTriggerMilestone(milestone.id);
            }
          }}
        >
          <div class="card-body p-2">
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-1 flex-wrap">
                  <h3 class="text-xs md:text-sm font-semibold text-base-content">{milestone.name}</h3>
                  {#if milestone.mediaType}
                    <span class="badge badge-xs badge-outline text-[9px] flex-shrink-0">{milestone.mediaType}</span>
                  {/if}
                  {#if milestone.triggerType === 'manual'}
                    <span class="badge badge-xs badge-ghost text-[9px] flex-shrink-0">Manual</span>
                  {:else if milestone.triggerType === 'timer' && milestone.triggerConfig?.minutes}
                    <span class="badge badge-xs badge-ghost text-[9px] flex-shrink-0">@ {milestone.triggerConfig.minutes}m</span>
                  {:else if milestone.triggerType === 'condition' && milestone.triggerConfig?.hintsUsed}
                    <span class="badge badge-xs badge-ghost text-[9px] flex-shrink-0">After {milestone.triggerConfig.hintsUsed} hints</span>
                  {/if}
                  {#if milestone.triggered}
                    <span class="badge badge-xs badge-success text-[9px] flex-shrink-0">✓ Used</span>
                  {/if}
                  {#if isMilestonePlaying}
                    <span class="badge badge-xs badge-warning text-[9px] flex-shrink-0">Playing</span>
                  {/if}
                </div>
                {#if milestone.content}
                  <p class="mt-1 text-[10px] md:text-xs text-base-content/70 line-clamp-1">{milestone.content}</p>
                {/if}
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                {#if milestone.triggered}
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs h-auto min-h-0 p-1 hover:bg-warning/20"
                    title="Reset milestone (make available again)"
                    onclick={(e) => {
                      e.stopPropagation();
                      onResetMilestone(milestone.id);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-warning" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                  </button>
                {/if}
                {#if milestone.type === 'intro'}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 text-info" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                  </svg>
                {:else if milestone.type === 'escaped'}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                {:else if milestone.type === 'failed'}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 text-error" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-xs md:text-sm text-base-content/60">No milestones configured for this game.</p>
  {/if}
</div>
