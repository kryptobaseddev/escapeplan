<script lang="ts">
  /**
   * GameBasicInfoForm - Extracted basic info fields from GameModal
   * Handles game identity, description, and core gameplay settings
   * Uses DaisyUI validator patterns for all inputs
   */

  interface Props {
    name: string;
    slug: string;
    description: string;
    story?: string;
    durationMinutes: number;
    difficulty: string;
    maxPlayers: number;
    categories: string[];
    slugTouched: boolean;
    minDurationMinutes?: number;
    maxDurationMinutes?: number;
    onNameChange: (name: string) => void;
    onSlugChange: (slug: string) => void;
    onDescriptionChange: (description: string) => void;
    onStoryChange: (story: string) => void;
    onDurationChange: (minutes: number) => void;
    onDifficultyChange: (difficulty: string) => void;
    onMaxPlayersChange: (players: number) => void;
    onCategoriesChange: (categories: string[]) => void;
    onSlugTouched: () => void;
  }

  let {
    name = $bindable(),
    slug = $bindable(),
    description = $bindable(),
    story = $bindable<string | undefined>(undefined),
    durationMinutes = $bindable(),
    difficulty = $bindable(),
    maxPlayers = $bindable(),
    categories = $bindable(),
    slugTouched = $bindable(),
    minDurationMinutes = 30,
    maxDurationMinutes = 240,
    onNameChange,
    onSlugChange,
    onDescriptionChange,
    onStoryChange,
    onDurationChange,
    onDifficultyChange,
    onMaxPlayersChange,
    onCategoriesChange,
    onSlugTouched
  }: Props = $props();

  const difficultyOptions = [
    { value: 'Beginner', label: 'Beginner', stars: 1, helper: 'Great for first-timers' },
    { value: 'Easy', label: 'Easy', stars: 2, helper: 'Light puzzling, story forward' },
    { value: 'Medium', label: 'Medium', stars: 3, helper: 'Balanced challenge' },
    { value: 'Hard', label: 'Hard', stars: 4, helper: 'Experienced teams recommended' },
    { value: 'Expert', label: 'Expert', stars: 5, helper: 'Designed for veterans' }
  ] as const;

  const selectedDifficulty = $derived(
    difficultyOptions.find((option) => option.value === difficulty) ?? difficultyOptions[2]
  );

  let newCategoryInput = $state('');

  function handleAddCategory() {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      onCategoriesChange([...categories, trimmed]);
      newCategoryInput = '';
    }
  }

  function handleRemoveCategory(category: string) {
    onCategoriesChange(categories.filter((entry) => entry !== category));
  }

  function handleCategoryKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCategory();
    }
  }
</script>

<!-- Game Identity Section -->
<fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
  <legend class="fieldset-legend">Game Identity</legend>
  <div class="grid gap-4">
    <!-- Game Name -->
    <label class="form-control">
      <span class="label-text">Game Name <span class="text-error">*</span></span>
      <input
        class="input validator"
        type="text"
        value={name}
        oninput={(e) => onNameChange(e.currentTarget.value)}
        required
        minlength="3"
        placeholder="Enter game name"
        title="At least 3 characters required"
      />
      <div class="validator-hint">At least 3 characters required</div>
    </label>

    <!-- URL Slug -->
    <label class="form-control">
      <span class="label-text">URL Slug <span class="text-error">*</span></span>
      <input
        class="input validator lowercase"
        type="text"
        value={slug}
        oninput={(e) => {
          onSlugTouched();
          onSlugChange(e.currentTarget.value);
        }}
        required
        pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
        placeholder="game-url-slug"
        title="Lowercase letters, numbers, and hyphens only"
      />
      <div class="validator-hint">Lowercase letters, numbers, and hyphens only</div>
    </label>
  </div>
</fieldset>

<!-- Game Description Section -->
<fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
  <legend class="fieldset-legend">Game Description</legend>
  <div class="grid gap-4">
    <!-- Description -->
    <label class="form-control">
      <span class="label-text">Description <span class="text-error">*</span></span>
      <textarea
        class="textarea validator"
        rows={4}
        value={description}
        oninput={(e) => onDescriptionChange(e.currentTarget.value)}
        required
        minlength="10"
        maxlength="500"
        placeholder="Brief description of the game..."
        title="Description must be between 10 and 500 characters"
      ></textarea>
      <div class="validator-hint">Description must be between 10 and 500 characters</div>
    </label>

    <!-- Story Background -->
    <label class="form-control">
      <span class="label-text">Story Background <span class="text-base-content/50">(optional)</span></span>
      <textarea
        class="textarea validator"
        rows={4}
        value={story}
        oninput={(e) => onStoryChange(e.currentTarget.value)}
        maxlength="1000"
        placeholder="Story introduction or narrative hook..."
        title="Maximum 1000 characters"
      ></textarea>
      <span class="label-text-alt text-base-content/60">Maximum 1000 characters</span>
    </label>
  </div>
</fieldset>

<!-- Gameplay Settings Section -->
<fieldset class="fieldset rounded-box border border-base-content/10 bg-base-200/50 p-4">
  <legend class="fieldset-legend">Gameplay Settings</legend>
  <div class="grid gap-6">
    <!-- Duration and Max Players Row -->
    <div class="grid gap-4 md:grid-cols-2">
      <!-- Duration -->
      <label class="form-control">
        <span class="label-text">Duration <span class="text-error">*</span></span>
        <label class="input validator flex items-center gap-2">
          <input
            type="number"
            class="grow"
            value={durationMinutes}
            oninput={(e) => onDurationChange(parseInt(e.currentTarget.value, 10))}
            required
            min={minDurationMinutes}
            max={maxDurationMinutes}
            title={`Duration must be between ${minDurationMinutes} and ${maxDurationMinutes} minutes`}
          />
          <span class="text-base-content/60">minutes</span>
        </label>
        <div class="validator-hint">Duration must be between {minDurationMinutes} and {maxDurationMinutes} minutes</div>
      </label>

      <!-- Max Players -->
      <label class="form-control">
        <span class="label-text">Maximum Players <span class="text-error">*</span></span>
        <label class="input validator flex items-center gap-2">
          <input
            type="number"
            class="grow"
            value={maxPlayers}
            oninput={(e) => onMaxPlayersChange(parseInt(e.currentTarget.value, 10))}
            required
            min="1"
            max="20"
            title="Maximum players must be between 1 and 20"
          />
          <span class="text-base-content/60">players</span>
        </label>
        <div class="validator-hint">Maximum players must be between 1 and 20</div>
      </label>
    </div>

    <!-- Difficulty Selector -->
    <div class="form-control">
      <span class="label-text">Difficulty <span class="text-error">*</span></span>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Select difficulty">
        {#each difficultyOptions as option}
          <button
            type="button"
            class={`btn btn-sm ${option.value === difficulty ? 'btn-primary' : 'btn-ghost border border-white/20'}`}
            aria-pressed={option.value === difficulty}
            onclick={() => onDifficultyChange(option.value)}
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
      <span class="label-text-alt text-base-content/60">{selectedDifficulty.helper}</span>
    </div>

    <!-- Categories -->
    <div class="form-control">
      <span class="label-text">Categories</span>
      <div class="flex flex-wrap gap-2">
        {#each categories as category}
          <span class="badge badge-outline border-primary/40 text-primary">
            {category}
            <button type="button" class="ml-1 text-xs" onclick={() => handleRemoveCategory(category)}>×</button>
          </span>
        {/each}
      </div>
      <div class="mt-3 flex gap-2">
        <input
          class="input input-bordered flex-1"
          placeholder="Add category (press Enter)"
          bind:value={newCategoryInput}
          onkeydown={handleCategoryKeydown}
        />
        <button type="button" class="btn btn-secondary" onclick={handleAddCategory}>Add</button>
      </div>
    </div>
  </div>
</fieldset>
