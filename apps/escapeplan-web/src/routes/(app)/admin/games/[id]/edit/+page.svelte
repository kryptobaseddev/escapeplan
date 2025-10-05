<svelte:options runes={true} />

<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type {
    GameBookingRules,
    GameDetails,
    GameHintDefinition,
    GameMediaConfig,
    GameMilestone,
    GamePricingConfig,
    GamePuzzleDefinition,
    RoomDisplayConfig,
    SaveGameRequest
  } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';
  import { createFormHandler } from '$lib/utils/forms';
  import { slugify, uid } from '$lib/utils/game';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import GameBasicInfoForm from '$lib/components/games/GameBasicInfoForm.svelte';
  import GameMediaSection from '$lib/components/games/GameMediaSection.svelte';
  import GamePuzzlesSection from '$lib/components/games/GamePuzzlesSection.svelte';
  import GameCamerasTab from '$lib/components/games/GameCamerasTab.svelte';
  import GameRoomDisplayTab from '$lib/components/games/GameRoomDisplayTab.svelte';
  import GameBookingTab from '$lib/components/games/GameBookingTab.svelte';
  import GameMilestonesTab from '$lib/components/games/GameMilestonesTab.svelte';
  import HintModal from '$lib/components/games/HintModal.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type TabId = 'basic' | 'media' | 'puzzles' | 'cameras' | 'display' | 'booking' | 'milestones';

  interface EditableHint extends GameHintDefinition {
    // All fields inherited from GameHintDefinition
  }
  interface EditablePuzzle extends GamePuzzleDefinition {
    hints: EditableHint[];
  }
  interface EditableMilestone extends GameMilestone {}
  interface EditableGame extends Omit<SaveGameRequest, 'puzzles' | 'media' | 'pricing' | 'bookingRules' | 'milestones' | 'roomDisplayConfig'> {
    puzzles: EditablePuzzle[];
    media: GameMediaConfig;
    pricing: GamePricingConfig;
    bookingRules: GameBookingRules;
    milestones: EditableMilestone[];
    roomDisplayConfig?: RoomDisplayConfig;
  }

  // State
  let errorMessage = $state<string | null>(null);
  let activeTab = $state<TabId>('basic');
  let workingGame = $state<EditableGame>(initializeGameFromData());
  let payloadJson = $state('');
  let slugTouched = $state(false);
  let draggingPuzzleId = $state<string | null>(null);
  let draggingHint = $state<{ puzzleId: string; hintId: string } | null>(null);
  let submitting = $state(false);

  // Hint modal state
  let hintModalOpen = $state(false);
  let editingHint = $state<{ puzzle: EditablePuzzle; hint: EditableHint | null } | null>(null);

  // Milestone upload state
  let milestoneUploading = $state<Record<string, boolean>>({});
  let milestoneUploadErrors = $state<Record<string, string | null>>({});

  // Asset preview cache
  let assetCache = $state<Record<string, { url: string; filename: string }>>({});

  // Available cameras (placeholder - would come from parent or API)
  let availableCameras = $state<Array<{ id: string; name: string; location?: string }>>([]);

  const tabItems: Array<{ id: TabId; label: string }> = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'media', label: 'Media' },
    { id: 'puzzles', label: 'Puzzles' },
    { id: 'cameras', label: 'Cameras' },
    { id: 'display', label: 'Display' },
    { id: 'booking', label: 'Booking' },
    { id: 'milestones', label: 'Milestones' }
  ];

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Initialize game from loaded data
  function initializeGameFromData(): EditableGame {
    const game = data.game;
    return {
      slug: game.slug,
      name: game.name,
      description: game.description,
      storyIntro: game.storyIntro ?? '',
      durationMinutes: game.durationMinutes,
      difficulty: game.difficulty,
      gameType: game.gameType ?? 'storefront',
      categories: game.categories ?? [],
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      resourcesRequired: game.resourcesRequired ?? 1,
      validationNotes: game.validationNotes ?? '',
      defaultVolume: game.defaultVolume ?? 80,
      cameraIds: game.cameraIds ?? [],
      puzzles: (game.puzzles ?? []) as EditablePuzzle[],
      milestones: (game.milestones ?? []) as EditableMilestone[],
      media: game.media ?? { galleryAssetIds: [] },
      roomDisplayConfig: game.roomDisplayConfig,
      pricing: game.pricing ?? {
        tiers: [],
        deposit: { required: false },
        discounts: []
      },
      bookingRules: game.bookingRules ?? {
        isMobile: false,
        locationNotes: '',
        travelBufferMinutes: 0,
        equipmentChecklist: [],
        reservationStyle: 'public',
        cancellationPolicy: '',
        customFields: []
      }
    };
  }

  function createEmptyPuzzle(): EditablePuzzle {
    return {
      id: uid('puzzle'),
      title: '',
      description: '',
      solution: '',
      mediaAsset: '',
      operatorActions: '',
      displayOrder: (workingGame.puzzles.length ?? 0) + 1,
      hints: []
    } as EditablePuzzle;
  }

  // Asset fetching
  async function fetchAsset(assetId: string) {
    if (assetCache[assetId]) return;
    try {
      const response = await apiFetch<{ asset: { id: string; url: string; filename: string } }>(
        fetch,
        `/assets/${assetId}`,
        { credentials: 'include' }
      );
      assetCache[assetId] = { url: response.asset.url, filename: response.asset.filename };
    } catch (err) {
      console.error(`Failed to fetch asset ${assetId}:`, err);
    }
  }

  async function fetchGameAssets() {
    const assetIds: string[] = [];
    if (workingGame.media?.thumbnailAssetId) assetIds.push(workingGame.media.thumbnailAssetId);
    if (workingGame.media?.galleryAssetIds) assetIds.push(...workingGame.media.galleryAssetIds);
    if (workingGame.roomDisplayConfig?.backgroundAssetId) assetIds.push(workingGame.roomDisplayConfig.backgroundAssetId);
    await Promise.all(assetIds.map(fetchAsset));
  }

  // Payload building and validation
  function buildPayload(): SaveGameRequest {
    const cleanPuzzles = workingGame.puzzles.map((puzzle, index) => ({
      id: puzzle.id || uid('puzzle'),
      title: puzzle.title,
      description: puzzle.description || undefined,
      solution: puzzle.solution || undefined,
      mediaAsset: puzzle.mediaAsset || undefined,
      operatorActions: puzzle.operatorActions || undefined,
      displayOrder: puzzle.displayOrder ?? index + 1,
      hints: puzzle.hints?.map((hint, hintIndex) => ({
        uuid: hint.uuid || uid('hint'),
        type: hint.type,
        content: hint.content,
        assetUrl: hint.assetUrl || undefined,
        volumeLevel: hint.volumeLevel ?? 80,
        order: hint.order ?? hintIndex + 1,
        penaltySeconds: hint.penaltySeconds ?? 0,
        penaltyEnabled: hint.penaltyEnabled ?? false,
        countAsHint: hint.countAsHint ?? true,
        loop: false,
        autoDismiss: false
      })) ?? []
    }));

    const media: GameMediaConfig = {
      thumbnailAssetId: workingGame.media?.thumbnailAssetId || undefined,
      galleryAssetIds: workingGame.media?.galleryAssetIds?.filter(Boolean) ?? []
    };

    const pricing: GamePricingConfig = {
      tiers: workingGame.pricing?.tiers?.map((tier) => ({
        id: tier.id || uid('tier'),
        label: tier.label,
        model: tier.model || 'per_person',
        priceCents: Math.round((tier.priceCents ?? 0) * 100),
        baseHours: tier.baseHours,
        basePriceCents: tier.basePriceCents != null ? Math.round(tier.basePriceCents * 100) : undefined,
        additionalHourCents: tier.additionalHourCents != null ? Math.round(tier.additionalHourCents * 100) : undefined,
        minPlayers: tier.minPlayers,
        maxPlayers: tier.maxPlayers,
        displayOrder: tier.displayOrder ?? 1,
        active: tier.active ?? true
      })) ?? [],
      deposit: workingGame.pricing?.deposit
        ? {
            required: Boolean(workingGame.pricing.deposit.required),
            type: workingGame.pricing.deposit.type,
            amountCents: workingGame.pricing.deposit.amountCents != null ? Math.round(workingGame.pricing.deposit.amountCents * 100) : null
          }
        : undefined,
      discounts: workingGame.pricing?.discounts?.map((discount) => ({
        code: discount.code,
        percentOff: discount.percentOff ?? null,
        amountOffCents: discount.amountOffCents != null ? Math.round(discount.amountOffCents * 100) : null,
        expiresAt: discount.expiresAt ?? null,
        notes: discount.notes ?? null
      })) ?? []
    };

    const bookingRules: GameBookingRules = {
      isMobile: workingGame.bookingRules?.isMobile ?? false,
      locationNotes: workingGame.bookingRules?.locationNotes || undefined,
      travelBufferMinutes: workingGame.bookingRules?.travelBufferMinutes ?? 0,
      equipmentChecklist: workingGame.bookingRules?.equipmentChecklist?.filter(Boolean) ?? [],
      reservationStyle: workingGame.bookingRules?.reservationStyle ?? 'public',
      cancellationPolicy: workingGame.bookingRules?.cancellationPolicy || undefined,
      customFields:
        workingGame.bookingRules?.customFields?.map((field) => ({
          label: field.label,
          required: Boolean(field.required)
        })) ?? []
    };

    const cleanMilestones = workingGame.milestones.map((milestone, index) => ({
      ...(milestone.id ? { id: milestone.id } : {}),
      type: milestone.type,
      name: milestone.name.trim(),
      mediaType: milestone.mediaType || null,
      content: milestone.content?.trim() || null,
      assetId: milestone.assetId || null,
      volumeLevel: milestone.volumeLevel ?? 80,
      displayOrder: milestone.displayOrder ?? index + 1,
      triggerType: milestone.triggerType,
      triggerConfig: milestone.triggerConfig || null,
      enabled: milestone.enabled ?? true,
      loop: false,
      autoDismiss: false
    }));

    const roomDisplayConfig = workingGame.roomDisplayConfig
      ? ({
          backgroundType: workingGame.roomDisplayConfig.backgroundType ?? 'solid',
          backgroundAssetId: workingGame.roomDisplayConfig.backgroundAssetId,
          backgroundColor: workingGame.roomDisplayConfig.backgroundColor,
          gradientFrom: workingGame.roomDisplayConfig.gradientFrom,
          gradientTo: workingGame.roomDisplayConfig.gradientTo,
          gradientDirection: workingGame.roomDisplayConfig.gradientDirection ?? 'to-b',
          backgroundOpacity: workingGame.roomDisplayConfig.backgroundOpacity ?? 40,
          defaultMediaScale: workingGame.roomDisplayConfig.defaultMediaScale ?? 90,
          showTimer: workingGame.roomDisplayConfig.showTimer ?? true,
          timerPosition: workingGame.roomDisplayConfig.timerPosition ?? 'center',
          textHintTextColor: workingGame.roomDisplayConfig.textHintTextColor ?? '#000000',
          textHintBackgroundColor: workingGame.roomDisplayConfig.textHintBackgroundColor ?? '#FFA500'
        } as RoomDisplayConfig)
      : undefined;

    const payload: SaveGameRequest = {
      slug: workingGame.slug.trim(),
      name: workingGame.name.trim(),
      description: workingGame.description.trim(),
      storyIntro: workingGame.storyIntro?.trim() || undefined,
      durationMinutes: Number(workingGame.durationMinutes) || 60,
      difficulty: workingGame.difficulty.trim() || 'Medium',
      gameType: workingGame.gameType ?? 'storefront',
      categories: workingGame.categories.map((category) => category.trim()).filter(Boolean),
      minPlayers: Number(workingGame.minPlayers) || 1,
      maxPlayers: Number(workingGame.maxPlayers) || 1,
      resourcesRequired: Number(workingGame.resourcesRequired) || 1,
      validationNotes: workingGame.validationNotes?.trim() || undefined,
      defaultVolume: workingGame.defaultVolume ?? 80,
      cameraIds: workingGame.cameraIds ?? [],
      puzzles: cleanPuzzles,
      milestones: cleanMilestones,
      media,
      roomDisplayConfig,
      pricing,
      bookingRules
    };

    return payload;
  }

  function validateGame(): string | null {
    if (!workingGame.name.trim()) {
      return 'Game name is required.';
    }
    if (!workingGame.slug.trim() || !slugPattern.test(workingGame.slug.trim())) {
      return 'Slug must contain lowercase letters, numbers, and hyphens only.';
    }
    if (!workingGame.description.trim() || workingGame.description.trim().length < 10) {
      return 'Description must be at least 10 characters.';
    }

    // Get min/max duration from system settings with fallback to hardcoded values
    const minDuration = data.systemSettings?.business?.find((s: any) => s.key === 'business.game_duration_min_minutes')?.value ?? 30;
    const maxDuration = data.systemSettings?.business?.find((s: any) => s.key === 'business.game_duration_max_minutes')?.value ?? 240;

    if (workingGame.durationMinutes < minDuration || workingGame.durationMinutes > maxDuration) {
      return `Duration must be between ${minDuration} and ${maxDuration} minutes.`;
    }
    if (workingGame.maxPlayers < 1 || workingGame.maxPlayers > 20) {
      return 'Maximum players must be between 1 and 20.';
    }
    if (workingGame.minPlayers < 1 || workingGame.minPlayers > workingGame.maxPlayers) {
      return 'Minimum players cannot exceed the maximum player count.';
    }
    return null;
  }

  // Event handlers
  function updatePayload() {
    const payload = buildPayload();
    console.log('[updatePayload] Built payload:', {
      media: payload.media,
      roomDisplayConfig: payload.roomDisplayConfig
    });
    payloadJson = JSON.stringify(payload);
  }

  const markDirty = () => {
    console.log('[markDirty] Called');
    updatePayload();
  };

  function handleNameChange(name: string) {
    workingGame.name = name;
    if (!slugTouched) {
      const generated = slugify(name);
      if (generated && workingGame.slug !== generated) {
        workingGame.slug = generated;
      }
    }
    markDirty();
  }

  function handleSlugChange(slug: string) {
    workingGame.slug = slug;
    markDirty();
  }

  function handleSlugTouched() {
    slugTouched = true;
  }

  function handleCancel() {
    goto('/admin/games');
  }

  // Puzzle handlers
  function addPuzzle() {
    workingGame.puzzles = [...workingGame.puzzles, createEmptyPuzzle()];
    updatePayload();
  }

  function removePuzzle(id: string) {
    workingGame.puzzles = workingGame.puzzles.filter((puzzle) => puzzle.id !== id);
    updatePayload();
  }

  // Hint modal handlers
  function openHintModal(puzzle: EditablePuzzle, hint: GameHintDefinition | null = null) {
    editingHint = { puzzle, hint: hint as EditableHint | null };
    hintModalOpen = true;
  }

  function closeHintModal() {
    hintModalOpen = false;
    editingHint = null;
  }

  function saveHintFromModal(savedHint: GameHintDefinition) {
    if (!editingHint) return;

    const { puzzle, hint: originalHint } = editingHint;

    // Find the puzzle in workingGame.puzzles and update its hints
    const puzzleIndex = workingGame.puzzles.findIndex(p => p.id === puzzle.id);
    if (puzzleIndex === -1) return;

    const targetPuzzle = workingGame.puzzles[puzzleIndex];

    // Ensure hints array exists
    if (!targetPuzzle.hints || !Array.isArray(targetPuzzle.hints)) {
      targetPuzzle.hints = [];
    }

    if (originalHint) {
      // Update existing hint
      const hintIndex = targetPuzzle.hints.findIndex(h => h.uuid === originalHint.uuid);
      if (hintIndex !== -1) {
        targetPuzzle.hints[hintIndex] = savedHint as EditableHint;
      }
    } else {
      // Add new hint
      targetPuzzle.hints = [...targetPuzzle.hints, savedHint as EditableHint];
    }

    // Trigger reactivity by creating a new array
    workingGame.puzzles = [...workingGame.puzzles];
    updatePayload();
    closeHintModal();
  }

  // Milestone upload handler
  async function handleMilestoneUpload(milestoneId: string, file: File) {
    milestoneUploading[milestoneId] = true;
    milestoneUploadErrors[milestoneId] = null;

    try {
      const milestone = workingGame.milestones.find(m => m.id === milestoneId);
      if (!milestone) throw new Error('Milestone not found');

      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `/api/assets/upload?gameId=${encodeURIComponent(workingGame.slug)}&assetType=milestone_media&mediaType=${milestone.mediaType}&milestoneId=${milestoneId}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      milestone.assetId = result.asset.id;
      milestoneUploadErrors[milestoneId] = null;
      updatePayload();
    } catch (error) {
      console.error('Milestone asset upload failed:', error);
      milestoneUploadErrors[milestoneId] = error instanceof Error ? error.message : 'Failed to upload file';
    } finally {
      milestoneUploading[milestoneId] = false;
    }
  }

  // Form submission
  const handleSubmit = createFormHandler({
    onSubmit: () => {
      const validationError = validateGame();
      if (validationError) {
        errorMessage = validationError;
        throw new Error(validationError); // Prevent submission
      }
      errorMessage = null;
      submitting = true;
      updatePayload();
    },
    onSuccess: async () => {
      // Redirect handled by server-side action
    },
    onError: (result) => {
      const failureData = result.data as { message?: string } | undefined;
      errorMessage = failureData?.message ?? 'Request failed. Please review your input.';
      submitting = false;
    },
    onFinally: () => {
      submitting = false;
    }
  });

  // Initialize payload
  $effect(() => {
    updatePayload();
  });
</script>

<div class="flex flex-col h-screen">
  <!-- Header with tabs -->
  <header class="sticky top-0 z-10 bg-base-100 border-b border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-base-content">Edit Game Configuration</h1>
          <p class="text-sm text-base-content/60">Update game metadata, media assets, puzzles, pricing, and booking rules.</p>
        </div>
      </div>

      {#if errorMessage}
        <Alert type="error" class="mb-4">{errorMessage}</Alert>
      {/if}

      <nav class="tabs tabs-boxed overflow-x-auto">
        {#each tabItems as tab}
          <button
            type="button"
            class={`tab whitespace-nowrap ${activeTab === tab.id ? 'tab-active' : ''}`}
            onclick={() => activeTab = tab.id}
          >
            {tab.label}
          </button>
        {/each}
      </nav>
    </div>
  </header>

  <!-- Scrollable content area -->
  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto px-4 py-6">
      <form method="POST" class="space-y-6" use:enhance={handleSubmit}>
        <input type="hidden" name="payload" value={payloadJson} />

        <section class="space-y-6">
          {#if activeTab === 'basic'}
            <GameBasicInfoForm
              bind:name={workingGame.name}
              bind:slug={workingGame.slug}
              bind:description={workingGame.description}
              bind:story={workingGame.storyIntro}
              bind:durationMinutes={workingGame.durationMinutes}
              bind:difficulty={workingGame.difficulty}
              bind:maxPlayers={workingGame.maxPlayers}
              bind:categories={workingGame.categories}
              bind:slugTouched={slugTouched}
              minDurationMinutes={data.systemSettings?.business?.find((s: any) => s.key === 'business.game_duration_min_minutes')?.value ?? 30}
              maxDurationMinutes={data.systemSettings?.business?.find((s: any) => s.key === 'business.game_duration_max_minutes')?.value ?? 240}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onDescriptionChange={(val) => { workingGame.description = val; markDirty(); }}
              onStoryChange={(val) => { workingGame.storyIntro = val; markDirty(); }}
              onDurationChange={(val) => { workingGame.durationMinutes = val; markDirty(); }}
              onDifficultyChange={(val) => { workingGame.difficulty = val; markDirty(); }}
              onMaxPlayersChange={(val) => { workingGame.maxPlayers = val; markDirty(); }}
              onCategoriesChange={(val) => { workingGame.categories = val; markDirty(); }}
              onSlugTouched={handleSlugTouched}
            />
          {:else if activeTab === 'media'}
            <GameMediaSection
              gameSlug={workingGame.slug}
              coverImageId={workingGame.media!.thumbnailAssetId}
              roomDisplayBackgroundId={workingGame.roomDisplayConfig?.backgroundAssetId}
              galleryImageIds={workingGame.media!.galleryAssetIds}
              assetCache={assetCache}
              onCoverImageChange={(val) => {
                console.log('[Media] onCoverImageChange called with:', val);
                if (workingGame.media) workingGame.media.thumbnailAssetId = val;
                console.log('[Media] Updated thumbnailAssetId to:', workingGame.media?.thumbnailAssetId);
                markDirty();
              }}
              onRoomDisplayBackgroundChange={(val) => {
                console.log('[Media] onRoomDisplayBackgroundChange called with:', val);
                const config = workingGame.roomDisplayConfig ??= {
                  backgroundType: 'asset',
                  backgroundOpacity: 40,
                  defaultMediaScale: 90,
                  showTimer: true,
                  timerPosition: 'center',
                  gradientDirection: 'to-b',
                  textHintTextColor: '#000000',
                  textHintBackgroundColor: '#FFA500',
                  timerTextColor: '#FFFFFF',
                  timerBackgroundColor: '#000000',
                  timerOpacity: 80
                } satisfies RoomDisplayConfig;

                config.backgroundAssetId = val;
                config.backgroundType = val ? 'asset' : 'solid';
                console.log('[Media] Updated roomDisplayConfig:', workingGame.roomDisplayConfig);
                markDirty();
              }}
              onGalleryImagesChange={(val) => {
                console.log('[Media] onGalleryImagesChange called with:', val);
                if (workingGame.media) workingGame.media.galleryAssetIds = val;
                console.log('[Media] Updated galleryAssetIds to:', workingGame.media?.galleryAssetIds);
                markDirty();
              }}
              onAssetCacheUpdate={(assetId, asset) => { assetCache[assetId] = asset; }}
            />
          {:else if activeTab === 'puzzles'}
            <GamePuzzlesSection
              bind:puzzles={workingGame.puzzles as any}
              bind:draggingPuzzleId={draggingPuzzleId}
              bind:draggingHint={draggingHint}
              onPuzzlesChange={(val) => { workingGame.puzzles = val as any; markDirty(); }}
              onDraggingPuzzleIdChange={(val) => { draggingPuzzleId = val; }}
              onDraggingHintChange={(val) => { draggingHint = val; }}
              onOpenHintModal={openHintModal as any}
              onAddPuzzle={addPuzzle}
              onRemovePuzzle={removePuzzle}
              onMarkDirty={markDirty}
            />
          {:else if activeTab === 'cameras'}
            <GameCamerasTab
              availableCameras={availableCameras}
              bind:assignedCameraIds={workingGame.cameraIds}
              onCamerasChange={(val) => { workingGame.cameraIds = val; markDirty(); }}
            />
          {:else if activeTab === 'display'}
            <GameRoomDisplayTab
              bind:roomDisplayConfig={workingGame.roomDisplayConfig}
              gameSlug={workingGame.slug}
              onConfigChange={(config: RoomDisplayConfig | undefined) => { workingGame.roomDisplayConfig = config; markDirty(); }}
              onMarkDirty={markDirty}
            />
          {:else if activeTab === 'booking'}
            <GameBookingTab
              bind:pricing={workingGame.pricing}
              bind:bookingRules={workingGame.bookingRules}
              isMobile={workingGame.bookingRules?.isMobile ?? false}
              onPricingChange={(val) => { workingGame.pricing = val; markDirty(); }}
              onBookingRulesChange={(val) => { workingGame.bookingRules = val; markDirty(); }}
            />
          {:else if activeTab === 'milestones'}
            <GameMilestonesTab
              gameId={workingGame.slug}
              bind:milestones={workingGame.milestones}
              milestoneUploading={milestoneUploading}
              milestoneUploadErrors={milestoneUploadErrors}
              onMilestonesChange={(val) => { workingGame.milestones = val; markDirty(); }}
              onMilestoneUpload={handleMilestoneUpload}
            />
          {/if}
        </section>
      </form>
    </div>
  </main>

  <!-- Fixed footer with Cancel/Save -->
  <footer class="sticky bottom-0 z-10 bg-base-100 border-t border-white/10">
    <div class="container mx-auto px-4 py-4">
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-ghost" onclick={handleCancel}>Cancel</button>
        <LoadingButton
          type="submit"
          variant="primary"
          loading={submitting}
          onclick={() => {
            const form = document.querySelector('form[method="POST"]') as HTMLFormElement;
            form?.requestSubmit();
          }}
        >
          Save Changes
        </LoadingButton>
      </div>
    </div>
  </footer>
</div>

{#if hintModalOpen && editingHint}
  <HintModal
    open={hintModalOpen}
    hint={editingHint.hint}
    gameId={workingGame.slug}
    puzzleId={editingHint.puzzle.id}
    hintOrder={editingHint.hint?.order}
    gameDefaultVolume={workingGame.defaultVolume}
    onclose={closeHintModal}
    onsave={saveHintFromModal}
  />
{/if}
