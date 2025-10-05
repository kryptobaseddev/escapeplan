<script lang="ts">
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
  import Modal from '$lib/components/ui/Modal.svelte';
  import LoadingButton from '$lib/components/ui/LoadingButton.svelte';
  import GameBasicInfoForm from './GameBasicInfoForm.svelte';
  import GameMediaSection from './GameMediaSection.svelte';
  import GamePuzzlesSection from './GamePuzzlesSection.svelte';
  import GameCamerasTab from './GameCamerasTab.svelte';
  import GameBookingTab from './GameBookingTab.svelte';
  import GameMilestonesTab from './GameMilestonesTab.svelte';
  import HintModal from './HintModal.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  type Mode = 'create' | 'edit';
  type TabId = 'basic' | 'media' | 'puzzles' | 'cameras' | 'booking' | 'milestones';

  let {
    open = $bindable(false),
    mode = 'create',
    action = '',
    game = null,
    onclose = undefined,
    onsuccess = undefined
  }: {
    open?: boolean;
    mode?: Mode;
    action?: string;
    game?: GameDetails | null;
    onclose?: (() => void) | undefined;
    onsuccess?: (() => void) | undefined;
  } = $props();

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
  let initialised = $state(false);
  let activeTab = $state<TabId>('basic');
  let workingGame = $state<EditableGame>(createEmptyGame());
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
    { id: 'booking', label: 'Booking' },
    { id: 'milestones', label: 'Milestones' }
  ];

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Factory functions
  function createEmptyGame(): EditableGame {
    return {
      slug: '',
      name: '',
      description: '',
      storyIntro: '',
      durationMinutes: 60,
      difficulty: 'Medium',
      gameType: 'storefront',
      categories: [],
      minPlayers: 1,
      maxPlayers: 8,
      resourcesRequired: 1,
      validationNotes: '',
      defaultVolume: 80,
      cameraIds: [],
      puzzles: [],
      milestones: [],
      media: { galleryAssetIds: [] },
      roomDisplayConfig: undefined,
      pricing: {
        tiers: [],
        deposit: { required: false },
        discounts: []
      },
      bookingRules: {
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

  function cloneGameDetails(details: GameDetails): EditableGame {
    return {
      slug: details.slug,
      name: details.name,
      description: details.description,
      storyIntro: details.storyIntro ?? '',
      durationMinutes: details.durationMinutes,
      difficulty: details.difficulty,
      gameType: details.gameType,
      categories: [...(details.categories ?? [])],
      minPlayers: details.minPlayers,
      maxPlayers: details.maxPlayers,
      resourcesRequired: details.resourcesRequired,
      validationNotes: details.validationNotes ?? '',
      defaultVolume: details.defaultVolume ?? 80,
      cameraIds: [...(details.cameraIds ?? [])],
      puzzles: details.puzzles.map((puzzle) => ({
        ...puzzle,
        hints: puzzle.hints ? puzzle.hints.map((hint) => ({ ...hint })) : []
      })),
      milestones: details.milestones ? details.milestones.map((milestone) => ({ ...milestone })) : [],
      media: details.media ? { ...details.media, galleryAssetIds: [...(details.media.galleryAssetIds ?? [])] } : { galleryAssetIds: [] },
      roomDisplayConfig: details.roomDisplayConfig ? { ...details.roomDisplayConfig } : undefined,
      pricing: details.pricing
        ? {
            tiers: details.pricing.tiers ? details.pricing.tiers.map((tier) => ({ ...tier, priceCents: tier.priceCents / 100 })) : [],
            deposit: details.pricing.deposit ? { ...details.pricing.deposit, amountCents: details.pricing.deposit.amountCents ? details.pricing.deposit.amountCents / 100 : null } : undefined,
            discounts: details.pricing.discounts ? details.pricing.discounts.map((discount) => ({ ...discount, amountOffCents: discount.amountOffCents ? discount.amountOffCents / 100 : null })) : []
          }
        : {
            tiers: [],
            deposit: { required: false },
            discounts: []
          },
      bookingRules: details.bookingRules
        ? {
            isMobile: details.bookingRules.isMobile ?? false,
            locationNotes: details.bookingRules.locationNotes ?? '',
            travelBufferMinutes: details.bookingRules.travelBufferMinutes ?? 0,
            equipmentChecklist: [...(details.bookingRules.equipmentChecklist ?? [])],
            reservationStyle: details.bookingRules.reservationStyle ?? 'public',
            cancellationPolicy: details.bookingRules.cancellationPolicy ?? '',
            customFields: details.bookingRules.customFields ? details.bookingRules.customFields.map((field) => ({ ...field })) : []
          }
        : {
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
      })) ?? [],
      mediaMeta: puzzle.mediaMeta || undefined
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
    // Duration validation removed - handled by backend against system settings
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
    payloadJson = JSON.stringify(buildPayload());
  }

  const markDirty = () => updatePayload();

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

  function resetState() {
    workingGame = createEmptyGame();
    activeTab = 'basic';
    errorMessage = null;
    payloadJson = JSON.stringify(buildPayload());
    slugTouched = false;
    draggingPuzzleId = null;
    draggingHint = null;
    submitting = false;
  }

  function close() {
    onclose?.();
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

    if (originalHint) {
      const index = puzzle.hints.findIndex(h => h.uuid === originalHint.uuid);
      if (index !== -1) {
        puzzle.hints[index] = savedHint as EditableHint;
      }
    } else {
      puzzle.hints = [...puzzle.hints, savedHint as EditableHint];
    }

    workingGame.puzzles = [...workingGame.puzzles];
    updatePayload();
    closeHintModal();
  }

  // Milestone upload handler
  async function handleMilestoneUpload(milestoneId: string, file: File) {
    const gameId = game?.id || (mode === 'edit' ? workingGame.slug : null);
    if (!gameId) {
      milestoneUploadErrors[milestoneId] = 'Game must be saved before uploading milestone media';
      return;
    }

    milestoneUploading[milestoneId] = true;
    milestoneUploadErrors[milestoneId] = null;

    try {
      const milestone = workingGame.milestones.find(m => m.id === milestoneId);
      if (!milestone) throw new Error('Milestone not found');

      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `/api/assets/upload?gameId=${encodeURIComponent(gameId)}&assetType=milestone_media&mediaType=${milestone.mediaType}&milestoneId=${milestoneId}`;

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
      errorMessage = null;
      submitting = false;
      onsuccess?.();
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

  // Effects
  $effect(() => {
    if (!open && initialised) {
      initialised = false;
      resetState();
    }
  });

  $effect(() => {
    if (open && !initialised) {
      workingGame = game ? cloneGameDetails(game) : createEmptyGame();
      errorMessage = null;
      activeTab = 'basic';
      initialised = true;
      payloadJson = JSON.stringify(buildPayload());
      slugTouched = mode === 'edit';
      draggingPuzzleId = null;
      draggingHint = null;

      if (mode === 'edit' && game) {
        fetchGameAssets();
      }
    }
  });

  $effect(() => {
    if (open && initialised) {
      updatePayload();
    }
  });
</script>

<Modal
  open={open}
  title={mode === 'create' ? 'Add game configuration' : `Edit ${game?.name ?? 'game'}`}
  description="Configure game metadata, media assets, puzzles, pricing, and booking rules."
  size="4xl"
  onClose={close}
>
  {#if errorMessage}
    <Alert type="error" class="mb-4 text-sm">
      <span>{errorMessage}</span>
    </Alert>
  {/if}

  <nav class="tabs tabs-boxed mb-6 overflow-x-auto">
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

  <form method="POST" action={action} class="space-y-6" use:enhance={handleSubmit}>
    {#if mode === 'edit'}
      <input type="hidden" name="id" value={game?.id} />
    {/if}
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
          bind:coverImageId={workingGame.media!.thumbnailAssetId}
          roomDisplayBackgroundId={workingGame.roomDisplayConfig?.backgroundAssetId}
          bind:galleryImageIds={workingGame.media!.galleryAssetIds}
          assetCache={assetCache}
          onCoverImageChange={(val) => { if (workingGame.media) workingGame.media.thumbnailAssetId = val; markDirty(); }}
          onRoomDisplayBackgroundChange={(val) => {
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
            markDirty();
          }}
          onGalleryImagesChange={(val) => { if (workingGame.media) workingGame.media.galleryAssetIds = val; markDirty(); }}
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
          gameId={game?.id || (mode === 'edit' ? workingGame.slug : undefined)}
          bind:milestones={workingGame.milestones}
          milestoneUploading={milestoneUploading}
          milestoneUploadErrors={milestoneUploadErrors}
          onMilestonesChange={(val) => { workingGame.milestones = val; markDirty(); }}
          onMilestoneUpload={handleMilestoneUpload}
        />
      {/if}
    </section>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
    <LoadingButton
      type="submit"
      variant="primary"
      loading={submitting}
      onclick={() => {
        const form = document.querySelector('form[method="POST"]') as HTMLFormElement;
        form?.requestSubmit();
      }}
    >
      {mode === 'create' ? 'Create Game' : 'Save Changes'}
    </LoadingButton>
  {/snippet}
</Modal>

{#if hintModalOpen && editingHint}
  <HintModal
    open={hintModalOpen}
    hint={editingHint.hint}
    gameId={game?.id || workingGame.slug}
    puzzleId={editingHint.puzzle.id}
    hintOrder={editingHint.hint?.order}
    gameDefaultVolume={workingGame.defaultVolume}
    onclose={closeHintModal}
    onsave={saveHintFromModal}
  />
{/if}
