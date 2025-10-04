<svelte:options runes={true} />

<script lang="ts">
  import { apiFetch } from '$lib/api/client';
  import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

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
    system: Setting[];
    general: Setting[];
  }

  let {
    settings: initialSettings
  }: {
    settings: SettingsData;
  } = $props();

  // Create local reactive copy of settings
  let settings = $state<SettingsData>({
    storage: [],
    backup: [],
    updates: [],
    business: [],
    system: [],
    general: []
  });

  // Initialize settings from props
  $effect(() => {
    settings.storage = [...initialSettings.storage];
    settings.backup = [...initialSettings.backup];
    settings.updates = [...initialSettings.updates];
    settings.business = [...initialSettings.business];
    settings.system = [...initialSettings.system];
    settings.general = [...initialSettings.general];
  });

  let editedValues: Record<string, any> = $state({});
  let saving: Record<string, boolean> = $state({});
  let errors: Record<string, string> = $state({});
  let successMessages: Record<string, string> = $state({});

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
        // Update the setting in the local state
        setting.value = newValue;
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

  const storageSettings = $derived(settings.storage || []);
  const backupSettings = $derived(settings.backup || []);
  const updatesSettings = $derived(settings.updates || []);
  const businessSettings = $derived(settings.business || []);
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
