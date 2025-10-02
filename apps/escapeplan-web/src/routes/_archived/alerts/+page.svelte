<svelte:options runes={true} />

<script lang="ts">
  import type { PageData } from './$types';
  import type { AlertRule, UpdateAlertRuleRequest } from '@escapeplan/contracts';
  import { apiFetch } from '$lib/api/client';

  let { data } = $props<{ data: PageData }>();

  let rules = $state<AlertRule[]>(data.rules ?? []);
  let editingRule = $state<string | null>(null);
  let editForm = $state<Partial<UpdateAlertRuleRequest>>({});
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  const setToast = (message: string, type: 'success' | 'error' = 'success') => {
    toast = { message, type };
    setTimeout(() => (toast = null), 3000);
  };

  const toggleEnabled = async (rule: AlertRule) => {
    try {
      await apiFetch(fetch, `/api/admin/alert-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled })
      });
      rule.enabled = !rule.enabled;
      setToast(`Alert rule ${rule.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle rule', error);
      setToast('Failed to update rule', 'error');
    }
  };

  const startEdit = (rule: AlertRule) => {
    editingRule = rule.id;
    editForm = {
      level: rule.level,
      title_template: rule.title_template,
      message_template: rule.message_template
    };
  };

  const cancelEdit = () => {
    editingRule = null;
    editForm = {};
  };

  const saveEdit = async (ruleId: string) => {
    try {
      await apiFetch(fetch, `/api/admin/alert-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const rule = rules.find((r) => r.id === ruleId);
      if (rule && editForm.level) rule.level = editForm.level;
      if (rule && editForm.title_template) rule.title_template = editForm.title_template;
      if (rule && editForm.message_template) rule.message_template = editForm.message_template;

      setToast('Alert rule updated');
      cancelEdit();
    } catch (error) {
      console.error('Failed to save rule', error);
      setToast('Failed to save changes', 'error');
    }
  };

  const getLevelBadge = (level: string) => {
    const badges: Record<string, string> = {
      critical: 'badge-error',
      warning: 'badge-warning',
      info: 'badge-info'
    };
    return badges[level] || 'badge-ghost';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      timer: '⏱',
      hint: '💡',
      network: '🌐',
      system: '⚙️',
      session: '🎮'
    };
    return icons[category] || '•';
  };
</script>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
  <header>
    <h1 class="text-3xl font-bold">Alert Rules</h1>
    <p class="mt-2 text-sm text-base-content/60">
      Configure when alerts are generated for operators
    </p>
  </header>

  {#if toast}
    <div class={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'}`}>
      <span>{toast.message}</span>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2">
    {#each rules as rule}
      <div class="card bg-base-200">
        <div class="card-body">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{getCategoryIcon(rule.category)}</span>
              <div>
                <h3 class="card-title text-base">{rule.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</h3>
                <p class="text-xs text-base-content/60">{rule.description || 'No description'}</p>
              </div>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-success"
              checked={rule.enabled}
              onchange={() => toggleEnabled(rule)}
            />
          </div>

          {#if editingRule === rule.id}
            <div class="mt-4 space-y-3 border-t border-base-300 pt-4">
              <div>
                <label class="label">
                  <span class="label-text text-xs">Alert Level</span>
                </label>
                <select class="select select-bordered select-sm w-full" bind:value={editForm.level}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label class="label">
                  <span class="label-text text-xs">Title Template</span>
                </label>
                <input
                  type="text"
                  class="input input-bordered input-sm w-full"
                  bind:value={editForm.title_template}
                />
              </div>

              <div>
                <label class="label">
                  <span class="label-text text-xs">Message Template</span>
                </label>
                <textarea
                  class="textarea textarea-bordered textarea-sm w-full"
                  rows="2"
                  bind:value={editForm.message_template}
                ></textarea>
                <p class="mt-1 text-xs text-base-content/40">
                  Use {'{{'}gameName{'}}'}{'{'}, {'{{'}roomName{'}}'}{'{'}, {'{{'}time{'}}'} for dynamic values
                </p>
              </div>

              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm" onclick={() => saveEdit(rule.id)}>
                  Save Changes
                </button>
                <button class="btn btn-ghost btn-sm" onclick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          {:else}
            <div class="mt-4 space-y-2 border-t border-base-300 pt-4 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-base-content/60">Level</span>
                <span class={`badge badge-sm ${getLevelBadge(rule.level)}`}>
                  {rule.level}
                </span>
              </div>
              <div>
                <span class="font-semibold text-base-content/60">Title:</span>
                <span class="ml-2 text-base-content">{rule.title_template}</span>
              </div>
              <div>
                <span class="font-semibold text-base-content/60">Message:</span>
                <span class="ml-2 text-base-content">{rule.message_template}</span>
              </div>
              {#if rule.auto_dismiss_on && rule.auto_dismiss_on.length > 0}
                <div>
                  <span class="font-semibold text-base-content/60">Auto-dismiss on:</span>
                  <span class="ml-2 text-base-content">{rule.auto_dismiss_on.join(', ')}</span>
                </div>
              {/if}
              <button class="btn btn-ghost btn-sm mt-2 w-full" onclick={() => startEdit(rule)}>
                Edit Rule
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
