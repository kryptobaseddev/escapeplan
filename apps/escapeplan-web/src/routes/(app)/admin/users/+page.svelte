<script lang="ts">
  import { enhance } from '$app/forms';
  import { formatDistanceToNow } from 'date-fns';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  function relative(date?: string) {
    if (!date) return '—';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  }

  function initials(name?: string) {
    if (!name) return 'EP';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0)?.toUpperCase() ?? '')
      .join('');
  }
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-2">
    <h1 class="section-heading">User Management</h1>
    <p class="text-sm text-base-content/60">
      Create and maintain operator accounts for the EscapePlan appliance. All credentials are stored with Argon2id hashing.
    </p>
  </header>

  <div class="glass-panel border-white/10 bg-base-200/70 p-6">
    <h2 class="text-lg font-semibold text-base-content">Invite new user</h2>
    <form method="POST" action="?/create" use:enhance class="mt-4 grid gap-4 md:grid-cols-2">
      <label class="form-control">
        <span class="label-text">Username</span>
        <input class="input input-bordered" name="username" required />
      </label>
      <label class="form-control">
        <span class="label-text">Display name</span>
        <input class="input input-bordered" name="name" required />
      </label>
      <label class="form-control">
        <span class="label-text">Email (optional)</span>
        <input class="input input-bordered" type="email" name="email" />
      </label>
      <label class="form-control">
        <span class="label-text">Avatar URL (optional)</span>
        <input class="input input-bordered" type="url" name="avatarUrl" placeholder="https://..." />
      </label>
      <label class="form-control">
        <span class="label-text">Initial password</span>
        <input class="input input-bordered" type="password" name="password" minlength="12" required />
      </label>
      <label class="form-control">
        <span class="label-text">Role</span>
        <select class="select select-bordered" name="role">
          <option value="general_manager">General Manager</option>
          <option value="game_master">Game Master</option>
          <option value="technician">Technician</option>
        </select>
      </label>
      <label class="form-control md:col-span-2">
        <span class="label-text">Bio (optional)</span>
        <textarea class="textarea textarea-bordered min-h-[6rem]" name="bio" maxlength="500" placeholder="Add operator details visible to managers."></textarea>
      </label>
      <label class="form-control">
        <span class="label-text">Require password reset</span>
        <input type="checkbox" class="toggle toggle-primary" name="mustResetPassword" />
      </label>
      <div class="md:col-span-2 flex justify-end">
        <button class="btn btn-primary" type="submit">Create user</button>
      </div>
    </form>
  </div>

  <div class="space-y-4">
    {#each data.users as user (user.id)}
      <article class="glass-panel border-white/10 bg-base-200/70 p-6">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="inline-flex size-12 items-center justify-center rounded-2xl bg-base-300/70 text-base font-semibold text-base-content/70">
              {#if user.avatarUrl}
                <img src={user.avatarUrl} alt={user.name} class="size-full rounded-2xl object-cover" />
              {:else}
                {initials(user.name)}
              {/if}
            </div>
            <div>
              <h3 class="text-xl font-display text-base-content">{user.name}</h3>
              <p class="text-sm text-base-content/60">{user.username} · {user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs text-base-content/50">
            <span>Created {relative(user.createdAt)}</span>
            <span class="inline-block h-1 w-1 rounded-full bg-base-content/40"></span>
            <span>Updated {relative(user.updatedAt)}</span>
          </div>
        </header>
        {#if user.bio}
          <p class="mt-3 text-sm text-base-content/60">{user.bio}</p>
        {/if}
        <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <form method="POST" action="?/update" use:enhance class="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <label class="form-control">
              <span class="label-text">Display name</span>
              <input class="input input-bordered" name="name" value={user.name} required />
            </label>
            <label class="form-control">
              <span class="label-text">Email</span>
              <input class="input input-bordered" type="email" name="email" value={user.email ?? ''} />
            </label>
            <label class="form-control">
              <span class="label-text">Avatar URL</span>
              <input
                class="input input-bordered"
                type="url"
                name="avatarUrl"
                value={user.avatarUrl ?? ''}
                placeholder="https://..."
              />
              <span class="label-text-alt">Leave blank to remove the avatar.</span>
            </label>
            <label class="form-control">
              <span class="label-text">Bio</span>
              <textarea class="textarea textarea-bordered min-h-[5rem]" name="bio" maxlength="500">{user.bio ?? ''}</textarea>
              <span class="label-text-alt">Max 500 characters.</span>
            </label>
            <label class="form-control">
              <span class="label-text">Role</span>
              <select class="select select-bordered" name="role" value={user.role}>
                <option value="admin" disabled>Admin</option>
                <option value="general_manager">General Manager</option>
                <option value="game_master">Game Master</option>
                <option value="technician">Technician</option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text">Require password reset</span>
              <input type="checkbox" class="toggle toggle-primary" name="mustResetPassword" checked={user.mustResetPassword} />
            </label>
            <button class="btn btn-sm btn-primary" type="submit">Save changes</button>
          </form>
          <form method="POST" action="?/reset" use:enhance class="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <h4 class="text-sm font-semibold text-base-content">Reset password</h4>
            <label class="form-control">
              <span class="label-text">New password</span>
              <input class="input input-bordered" type="password" name="password" minlength="12" required />
            </label>
            <label class="form-control">
              <span class="label-text">Require reset on next login</span>
              <input type="checkbox" class="toggle toggle-primary" name="forceReset" checked />
            </label>
            <button class="btn btn-sm btn-secondary" type="submit">Reset password</button>
            <p class="text-xs text-base-content/40">Last login: {relative(user.lastLoginAt)}</p>
          </form>
        </div>
        <form method="POST" action="?/delete" use:enhance class="mt-4 flex justify-end">
          <input type="hidden" name="id" value={user.id} />
          <button class="btn btn-sm btn-ghost border border-error/40 text-error" type="submit" disabled={user.role === 'admin'}>
            Remove user
          </button>
        </form>
      </article>
    {/each}
  </div>
</section>

<style>
  form:global(.pending) {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
