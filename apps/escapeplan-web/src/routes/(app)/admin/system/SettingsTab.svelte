<svelte:options runes={true} />

<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import AssetBrowser from '$lib/components/assets/AssetBrowser.svelte';

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

  // Create local reactive copy of settings
  let settings = $state<SettingsData>({
    storage: [],
    backup: [],
    updates: [],
    business: [],
    user_validation: [],
    system: [],
    general: []
  });

  // Initialize settings from props
  $effect(() => {
    settings.storage = [...(initialSettings.storage || [])];
    settings.backup = [...(initialSettings.backup || [])];
    settings.updates = [...(initialSettings.updates || [])];
    settings.business = [...(initialSettings.business || [])];
    settings.user_validation = [...(initialSettings.user_validation || [])];
    settings.system = [...(initialSettings.system || [])];
    settings.general = [...(initialSettings.general || [])];
  });

  let editedValues: Record<string, any> = $state({});
  let saving: Record<string, boolean> = $state({});
  let errors: Record<string, string> = $state({});
  let successMessages: Record<string, string> = $state({});

  // Asset browser modal state
  let assetBrowserOpen = $state(false);
  let currentAssetField = $state<string | null>(null);

  function getDisplayValue(setting: Setting): any {
    return editedValues[setting.key] !== undefined ? editedValues[setting.key] : setting.value;
  }

  function handleEdit(key: string, value: any) {
    editedValues[key] = value;
    delete errors[key];
    delete successMessages[key];
  }

  async function saveSetting(setting: Setting) {
    const newValue = editedValues[setting.key] ?? setting.value;

    saving[setting.key] = true;
    delete errors[setting.key];
    delete successMessages[setting.key];

    try {
      const response = await apiFetch<{ success: boolean; key: string; value: any }>(
        fetch,
        `/admin/settings/${setting.key}`,
        {
          method: 'PUT',
          body: JSON.stringify({ value: newValue }),
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.success) {
        // Update the setting in the local state by finding the category and updating the array
        const category = setting.key.split('.')[0] as keyof SettingsData;
        const categorySettings = settings[category];
        const index = categorySettings.findIndex(s => s.key === setting.key);

        if (index !== -1) {
          // Create new array with updated setting to trigger reactivity
          categorySettings[index] = { ...categorySettings[index], value: newValue };
          settings[category] = [...categorySettings];
        }

        delete editedValues[setting.key];
        successMessages[setting.key] = 'Saved successfully';

        // Clear success message after 3 seconds
        setTimeout(() => {
          delete successMessages[setting.key];
          successMessages = { ...successMessages };
        }, 3000);
      }
    } catch (error: any) {
      errors[setting.key] = error.message || 'Failed to save setting';
    } finally {
      saving[setting.key] = false;
      saving = { ...saving };
      errors = { ...errors };
      successMessages = { ...successMessages };
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

  const storageSettings = $derived(settings.storage || []);
  const backupSettings = $derived(settings.backup || []);
  const updatesSettings = $derived(settings.updates || []);
  const businessSettings = $derived(settings.business || []);
  const userValidationSettings = $derived(settings.user_validation || []);
  const systemSettings = $derived(settings.system || []);
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
        {#each businessSettings as setting}
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
                {#if setting.key === 'business.default_text_hint_sound_asset_id'}
                  <!-- Asset picker for text hint sound -->
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      class="input input-bordered flex-1"
                      value={inputData.value || 'No sound selected'}
                      disabled
                      readonly
                    />
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      onclick={() => openAssetBrowser(setting.key)}
                      disabled={!setting.isEditable || saving[setting.key]}
                    >
                      Select Sound
                    </button>
                    {#if inputData.value && inputData.value !== 'null'}
                      <button
                        type="button"
                        class="btn btn-error btn-sm"
                        onclick={() => {
                          handleEdit(setting.key, null);
                          saveSetting({ ...setting, value: null });
                        }}
                        disabled={!setting.isEditable || saving[setting.key]}
                      >
                        Clear
                      </button>
                    {/if}
                  </div>
                {:else if setting.key.includes('policy')}
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
                {#if inputData.hasChanges && setting.key !== 'business.default_text_hint_sound_asset_id'}
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
