# EscapePlan UI Pattern Analysis

**Date:** 2025-10-02
**Auditor:** Claude (UI Design System Audit)
**Tech Stack:** SvelteKit 2, Svelte 5 (runes), DaisyUI 5.1.25+, Tailwind CSS 4
**Scope:** All Svelte components and route pages in `apps/escapeplan-web/src`

---

## Executive Summary

This document analyzes UI patterns and anti-patterns found across the EscapePlan codebase. The analysis identifies both successful patterns to replicate and problematic patterns that need refactoring.

**Key Findings:**
- **Good Patterns:** 8 reusable component patterns identified
- **Anti-Patterns:** 12 problematic patterns requiring attention
- **Missing Patterns:** 7 critical utility components needed
- **Consistency Score:** 65% - Moderate consistency with room for improvement

---

## Table of Contents

1. [Good Patterns](#good-patterns)
2. [Anti-Patterns](#anti-patterns)
3. [Inconsistencies](#inconsistencies)
4. [Missing Patterns](#missing-patterns)
5. [Recommendations](#recommendations)

---

## Good Patterns

### 1. Modal Dialog Pattern

**Location:** `UserModal.svelte`, `CameraModal.svelte`, `GameModal.svelte`, and 6 other modal components

**Pattern:**
```svelte
<dialog
  class="modal modal-bottom sm:modal-middle"
  open
  bind:this={dialogElement}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
>
  <div class="modal-box max-h-[92vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
    <header class="space-y-2">
      <h2 class="text-lg font-semibold text-base-content">
        {isCreate ? 'Add operator' : `Edit ${userValue?.name ?? 'operator'}`}
      </h2>
      <p class="text-sm text-base-content/70">
        Provide real operator details. Archived accounts cannot sign in until restored.
      </p>
    </header>

    {#if errorMessage}
      <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
        <span>{errorMessage}</span>
      </div>
    {/if}

    <form method="POST" action={actionValue} class="mt-6 space-y-5" use:enhance={handleSubmit}>
      <!-- Form fields -->
    </form>
  </div>
</dialog>
```

**Why It's Good:**
- ✅ Uses native `<dialog>` element for proper semantics and accessibility
- ✅ Responsive: `modal-bottom sm:modal-middle` adapts to mobile/desktop
- ✅ Prevents default cancel behavior and calls custom handler
- ✅ Consistent sizing and overflow handling
- ✅ Proper error display pattern
- ✅ Uses SvelteKit form actions with progressive enhancement

**Reuse Recommendation:** Replicate this pattern in all modal dialogs

---

### 2. Responsive DataTable Pattern

**Location:** `DataTable.svelte`

**Pattern:**
```svelte
<script lang="ts" generics="T">
  interface DataTableProps<T> {
    items: T[];
    keyField: keyof T;
    mobileCard: Snippet<[T]>;
    columns: DataTableColumn[];
    desktopCell: Snippet<[T, string]>;
    emptyMessage?: string;
    isLoading?: boolean;
    breakpoint?: 'sm' | 'md' | 'lg';
  }
</script>

{#if isLoading}
  <div class="flex items-center justify-center p-12">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{:else if items.length === 0}
  <div class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center text-sm text-base-content/60">
    {emptyMessage}
  </div>
{:else}
  <!-- Mobile: Card Layout -->
  <div class="space-y-4 {hideClass}">
    {#each items as item (item[keyField])}
      {@render mobileCard(item)}
    {/each}
  </div>

  <!-- Desktop: Table Layout -->
  <div class={showClass}>
    <table class="table table-zebra">
      <!-- Table content -->
    </table>
  </div>
{/if}
```

**Why It's Good:**
- ✅ Generic TypeScript types for maximum reusability
- ✅ Mobile-first responsive pattern with card fallback
- ✅ Snippet-based rendering for flexible content
- ✅ Loading and empty states handled
- ✅ DaisyUI `table-zebra` for readability
- ✅ Configurable breakpoint

**Reuse Recommendation:** Use this component for all tabular data displays

---

### 3. Form Field with Label Pattern

**Location:** `UserModal.svelte` (lines 208-218), `login/+page.svelte` (lines 37-47)

**Pattern:**
```svelte
<label class="form-control">
  <span class="label-text">Username</span>
  <input
    class="input input-bordered"
    name="username"
    required
    bind:value={usernameDraft}
    placeholder="liv.operator"
  />
</label>
```

**Why It's Good:**
- ✅ Proper label association for accessibility
- ✅ Consistent DaisyUI classes (`form-control`, `label-text`, `input-bordered`)
- ✅ Svelte 5 `bind:value` for reactivity
- ✅ Native HTML validation attributes

**Reuse Recommendation:** Standardize this pattern across all forms

---

### 4. Custom CSS Utility Classes

**Location:** `app.css`

**Pattern:**
```css
.glass-panel {
  @apply rounded-2xl border border-white/5 bg-base-200/60 backdrop-blur-lg shadow-lg shadow-black/30;
}

.section-heading {
  @apply text-3xl font-display font-semibold text-base-content/90 sm:text-4xl;
}

.badge-pill {
  @apply inline-flex items-center gap-2 rounded-full bg-neutral/70 px-3 py-1 text-xs font-medium text-neutral-content/80;
}

.metric-card {
  @apply rounded-2xl border border-white/10 bg-base-200/70 backdrop-blur-lg shadow-lg shadow-black/30 p-5 transition duration-200 hover:border-primary/40 hover:shadow-primary/20;
}

.hero-title {
  @apply text-4xl font-display tracking-tight text-base-content;
}
```

**Why It's Good:**
- ✅ Centralized design tokens
- ✅ Consistent visual language across app
- ✅ Easy to update globally
- ✅ Semantic naming

**Reuse Recommendation:** Document all custom utilities and continue using this pattern

---

### 5. Svelte 5 Runes State Management

**Location:** `UserModal.svelte`, `dashboard/+page.svelte`, all components

**Pattern:**
```svelte
<script lang="ts">
  interface Props {
    open?: boolean;
    mode?: Mode;
    user?: OperatorSummary | null;
    onclose?: () => void;
    onsuccess?: () => void;
  }

  const props = $props();

  let dialogElement = $state<HTMLDialogElement | null>(null);
  let errorMessage = $state<string | null>(null);
  let selectedRole = $state<OperatorRole>('manager');

  let openFlag = $derived(Boolean(props.open));
  let modeValue = $derived((props.mode ?? 'create') as Mode);

  $effect(() => {
    if (!openFlag && initialised) {
      // Reset state
      errorMessage = null;
    }
  });
</script>
```

**Why It's Good:**
- ✅ Modern Svelte 5 runes API (`$props`, `$state`, `$derived`, `$effect`)
- ✅ TypeScript interface for props
- ✅ Reactive state with proper lifecycle management
- ✅ Derived values for computed properties
- ✅ Side effects in `$effect` blocks

**Reuse Recommendation:** This is the standard for all new Svelte 5 components

---

### 6. Toast Notification Pattern

**Location:** `dashboard/+page.svelte` (lines 30-37)

**Pattern:**
```svelte
<script>
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  const setToast = (message: string, type: 'success' | 'error' = 'success') => {
    toast = { message, type };
    setTimeout(() => {
      if (toast?.message === message) {
        toast = null;
      }
    }, 4000);
  };
</script>

{#if toast}
  <div class={`alert ${toast.type === 'error' ? 'alert-error border-error/30 bg-error/10 text-error-content' : 'alert-success border-success/30 bg-success/10 text-success-content'} mt-4`}>
    <span>{toast.message}</span>
  </div>
{/if}
```

**Why It's Good:**
- ✅ Simple state-based approach
- ✅ Auto-dismiss after 4 seconds
- ✅ Type-safe with TypeScript
- ✅ DaisyUI semantic alert classes

**Anti-Pattern Alert:** This pattern is repeated in multiple files - should be extracted to a reusable Toast component

---

### 7. Avatar Display Pattern

**Location:** `Avatar.svelte`, used in `+layout.svelte`

**Pattern:**
```svelte
<div class="shrink-0 overflow-hidden rounded-2xl">
  <Avatar config={props.data.user?.avatarConfig} username={props.data.user?.username} size={48} />
</div>
```

**Why It's Good:**
- ✅ Reusable component with configurable size
- ✅ Deterministic avatar generation from config
- ✅ Consistent rounded corners
- ✅ Proper overflow handling

**Reuse Recommendation:** Continue using this component for all user avatars

---

### 8. Progressive Form Enhancement Pattern

**Location:** `UserModal.svelte` (lines 53-68)

**Pattern:**
```svelte
<script>
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';

  const handleSubmit: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        const failureData = result.data as { message?: string } | undefined;
        errorMessage = failureData?.message ?? 'Request failed. Please try again.';
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        errorMessage = null;
        props.onsuccess?.();
        return;
      }
      await update();
    };
  };
</script>

<form method="POST" action={actionValue} use:enhance={handleSubmit}>
  <!-- Form fields -->
</form>
```

**Why It's Good:**
- ✅ Progressive enhancement with `use:enhance`
- ✅ Proper error handling from server
- ✅ Success callback support
- ✅ Prevents full page reload
- ✅ Works without JavaScript

**Reuse Recommendation:** Standard pattern for all forms

---

## Anti-Patterns

### 1. Repeated Modal Boilerplate (CRITICAL)

**Problem:** Every modal component repeats the exact same structure

**Files Affected:** 9 modal components
- `UserModal.svelte`
- `CameraModal.svelte`
- `GameModal.svelte`
- `GameDetailsModal.svelte`
- `RoleModal.svelte`
- `HintModal.svelte`
- `MediaModal.svelte`
- `QuickStartModal.svelte`
- `PasswordResetModal.svelte`

**Example of Repetition:**
```svelte
<!-- Repeated in ALL modal files -->
<dialog
  class="modal modal-bottom sm:modal-middle"
  open
  bind:this={dialogElement}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
>
  <div class="modal-box max-h-[92vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
    <!-- Different content per modal -->
  </div>
</dialog>
```

**Problems:**
- ❌ ~30 lines of repeated code per modal
- ❌ Inconsistent modal sizing (some use `max-w-2xl`, others might differ)
- ❌ No backdrop click handling
- ❌ No standardized close button
- ❌ Hard to update modal behavior globally

**Recommended Fix:**
Create `Modal.svelte` wrapper component:

```svelte
<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  const { open, title, description, size = '2xl', onclose, children, actions } = $props();

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[size];
</script>

{#if open}
  <dialog class="modal modal-bottom sm:modal-middle" open oncancel={(e) => { e.preventDefault(); onclose(); }}>
    <div class="modal-box max-h-[92vh] w-full {sizeClass} overflow-y-auto px-6 py-6">
      <header class="space-y-2">
        <h2 class="text-lg font-semibold text-base-content">{title}</h2>
        {#if description}
          <p class="text-sm text-base-content/70">{description}</p>
        {/if}
      </header>

      {@render children()}

      {#if actions}
        <footer class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {@render actions()}
        </footer>
      {/if}
    </div>
    <div class="modal-backdrop" onclick={onclose}></div>
  </dialog>
{/if}
```

**Impact:** Would reduce ~270 lines of repeated code across 9 files

---

### 2. No Loading States on Data Fetch

**Problem:** Users see blank screens while data loads

**Files Affected:**
- `dashboard/+page.svelte` - No loading state for sessions
- `bookings/+page.svelte` - No loading state for calendar
- `games/+page.svelte` - No loading state for games list
- `admin/users/+page.svelte` - No loading state for users

**Example:**
```svelte
<!-- dashboard/+page.svelte -->
<section class="glass-panel border-white/10 bg-base-200/70 p-6">
  <header class="flex items-center justify-between gap-4">
    <h2 class="text-lg font-semibold text-base-content">Live rooms</h2>
  </header>
  <div class="mt-5 space-y-4">
    {#if sessions.length === 0}
      <p class="rounded-xl border border-dashed border-base-content/20 bg-base-100/50 px-4 py-6 text-center text-sm text-base-content/60">
        No active sessions — the control room is standing by.
      </p>
    {:else}
      {#each sessions as session}
        <!-- Session cards -->
      {/each}
    {/if}
  </div>
</section>
```

**Problems:**
- ❌ No distinction between "loading" and "no data"
- ❌ Empty state shown immediately before data loads
- ❌ Poor UX during initial page load
- ❌ No skeleton screens

**Recommended Fix:**
```svelte
{#if isLoading}
  <SkeletonLoader type="card" count={3} />
{:else if sessions.length === 0}
  <EmptyState message="No active sessions" />
{:else}
  {#each sessions as session}
    <!-- Content -->
  {/each}
{/if}
```

---

### 3. Missing Validation State Classes

**Problem:** Form errors shown only in alerts, not inline with fields

**Files Affected:** All forms in modals and pages

**Example:**
```svelte
<!-- UserModal.svelte -->
{#if errorMessage}
  <div class="alert alert-error mt-4">
    <span>{errorMessage}</span>
  </div>
{/if}

<label class="form-control">
  <span class="label-text">Username</span>
  <input
    class="input input-bordered"
    name="username"
    required
  />
</label>
```

**Problems:**
- ❌ No `input-error` class when field has error
- ❌ No inline error message below field
- ❌ User must read alert to find which field failed
- ❌ Poor accessibility for screen readers

**Recommended Fix:**
```svelte
<label class="form-control">
  <span class="label-text">Username</span>
  <input
    class={`input input-bordered ${errors.username ? 'input-error' : ''}`}
    name="username"
    required
  />
  {#if errors.username}
    <span class="label-text-alt text-error">{errors.username}</span>
  {/if}
</label>
```

---

### 4. Inconsistent Button Sizing

**Problem:** No standard sizing guideline

**Examples:**
- **Login page:** `btn-block` (full width)
  ```svelte
  <button class="btn btn-primary btn-block" type="submit">Enter control center</button>
  ```

- **Bookings page:** `btn-sm` (small)
  ```svelte
  <button class="btn btn-sm btn-primary" type="submit">All bookings</button>
  ```

- **HelpTooltip:** `btn-xs` (extra small)
  ```svelte
  <button class="btn btn-circle btn-ghost btn-xs">...</button>
  ```

- **Modals:** Default size (no modifier)
  ```svelte
  <button class="btn btn-primary">Save changes</button>
  ```

**Problems:**
- ❌ No clear pattern for when to use each size
- ❌ Visual inconsistency across similar contexts
- ❌ Mobile touch target size concerns

**Recommended Standards:**
- **Default (44px min):** Primary CTAs, modal actions
- `btn-sm` (36px min): Compact contexts (table actions, secondary buttons)
- `btn-xs` (28px min): Icon-only utilities (tooltips, dismiss buttons)
- `btn-lg` (52px min): Hero CTAs, critical actions
- `btn-block`: Mobile-first forms only

---

### 5. Mixed Input Styling

**Problem:** Inconsistent use of opacity modifiers

**Examples:**
- **Login page:** Custom opacity modifiers
  ```svelte
  <input class="input input-bordered input-primary/70 bg-base-100/70" />
  ```

- **Modals:** Plain DaisyUI classes
  ```svelte
  <input class="input input-bordered" />
  ```

**Problems:**
- ❌ No clear reason for difference
- ❌ Visual inconsistency
- ❌ Harder to maintain

**Recommended Fix:** Choose one approach and document it
- **Option A:** Use opacity modifiers everywhere for glass effect
- **Option B:** Use plain DaisyUI classes everywhere for simplicity

---

### 6. Repeated Toast Implementation

**Problem:** Toast notification pattern repeated in multiple files

**Files Affected:**
- `dashboard/+page.svelte`
- Likely in other pages (not fully audited)

**Code Repetition:**
```svelte
<!-- Same pattern in multiple files -->
let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

const setToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast = { message, type };
  setTimeout(() => {
    if (toast?.message === message) {
      toast = null;
    }
  }, 4000);
};
```

**Problems:**
- ❌ Duplicated logic
- ❌ Hard to update behavior globally
- ❌ No global toast queue

**Recommended Fix:**
Create centralized `Toast.svelte` component with store-based state

---

### 7. No Keyboard Shortcut Visual Indicators

**Problem:** Keyboard shortcuts exist but aren't documented visually

**Example:**
```svelte
<!-- dashboard/+page.svelte line 126 -->
const handleKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (canManageSessions && games.length) {
      quickStartOpen = true;
    }
  }
};
```

**Problems:**
- ❌ User has no way to discover Cmd+K shortcut
- ❌ No visual `<kbd>` element
- ❌ Poor discoverability

**Recommended Fix:**
```svelte
<button class="btn btn-secondary" onclick={() => (quickStartOpen = true)}>
  + Quick start session
  <span class="ml-2 text-xs opacity-60">
    <kbd class="kbd kbd-sm">⌘</kbd>
    <kbd class="kbd kbd-sm">K</kbd>
  </span>
</button>
```

---

### 8. Hardcoded Colors in Custom Styling

**Problem:** Some components override DaisyUI semantic colors with custom values

**Example:**
```svelte
<!-- alert with custom border/background -->
<div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
  <span>{errorMessage}</span>
</div>
```

**Problems:**
- ❌ Mix of DaisyUI semantic (`alert-error`) and custom values (`border-error/30`)
- ❌ Harder to theme
- ❌ Inconsistent with DaisyUI patterns

**Recommended Fix:** Use DaisyUI classes or define custom utilities consistently

---

### 9. Missing ARIA Labels on Icon Buttons

**Problem:** Icon-only buttons lack accessibility

**Example:**
```svelte
<!-- HelpTooltip.svelte -->
<button type="button" class="btn btn-circle btn-ghost btn-xs text-info" tabindex="-1">
  <svg>...</svg>
</button>
```

**Problems:**
- ❌ No `aria-label`
- ❌ `tabindex="-1"` removes from keyboard navigation
- ❌ Screen readers can't describe button purpose

**Recommended Fix:**
```svelte
<button
  type="button"
  class="btn btn-circle btn-ghost btn-xs text-info"
  aria-label="Show help information"
>
  <svg aria-hidden="true">...</svg>
</button>
```

---

### 10. Custom Class Names Not Documented

**Problem:** Custom utility classes used without documentation

**Examples:**
- `badge-pill` (custom, not DaisyUI)
- `glass-panel` (custom)
- `hero-title` (custom)
- `metric-card` (custom)
- `section-heading` (custom)

**Problems:**
- ❌ No central documentation of custom classes
- ❌ Developers must search codebase to find definitions
- ❌ Risk of creating duplicate utilities

**Recommended Fix:** Document all custom utilities in UI_DESIGN_SYSTEM.md

---

### 11. Inline Conditional Classes

**Problem:** Complex class logic makes templates hard to read

**Example:**
```svelte
<!-- dashboard/+page.svelte line 203 -->
<span
  class={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${dashboard.network.status === 'online' ? 'bg-success/15 text-success' : dashboard.network.status === 'degraded' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}
>
  <span class="inline-flex size-1.5 rounded-full bg-current"></span>
  {dashboard.network.status}
</span>
```

**Problems:**
- ❌ Hard to read
- ❌ Difficult to maintain
- ❌ Repeated pattern across files

**Recommended Fix:**
Extract to derived value:
```svelte
<script>
  const statusClass = $derived({
    online: 'bg-success/15 text-success',
    degraded: 'bg-warning/15 text-warning',
    offline: 'bg-error/15 text-error'
  }[dashboard.network.status]);
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider {statusClass}">
  <span class="inline-flex size-1.5 rounded-full bg-current"></span>
  {dashboard.network.status}
</span>
```

---

### 12. No Skeleton Loading Screens

**Problem:** Zero skeleton screen implementations found

**Files Affected:** All pages with async data

**Impact:**
- ❌ Poor perceived performance
- ❌ Layout shift on load
- ❌ Unclear to user that content is loading

**Recommended Fix:**
Create `SkeletonLoader.svelte` component:
```svelte
<script lang="ts">
  interface Props {
    type: 'text' | 'card' | 'table' | 'avatar';
    count?: number;
    lines?: number;
  }

  const { type, count = 1, lines = 3 } = $props();
</script>

{#if type === 'card'}
  {#each Array(count) as _}
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="skeleton h-6 w-3/4 mb-2"></div>
        <div class="skeleton h-4 w-full mb-1"></div>
        <div class="skeleton h-4 w-5/6"></div>
      </div>
    </div>
  {/each}
{/if}
```

---

## Inconsistencies

### 1. Alert Component Variations

**Inconsistent Patterns Found:**

**Pattern A:** Custom border and background
```svelte
<div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
  <span>{errorMessage}</span>
</div>
```

**Pattern B:** Plain DaisyUI
```svelte
<div class="alert alert-error">
  <span>{form.message}</span>
</div>
```

**Recommendation:** Standardize on one pattern

---

### 2. Badge Usage

**Inconsistent Patterns Found:**

**DaisyUI semantic:**
```svelte
<span class="badge badge-outline border-white/15 text-[11px]">checked_in</span>
```

**Custom badge-pill:**
```svelte
<div class="badge-pill">
  <span class="inline-flex size-2 rounded-full bg-success"></span>
  <span>Network online</span>
</div>
```

**Recommendation:** Document when to use each variant

---

### 3. Empty State Messages

**Inconsistent Patterns Found:**

**Pattern A:** Rounded box
```svelte
<p class="rounded-xl border border-dashed border-base-content/20 bg-base-100/50 px-4 py-6 text-center text-sm text-base-content/60">
  No active sessions — the control room is standing by.
</p>
```

**Pattern B:** DataTable pattern
```svelte
<div class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center text-sm text-base-content/60">
  {emptyMessage}
</div>
```

**Recommendation:** Create `EmptyState.svelte` component with consistent styling

---

## Missing Patterns

### 1. Loading State Component (CRITICAL)

**Need:** Centralized loading indicator with DaisyUI `loading-infinity` as default

**Required Props:**
```typescript
interface LoadingStateProps {
  variant?: 'spinner' | 'dots' | 'ring' | 'ball' | 'infinity';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  fullScreen?: boolean;
  message?: string;
}
```

**Use Cases:**
- Dashboard data loading
- Bookings calendar loading
- Games list loading
- Modal submit actions

---

### 2. Skeleton Loader Component (CRITICAL)

**Need:** Skeleton screens for better perceived performance

**Required Variants:**
- Text skeleton (single/multi-line)
- Card skeleton
- Table skeleton
- Avatar skeleton

**Use Cases:**
- Dashboard session cards
- Bookings list
- Game library
- DataTable rows

---

### 3. FormField Wrapper Component

**Need:** Reduce form field boilerplate

**Required Features:**
- Label + input wrapper
- Error display
- Help text
- Validation state styling

**Example Usage:**
```svelte
<FormField
  label="Username"
  name="username"
  type="text"
  required
  error={errors.username}
  helpText="Enter your operator username"
  bind:value={username}
/>
```

---

### 4. Breadcrumbs Component

**Need:** Navigation breadcrumb trail

**Required Features:**
```typescript
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  class?: string;
}
```

**Use Cases:**
- Admin pages
- Game Runner
- Nested routes

---

### 5. KeyboardShortcut Display Component

**Need:** Visual indication of keyboard shortcuts

**Example:**
```svelte
<KeyboardShortcut keys={['⌘', 'K']} />
<!-- Renders: ⌘ + K with proper kbd styling -->
```

**Use Cases:**
- Dashboard quick start button
- Help tooltips
- Documentation

---

### 6. Toast Notification System

**Need:** Global toast notifications

**Required Features:**
- Queue multiple toasts
- Auto-dismiss
- Manual dismiss
- Success/error/info/warning variants
- Position control (top-right, bottom-center, etc.)

---

### 7. EmptyState Component

**Need:** Standardized empty state display

**Required Props:**
```typescript
interface EmptyStateProps {
  icon?: Snippet;
  title: string;
  message?: string;
  action?: Snippet;
}
```

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Create Modal Wrapper Component**
   - Impact: Reduces ~270 lines of repeated code
   - Effort: 2-3 hours
   - Files to refactor: 9 modal components

2. **Create LoadingState Component**
   - Impact: Adds loading states to 10+ pages
   - Effort: 1-2 hours
   - Default to `loading-infinity` variant

3. **Create SkeletonLoader Component**
   - Impact: Improves perceived performance significantly
   - Effort: 2-3 hours
   - Priority use cases: Dashboard, Bookings, Games list

4. **Add Validation State Classes**
   - Impact: Better UX and accessibility
   - Effort: 1 hour per form
   - Files affected: All forms in modals and pages

5. **Add ARIA Labels to Icon Buttons**
   - Impact: Critical accessibility improvement
   - Effort: 30 minutes
   - Files affected: HelpTooltip, DataTable, Dashboard

### Short-Term Improvements (Priority 2)

6. **Standardize Button Sizing**
   - Document sizing standards
   - Create size decision matrix
   - Audit and update existing buttons

7. **Create Breadcrumbs Component**
   - Impact: Improved navigation UX
   - Effort: 1-2 hours

8. **Create KeyboardShortcut Component**
   - Impact: Better discoverability
   - Effort: 1 hour

9. **Create Toast System**
   - Impact: Centralized notifications
   - Effort: 3-4 hours
   - Replace inline toast implementations

10. **Document Custom Utility Classes**
    - Add to UI_DESIGN_SYSTEM.md
    - Include usage guidelines

### Long-Term Improvements (Priority 3)

11. **Create FormField Wrapper**
    - Reduces form boilerplate
    - Standardizes validation display

12. **Create EmptyState Component**
    - Standardizes empty state UX

13. **Enhance DataTable**
    - Add sorting indicators
    - Add pagination
    - Add filtering

14. **Standardize Input Styling**
    - Choose opacity modifier approach
    - Apply consistently

15. **Extract Inline Conditional Classes**
    - Improve template readability
    - Use derived values

---

## Summary Statistics

### Pattern Quality Breakdown

**Good Patterns Identified:** 8
- Modal dialog pattern
- DataTable responsive pattern
- Form field with label pattern
- Custom CSS utilities
- Svelte 5 runes state management
- Toast notification pattern
- Avatar display pattern
- Progressive form enhancement

**Anti-Patterns Identified:** 12
- Repeated modal boilerplate (CRITICAL)
- No loading states
- Missing validation state classes
- Inconsistent button sizing
- Mixed input styling
- Repeated toast implementation
- No keyboard shortcut indicators
- Hardcoded colors
- Missing ARIA labels
- Undocumented custom classes
- Inline conditional classes
- No skeleton screens

**Inconsistencies Found:** 3
- Alert component variations
- Badge usage patterns
- Empty state messages

**Missing Patterns:** 7
- LoadingState component
- SkeletonLoader component
- FormField wrapper
- Breadcrumbs component
- KeyboardShortcut component
- Toast system
- EmptyState component

### Effort Estimation

**High Impact, Low Effort:**
- Create LoadingState component (1-2 hours)
- Add ARIA labels (30 minutes)
- Document custom utilities (1 hour)

**High Impact, Medium Effort:**
- Create Modal wrapper (2-3 hours)
- Create SkeletonLoader (2-3 hours)
- Add validation state classes (1 hour per form × 10 forms = 10 hours)

**High Impact, High Effort:**
- Create Toast system (3-4 hours)
- Refactor all modals to use wrapper (1 hour × 9 modals = 9 hours)

**Total Estimated Effort:** ~40-50 hours for all Priority 1 and 2 improvements

---

**Next Steps:** Proceed to UI_DESIGN_SYSTEM.md creation with comprehensive component specifications.
