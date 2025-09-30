<script lang="ts">
  import type { ActionData } from './$types';

  const { form } = $props<{ form: ActionData | null }>();
</script>

<section class="relative min-h-screen overflow-hidden px-4 py-12 sm:py-16">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(196,49,49,0.35)_0,transparent_55%),radial-gradient(circle_at_80%_15%,rgba(0,213,200,0.28)_0,transparent_50%),linear-gradient(135deg,rgba(15,17,21,0.9),rgba(15,17,21,0.95))]" aria-hidden="true"></div>
  <div class="relative z-10 mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
    <div class="space-y-8 text-base-content/80">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
        EscapePlan
      </span>
      <div>
        <h1 class="hero-title">EscapePlan operator console</h1>
        <p class="mt-4 max-w-xl text-sm text-base-content/70 sm:text-base">
          Authenticate on the local appliance to manage bookings, timers, and live room feeds. No WAN connection is required.
        </p>
      </div>
      <div class="glass-panel inline-flex items-center gap-3 border-white/10 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        <span class="inline-flex size-2 rounded-full bg-success shadow shadow-success/40"></span>
        <span>Appliance status · Online</span>
      </div>
    </div>

    <div class="glass-panel mx-auto w-full max-w-md border-white/15 bg-base-200/80 p-8">
      <header class="space-y-2 text-center">
        <h2 class="text-3xl font-display font-semibold text-base-content">Operator sign-in</h2>
        <p class="text-sm text-base-content/60">Login using your EscapePlan credentials.</p>
      </header>

      {#if form?.message}
        <div class="alert alert-error mt-6 text-sm">
          <span>{form.message}</span>
        </div>
      {/if}

      <form method="POST" action="/login" class="mt-8 space-y-5">
        <label class="form-control w-full">
          <span class="label-text text-xs font-semibold uppercase tracking-[0.35em] text-base-content/60">Username</span>
          <input
            class="input input-bordered input-primary/70 mt-2 bg-base-100/70"
            name="username"
            type="text"
            placeholder="ops.controller"
            autocomplete="username"
            required
          />
        </label>

        <label class="form-control w-full">
          <span class="label-text text-xs font-semibold uppercase tracking-[0.35em] text-base-content/60">Password</span>
          <input
            class="input input-bordered input-primary/70 mt-2 bg-base-100/70"
            name="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </label>

        <button class="btn btn-primary btn-block mt-6" type="submit">Enter control center</button>
      </form>

      <div class="mt-6 flex items-center justify-center text-xs text-base-content/50">
        <span>Need access? Contact the coordinator.</span>
      </div>
    </div>
  </div>
</section>
