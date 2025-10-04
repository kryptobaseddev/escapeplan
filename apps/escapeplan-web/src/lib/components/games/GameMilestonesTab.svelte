<script lang="ts">
  import type { GameMilestone, MilestoneType, MilestoneMediaType } from '@escapeplan/contracts';
  import Alert from '$lib/components/ui/Alert.svelte';
  import AssetBrowser from '../assets/AssetBrowser.svelte';
  import VolumeSlider from '$lib/components/ui/VolumeSlider.svelte';

  let {
    gameId = undefined,
    milestones = $bindable(),
    milestoneUploading,
    milestoneUploadErrors,
    onMilestonesChange,
    onMilestoneUpload
  }: {
    gameId?: string;
    milestones: GameMilestone[];
    milestoneUploading: Record<string, boolean>;
    milestoneUploadErrors: Record<string, string | null>;
    onMilestonesChange: (milestones: GameMilestone[]) => void;
    onMilestoneUpload: (milestoneId: string, file: File) => Promise<void>;
  } = $props();

  let milestoneFileInputs: Record<string, HTMLInputElement | null> = $state({});

  // Helper function to generate unique IDs
  function uid(prefix: string) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Helper function to move array items
  function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  }

  function addMilestone() {
    const newMilestone: GameMilestone = {
      id: uid('milestone'),
      gameId: '', // Will be set when game is saved
      type: 'custom',
      name: 'New Milestone',
      mediaType: null,
      content: null,
      assetId: null,
      volumeLevel: 80,
      displayOrder: milestones.length + 1,
      triggerType: 'manual',
      triggerConfig: null,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onMilestonesChange([...milestones, newMilestone]);
  }

  function deleteMilestone(index: number) {
    const newMilestones = milestones.filter((_, idx) => idx !== index);
    applyMilestoneOrder(newMilestones);
    onMilestonesChange(newMilestones);
  }

  function moveMilestone(from: number, to: number) {
    const reordered = moveItem(milestones, from, to);
    applyMilestoneOrder(reordered);
    onMilestonesChange(reordered);
  }

  function applyMilestoneOrder(list: GameMilestone[]) {
    list.forEach((milestone, index) => {
      milestone.displayOrder = index + 1;
    });
  }

  async function handleMilestoneFileUpload(milestone: GameMilestone, event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    await onMilestoneUpload(milestone.id, file);
  }
</script>

<div class="space-y-4">
  <Alert type="info">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
    <div class="inline-block">
      <p class="font-semibold">Game Milestones</p>
      <p>Create special moments like intro videos, escape celebrations, or time-up messages that can be triggered automatically or manually during gameplay.</p>
    </div>
  </Alert>

  <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
    <header class="mb-3 flex items-center justify-between gap-3">
      <h4 class="text-sm font-semibold text-base-content">Milestones ({milestones.length})</h4>
      <button type="button" class="btn btn-xs btn-secondary" onclick={addMilestone}>
        + Add milestone
      </button>
    </header>

    {#if milestones.length === 0}
      <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">
        No milestones configured. Add milestones to create special moments during your game sessions.
      </p>
    {/if}

    <div class="space-y-3">
      {#each milestones as milestone, index (milestone.id)}
        <div class="rounded-lg border border-white/10 bg-base-200/80 p-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex-1">
              <div class="grid gap-3 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Type <span class="text-error">*</span></span>
                  <select
                    class="select select-bordered select-sm"
                    bind:value={milestone.type}
                    onchange={(e) => {
                      const type = (e.currentTarget as HTMLSelectElement).value as MilestoneType;
                      milestone.type = type;
                      // Auto-fill name based on type (except custom)
                      if (type === 'intro') {
                        milestone.name = 'Intro';
                      } else if (type === 'escaped') {
                        milestone.name = 'Escaped';
                      } else if (type === 'failed') {
                        milestone.name = 'Failed';
                      }
                      onMilestonesChange(milestones);
                    }}
                  >
                    <option value="intro">Intro</option>
                    <option value="escaped">Escaped</option>
                    <option value="failed">Failed</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="label-text">Milestone name <span class="text-error">*</span></span>
                  <input
                    class="input input-bordered input-sm"
                    type="text"
                    bind:value={milestone.name}
                    oninput={() => onMilestonesChange(milestones)}
                    placeholder={milestone.type === 'custom' ? 'Enter custom name' : milestone.name || 'Name'}
                    required
                    readonly={milestone.type !== 'custom'}
                    class:input-disabled={milestone.type !== 'custom'}
                  />
                </label>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex flex-col gap-1">
                {#if index > 0}
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost"
                    onclick={() => moveMilestone(index, index - 1)}
                    title="Move up"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                {/if}
                {#if index < milestones.length - 1}
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost"
                    onclick={() => moveMilestone(index, index + 1)}
                    title="Move down"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                {/if}
              </div>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error"
                onclick={() => deleteMilestone(index)}
                title="Delete milestone"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <label class="form-control mb-3">
            <span class="label-text">Content / Description</span>
            <textarea
              class="textarea textarea-bordered textarea-sm"
              rows={2}
              bind:value={milestone.content}
              oninput={() => onMilestonesChange(milestones)}
              placeholder="Optional message or description for this milestone"
            ></textarea>
          </label>

          <div class="grid gap-3 md:grid-cols-2 mb-3">
            <label class="form-control">
              <span class="label-text">Media type</span>
              <select
                class="select select-bordered select-sm"
                value={milestone.mediaType ?? ''}
                onchange={(e) => {
                  const val = (e.currentTarget as HTMLSelectElement).value;
                  milestone.mediaType = val === '' ? null : (val as MilestoneMediaType);
                  onMilestonesChange(milestones);
                }}
              >
                <option value="">None</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </label>

            {#if milestone.mediaType === 'audio' || milestone.mediaType === 'video'}
              <VolumeSlider
                bind:value={milestone.volumeLevel}
                label="Volume"
                step={5}
                onchange={() => onMilestonesChange(milestones)}
              />
            {/if}
          </div>

          {#if milestone.mediaType && milestone.mediaType !== 'text'}
            <div class="form-control mb-3">
              <span class="label-text">Media File</span>
              <input
                type="file"
                bind:this={milestoneFileInputs[milestone.id]}
                onchange={(e) => handleMilestoneFileUpload(milestone, e)}
                accept={milestone.mediaType === 'image' ? 'image/*' : milestone.mediaType === 'audio' ? 'audio/*' : 'video/*'}
                class="hidden"
              />

              <div class="mt-2">
                {#if !milestone.assetId}
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    onclick={() => milestoneFileInputs[milestone.id]?.click()}
                    disabled={milestoneUploading[milestone.id]}
                  >
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                      <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
                    </svg>
                    Upload {milestone.mediaType}
                  </button>
                {:else}
                  <div class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                    <svg class="h-4 w-4 text-success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-sm text-success font-medium">Uploaded</span>
                    <span class="text-xs text-base-content/60">ID: {milestone.assetId.slice(0, 8)}...</span>
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost ml-auto"
                      onclick={() => {
                        milestone.assetId = null;
                        if (milestoneFileInputs[milestone.id]) {
                          milestoneFileInputs[milestone.id]!.value = '';
                        }
                        onMilestonesChange(milestones);
                      }}
                    >
                      Change
                    </button>
                  </div>
                {/if}
              </div>

              {#if milestoneUploadErrors[milestone.id]}
                <span class="label-text-alt text-error mt-1">{milestoneUploadErrors[milestone.id]}</span>
              {/if}
              {#if milestoneUploading[milestone.id]}
                <span class="label-text-alt text-info mt-1 flex items-center gap-2">
                  <span class="loading loading-spinner loading-xs"></span>
                  Uploading...
                </span>
              {/if}

              <!-- Browse existing assets -->
              {#if !milestone.assetId}
                <details class="collapse collapse-arrow bg-base-200/50 mt-3">
                  <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
                  <div class="collapse-content">
                    <AssetBrowser
                      gameId={gameId}
                      assetType="milestone_media"
                      mediaType={milestone.mediaType}
                      selectionMode="single"
                      onSelect={(asset) => {
                        milestone.assetId = asset.id;
                        onMilestonesChange(milestones);
                      }}
                    />
                  </div>
                </details>
              {/if}
            </div>
          {/if}

          <div class="divider my-3"></div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="form-control">
              <span class="label-text">Trigger type <span class="text-error">*</span></span>
              <select class="select select-bordered select-sm" bind:value={milestone.triggerType} onchange={() => onMilestonesChange(milestones)}>
                <option value="manual">Manual (button in game runner)</option>
                <option value="timer">Timer-based (auto-trigger at time)</option>
                <option value="condition">Condition-based (auto-trigger on event)</option>
              </select>
            </label>

            <label class="form-control">
              <span class="label-text">Enabled</span>
              <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-base-100/70 px-3 py-2">
                <input
                  type="checkbox"
                  class="toggle toggle-success toggle-sm"
                  bind:checked={milestone.enabled}
                  onchange={() => onMilestonesChange(milestones)}
                />
                <span class="text-sm text-base-content/70">{milestone.enabled ? 'Active' : 'Disabled'}</span>
              </div>
            </label>
          </div>

          {#if milestone.triggerType === 'timer'}
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="form-control">
                <span class="label-text">Trigger at (minutes)</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    value={milestone.triggerConfig?.minutes ?? ''}
                    oninput={(e) => {
                      const val = Number((e.currentTarget as HTMLInputElement).value);
                      milestone.triggerConfig = { ...milestone.triggerConfig, minutes: val || undefined };
                      onMilestonesChange(milestones);
                    }}
                    placeholder="e.g., 5 = trigger at 5 min mark"
                  />
                </label>
                <div class="validator-hint">Minutes elapsed when triggered</div>
              </label>
              <label class="form-control">
                <span class="label-text">Repeat interval (minutes)</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    value={milestone.triggerConfig?.interval ?? ''}
                    oninput={(e) => {
                      const val = Number((e.currentTarget as HTMLInputElement).value);
                      milestone.triggerConfig = { ...milestone.triggerConfig, interval: val || undefined };
                      onMilestonesChange(milestones);
                    }}
                    placeholder="e.g., 10 = every 10 minutes"
                  />
                </label>
                <div class="validator-hint">Repeat trigger interval</div>
              </label>
            </div>
          {:else if milestone.triggerType === 'condition'}
            <div class="mt-3">
              <label class="form-control">
                <span class="label-text">Trigger after hints used</span>
                <label class="input validator input-sm flex items-center gap-2">
                  <input
                    type="number"
                    class="grow"
                    min="0"
                    value={milestone.triggerConfig?.hintsUsed ?? ''}
                    oninput={(e) => {
                      const val = Number((e.currentTarget as HTMLInputElement).value);
                      milestone.triggerConfig = { ...milestone.triggerConfig, hintsUsed: val || undefined };
                      onMilestonesChange(milestones);
                    }}
                    placeholder="e.g., 3 = trigger after 3 hints sent"
                  />
                </label>
                <div class="validator-hint">Number of hints before trigger</div>
              </label>
            </div>
          {/if}

          <div class="mt-3 rounded-lg bg-base-300/50 p-2 text-xs text-base-content/60">
            <strong>Order:</strong> #{milestone.displayOrder} | <strong>ID:</strong> {milestone.id}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
