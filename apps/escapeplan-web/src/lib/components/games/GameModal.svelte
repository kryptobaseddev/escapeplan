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
    GameRoomDefinition,
    MilestoneMediaType,
    MilestoneTriggerType,
    MilestoneType,
    SaveGameRequest
  } from '@escapeplan/contracts';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { apiFetch } from '$lib/api/client';
  import HintModal from './HintModal.svelte';
  import AssetUpload from '../assets/AssetUpload.svelte';
  import AssetBrowser from '../assets/AssetBrowser.svelte';
  import HelpTooltip from '../ui/HelpTooltip.svelte';

  type Mode = 'create' | 'edit';

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

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let errorMessage = $state<string | null>(null);
  let initialised = $state(false);
  type TabId = 'details' | 'media' | 'rooms' | 'puzzles' | 'cameras' | 'pricing' | 'booking' | 'milestones';

  let activeTab = $state<TabId>('details');

  interface EditableHint extends GameHintDefinition {}
  interface EditablePuzzle extends GamePuzzleDefinition {
    hints: EditableHint[];
  }
  interface EditableRoom extends GameRoomDefinition {}
  interface EditableMilestone extends GameMilestone {}
  interface EditableGame extends Omit<SaveGameRequest, 'rooms' | 'puzzles' | 'media' | 'pricing' | 'bookingRules' | 'milestones'> {
    rooms: EditableRoom[];
    puzzles: EditablePuzzle[];
    media: GameMediaConfig;
    pricing: GamePricingConfig;
    bookingRules: GameBookingRules;
    milestones: EditableMilestone[];
  }


  let workingGame = $state<EditableGame>(createEmptyGame());
  let payloadJson = $state('');
  let slugTouched = $state(false);
  let draggingRoomId = $state<string | null>(null);
  let draggingPuzzleId = $state<string | null>(null);
  let draggingHint = $state<{ puzzleId: string; hintId: string } | null>(null);

  // Hint modal state
  let hintModalOpen = $state(false);
  let editingHint = $state<{ puzzle: EditablePuzzle; hint: EditableHint | null } | null>(null);
  let activeHintTab = $state<Record<string, 'text' | 'image' | 'audio' | 'video'>>({});

  // Milestone upload state
  let milestoneFileInputs = $state<Record<string, HTMLInputElement | null>>({});
  let milestoneUploading = $state<Record<string, boolean>>({});
  let milestoneUploadErrors = $state<Record<string, string | null>>({});

  // Asset preview cache - maps asset IDs to asset objects for immediate preview
  let assetCache = $state<Record<string, { url: string; filename: string }>>({});

  const tabItems: Array<{ id: TabId; label: string }> = [
    { id: 'details', label: 'Game Details' },
    { id: 'media', label: 'Images & Media' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'puzzles', label: 'Puzzles & Hints' },
    { id: 'cameras', label: 'Cameras' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'booking', label: 'Booking Rules' },
    { id: 'milestones', label: 'Milestones' }
  ];

  const difficultyOptions = [
    { value: 'Beginner', label: 'Beginner', stars: 1, helper: 'Great for first-timers' },
    { value: 'Easy', label: 'Easy', stars: 2, helper: 'Light puzzling, story forward' },
    { value: 'Medium', label: 'Medium', stars: 3, helper: 'Balanced challenge' },
    { value: 'Hard', label: 'Hard', stars: 4, helper: 'Experienced teams recommended' },
    { value: 'Expert', label: 'Expert', stars: 5, helper: 'Designed for veterans' }
  ] as const;

  type DifficultyOption = (typeof difficultyOptions)[number];
  type BookingCustomField = { label: string; required: boolean };

  // Derived: compute selectedDifficulty from workingGame.difficulty
  const selectedDifficulty = $derived(
    difficultyOptions.find((option) => option.value === workingGame.difficulty) ?? difficultyOptions[2]
  );

  // Derived: compute bookingCustomFields from workingGame.bookingRules
  const bookingCustomFields = $derived.by(() => {
    const current = workingGame.bookingRules.customFields;
    if (!current) {
      return [];
    }
    return current as BookingCustomField[];
  });

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function uid(prefix: string) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

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
      rooms: [],
      puzzles: [],
      milestones: [],
      media: { galleryAssetIds: [] },
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
      rooms: details.rooms.map((room) => ({ ...room })),
      puzzles: details.puzzles.map((puzzle) => ({
        ...puzzle,
        hints: puzzle.hints ? puzzle.hints.map((hint) => ({ ...hint })) : []
      })),
      milestones: details.milestones ? details.milestones.map((milestone) => ({ ...milestone })) : [],
      media: details.media ? { ...details.media, galleryAssetIds: [...(details.media.galleryAssetIds ?? [])] } : { galleryAssetIds: [] },
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

  function createEmptyRoom(): EditableRoom {
    return {
      id: uid('room'),
      name: '',
      description: '',
      slug: '',
      isMobileCapable: false,
      themeToken: '',
      capacity: undefined
    };
  }

  function createEmptyHint(): EditableHint {
    return {
      uuid: uid('hint'),
      type: 'text',
      content: '',
      order: 1
    } as EditableHint;
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

  function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return [...items];
    }
    const clone = [...items];
    const [removed] = clone.splice(from, 1);
    clone.splice(to, 0, removed);
    return clone;
  }

  function applyPuzzleOrder() {
    workingGame.puzzles = workingGame.puzzles.map((puzzle, index) => ({
      ...puzzle,
      displayOrder: index + 1
    }));
  }

  function applyHintOrder(puzzle: EditablePuzzle) {
    puzzle.hints = puzzle.hints.map((hint, index) => ({
      ...hint,
      order: index + 1
    }));
    workingGame.puzzles = [...workingGame.puzzles]; // trigger Svelte reactivity
  }

  function createEmptyMilestone(): EditableMilestone {
    return {
      id: uid('milestone'),
      gameId: '', // Will be set on save
      type: 'intro',
      name: 'Intro', // Default to Intro
      mediaType: null,
      content: null,
      assetId: null,
      volumeLevel: workingGame.defaultVolume || 80,
      displayOrder: (workingGame.milestones.length ?? 0) + 1,
      triggerType: 'manual',
      triggerConfig: null,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function addMilestone() {
    workingGame.milestones = [...workingGame.milestones, createEmptyMilestone()];
    applyMilestoneOrder();
    updatePayload();
  }

  function deleteMilestone(index: number) {
    workingGame.milestones = workingGame.milestones.filter((_, i) => i !== index);
    applyMilestoneOrder();
    updatePayload();
  }

  function moveMilestone(from: number, to: number) {
    workingGame.milestones = moveItem(workingGame.milestones, from, to);
    applyMilestoneOrder();
    updatePayload();
  }

  function applyMilestoneOrder() {
    workingGame.milestones = workingGame.milestones.map((milestone, index) => ({
      ...milestone,
      displayOrder: index + 1
    }));
  }

  async function handleMilestoneFileUpload(milestone: EditableMilestone, event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Need a saved game to upload assets
    const gameId = game?.id || (mode === 'edit' ? workingGame.slug : null);
    if (!gameId) {
      milestoneUploadErrors[milestone.id] = 'Game must be saved before uploading milestone media';
      return;
    }

    milestoneUploading[milestone.id] = true;
    milestoneUploadErrors[milestone.id] = null;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `/api/assets/upload?gameId=${encodeURIComponent(gameId)}&assetType=milestone_media&mediaType=${milestone.mediaType}&milestoneId=${milestone.id}`;

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
      milestoneUploadErrors[milestone.id] = null;
      updatePayload();
    } catch (error) {
      console.error('Milestone asset upload failed:', error);
      milestoneUploadErrors[milestone.id] = error instanceof Error ? error.message : 'Failed to upload file';
      milestone.assetId = null;
    } finally {
      milestoneUploading[milestone.id] = false;
    }
  }

  function resetState() {
    workingGame = createEmptyGame();
    activeTab = 'details';
    errorMessage = null;
    payloadJson = JSON.stringify(buildPayload());
    slugTouched = false;
    draggingRoomId = null;
    draggingPuzzleId = null;
    draggingHint = null;
  }

  function close() {
    onclose?.();
  }

  // Fetch asset details by ID
  async function fetchAsset(assetId: string) {
    if (assetCache[assetId]) return; // Already cached
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

  // Fetch all assets referenced in the game
  async function fetchGameAssets() {
    const assetIds: string[] = [];

    // Collect all asset IDs from media config
    if (workingGame.media.thumbnailAssetId) assetIds.push(workingGame.media.thumbnailAssetId);
    if (workingGame.media.roomScreenAssetId) assetIds.push(workingGame.media.roomScreenAssetId);
    if (workingGame.media.galleryAssetIds) assetIds.push(...workingGame.media.galleryAssetIds);

    // Fetch all assets in parallel
    await Promise.all(assetIds.map(fetchAsset));
  }

  // Effect to handle modal close
  $effect(() => {
    if (!open && initialised) {
      initialised = false;
      resetState();
    }
  });

  // Effect to handle modal open
  $effect(() => {
    if (open && !initialised) {
      workingGame = game ? cloneGameDetails(game) : createEmptyGame();
      errorMessage = null;
      activeTab = 'details';
      initialised = true;
      payloadJson = JSON.stringify(buildPayload());
      slugTouched = mode === 'edit';
      draggingRoomId = null;
      draggingPuzzleId = null;
      draggingHint = null;

      // Fetch assets if editing existing game
      if (mode === 'edit' && game) {
        fetchGameAssets();
      }
    }
  });

  function addCategory(category: string) {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (!workingGame.categories.includes(trimmed)) {
      workingGame = { ...workingGame, categories: [...workingGame.categories, trimmed] };
      updatePayload();
    }
  }

  function removeCategory(category: string) {
    workingGame = {
      ...workingGame,
      categories: workingGame.categories.filter((entry) => entry !== category)
    };
    updatePayload();
  }

  function handleNameInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    if (!slugTouched) {
      const generated = slugify(target.value);
      if (generated && workingGame.slug !== generated) {
        workingGame.slug = generated;
      }
    }
    markDirty();
  }

  function handleSlugInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    slugTouched = true;
    const sanitized = slugify(target.value);
    if (target.value !== sanitized) {
      target.value = sanitized;
    }
    workingGame.slug = sanitized;
    markDirty();
  }

  function setDifficulty(value: (typeof difficultyOptions)[number]['value']) {
    if (workingGame.difficulty !== value) {
      workingGame.difficulty = value;
      markDirty();
    }
  }

  function addRoom() {
    workingGame.rooms = [...workingGame.rooms, createEmptyRoom()];
    updatePayload();
  }

  function removeRoom(id: string) {
    workingGame.rooms = workingGame.rooms.filter((room) => room.id !== id);
    updatePayload();
  }

  function addPuzzle() {
    workingGame.puzzles = [...workingGame.puzzles, createEmptyPuzzle()];
    updatePayload();
  }

  function removePuzzle(id: string) {
    workingGame.puzzles = workingGame.puzzles.filter((puzzle) => puzzle.id !== id);
    applyPuzzleOrder();
    updatePayload();
  }

  function handleRoomDragStart(id: string, event: DragEvent) {
    draggingRoomId = id;
    event.dataTransfer?.setData('text/plain', id);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 20, 20);
  }

  function handleRoomDragOver(id: string, event: DragEvent) {
    event.preventDefault();
    if (!draggingRoomId || draggingRoomId === id) return;
    const from = workingGame.rooms.findIndex((room) => room.id === draggingRoomId);
    const to = workingGame.rooms.findIndex((room) => room.id === id);
    if (from === -1 || to === -1) return;
    workingGame.rooms = moveItem(workingGame.rooms, from, to);
    updatePayload();
  }

  function handleRoomDrop(event: DragEvent) {
    event.preventDefault();
    draggingRoomId = null;
  }

  function handleRoomListDrop(event: DragEvent) {
    if (!draggingRoomId) return;
    const from = workingGame.rooms.findIndex((room) => room.id === draggingRoomId);
    if (from === -1) return;
    event.preventDefault();
    workingGame.rooms = moveItem(workingGame.rooms, from, workingGame.rooms.length - 1);
    updatePayload();
    draggingRoomId = null;
  }

  function handlePuzzleDragStart(id: string, event: DragEvent) {
    draggingPuzzleId = id;
    event.dataTransfer?.setData('text/plain', id);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 20, 20);
  }

  function handlePuzzleDragOver(id: string, event: DragEvent) {
    event.preventDefault();
    if (!draggingPuzzleId || draggingPuzzleId === id) return;
    const from = workingGame.puzzles.findIndex((puzzle) => puzzle.id === draggingPuzzleId);
    const to = workingGame.puzzles.findIndex((puzzle) => puzzle.id === id);
    if (from === -1 || to === -1) return;
    workingGame.puzzles = moveItem(workingGame.puzzles, from, to);
    applyPuzzleOrder();
    updatePayload();
  }

  function handlePuzzleDrop(event: DragEvent) {
    event.preventDefault();
    draggingPuzzleId = null;
  }

  function handlePuzzleListDrop(event: DragEvent) {
    if (!draggingPuzzleId) return;
    const from = workingGame.puzzles.findIndex((puzzle) => puzzle.id === draggingPuzzleId);
    if (from === -1) return;
    event.preventDefault();
    workingGame.puzzles = moveItem(workingGame.puzzles, from, workingGame.puzzles.length - 1);
    applyPuzzleOrder();
    updatePayload();
    draggingPuzzleId = null;
  }

  function handleHintDragStart(puzzleId: string, hintId: string, event: DragEvent) {
    draggingHint = { puzzleId, hintId };
    event.dataTransfer?.setData('text/plain', `${puzzleId}:${hintId}`);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 20, 20);
  }

  function handleHintDragOver(puzzle: EditablePuzzle, overHintId: string, event: DragEvent) {
    event.preventDefault();
    if (!draggingHint || draggingHint.puzzleId !== puzzle.id) return;
    if (draggingHint.hintId === overHintId) return;
    const hints = puzzle.hints;
    const from = hints.findIndex((hint) => hint.uuid === draggingHint?.hintId);
    const to = hints.findIndex((hint) => hint.uuid === overHintId);
    if (from === -1 || to === -1) return;
    puzzle.hints = moveItem(hints, from, to);
    applyHintOrder(puzzle);
    updatePayload();
  }

  function handleHintListDrop(puzzle: EditablePuzzle, event: DragEvent) {
    if (!draggingHint || draggingHint.puzzleId !== puzzle.id) return;
    const hints = puzzle.hints;
    const from = hints.findIndex((hint) => hint.uuid === draggingHint?.hintId);
    if (from === -1) return;
    event.preventDefault();
    puzzle.hints = moveItem(hints, from, hints.length - 1);
    applyHintOrder(puzzle);
    updatePayload();
    draggingHint = null;
  }

  function handleHintDrop(event: DragEvent) {
    event.preventDefault();
    draggingHint = null;
  }

  function addHint(puzzle: EditablePuzzle) {
    puzzle.hints = [...puzzle.hints, { ...createEmptyHint(), order: puzzle.hints.length + 1 }];
    workingGame.puzzles = [...workingGame.puzzles]; // trigger Svelte reactivity
    updatePayload();
  }

  function removeHint(puzzle: EditablePuzzle, hintId: string) {
    puzzle.hints = puzzle.hints.filter((hint) => hint.uuid !== hintId);
    applyHintOrder(puzzle);
    workingGame.puzzles = [...workingGame.puzzles]; // trigger Svelte reactivity
    updatePayload();
  }

  // Hint modal functions
  function openHintModal(puzzle: EditablePuzzle, hint: EditableHint | null = null) {
    editingHint = { puzzle, hint };
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
      // Editing existing hint
      const index = puzzle.hints.findIndex(h => h.uuid === originalHint.uuid);
      if (index !== -1) {
        puzzle.hints[index] = savedHint as EditableHint;
      }
    } else {
      // Adding new hint
      puzzle.hints = [...puzzle.hints, savedHint as EditableHint];
    }

    applyHintOrder(puzzle);
    workingGame.puzzles = [...workingGame.puzzles];
    updatePayload();
    closeHintModal();
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

  function updatePayload() {
    payloadJson = JSON.stringify(buildPayload());
  }

  const markDirty = () => updatePayload();

  function buildPayload(): SaveGameRequest {
    const cleanRooms = workingGame.rooms.map((room, index) => ({
      id: room.id || uid('room'),
      name: room.name,
      description: room.description || undefined,
      slug: room.slug ? room.slug : undefined,
      isMobileCapable: Boolean(room.isMobileCapable),
      themeToken: room.themeToken || undefined,
      capacity: room.capacity ?? undefined
    }));

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
        order: hint.order ?? hintIndex + 1
      })) ?? []
    }));

    const media: GameMediaConfig | undefined = workingGame.media
      ? {
          thumbnailAssetId: workingGame.media.thumbnailAssetId || undefined,
          roomScreenAssetId: workingGame.media.roomScreenAssetId || undefined,
          galleryAssetIds: workingGame.media.galleryAssetIds?.filter(Boolean) ?? []
        }
      : undefined;

    const pricing: GamePricingConfig | undefined = workingGame.pricing
      ? {
          tiers: workingGame.pricing.tiers?.map((tier) => ({
            ...tier,
            id: tier.id || uid('tier'),
            priceCents: Math.round((tier.priceCents ?? 0) * 100),
            basePriceCents: tier.basePriceCents ? Math.round(tier.basePriceCents * 100) : undefined,
            additionalHourCents: tier.additionalHourCents ? Math.round(tier.additionalHourCents * 100) : undefined
          })) ?? [],
          deposit: workingGame.pricing.deposit
            ? {
                required: Boolean(workingGame.pricing.deposit.required),
                type: workingGame.pricing.deposit.type,
                amountCents: workingGame.pricing.deposit.amountCents ? Math.round(workingGame.pricing.deposit.amountCents * 100) : null
              }
            : undefined,
          discounts: workingGame.pricing.discounts?.map((discount) => ({
            code: discount.code,
            percentOff: discount.percentOff ?? null,
            amountOffCents: discount.amountOffCents ? Math.round(discount.amountOffCents * 100) : null,
            expiresAt: discount.expiresAt ?? null,
            notes: discount.notes ?? null
          })) ?? []
        }
      : undefined;

    const bookingRules: GameBookingRules | undefined = workingGame.bookingRules
      ? {
          isMobile: workingGame.bookingRules.isMobile ?? false,
          locationNotes: workingGame.bookingRules.locationNotes || undefined,
          travelBufferMinutes: workingGame.bookingRules.travelBufferMinutes ?? 0,
          equipmentChecklist: workingGame.bookingRules.equipmentChecklist?.filter(Boolean) ?? [],
          reservationStyle: workingGame.bookingRules.reservationStyle ?? 'public',
          cancellationPolicy: workingGame.bookingRules.cancellationPolicy || undefined,
          customFields:
            workingGame.bookingRules.customFields?.map((field) => ({
              label: field.label,
              required: Boolean(field.required)
            })) ?? []
        }
      : undefined;

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
      enabled: milestone.enabled ?? true
    }));

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
      rooms: cleanRooms,
      puzzles: cleanPuzzles,
      milestones: cleanMilestones,
      media,
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
    if (workingGame.minPlayers < 1 || workingGame.minPlayers > workingGame.maxPlayers) {
      return 'Minimum players cannot exceed the maximum player count.';
    }
    if (workingGame.rooms.length === 0) {
      return 'Add at least one room before saving.';
    }
    if (workingGame.puzzles.length === 0) {
      return 'Add at least one puzzle before saving.';
    }
    if ((workingGame.pricing.tiers?.length ?? 0) === 0) {
      return 'Add at least one pricing tier.';
    }
    return null;
  }

  const handleSubmit: SubmitFunction = ({ cancel }) => {
    const validationError = validateGame();
    if (validationError) {
      errorMessage = validationError;
      cancel();
      return;
    }
    errorMessage = null;
    updatePayload();

    return async ({ result, update }) => {
      if (result.type === 'failure') {
        const failureData = result.data as { message?: string } | undefined;
        errorMessage = failureData?.message ?? 'Request failed. Please review your input.';
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        errorMessage = null;
        onsuccess?.();
        return;
      }
      await update();
    };
  };

  // Effect to update payload when open and initialised
  $effect(() => {
    if (open && initialised) {
      updatePayload();
    }
  });
</script>

{#if open}
  <div class="w-full">
    <div class="rounded-2xl border border-white/10 bg-base-200/70 p-6">
      <header class="space-y-4">
        <button type="button" class="btn btn-ghost btn-sm gap-2" onclick={close}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to games
        </button>
        <div>
          <h2 class="text-2xl font-semibold text-base-content">
            {mode === 'create' ? 'Add game configuration' : `Edit ${game?.name ?? 'game'}`}
          </h2>
          <p class="mt-1 text-sm text-base-content/60">
            Configure game metadata, media assets, rooms, puzzles, pricing, and booking rules. All fields map directly to the EscapePlan API schema.
          </p>
        </div>
      </header>

      {#if errorMessage}
        <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <form method="POST" action={action} class="mt-6 space-y-6" use:enhance={handleSubmit}>
        {#if mode === 'edit'}
          <input type="hidden" name="id" value={game?.id} />
        {/if}
        <input type="hidden" name="payload" value={payloadJson} />

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

        <section class="space-y-6">
          {#if activeTab === 'details'}
            <div class="space-y-6">
              <div class="grid gap-6 md:grid-cols-2">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-medium text-base">Game name</span>
                  </label>
                  <input
                    class="input input-bordered w-full bg-base-100"
                    placeholder="Enter game name"
                    bind:value={workingGame.name}
                    required
                    oninput={handleNameInput}
                  />
                </div>
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-medium text-base">URL Slug</span>
                  </label>
                  <input
                    class="input input-bordered lowercase w-full bg-base-100"
                    placeholder="game-url-slug"
                    bind:value={workingGame.slug}
                    required
                    pattern="^[a-z0-9\-]+$"
                    oninput={handleSlugInput}
                  />
                  <label class="label">
                    <span class="label-text-alt text-base-content/60">Lowercase letters, numbers, and hyphens only</span>
                  </label>
                </div>
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium text-base">Description</span>
                </label>
                <textarea
                  class="textarea textarea-bordered w-full bg-base-100"
                  rows={4}
                  placeholder="Brief description of the game..."
                  bind:value={workingGame.description}
                  required
                  oninput={markDirty}
                ></textarea>
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium text-base">Story intro <span class="text-base-content/50">(optional)</span></span>
                </label>
                <textarea
                  class="textarea textarea-bordered w-full bg-base-100"
                  rows={4}
                  placeholder="Story introduction or narrative hook..."
                  bind:value={workingGame.storyIntro}
                  oninput={markDirty}
                ></textarea>
              </div>
              <div class="grid gap-6 md:grid-cols-3">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-medium text-base">Duration</span>
                  </label>
                  <div class="input-group">
                    <input
                      class="input input-bordered w-full bg-base-100"
                      type="number"
                      min="5"
                      max="240"
                      bind:value={workingGame.durationMinutes}
                      oninput={markDirty}
                    />
                    <span class="bg-base-200 px-4 flex items-center">minutes</span>
                  </div>
                </div>
                <div class="form-control md:col-span-2">
                  <label class="label">
                    <span class="label-text font-medium text-base">Difficulty</span>
                  </label>
                  <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Select difficulty">
                    {#each difficultyOptions as option}
                      <button
                        type="button"
                        class={`btn btn-sm ${option.value === workingGame.difficulty ? 'btn-primary' : 'btn-ghost border border-white/20'}`}
                        aria-pressed={option.value === workingGame.difficulty}
                        onclick={() => setDifficulty(option.value)}
                      >
                        <span class="flex items-center gap-2">
                          <span class="font-medium">{option.label}</span>
                          <span class="text-warning" aria-hidden="true">
                            {'★'.repeat(option.stars)}<span class="text-base-content/30">{'☆'.repeat(5 - option.stars)}</span>
                          </span>
                        </span>
                      </button>
                    {/each}
                  </div>
                  <label class="label">
                    <span class="label-text-alt text-base-content/60">{selectedDifficulty.helper}</span>
                  </label>
                </div>
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-medium text-base">Pricing model</span>
                </label>
                <select class="select select-bordered w-full bg-base-100" bind:value={workingGame.pricingModel} onchange={markDirty}>
                  <option value="per_person">Per person pricing</option>
                  <option value="flat_rate">Flat rate pricing</option>
                </select>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Minimum players</span>
                  <input class="input input-bordered" type="number" min="1" bind:value={workingGame.minPlayers} oninput={markDirty} />
                </label>
                <label class="form-control">
                  <span class="label-text">Maximum players</span>
                  <input class="input input-bordered" type="number" min={workingGame.minPlayers} bind:value={workingGame.maxPlayers} oninput={markDirty} />
                </label>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Base price per player ($)</span>
                  <input class="input input-bordered" type="number" min="0" step="0.01" bind:value={workingGame.pricePerPlayerCents} oninput={markDirty} />
                </label>
                <label class="form-control">
                  <span class="label-text">Resources required (staff)</span>
                  <input class="input input-bordered" type="number" min="1" bind:value={workingGame.resourcesRequired} oninput={markDirty} />
                </label>
              </div>
              <label class="form-control">
                <div class="label">
                  <span class="label-text font-medium text-base">Default Audio Volume</span>
                  <span class="label-text-alt text-base-content/60">
                    Inherited by hints and milestones (can be overridden)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  bind:value={workingGame.defaultVolume}
                  class="range range-primary"
                  oninput={markDirty}
                />
                <div class="flex justify-between text-xs px-2 mt-1">
                  <span>Mute</span>
                  <span class="font-medium text-primary">{workingGame.defaultVolume ?? 80}%</span>
                  <span>Max</span>
                </div>
              </label>
              <label class="form-control">
                <span class="label-text">Categories</span>
                <div class="flex flex-wrap gap-2">
                  {#each workingGame.categories as category}
                    <span class="badge badge-outline border-primary/40 text-primary">
                      {category}
                      <button type="button" class="ml-1 text-xs" onclick={() => removeCategory(category)}>×</button>
                    </span>
                  {/each}
                </div>
                <div class="mt-3 flex gap-2">
                  <input
                    class="input input-bordered flex-1"
                    placeholder="Add category (press Enter)"
                    onkeydown={(event) => {
                      const target = event.currentTarget as HTMLInputElement;
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCategory(target.value);
                        target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={(event) => {
                      const input = (event.currentTarget?.previousElementSibling ?? null) as HTMLInputElement | null;
                      if (input && input.value.trim().length) {
                        addCategory(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </label>
              <label class="form-control">
                <span class="label-text">Validation notes (internal)</span>
                <textarea class="textarea textarea-bordered" rows={3} bind:value={workingGame.validationNotes} oninput={markDirty}></textarea>
              </label>
            </div>
          {:else if activeTab === 'media'}
            <div class="space-y-6">
              <!-- Thumbnail -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-base font-semibold text-base-content">Game Thumbnail</h3>
                  {#if workingGame.media.thumbnailAssetId}
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost text-error"
                      onclick={() => {
                        workingGame.media.thumbnailAssetId = undefined;
                        updatePayload();
                      }}
                    >
                      Remove
                    </button>
                  {/if}
                </div>
                {#if workingGame.media.thumbnailAssetId}
                  {@const cachedAsset = assetCache[workingGame.media.thumbnailAssetId]}
                  <div class="rounded-xl border border-white/10 bg-base-100/70 p-3">
                    <div class="flex items-center gap-3">
                      <div class="h-16 w-16 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
                        {#if cachedAsset?.url}
                          <img src={cachedAsset.url} alt="Thumbnail" class="h-full w-full object-cover" />
                        {:else}
                          <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        {/if}
                      </div>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-base-content">{cachedAsset?.filename || workingGame.media.thumbnailAssetId}</p>
                        <p class="text-xs text-base-content/60">Thumbnail image</p>
                      </div>
                    </div>
                  </div>
                {:else}
                  <AssetUpload
                    gameId={workingGame.slug || 'temp'}
                    assetType="thumbnail"
                    accept="image/*"
                    maxSizeMB={5}
                    onSuccess={(asset) => {
                      workingGame.media.thumbnailAssetId = asset.id;
                      assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                      updatePayload();
                    }}
                  />
                {/if}
                <details class="collapse collapse-arrow bg-base-200/50">
                  <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
                  <div class="collapse-content">
                    <AssetBrowser
                      gameId={workingGame.slug}
                      assetType="thumbnail"
                      selectedAssetId={workingGame.media.thumbnailAssetId ?? undefined}
                      onSelect={(asset) => {
                        workingGame.media.thumbnailAssetId = asset.id;
                        assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                        updatePayload();
                      }}
                    />
                  </div>
                </details>
              </section>

              <!-- Room Background -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-base font-semibold text-base-content">Room Display Background</h3>
                  {#if workingGame.media.roomScreenAssetId}
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost text-error"
                      onclick={() => {
                        workingGame.media.roomScreenAssetId = undefined;
                        updatePayload();
                      }}
                    >
                      Remove
                    </button>
                  {/if}
                </div>
                {#if workingGame.media.roomScreenAssetId}
                  {@const cachedAsset = assetCache[workingGame.media.roomScreenAssetId]}
                  <div class="rounded-xl border border-white/10 bg-base-100/70 p-3">
                    <div class="flex items-center gap-3">
                      <div class="h-16 w-24 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
                        {#if cachedAsset?.url}
                          <img src={cachedAsset.url} alt="Room background" class="h-full w-full object-cover" />
                        {:else}
                          <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        {/if}
                      </div>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-base-content">{cachedAsset?.filename || workingGame.media.roomScreenAssetId}</p>
                        <p class="text-xs text-base-content/60">Room background</p>
                      </div>
                    </div>
                  </div>
                {:else}
                  <AssetUpload
                    gameId={workingGame.slug || 'temp'}
                    assetType="room_background"
                    accept="image/*,video/*"
                    maxSizeMB={25}
                    onSuccess={(asset) => {
                      workingGame.media.roomScreenAssetId = asset.id;
                      assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                      updatePayload();
                    }}
                  />
                {/if}
                <details class="collapse collapse-arrow bg-base-200/50">
                  <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
                  <div class="collapse-content">
                    <AssetBrowser
                      gameId={workingGame.slug}
                      assetType="room_background"
                      selectedAssetId={workingGame.media.roomScreenAssetId ?? undefined}
                      onSelect={(asset) => {
                        workingGame.media.roomScreenAssetId = asset.id;
                        assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                        updatePayload();
                      }}
                    />
                  </div>
                </details>
              </section>

              <!-- Gallery -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-base font-semibold text-base-content">Gallery Images</h3>
                  <span class="text-xs text-base-content/60">
                    {workingGame.media.galleryAssetIds?.length || 0} images
                  </span>
                </div>
                {#if workingGame.media.galleryAssetIds && workingGame.media.galleryAssetIds.length > 0}
                  <div class="grid gap-3 sm:grid-cols-3">
                    {#each workingGame.media.galleryAssetIds as assetId, index (assetId)}
                      {@const cachedAsset = assetCache[assetId]}
                      <div class="relative rounded-lg border border-white/10 bg-base-100/70 p-2">
                        <div class="aspect-video rounded bg-base-200 overflow-hidden flex items-center justify-center">
                          {#if cachedAsset?.url}
                            <img src={cachedAsset.url} alt="Gallery {index + 1}" class="h-full w-full object-cover" />
                          {:else}
                            <svg class="h-8 w-8 text-base-content/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          {/if}
                        </div>
                        <button
                          type="button"
                          class="btn btn-circle btn-xs btn-error absolute -right-2 -top-2"
                          onclick={() => {
                            workingGame.media.galleryAssetIds = workingGame.media.galleryAssetIds.filter(id => id !== assetId);
                            updatePayload();
                          }}
                        >
                          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
                <AssetUpload
                  gameId={workingGame.slug || 'temp'}
                  assetType="gallery"
                  accept="image/*"
                  maxSizeMB={5}
                  onSuccess={(asset) => {
                    workingGame.media.galleryAssetIds = [...(workingGame.media.galleryAssetIds || []), asset.id];
                    assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                    updatePayload();
                  }}
                />
                <details class="collapse collapse-arrow bg-base-200/50">
                  <summary class="collapse-title text-sm font-medium">Or browse existing assets</summary>
                  <div class="collapse-content">
                    <AssetBrowser
                      gameId={workingGame.slug}
                      assetType="gallery"
                      onSelect={(asset) => {
                        const currentIds = workingGame.media.galleryAssetIds || [];
                        if (!currentIds.includes(asset.id)) {
                          workingGame.media.galleryAssetIds = [...currentIds, asset.id];
                          assetCache[asset.id] = { url: asset.url, filename: asset.filename };
                          updatePayload();
                        }
                      }}
                    />
                  </div>
                </details>
              </section>
            </div>
          {:else if activeTab === 'rooms'}
            <div class="space-y-4">
              {#if workingGame.rooms.length === 0}
                <p class="rounded-lg border border-dashed border-base-content/20 bg-base-100/70 p-4 text-sm text-base-content/60">
                  No rooms yet. Add at least one room to finish configuration.
                </p>
              {/if}
              {#each workingGame.rooms as room, index (room.id)}
                <article
                  class="rounded-2xl border border-white/10 bg-base-100/70 p-4 shadow-sm"
                  ondragover={(event) => handleRoomDragOver(room.id, event)}
                  ondrop={handleRoomDrop}
                >
                  <header class="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-base font-semibold text-base-content">Room {index + 1}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-base-content/60"
                        aria-label="Reorder room"
                        draggable="true"
                        ondragstart={(event) => handleRoomDragStart(room.id, event)}
                        ondragend={handleRoomDrop}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
                          <path fill="currentColor" d="M4 10h16v2H4zm0-4h16v2H4zm0 8h16v2H4zm0 4h16v2H4z" />
                        </svg>
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost text-error" onclick={() => removeRoom(room.id)}>
                        Remove
                      </button>
                    </div>
                  </header>
                  <div class="grid gap-3 md:grid-cols-2">
                    <label class="form-control">
                      <span class="label-text">Name</span>
                      <input class="input input-bordered" bind:value={room.name} required oninput={markDirty} />
                    </label>
                    <label class="form-control">
                      <span class="label-text">Slug</span>
                      <input class="input input-bordered lowercase" placeholder="optional" bind:value={room.slug} oninput={markDirty} />
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text">Description</span>
                      <textarea class="textarea textarea-bordered" rows={2} bind:value={room.description} oninput={markDirty}></textarea>
                    </label>
                    <label class="form-control">
                      <span class="label-text">Theme token</span>
                      <input class="input input-bordered" bind:value={room.themeToken} placeholder="e.g. escapeplan-pirate" oninput={markDirty} />
                    </label>
                    <label class="form-control">
                      <span class="label-text">Capacity</span>
                      <input class="input input-bordered" type="number" min="1" bind:value={room.capacity} oninput={markDirty} />
                    </label>
                  </div>
                  <div class="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="toggle toggle-primary"
                      bind:checked={room.isMobileCapable}
                      onchange={markDirty}
                    />
                    <span class="text-sm text-base-content/70">Supports mobile deployments</span>
                  </div>
                </article>
              {/each}
              <div
                class="h-3"
                role="presentation"
                aria-hidden="true"
                ondragover={(event) => {
                  event.preventDefault();
                  handleRoomListDrop(event);
                }}
                ondrop={handleRoomListDrop}
              ></div>
              <button type="button" class="btn btn-secondary" onclick={addRoom}>
                + Add room
              </button>
            </div>
          {:else if activeTab === 'puzzles'}
            <div class="space-y-4">
              {#if workingGame.puzzles.length === 0}
                <p class="rounded-lg border border-dashed border-base-content/20 bg-base-100/70 p-4 text-sm text-base-content/60">
                  No puzzles configured. Add puzzles to capture hint flows.
                </p>
              {/if}
              {#each workingGame.puzzles as puzzle, index (puzzle.id)}
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
                      <button type="button" class="btn btn-xs btn-ghost text-error" onclick={() => removePuzzle(puzzle.id)}>
                        Remove
                      </button>
                    </div>
                  </header>
                  <div class="grid gap-3 md:grid-cols-2">
                    <label class="form-control">
                      <span class="label-text">Title</span>
                      <input class="input input-bordered" bind:value={puzzle.title} required oninput={markDirty} />
                    </label>
                    <label class="form-control">
                      <span class="label-text">Display order</span>
                      <input class="input input-bordered" type="number" min="1" bind:value={puzzle.displayOrder} oninput={markDirty} />
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text">Description</span>
                      <textarea class="textarea textarea-bordered" rows={2} bind:value={puzzle.description} oninput={markDirty}></textarea>
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text">Solution</span>
                      <textarea class="textarea textarea-bordered" rows={2} bind:value={puzzle.solution} oninput={markDirty}></textarea>
                    </label>
                    <label class="form-control">
                      <span class="label-text">Media asset</span>
                      <input class="input input-bordered" bind:value={puzzle.mediaAsset} placeholder="optional asset id" oninput={markDirty} />
                    </label>
                    <label class="form-control">
                      <span class="label-text">Operator actions</span>
                      <input class="input input-bordered" bind:value={puzzle.operatorActions} placeholder="reset instructions" oninput={markDirty} />
                    </label>
                  </div>
                  <section class="mt-4 rounded-xl border border-dashed border-white/10 bg-base-200/70 p-4">
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <h4 class="text-sm font-semibold text-base-content">Hints</h4>
                      <button type="button" class="btn btn-xs btn-secondary" onclick={() => openHintModal(puzzle)}>
                        + Add hint
                      </button>
                    </div>

                    {#if puzzle.hints.length === 0}
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
                                <tr class="hover">
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
                                        onclick={() => openHintModal(puzzle, hint)}
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
              <button type="button" class="btn btn-secondary" onclick={addPuzzle}>
                + Add puzzle
              </button>
            </div>
          {:else if activeTab === 'cameras'}
            <div class="space-y-4">
              <div class="rounded-lg border border-white/10 bg-base-100/70 p-4">
                <h3 class="text-sm font-semibold text-base-content mb-2">Associated Cameras</h3>
                <p class="text-sm text-base-content/60 mb-4">
                  Select cameras to display during this game's sessions
                </p>

                <div class="space-y-2">
                  {#if !workingGame.cameraIds}
                    <p class="text-sm text-base-content/60 italic">Loading cameras...</p>
                  {:else if workingGame.cameraIds.length === 0}
                    <div class="alert alert-info">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>No cameras selected. Sessions will not have camera feeds.</span>
                    </div>
                  {:else}
                    <div class="alert alert-success">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>{workingGame.cameraIds.length} camera(s) selected</span>
                    </div>
                  {/if}

                  <div class="text-sm text-base-content/70 mt-4 p-3 bg-base-200/50 rounded-lg">
                    <p class="font-medium mb-2">Note:</p>
                    <p>Camera management and selection will be available in a future update. For now, cameras are associated automatically based on room configuration.</p>
                  </div>
                </div>
              </div>
            </div>
          {:else if activeTab === 'pricing'}
            <div class="space-y-4">
              <article class="grid gap-4 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Pricing model</span>
                  <select class="select select-bordered" bind:value={workingGame.pricing.model}>
                    <option value="per_person">Per person</option>
                    <option value="flat_rate">Flat rate</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="label-text">Deposit required</span>
                  <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-base-100/70 px-3 py-2">
                    <input
                      type="checkbox"
                      class="toggle toggle-secondary"
                      checked={Boolean(workingGame.pricing.deposit?.required)}
                      onchange={(event) => {
                        const checked = (event.currentTarget as HTMLInputElement).checked;
                        workingGame.pricing.deposit = checked
                          ? {
                              required: true,
                              type: workingGame.pricing.deposit?.type ?? 'flat',
                              amountCents: workingGame.pricing.deposit?.amountCents ?? 0
                            }
                          : { required: false };
                        updatePayload();
                      }}
                    />
                    <span class="text-sm text-base-content/70">Collect deposit during booking</span>
                  </div>
                </label>
              </article>

              {#if workingGame.pricing.deposit?.required}
                <div class="grid gap-4 md:grid-cols-2">
                  <label class="form-control">
                    <span class="label-text">Deposit type</span>
                    <select
                      class="select select-bordered"
                      value={workingGame.pricing.deposit?.type ?? 'flat'}
                      onchange={(event) => {
                        const value = (event.currentTarget as HTMLSelectElement).value as 'flat' | 'percent';
                        workingGame.pricing.deposit = {
                          ...(workingGame.pricing.deposit ?? { required: true }),
                          required: true,
                          type: value,
                          amountCents: workingGame.pricing.deposit?.amountCents ?? 0
                        };
                        updatePayload();
                      }}
                    >
                      <option value="flat">Flat</option>
                      <option value="percent">Percent</option>
                    </select>
                  </label>
                  <label class="form-control">
                    <span class="label-text">Deposit amount ($)</span>
                    <input
                      class="input input-bordered"
                      type="number"
                      min="0"
                      step="0.01"
                      value={workingGame.pricing.deposit?.amountCents ?? 0}
                      oninput={(event) => {
                        const amount = Number((event.currentTarget as HTMLInputElement).value) || 0;
                        workingGame.pricing.deposit = {
                          ...(workingGame.pricing.deposit ?? { required: true, type: 'flat' }),
                          required: true,
                          amountCents: amount
                        };
                        updatePayload();
                      }}
                    />
                  </label>
                </div>
              {/if}

              <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
                <header class="mb-3 flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-base-content">Pricing tiers</h4>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary"
                    onclick={() => {
                      workingGame.pricing.tiers = [
                        ...workingGame.pricing.tiers,
                        { id: uid('tier'), label: `Tier ${workingGame.pricing.tiers.length + 1}`, priceCents: 0 }
                      ];
                      updatePayload();
                    }}
                  >
                    + Add tier
                  </button>
                </header>
                {#if workingGame.pricing.tiers.length === 0}
                  <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">No pricing tiers configured.</p>
                {/if}
                <div class="space-y-3">
                  {#each workingGame.pricing.tiers as tier (tier.id)}
                    <div class="rounded-lg border border-white/10 bg-base-200/80 p-3">
                      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <label class="form-control flex-1">
                          <span class="label-text">Label</span>
                          <input class="input input-bordered input-sm" bind:value={tier.label} oninput={markDirty} />
                        </label>
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-error"
                        onclick={() => {
                          workingGame.pricing.tiers = workingGame.pricing.tiers.filter((item) => item.id !== tier.id);
                          updatePayload();
                        }}
                      >
                        Remove
                      </button>
                      </div>
                      <div class="mt-2 grid gap-2 md:grid-cols-3">
                        <label class="form-control">
                          <span class="label-text">Price ($)</span>
                          <input class="input input-bordered input-sm" type="number" min="0" step="0.01" bind:value={tier.priceCents} oninput={markDirty} />
                        </label>
                        <label class="form-control">
                          <span class="label-text">Min players</span>
                          <input class="input input-bordered input-sm" type="number" min="1" bind:value={tier.minPlayers} oninput={markDirty} />
                        </label>
                        <label class="form-control">
                          <span class="label-text">Max players</span>
                          <input class="input input-bordered input-sm" type="number" min="1" bind:value={tier.maxPlayers} oninput={markDirty} />
                        </label>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>

              <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
                <header class="mb-3 flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-base-content">Discount codes</h4>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary"
                    onclick={() => {
                      workingGame.pricing.discounts = [
                        ...workingGame.pricing.discounts,
                        { code: `DISC-${workingGame.pricing.discounts.length + 1}`, percentOff: 10 }
                      ];
                      updatePayload();
                    }}
                  >
                    + Add discount
                  </button>
                </header>
                {#if workingGame.pricing.discounts.length === 0}
                  <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">No discounts configured.</p>
                {/if}
                <div class="space-y-3">
                  {#each workingGame.pricing.discounts as discount (discount.code)}
                    <div class="rounded-lg border border-white/10 bg-base-200/80 p-3">
                      <div class="grid gap-2 md:grid-cols-4">
                        <label class="form-control">
                          <span class="label-text">Code</span>
                          <input class="input input-bordered input-sm uppercase" bind:value={discount.code} oninput={markDirty} />
                        </label>
                        <label class="form-control">
                          <span class="label-text">Percent off</span>
                          <input class="input input-bordered input-sm" type="number" min="0" max="100" bind:value={discount.percentOff} oninput={markDirty} />
                        </label>
                        <label class="form-control">
                          <span class="label-text">Amount off ($)</span>
                          <input class="input input-bordered input-sm" type="number" min="0" step="0.01" bind:value={discount.amountOffCents} oninput={markDirty} />
                        </label>
                        <label class="form-control">
                          <span class="label-text">Expires at</span>
                          <input class="input input-bordered input-sm" type="datetime-local" bind:value={discount.expiresAt} oninput={markDirty} />
                        </label>
                      </div>
                      <label class="form-control mt-2">
                        <span class="label-text">Notes</span>
                        <textarea class="textarea textarea-bordered textarea-sm" rows={2} bind:value={discount.notes} oninput={markDirty}></textarea>
                      </label>
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-error mt-2"
                        onclick={() => {
                          workingGame.pricing.discounts = workingGame.pricing.discounts.filter((item) => item !== discount);
                          updatePayload();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  {/each}
                </div>
              </section>
            </div>
          {:else}
            <div class="space-y-4">
              <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-base-100/70 px-4 py-3">
                <input type="checkbox" class="toggle toggle-primary" bind:checked={workingGame.bookingRules.isMobile} onchange={markDirty} />
                <span class="text-sm text-base-content/70">Game is available for mobile deployments</span>
              </div>
              <label class="form-control">
                <span class="label-text">Location notes template</span>
                <textarea class="textarea textarea-bordered" rows={3} bind:value={workingGame.bookingRules.locationNotes} oninput={markDirty}></textarea>
              </label>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="form-control">
                  <span class="label-text">Travel buffer (minutes)</span>
                  <input class="input input-bordered" type="number" min="0" max="600" bind:value={workingGame.bookingRules.travelBufferMinutes} oninput={markDirty} />
                </label>
                <label class="form-control">
                  <span class="label-text">Reservation style</span>
                  <select class="select select-bordered" bind:value={workingGame.bookingRules.reservationStyle} onchange={markDirty}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
              </div>
              <label class="form-control">
                <span class="label-text">Cancellation policy</span>
                <textarea class="textarea textarea-bordered" rows={3} bind:value={workingGame.bookingRules.cancellationPolicy} oninput={markDirty}></textarea>
              </label>
              <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
                <header class="mb-3 flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-base-content">Equipment checklist</h4>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary"
                    onclick={() => {
                      workingGame.bookingRules.equipmentChecklist = [
                        ...(workingGame.bookingRules.equipmentChecklist ?? []),
                        `Item ${ (workingGame.bookingRules.equipmentChecklist?.length ?? 0) + 1 }`
                      ];
                      updatePayload();
                    }}
                  >
                    + Add item
                  </button>
                </header>
                <div class="space-y-2">
                  {#each workingGame.bookingRules.equipmentChecklist as item, index (item + index)}
                    <div class="flex items-center gap-3">
                      <input
                        class="input input-bordered input-sm flex-1"
                        bind:value={workingGame.bookingRules.equipmentChecklist[index]}
                        oninput={markDirty}
                        placeholder="Equipment name"
                      />
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-error"
                        onclick={() => {
                          workingGame.bookingRules.equipmentChecklist = workingGame.bookingRules.equipmentChecklist.filter((entry, idx) => idx !== index);
                          updatePayload();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  {/each}
                </div>
              </section>
              <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
                <header class="mb-3 flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-base-content">Custom booking fields</h4>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary"
                    onclick={() => {
                      workingGame.bookingRules.customFields = [
                        ...bookingCustomFields,
                        { label: 'Custom field', required: false }
                      ];
                      updatePayload();
                    }}
                  >
                    + Add field
                  </button>
                </header>
                <div class="space-y-3">
                  {#each bookingCustomFields as field, index (`${field.label}-${index}`)}
                    <div class="rounded-lg border border-white/10 bg-base-200/80 p-3">
                      <label class="form-control">
                        <span class="label-text">Label</span>
                        <input class="input input-bordered input-sm" bind:value={field.label} oninput={markDirty} />
                      </label>
                      <div class="mt-2 flex items-center gap-3">
                        <input type="checkbox" class="checkbox checkbox-sm" bind:checked={field.required} onchange={markDirty} />
                        <span class="text-xs text-base-content/60">Required</span>
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-error"
                        onclick={() => {
                          workingGame.bookingRules.customFields = bookingCustomFields.filter((_, idx) => idx !== index);
                          updatePayload();
                        }}
                      >
                        Remove
                      </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            </div>

          {:else if activeTab === 'milestones'}
            <div class="space-y-4">
              <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <div class="text-sm">
                  <p class="font-semibold">Game Milestones</p>
                  <p>Create special moments like intro videos, escape celebrations, or time-up messages that can be triggered automatically or manually during gameplay.</p>
                </div>
              </div>

              <section class="rounded-xl border border-dashed border-white/10 bg-base-100/70 p-4">
                <header class="mb-3 flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-base-content">Milestones ({workingGame.milestones.length})</h4>
                  <button type="button" class="btn btn-xs btn-secondary" onclick={addMilestone}>
                    + Add milestone
                  </button>
                </header>

                {#if workingGame.milestones.length === 0}
                  <p class="rounded-lg border border-white/5 bg-base-200/60 p-3 text-xs text-base-content/60">
                    No milestones configured. Add milestones to create special moments during your game sessions.
                  </p>
                {/if}

                <div class="space-y-3">
                  {#each workingGame.milestones as milestone, index (milestone.id)}
                    <div class="rounded-lg border border-white/10 bg-base-200/80 p-4">
                      <div class="flex items-start justify-between gap-3 mb-4">
                        <div class="flex-1">
                          <div class="grid gap-3 md:grid-cols-2">
                            <label class="form-control">
                              <span class="label-text">Type *</span>
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
                                  // custom keeps whatever name user sets
                                  markDirty();
                                }}
                              >
                                <option value="intro">Intro</option>
                                <option value="escaped">Escaped</option>
                                <option value="failed">Failed</option>
                                <option value="custom">Custom</option>
                              </select>
                            </label>
                            <label class="form-control">
                              <span class="label-text">Milestone name *</span>
                              <input
                                class="input input-bordered input-sm"
                                type="text"
                                bind:value={milestone.name}
                                oninput={markDirty}
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
                            {#if index < workingGame.milestones.length - 1}
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
                          oninput={markDirty}
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
                              markDirty();
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
                          <label class="form-control">
                            <span class="label-text">Volume</span>
                            <div class="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                bind:value={milestone.volumeLevel}
                                oninput={markDirty}
                                class="range range-sm range-primary flex-1"
                              />
                              <span class="text-sm text-base-content/70 w-12 text-right">{milestone.volumeLevel}%</span>
                            </div>
                          </label>
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
                                    markDirty();
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
                        </div>
                      {/if}

                      <div class="divider my-3"></div>

                      <div class="grid gap-3 md:grid-cols-2">
                        <label class="form-control">
                          <span class="label-text">Trigger type *</span>
                          <select class="select select-bordered select-sm" bind:value={milestone.triggerType} onchange={markDirty}>
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
                              onchange={markDirty}
                            />
                            <span class="text-sm text-base-content/70">{milestone.enabled ? 'Active' : 'Disabled'}</span>
                          </div>
                        </label>
                      </div>

                      {#if milestone.triggerType === 'timer'}
                        <div class="mt-3 grid gap-3 md:grid-cols-2">
                          <label class="form-control">
                            <span class="label-text">Trigger at (minutes)</span>
                            <input
                              class="input input-bordered input-sm"
                              type="number"
                              min="0"
                              value={milestone.triggerConfig?.minutes ?? ''}
                              oninput={(e) => {
                                const val = Number((e.currentTarget as HTMLInputElement).value);
                                milestone.triggerConfig = { ...milestone.triggerConfig, minutes: val || undefined };
                                markDirty();
                              }}
                              placeholder="e.g., 5 = trigger at 5 min mark"
                            />
                          </label>
                          <label class="form-control">
                            <span class="label-text">Repeat interval (minutes)</span>
                            <input
                              class="input input-bordered input-sm"
                              type="number"
                              min="0"
                              value={milestone.triggerConfig?.interval ?? ''}
                              oninput={(e) => {
                                const val = Number((e.currentTarget as HTMLInputElement).value);
                                milestone.triggerConfig = { ...milestone.triggerConfig, interval: val || undefined };
                                markDirty();
                              }}
                              placeholder="e.g., 10 = every 10 minutes"
                            />
                          </label>
                        </div>
                      {:else if milestone.triggerType === 'condition'}
                        <div class="mt-3">
                          <label class="form-control">
                            <span class="label-text">Trigger after hints used</span>
                            <input
                              class="input input-bordered input-sm"
                              type="number"
                              min="0"
                              value={milestone.triggerConfig?.hintsUsed ?? ''}
                              oninput={(e) => {
                                const val = Number((e.currentTarget as HTMLInputElement).value);
                                milestone.triggerConfig = { ...milestone.triggerConfig, hintsUsed: val || undefined };
                                markDirty();
                              }}
                              placeholder="e.g., 3 = trigger after 3 hints sent"
                            />
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
          {/if}
        </section>

        <footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost w-full sm:w-auto" onclick={close}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary w-full sm:w-auto">
            {mode === 'create' ? 'Create game' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  </div>

  <!-- Hint Modal (opens on top of Game Form) -->
  <HintModal
    open={hintModalOpen}
    puzzleName={editingHint?.puzzle.title ?? ''}
    hint={editingHint?.hint ?? null}
    gameId={game?.id}
    puzzleId={editingHint?.puzzle.id}
    hintOrder={editingHint?.hint?.order ?? (editingHint?.puzzle.hints?.length ?? 0) + 1}
    onclose={closeHintModal}
    onsave={saveHintFromModal}
  />
{/if}
