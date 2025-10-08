<svelte:options runes={true} />

<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import AssetBrowser from '$lib/components/assets/AssetBrowser.svelte';
  import UploadSystemAudioModal from '$lib/components/system/UploadSystemAudioModal.svelte';

  interface Setting {
    key: string;
    value: any;
    label: string;
    description: string | null;
    type: 'string' | 'number' | 'boolean' | 'json';
    isEditable: boolean;
  }

  interface SettingsData {
    storage: Setting[];
    backup: Setting[];
    updates: Setting[];
    business: Setting[];
    user_validation: Setting[];
    system: Setting[];
    general: Setting[];
  }

  let {
    settings: initialSettings,
    availableRoles = []
  }: {
    settings: SettingsData;
    availableRoles?: Array<{ id: string; name: string; user_type_scope: string }>;
  } = $props();

  // Create local mutable copy of settings for optimistic updates
  let settings = $state<SettingsData>({
    storage: [],
    backup: [],
    updates: [],
    business: [],
    user_validation: [],
    system: [],
    general: []
  });

  // Initialize settings from props only when initialSettings changes
  $effect(() => {
    // Only update if initialSettings is provided (not on every render)
    if (initialSettings) {
      settings = {
        storage: [...(initialSettings.storage || [])],
        backup: [...(initialSettings.backup || [])],
        updates: [...(initialSettings.updates || [])],
        business: [...(initialSettings.business || [])],
        user_validation: [...(initialSettings.user_validation || [])],
        system: [...(initialSettings.system || [])],
        general: [...(initialSettings.general || [])]
      };
    }
  });

  let editedValues: Record<string, any> = $state({});
  let saving: Record<string, boolean> = $state({});
  let errors: Record<string, string> = $state({});
  let successMessages: Record<string, string> = $state({});

  // Asset browser modal state
  let assetBrowserOpen = $state(false);
  let currentAssetField = $state<string | null>(null);

  // Upload modal state
  let uploadModalOpen = $state(false);
  let selectedAssetDetails = $state<any | null>(null);
  let loadingAssetDetails = $state(false);

  function getDisplayValue(setting: Setting): any {
    return editedValues[setting.key] !== undefined ? editedValues[setting.key] : setting.value;
  }

  function handleEdit(key: string, value: any) {
    // Immutable update
    editedValues = { ...editedValues, [key]: value };

    // Immutable delete for errors and success messages
    const { [key]: _err, ...remainingErrors } = errors;
    const { [key]: _msg, ...remainingMessages } = successMessages;
    errors = remainingErrors;
    successMessages = remainingMessages;
  }

  async function saveSetting(setting: Setting) {
    const newValue = editedValues[setting.key] ?? setting.value;

    // Immutable updates
    saving = { ...saving, [setting.key]: true };
    const { [setting.key]: _err, ...remainingErrors } = errors;
    const { [setting.key]: _msg, ...remainingMessages } = successMessages;
    errors = remainingErrors;
    successMessages = remainingMessages;

    try {
      const response = await apiFetch<{ success: boolean; key: string; value: any }>(
        fetch,
        `/admin/settings/${setting.key}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ value: newValue }),
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.success) {
        // Update the setting in the local state using immutable patterns
        const category = setting.key.split('.')[0] as keyof SettingsData;
        const categorySettings = settings[category];
        const index = categorySettings.findIndex(s => s.key === setting.key);

        if (index !== -1) {
          // Immutable update: create new array with updated setting
          settings = {
            ...settings,
            [category]: categorySettings.map((s, i) =>
              i === index ? { ...s, value: newValue } : s
            )
          };
        }

        // Immutable delete: create new object without the key
        const { [setting.key]: _, ...remainingEdited } = editedValues;
        editedValues = remainingEdited;

        successMessages = { ...successMessages, [setting.key]: 'Saved successfully' };

        // Clear success message after 3 seconds
        setTimeout(() => {
          const { [setting.key]: __, ...remaining } = successMessages;
          successMessages = remaining;
        }, 3000);
      }
    } catch (error: any) {
      // Immutable error update
      errors = { ...errors, [setting.key]: error.message || 'Failed to save setting' };
    } finally {
      // Immutable update: set saving to false
      saving = { ...saving, [setting.key]: false };
    }
  }

  function renderSettingInput(setting: Setting) {
    const value = getDisplayValue(setting);
    const hasChanges = editedValues[setting.key] !== undefined;

    if (!setting.isEditable) {
      if (setting.type === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      return String(value);
    }

    return { setting, value, hasChanges };
  }

  function openAssetBrowser(settingKey: string) {
    currentAssetField = settingKey;
    assetBrowserOpen = true;
  }

  function handleAssetSelected(asset: any) {
    if (!currentAssetField) return;

    handleEdit(currentAssetField, asset.id);
    const setting = getAllSettings().find(s => s.key === currentAssetField);
    if (setting) {
      saveSetting({ ...setting, value: asset.id });
    }

    assetBrowserOpen = false;
    currentAssetField = null;
  }

  function getAllSettings(): Setting[] {
    return [
      ...settings.storage,
      ...settings.backup,
      ...settings.updates,
      ...settings.business,
      ...settings.user_validation,
      ...settings.system,
      ...settings.general
    ];
  }

  async function loadAssetDetails(assetId: string | null) {
    if (!assetId || assetId === 'null') {
      selectedAssetDetails = null;
      return;
    }

    loadingAssetDetails = true;
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        selectedAssetDetails = data.asset;
      } else {
        selectedAssetDetails = null;
      }
    } catch (err) {
      console.error('Failed to load asset details:', err);
      selectedAssetDetails = null;
    } finally {
      loadingAssetDetails = false;
    }
  }

  async function handleUploadSuccess(asset: any) {
    // Set the uploaded asset as the default sound
    const setting = getAllSettings().find(s => s.key === 'business.default_text_hint_sound_asset_id');
    if (setting) {
      editedValues['business.default_text_hint_sound_asset_id'] = asset.id;
      await saveSetting(setting);
      selectedAssetDetails = asset;
    }
    uploadModalOpen = false;
  }

  function handleClearAsset(setting: Setting) {
    handleEdit(setting.key, null);
    saveSetting({ ...setting, value: null });
    selectedAssetDetails = null;
  }

  const storageSettings = $derived(settings.storage || []);
  const backupSettings = $derived(settings.backup || []);
  const updatesSettings = $derived(settings.updates || []);
  const businessSettings = $derived(settings.business || []);
  const userValidationSettings = $derived(settings.user_validation || []);
  const systemSettings = $derived(settings.system || []);

  // Load asset details when the default sound setting changes
  $effect(() => {
    const currentValue = editedValues['business.default_text_hint_sound_asset_id'] ||
                         settings.business.find(s => s.key === 'business.default_text_hint_sound_asset_id')?.value;

    if (currentValue && currentValue !== 'null') {
      loadAssetDetails(currentValue);
    } else {
      selectedAssetDetails = null;
    }
  });
</script>

<div class="space-y-6">
  <!-- Business Defaults Section -->
  <section class="card bg-base-200">
    <div class="card-body">
      <h3 class="card-title flex items-center gap-2">
        <span>Business Defaults</span>
        <HelpTooltip text="Configure system-wide defaults for game settings. These values are used when creating new games." />
      </h3>

      <div class="space-y-4">
        <!-- Text Hint Settings Grid -->
        {#if businessSettings.some(s => s.key === 'business.default_text_hint_sound_asset_id' || s.key === 'business.default_text_hint_duration_seconds')}
          {@const hintSettings = businessSettings.filter(s =>
            s.key === 'business.default_text_hint_sound_asset_id' ||
            s.key === 'business.default_text_hint_duration_seconds'
          )}
          <div class="space-y-3">
            <h4 class="text-sm font-semibold text-base-content/70 uppercase tracking-wide">Text Hint Defaults</h4>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {#each hintSettings as setting}
                {@const inputData = renderSettingInput(setting)}
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-medium">{setting.label}</span>
                    {#if setting.description}
                      <HelpTooltip text={setting.description} />
                    {/if}
                  </label>

                  {#if typeof inputData === 'string' || typeof inputData === 'number'}
                    <!-- Read-only display -->
                    <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm">
                      {inputData}
                    </div>
                  {:else if setting.type === 'number'}
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        class="input input-bordered flex-1"
                        value={inputData.value}
                        oninput={(e) => handleEdit(setting.key, Number(e.currentTarget.value))}
                        disabled={!setting.isEditable}
                        min={setting.key === 'business.default_text_hint_duration_seconds' ? 5 : 0}
                        max={setting.key === 'business.default_text_hint_duration_seconds' ? 300 : undefined}
                        step={setting.key === 'business.default_text_hint_duration_seconds' ? 5 : 1}
                      />
                      {#if inputData.hasChanges}
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          onclick={() => saveSetting(setting)}
                          disabled={saving[setting.key]}
                        >
                          {#if saving[setting.key]}
                            <span class="loading loading-spinner loading-xs"></span>
                          {:else}
                            Save
                          {/if}
                        </button>
                      {/if}
                    </div>
                  {:else if setting.type === 'string' && setting.key === 'business.default_text_hint_sound_asset_id'}
                    <!-- Asset picker for text hint sound with preview -->
                    <div class="space-y-2">
                      <!-- Current sound display -->
                      {#if loadingAssetDetails}
                        <div class="skeleton h-10 w-full"></div>
                      {:else if selectedAssetDetails}
                        <div class="flex items-center gap-2 p-2 bg-base-200 rounded">
                          <span class="text-2xl">🎵</span>
                          <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate">{selectedAssetDetails.originalFilename}</div>
                            <div class="text-xs text-base-content/60">{(selectedAssetDetails.sizeBytes / 1024).toFixed(1)} KB</div>
                          </div>
                          <audio controls class="h-8">
                            <source src={selectedAssetDetails.url} type={selectedAssetDetails.mimeType} />
                          </audio>
                        </div>
                      {:else}
                        <input
                          type="text"
                          value="No sound selected"
                          class="input input-bordered w-full"
                          disabled
                        />
                      {/if}

                      <!-- Action buttons -->
                      <div class="flex gap-2 flex-wrap">
                        <button
                          class="btn btn-primary btn-sm"
                          onclick={() => openAssetBrowser(setting.key)}
                          disabled={!setting.isEditable || saving[setting.key]}
                        >
                          Select Sound
                        </button>
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick={() => { uploadModalOpen = true; }}
                          disabled={!setting.isEditable || saving[setting.key]}
                        >
                          Upload New
                        </button>
                        {#if selectedAssetDetails}
                          <button
                            class="btn btn-error btn-sm"
                            onclick={() => handleClearAsset(setting)}
                            disabled={saving[setting.key]}
                          >
                            Clear
                          </button>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#if errors[setting.key]}
                    <label class="label">
                      <span class="label-text-alt text-error">{errors[setting.key]}</span>
                    </label>
                  {/if}

                  {#if successMessages[setting.key]}
                    <label class="label">
                      <span class="label-text-alt text-success">{successMessages[setting.key]}</span>
                    </label>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Other Business Settings -->
        {#each businessSettings.filter(s => s.key !== 'business.default_text_hint_sound_asset_id' && s.key !== 'business.default_text_hint_duration_seconds') as setting}
          {@const inputData = renderSettingInput(setting)}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">{setting.label}</span>
              {#if setting.description}
                <HelpTooltip text={setting.description} />
              {/if}
            </label>

            {#if typeof inputData === 'string' || typeof inputData === 'number'}
              <!-- Read-only display -->
              <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm">
                {inputData}
              </div>
            {:else if setting.type === 'number'}
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input input-bordered flex-1"
                  value={inputData.value}
                  oninput={(e) => handleEdit(setting.key, Number(e.currentTarget.value))}
                  disabled={!setting.isEditable}
                  min="0"
                />
                {#if inputData.hasChanges}
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick={() => saveSetting(setting)}
                    disabled={saving[setting.key]}
                  >
                    {#if saving[setting.key]}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      Save
                    {/if}
                  </button>
                {/if}
              </div>
            {:else if setting.type === 'boolean'}
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={inputData.value}
                  onchange={(e) => {
                    const checked = e.currentTarget.checked;
                    handleEdit(setting.key, checked);
                    saveSetting({ ...setting, value: checked });
                  }}
                  disabled={!setting.isEditable || saving[setting.key]}
                />
                <span class="text-sm text-base-content/70">
                  {inputData.value ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            {:else if setting.type === 'string'}
              <div class="space-y-2">
                {#if setting.key.includes('policy')}
                  <!-- Textarea for policies -->
                  <textarea
                    class="textarea textarea-bordered w-full"
                    rows={4}
                    value={inputData.value}
                    oninput={(e) => handleEdit(setting.key, e.currentTarget.value)}
                    disabled={!setting.isEditable}
                  ></textarea>
                {:else}
                  <!-- Regular input -->
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    value={inputData.value}
                    oninput={(e) => handleEdit(setting.key, e.currentTarget.value)}
                    disabled={!setting.isEditable}
                  />
                {/if}
                {#if inputData.hasChanges}
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick={() => saveSetting(setting)}
                    disabled={saving[setting.key]}
                  >
                    {#if saving[setting.key]}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      Save
                    {/if}
                  </button>
                {/if}
              </div>
            {/if}

            {#if errors[setting.key]}
              <label class="label">
                <span class="label-text-alt text-error">{errors[setting.key]}</span>
              </label>
            {/if}

            {#if successMessages[setting.key]}
              <label class="label">
                <span class="label-text-alt text-success">{successMessages[setting.key]}</span>
              </label>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Storage Limits Section -->
  <section class="card bg-base-200">
    <div class="card-body">
      <h3 class="card-title flex items-center gap-2">
        <span>Storage Limits</span>
        <HelpTooltip text="Configure maximum file size limits for asset uploads" />
      </h3>

      <div class="space-y-4">
        {#each storageSettings as setting}
          {@const inputData = renderSettingInput(setting)}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">{setting.label}</span>
              {#if setting.description}
                <HelpTooltip text={setting.description} />
              {/if}
            </label>

            {#if typeof inputData === 'string' || typeof inputData === 'number'}
              <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm">
                {inputData}
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input input-bordered flex-1"
                  value={inputData.value}
                  oninput={(e) => handleEdit(setting.key, Number(e.currentTarget.value))}
                  disabled={!setting.isEditable}
                  min="1"
                />
                {#if inputData.hasChanges}
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick={() => saveSetting(setting)}
                    disabled={saving[setting.key]}
                  >
                    {#if saving[setting.key]}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      Save
                    {/if}
                  </button>
                {/if}
              </div>

              {#if errors[setting.key]}
                <label class="label">
                  <span class="label-text-alt text-error">{errors[setting.key]}</span>
                </label>
              {/if}

              {#if successMessages[setting.key]}
                <label class="label">
                  <span class="label-text-alt text-success">{successMessages[setting.key]}</span>
                </label>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Backup Settings Section -->
  <section class="card bg-base-200">
    <div class="card-body">
      <h3 class="card-title flex items-center gap-2">
        <span>Backup Settings</span>
        <HelpTooltip text="Configure automatic backup retention policies" />
      </h3>

      <div class="space-y-4">
        {#each backupSettings as setting}
          {@const inputData = renderSettingInput(setting)}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">{setting.label}</span>
              {#if setting.description}
                <HelpTooltip text={setting.description} />
              {/if}
            </label>

            {#if typeof inputData === 'string' || typeof inputData === 'number'}
              <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm">
                {inputData}
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input input-bordered flex-1"
                  value={inputData.value}
                  oninput={(e) => handleEdit(setting.key, Number(e.currentTarget.value))}
                  disabled={!setting.isEditable}
                  min="1"
                />
                {#if inputData.hasChanges}
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick={() => saveSetting(setting)}
                    disabled={saving[setting.key]}
                  >
                    {#if saving[setting.key]}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      Save
                    {/if}
                  </button>
                {/if}
              </div>

              {#if errors[setting.key]}
                <label class="label">
                  <span class="label-text-alt text-error">{errors[setting.key]}</span>
                </label>
              {/if}

              {#if successMessages[setting.key]}
                <label class="label">
                  <span class="label-text-alt text-success">{successMessages[setting.key]}</span>
                </label>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- User Validation Settings Section -->
  {#if userValidationSettings.length > 0}
  <section class="card bg-base-200">
    <div class="card-body">
      <h3 class="card-title flex items-center gap-2">
        <span>User Validation</span>
        <HelpTooltip text="Configure user account validation rules and password requirements" />
      </h3>

      <div class="space-y-4">
        {#each userValidationSettings as setting}
          {@const inputData = renderSettingInput(setting)}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">{setting.label}</span>
              {#if setting.description}
                <HelpTooltip text={setting.description} />
              {/if}
            </label>

            {#if typeof inputData === 'string' || typeof inputData === 'number'}
              <!-- Read-only display -->
              <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm">
                {inputData}
              </div>
            {:else if setting.type === 'number'}
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  class="input input-bordered flex-1"
                  value={inputData.value}
                  oninput={(e) => handleEdit(setting.key, Number(e.currentTarget.value))}
                  disabled={!setting.isEditable}
                  min="0"
                />
                {#if inputData.hasChanges}
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick={() => saveSetting(setting)}
                    disabled={saving[setting.key]}
                  >
                    {#if saving[setting.key]}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      Save
                    {/if}
                  </button>
                {/if}
              </div>
            {:else if setting.type === 'boolean'}
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  checked={inputData.value}
                  onchange={(e) => {
                    const checked = e.currentTarget.checked;
                    handleEdit(setting.key, checked);
                    saveSetting({ ...setting, value: checked });
                  }}
                  disabled={!setting.isEditable || saving[setting.key]}
                />
                <span class="text-sm text-base-content/70">
                  {inputData.value ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            {:else if setting.type === 'string'}
              <div class="space-y-2">
                {#if setting.key === 'user_validation.default_role'}
                  <!-- Dropdown for default role -->
                  <select
                    class="select select-bordered w-full"
                    value={inputData.value}
                    onchange={(e) => {
                      const value = e.currentTarget.value;
                      handleEdit(setting.key, value);
                      saveSetting({ ...setting, value });
                    }}
                    disabled={!setting.isEditable || saving[setting.key]}
                  >
                    {#each availableRoles.filter(r => r.user_type_scope === 'operator' || r.user_type_scope === 'both') as role}
                      <option value={role.name}>{role.name}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    value={inputData.value}
                    oninput={(e) => handleEdit(setting.key, e.currentTarget.value)}
                    disabled={!setting.isEditable}
                  />
                  {#if inputData.hasChanges}
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      onclick={() => saveSetting(setting)}
                      disabled={saving[setting.key]}
                    >
                      {#if saving[setting.key]}
                        <span class="loading loading-spinner loading-xs"></span>
                      {:else}
                        Save
                      {/if}
                    </button>
                  {/if}
                {/if}
              </div>
            {/if}

            {#if errors[setting.key]}
              <label class="label">
                <span class="label-text-alt text-error">{errors[setting.key]}</span>
              </label>
            {/if}

            {#if successMessages[setting.key]}
              <label class="label">
                <span class="label-text-alt text-success">{successMessages[setting.key]}</span>
              </label>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>
  {/if}

  <!-- System Information (Read-Only) -->
  <section class="card bg-base-200">
    <div class="card-body">
      <h3 class="card-title flex items-center gap-2">
        <span>System Information</span>
        <HelpTooltip text="Read-only system information" />
      </h3>

      <div class="space-y-4">
        {#each systemSettings as setting}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">{setting.label}</span>
              {#if setting.description}
                <HelpTooltip text={setting.description} />
              {/if}
            </label>
            <div class="rounded-lg border border-base-content/10 bg-base-300/50 px-4 py-3 text-sm font-mono">
              {setting.type === 'boolean' ? (setting.value ? 'Yes' : 'No') : String(setting.value)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>
</div>

<!-- Asset Browser Modal -->
{#if assetBrowserOpen}
  <div class="fixed inset-0 z-[100] flex items-center justify-center lg:left-72 lg:right-0">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/70 backdrop-blur-sm"
      onclick={() => {
        assetBrowserOpen = false;
        currentAssetField = null;
      }}
    ></div>

    <!-- Modal Content -->
    <div class="relative bg-base-200 rounded-2xl shadow-2xl w-full mx-6 max-w-5xl max-h-[85vh] flex flex-col border border-base-300/50">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-base-300/50">
        <div>
          <h3 class="text-xl font-bold text-base-content">Select Audio Asset</h3>
          <p class="text-sm text-base-content/60 mt-1">Choose a sound file to play with text hints sent to room display</p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          onclick={() => {
            assetBrowserOpen = false;
            currentAssetField = null;
          }}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5 fill-current">
            <path d="M6.225 4.811 4.81 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z" />
          </svg>
        </button>
      </div>

      <!-- Asset Browser -->
      <div class="flex-1 overflow-y-auto p-6 bg-base-100/50">
        <AssetBrowser
          mediaType="audio"
          onSelect={handleAssetSelected}
          selectionMode="single"
          selectedAssetId={currentAssetField ? (editedValues[currentAssetField] || undefined) : undefined}
        />
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-base-300/50">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => {
            assetBrowserOpen = false;
            currentAssetField = null;
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Upload System Audio Modal -->
{#if uploadModalOpen}
  <UploadSystemAudioModal
    open={uploadModalOpen}
    onClose={() => { uploadModalOpen = false; }}
    onSuccess={handleUploadSuccess}
  />
{/if}
