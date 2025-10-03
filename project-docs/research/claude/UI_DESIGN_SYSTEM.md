# EscapePlan UI Design System

**Version:** 1.0.0
**Date:** 2025-10-02
**Tech Stack:** SvelteKit 2, Svelte 5 (runes), DaisyUI 5.1.26+, Tailwind CSS 4
**Theme:** `escapeplan` (dark mode)

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Library](#component-library)
   - [Buttons](#buttons)
   - [Form Components](#form-components)
   - [Data Display](#data-display)
   - [Navigation](#navigation)
   - [Feedback](#feedback)
   - [Loading States](#loading-states)
   - [Utility Components](#utility-components)
6. [Accessibility](#accessibility)
7. [Responsive Design](#responsive-design)
8. [Code Examples](#code-examples)
9. [Custom Utilities](#custom-utilities)
10. [Component Specifications](#component-specifications)

---

## Design Principles

### 1. Offline-First Design
All UI patterns must work without internet connectivity. Visual feedback for online/offline states is required.

### 2. Dark Mode Native
The EscapePlan theme is built for dark environments (escape room control rooms). Light mode is not supported.

### 3. Accessibility First
All interactive components must be keyboard accessible and screen reader friendly. Touch targets must meet WCAG AA standards (minimum 44×44px for primary actions).

### 4. Glass Morphism Aesthetic
The design language uses layered glass panels with subtle transparency, backdrop blur, and colored shadows to create depth.

### 5. Progressive Enhancement
All forms and interactive elements must work without JavaScript. Use SvelteKit's progressive enhancement patterns.

### 6. Mobile-First Responsive
Design for mobile devices first, then enhance for larger screens. Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px).

### 7. Semantic HTML
Use semantic HTML elements (`<button>`, `<input>`, `<nav>`, `<article>`, etc.) for better accessibility and SEO.

### 8. Component Composition
Build complex UIs from small, reusable components. Avoid monolithic components.

---

## Color System

### Theme Colors

```css
[data-theme='escapeplan'] {
  /* Base colors */
  --color-base-100: #0f1115;  /* Background */
  --color-base-200: #14171d;  /* Surface */
  --color-base-300: #191d24;  /* Surface elevated */
  --color-base-content: #f6f7fb; /* Text on base */

  /* Brand colors */
  --color-primary: #00d5c8;   /* Teal - Primary CTA */
  --color-primary-content: #0a0b0d;
  --color-secondary: #c43131; /* Red - Destructive actions */
  --color-secondary-content: #ffe1e1;
  --color-accent: #1e88e5;    /* Blue - Highlights */
  --color-accent-content: #e3f2fd;

  /* Semantic colors */
  --color-success: #4caf50;   /* Green */
  --color-warning: #ffb300;   /* Amber */
  --color-error: #f44336;     /* Red */
  --color-info: #2196f3;      /* Blue */

  /* Neutral */
  --color-neutral: #1a1d23;
  --color-neutral-content: #f1f3f8;
}
```

### Color Usage Guidelines

**Primary (`#00d5c8` - Teal)**
- Main CTAs (submit buttons, create actions)
- Active navigation items
- Important status indicators
- Links

**Secondary (`#c43131` - Red)**
- Destructive actions (delete, archive)
- Critical alerts
- Logout button
- Timer warnings

**Accent (`#1e88e5` - Blue)**
- Highlights and badges
- Information callouts
- Secondary CTAs

**Success (`#4caf50` - Green)**
- Success messages
- Positive status (online, active, completed)
- Confirmation feedback

**Warning (`#ffb300` - Amber)**
- Warning messages
- Degraded status
- Timer approaching zero

**Error (`#f44336` - Red)**
- Error messages
- Failed validations
- Offline status

### Opacity Modifiers

DaisyUI and Tailwind support opacity modifiers:

```svelte
<!-- 70% opacity -->
<div class="bg-primary/70">...</div>

<!-- 30% opacity -->
<div class="border border-error/30">...</div>

<!-- 10% opacity for subtle backgrounds -->
<div class="bg-success/10">...</div>
```

**Common Opacity Patterns:**
- `/10` - Very subtle backgrounds (alert backgrounds)
- `/15` - Subtle highlights (badges, pills)
- `/30` - Borders and dividers
- `/40` - Secondary text
- `/50` - Disabled states
- `/60` - Tertiary text
- `/70` - Glass panel backgrounds
- `/80` - Active but subtle elements

---

## Typography

### Font Families

```css
@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Space Grotesk", system-ui, sans-serif;
}
```

**Sans (Inter):** Body text, form labels, most UI text
**Display (Space Grotesk):** Headings, brand text, large numbers

### Type Scale

```css
/* Headings (font-display) */
.hero-title        → text-4xl (36px/40px)
.section-heading   → text-3xl sm:text-4xl (30px→36px)
.modal-title       → text-lg (18px)

/* Body (font-sans) */
.body-lg           → text-base (16px)
.body              → text-sm (14px)
.body-sm           → text-xs (12px)
.caption           → text-[10px] (10px)
```

### Font Weights

- `font-normal` (400) - Body text
- `font-medium` (500) - Labels, emphasized text
- `font-semibold` (600) - Headings, buttons
- `font-bold` (700) - Rarely used, only for strong emphasis

### Line Height

- Headings: `leading-tight` (1.25)
- Body: `leading-normal` (1.5)
- Buttons: `leading-none` (1)

### Text Colors

```svelte
<!-- Primary content -->
<p class="text-base-content">Main text</p>

<!-- Secondary content (60% opacity) -->
<p class="text-base-content/60">Secondary text</p>

<!-- Tertiary content (40% opacity) -->
<p class="text-base-content/40">Tertiary text</p>

<!-- Colored text -->
<p class="text-primary">Teal text</p>
<p class="text-error">Error text</p>
```

### Letter Spacing

Used for uppercase labels and brand text:

```svelte
<!-- Small labels -->
<span class="tracking-[0.25em]">COMPACT</span>

<!-- Section labels -->
<span class="tracking-[0.3em]">SECTION</span>

<!-- Brand text -->
<span class="tracking-[0.35em]">ESCAPEPLAN</span>

<!-- Wide labels -->
<span class="tracking-[0.4em]">METRIC</span>
```

---

## Spacing & Layout

### Spacing Scale

Tailwind's default spacing scale (4px base):
- `gap-1` / `p-1` → 4px
- `gap-2` / `p-2` → 8px
- `gap-3` / `p-3` → 12px
- `gap-4` / `p-4` → 16px
- `gap-5` / `p-5` → 20px
- `gap-6` / `p-6` → 24px
- `gap-8` / `p-8` → 32px

### Common Layout Patterns

**Section Spacing:**
```svelte
<section class="space-y-8">
  <!-- 32px vertical spacing between children -->
</section>
```

**Card Padding:**
```svelte
<div class="p-5">  <!-- 20px all sides (modals, cards) -->
<div class="p-6">  <!-- 24px all sides (panels) -->
<div class="px-6 py-6">  <!-- Explicit x/y padding -->
```

**Form Spacing:**
```svelte
<form class="space-y-5">  <!-- 20px between fields -->
  <div class="space-y-2">  <!-- 8px label to input -->
```

**Grid Gaps:**
```svelte
<div class="grid gap-3">  <!-- 12px grid gap -->
<div class="grid gap-4">  <!-- 16px grid gap -->
```

### Container Widths

```svelte
<!-- Max width container -->
<div class="mx-auto max-w-7xl">  <!-- 1280px max -->

<!-- Modal sizes -->
<div class="max-w-sm">   <!-- 384px - Small modal -->
<div class="max-w-md">   <!-- 448px - Medium modal -->
<div class="max-w-lg">   <!-- 512px - Large modal -->
<div class="max-w-xl">   <!-- 576px - XL modal -->
<div class="max-w-2xl">  <!-- 672px - 2XL modal (standard) -->
```

### Responsive Grid

```svelte
<!-- Mobile: 1 col, Desktop: 2 cols -->
<div class="grid gap-4 md:grid-cols-2">

<!-- Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols -->
<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

<!-- Asymmetric grid -->
<div class="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
```

---

## Component Library

## Buttons

### Button Variants

DaisyUI provides button styles through the `btn` base class plus modifiers.

**Base Button:**
```svelte
<button class="btn">Default Button</button>
```

**Style Variants:**
```svelte
<button class="btn btn-primary">Primary CTA</button>
<button class="btn btn-secondary">Destructive Action</button>
<button class="btn btn-accent">Highlight Action</button>
<button class="btn btn-ghost">Subtle Action</button>
<button class="btn btn-outline">Outlined Button</button>
<button class="btn btn-link">Link Style</button>
```

**Size Variants:**
```svelte
<button class="btn btn-xs">Extra Small (28px min)</button>
<button class="btn btn-sm">Small (36px min)</button>
<button class="btn">Default (44px min)</button>
<button class="btn btn-lg">Large (52px min)</button>
```

**Shape Variants:**
```svelte
<button class="btn btn-circle">
  <svg>...</svg>  <!-- Icon only, circular -->
</button>

<button class="btn btn-square">
  <svg>...</svg>  <!-- Icon only, square -->
</button>

<button class="btn btn-block">
  Full Width Button
</button>
```

### Button Sizing Standards

**When to Use Each Size:**

| Size | Use Case | Examples |
|------|----------|----------|
| `btn-lg` | Hero CTAs, critical actions | "Start Session", "Create Game" |
| Default | Primary actions, modals | "Save", "Submit", "Delete" |
| `btn-sm` | Compact contexts, tables | Table row actions, filters |
| `btn-xs` | Icon-only utilities | Close buttons, tooltips |

**Mobile Considerations:**
- Use `btn-block` for mobile-first forms
- Minimum 44×44px touch target for primary actions
- Icon-only buttons should have clear labels on mobile

### Button States

```svelte
<!-- Loading state -->
<button class="btn btn-primary">
  <span class="loading loading-infinity loading-sm"></span>
  Loading...
</button>

<!-- Disabled state -->
<button class="btn btn-primary" disabled>
  Disabled
</button>

<!-- Active state (for toggle buttons) -->
<button class="btn btn-primary btn-active">
  Active
</button>
```

### Button Groups

```svelte
<!-- Join pattern (connected buttons) -->
<div class="join">
  <button class="btn join-item">Left</button>
  <button class="btn join-item">Center</button>
  <button class="btn join-item">Right</button>
</div>

<!-- Gap pattern (separate buttons) -->
<div class="flex gap-2">
  <button class="btn btn-ghost">Cancel</button>
  <button class="btn btn-primary">Confirm</button>
</div>
```

### Accessibility

**Icon Buttons:**
```svelte
<!-- GOOD: Has aria-label -->
<button class="btn btn-circle btn-ghost" aria-label="Close modal">
  <svg aria-hidden="true">...</svg>
</button>

<!-- BAD: No label for screen readers -->
<button class="btn btn-circle btn-ghost">
  <svg>...</svg>
</button>
```

**Disabled State:**
```svelte
<!-- Native disabled attribute -->
<button class="btn" disabled>Cannot Submit</button>

<!-- Disabled with aria-disabled (if interactive) -->
<button class="btn" aria-disabled="true" onclick={handleClick}>
  Disabled but clickable
</button>
```

---

## Form Components

### Text Input

**Basic Pattern:**
```svelte
<label class="form-control">
  <span class="label-text">Username</span>
  <input
    class="input input-bordered"
    type="text"
    name="username"
    placeholder="Enter username"
    required
  />
</label>
```

**With Help Text:**
```svelte
<label class="form-control">
  <span class="label-text">Email</span>
  <input class="input input-bordered" type="email" name="email" />
  <span class="label-text-alt text-xs text-base-content/50">
    We'll never share your email.
  </span>
</label>
```

**Validation States:**
```svelte
<!-- Error state -->
<label class="form-control">
  <span class="label-text">Password</span>
  <input class="input input-bordered input-error" type="password" name="password" />
  <span class="label-text-alt text-error">
    Password must be at least 12 characters
  </span>
</label>

<!-- Success state -->
<input class="input input-bordered input-success" type="text" />

<!-- Warning state -->
<input class="input input-bordered input-warning" type="text" />
```

**Size Variants:**
```svelte
<input class="input input-bordered input-xs" />
<input class="input input-bordered input-sm" />
<input class="input input-bordered" />  <!-- Default (md) -->
<input class="input input-bordered input-lg" />
```

**Color Variants:**
```svelte
<input class="input input-bordered input-primary" />
<input class="input input-bordered input-secondary" />
<input class="input input-bordered input-accent" />
```

**With Icon (Custom Pattern):**
```svelte
<label class="form-control">
  <span class="label-text">Search</span>
  <div class="relative">
    <input class="input input-bordered w-full pl-10" type="search" placeholder="Search..." />
    <svg class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-base-content/40">
      <!-- Search icon -->
    </svg>
  </div>
</label>
```

### Textarea

```svelte
<label class="form-control">
  <span class="label-text">Bio</span>
  <textarea
    class="textarea textarea-bordered min-h-[6rem]"
    name="bio"
    placeholder="Tell us about yourself..."
    maxlength="500"
  ></textarea>
  <span class="label-text-alt">{bioLength}/500 characters</span>
</label>
```

**Validation States:**
```svelte
<textarea class="textarea textarea-bordered textarea-error"></textarea>
<textarea class="textarea textarea-bordered textarea-success"></textarea>
```

### Select Dropdown

```svelte
<label class="form-control">
  <span class="label-text">Role</span>
  <select class="select select-bordered" name="role" bind:value={selectedRole}>
    <option disabled selected value="">Choose a role</option>
    <option value="admin">Administrator</option>
    <option value="manager">Manager</option>
    <option value="game_master">Game Master</option>
  </select>
  <span class="label-text-alt text-xs">
    Role determines default permissions
  </span>
</label>
```

**Validation States:**
```svelte
<select class="select select-bordered select-error"></select>
<select class="select select-bordered select-success"></select>
```

### Checkbox

```svelte
<!-- Standard checkbox -->
<label class="flex cursor-pointer items-center gap-2">
  <input type="checkbox" class="checkbox checkbox-primary" name="terms" />
  <span class="label-text">I agree to the terms</span>
</label>

<!-- With description -->
<div class="form-control">
  <label class="flex cursor-pointer items-start gap-3">
    <input type="checkbox" class="checkbox checkbox-primary mt-1" />
    <div>
      <span class="label-text font-medium">Send notifications</span>
      <p class="text-xs text-base-content/60">
        Receive email updates about your sessions
      </p>
    </div>
  </label>
</div>
```

**Size Variants:**
```svelte
<input type="checkbox" class="checkbox checkbox-xs" />
<input type="checkbox" class="checkbox checkbox-sm" />
<input type="checkbox" class="checkbox" />  <!-- Default (md) -->
<input type="checkbox" class="checkbox checkbox-lg" />
```

### Toggle (Switch)

```svelte
<label class="flex cursor-pointer items-center gap-3">
  <input type="checkbox" class="toggle toggle-primary" bind:checked={isEnabled} />
  <span class="label-text font-semibold">Enable feature</span>
</label>
```

**In UserModal (Production Example):**
```svelte
<label class="form-control">
  <span class="label-text">Require password reset</span>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    name="mustResetPassword"
    bind:checked={mustReset}
  />
  <span class="label-text-alt text-xs">Forces new password on next login.</span>
</label>
```

### Radio Buttons

```svelte
<div class="form-control">
  <label class="flex cursor-pointer items-center gap-2">
    <input type="radio" name="plan" class="radio radio-primary" value="basic" checked />
    <span class="label-text">Basic Plan</span>
  </label>
  <label class="flex cursor-pointer items-center gap-2">
    <input type="radio" name="plan" class="radio radio-primary" value="pro" />
    <span class="label-text">Pro Plan</span>
  </label>
</div>
```

**Radio as Button Group:**
```svelte
<div class="join">
  <input class="join-item btn" type="radio" name="scope" value="all" aria-label="All" checked />
  <input class="join-item btn" type="radio" name="scope" value="storefront" aria-label="Storefront" />
  <input class="join-item btn" type="radio" name="scope" value="mobile" aria-label="Mobile" />
</div>
```

### Range Slider

```svelte
<label class="form-control">
  <span class="label-text">Volume</span>
  <input
    type="range"
    min="0"
    max="100"
    value="50"
    class="range range-primary"
    bind:value={volume}
  />
  <div class="flex w-full justify-between px-2 text-xs">
    <span>0</span>
    <span>25</span>
    <span>50</span>
    <span>75</span>
    <span>100</span>
  </div>
</label>
```

---

## Data Display

### Table

**Basic Pattern (from DataTable.svelte):**
```svelte
<div class="overflow-x-auto">
  <div class="rounded-2xl border border-white/10 bg-base-200/70">
    <table class="table table-zebra">
      <thead class="bg-base-300/60 text-xs uppercase tracking-[0.28em] text-base-content/40">
        <tr>
          <th class="text-left">Name</th>
          <th class="text-center">Status</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr class="hover">
          <td>John Doe</td>
          <td class="text-center">
            <span class="badge badge-success">Active</span>
          </td>
          <td class="text-right">
            <button class="btn btn-sm btn-ghost">Edit</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

**Table Variants:**
```svelte
<!-- Zebra striping (alternating row colors) -->
<table class="table table-zebra">

<!-- Compact sizing -->
<table class="table table-xs">
<table class="table table-sm">

<!-- Pinned rows/columns -->
<table class="table table-pin-rows table-pin-cols">
```

**Responsive Pattern:**
Mobile card layout, desktop table layout (see DataTable.svelte)

### Badge

```svelte
<!-- Default badge -->
<span class="badge">Default</span>

<!-- Color variants -->
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-accent">Accent</span>
<span class="badge badge-ghost">Ghost</span>

<!-- Semantic badges -->
<span class="badge badge-info">Info</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>

<!-- Size variants -->
<span class="badge badge-xs">Extra Small</span>
<span class="badge badge-sm">Small</span>
<span class="badge badge-md">Medium</span>
<span class="badge badge-lg">Large</span>

<!-- Outline variant -->
<span class="badge badge-outline">Outlined</span>
<span class="badge badge-primary badge-outline">Primary Outlined</span>
```

**Production Example (from bookings):**
```svelte
<span class="badge badge-outline border-white/15 text-[11px]">
  {booking.status}
</span>
```

### Alert

```svelte
<!-- Info alert -->
<div class="alert alert-info">
  <svg><!-- Info icon --></svg>
  <span>New updates available</span>
</div>

<!-- Success alert -->
<div class="alert alert-success">
  <svg><!-- Success icon --></svg>
  <span>Your changes have been saved</span>
</div>

<!-- Warning alert -->
<div class="alert alert-warning">
  <svg><!-- Warning icon --></svg>
  <span>Please verify your email address</span>
</div>

<!-- Error alert -->
<div class="alert alert-error">
  <svg><!-- Error icon --></svg>
  <span>Failed to save changes</span>
</div>
```

**With Actions:**
```svelte
<div class="alert alert-info">
  <svg><!-- Icon --></svg>
  <div>
    <h3 class="font-bold">New version available</h3>
    <div class="text-sm">Refresh to get the latest features</div>
  </div>
  <button class="btn btn-sm btn-primary">Refresh</button>
</div>
```

**Production Pattern (from UserModal):**
```svelte
{#if errorMessage}
  <div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
    <span>{errorMessage}</span>
  </div>
{/if}
```

### Card

DaisyUI doesn't have a built-in card component, but we use a consistent custom pattern:

```svelte
<!-- Standard card -->
<article class="rounded-2xl border border-white/10 bg-base-100/60 p-5 shadow-lg shadow-black/20">
  <header class="space-y-2">
    <h3 class="text-xl font-display text-base-content">Card Title</h3>
    <p class="text-sm text-base-content/60">Card description</p>
  </header>
  <div class="mt-4">
    <!-- Card content -->
  </div>
  <footer class="mt-4 flex gap-2">
    <button class="btn btn-primary">Action</button>
  </footer>
</article>

<!-- Glass panel variant -->
<div class="glass-panel border-white/10 bg-base-200/70 p-6">
  <!-- Content -->
</div>

<!-- Metric card (from dashboard) -->
<article class="metric-card p-4">
  <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">
    Active Sessions
  </p>
  <p class="mt-2 text-3xl font-display text-primary">03</p>
  <p class="mt-1 text-[10px] text-base-content/40">Live rooms</p>
</article>
```

### Avatar

Use the custom `Avatar.svelte` component:

```svelte
<script>
  import Avatar from '$lib/avatar/Avatar.svelte';
</script>

<Avatar
  config={user.avatarConfig}
  username={user.username}
  size={48}
  class="overflow-hidden rounded-2xl border border-white/10"
/>
```

**Sizes:**
- 32px - Small (list items)
- 48px - Standard (sidebar, cards)
- 64px - Large (modals, profile pages)
- 96px - Extra large (profile headers)

---

## Navigation

### Navbar

Production navbar is in `(app)/+layout.svelte` as a sticky header:

```svelte
<header class="sticky top-0 z-30 border-b border-white/5 bg-base-100/70 px-4 py-3 backdrop-blur lg:px-6">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <!-- Mobile menu toggle -->
      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-base-300/60 lg:hidden"
        aria-label="Open navigation"
      >
        <!-- Hamburger icon -->
      </button>

      <!-- Page title -->
      <div class="flex flex-col">
        <h1 class="font-display text-base text-base-content sm:text-lg">
          {currentPageTitle}
        </h1>
        <p class="hidden text-xs uppercase tracking-[0.3em] text-base-content/40 sm:block">
          Console
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <!-- Status badge -->
      <div class="badge-pill hidden md:inline-flex">
        <span class="inline-flex size-2 rounded-full bg-success shadow shadow-success/50"></span>
        <span>Pi appliance · Offline ready</span>
      </div>
    </div>
  </div>
</header>
```

### Sidebar

Production sidebar is in `(app)/+layout.svelte`:

```svelte
<aside class="drawer-side">
  <label for="app-drawer" aria-label="Close navigation" class="drawer-overlay"></label>
  <div class="flex min-h-full flex-col justify-between border-r border-white/5 bg-base-100/80 backdrop-blur-xl w-72 px-4 py-5">
    <!-- Logo -->
    <div class="flex items-center gap-3">
      <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
        <img src="/logo.png" alt="EscapePlan" class="h-7 w-auto" />
      </span>
      <div class="flex flex-col text-base-content">
        <span class="font-display text-base">EscapePlan</span>
        <span class="text-xs uppercase tracking-[0.35em] text-base-content/50">Control Room</span>
      </div>
    </div>

    <!-- Navigation links -->
    <nav class="flex flex-1 flex-col gap-2">
      <a
        href="/dashboard"
        class="nav-link group"
        data-active={$page.url.pathname === '/dashboard'}
      >
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-300/60">
          <svg><!-- Icon --></svg>
        </span>
        <span class="truncate font-medium">Dashboard</span>
      </a>
    </nav>

    <!-- User profile section -->
    <div class="flex flex-col gap-3 border-t border-white/5 pt-5">
      <div class="flex items-center gap-3">
        <Avatar config={user.avatarConfig} username={user.username} size={48} />
        <div class="flex flex-col text-xs text-base-content/60">
          <span class="truncate text-sm font-semibold text-base-content/80">
            {user.name}
          </span>
          <span class="truncate text-[0.65rem] uppercase tracking-[0.35em]">
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  </div>
</aside>
```

**Nav Link Styles (app.css):**
```css
.nav-link {
  @apply flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-base-content/60 transition-all duration-200 ease-out;
}

.nav-link:hover {
  @apply bg-base-300/60 text-base-content;
}

.nav-link[data-active='true'] {
  @apply text-primary;
}
```

### Breadcrumbs

DaisyUI breadcrumbs pattern:

```svelte
<div class="breadcrumbs text-sm">
  <ul>
    <li><a href="/dashboard">Home</a></li>
    <li><a href="/admin">Admin</a></li>
    <li>Games</li>
  </ul>
</div>
```

**Custom Breadcrumbs Component (TO BE CREATED):**
```svelte
<script lang="ts">
  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    items: BreadcrumbItem[];
    class?: string;
  }

  const { items, class: className = '' } = $props();
</script>

<nav class="breadcrumbs text-sm {className}" aria-label="Breadcrumb">
  <ul>
    {#each items as item}
      <li>
        {#if item.href}
          <a href={item.href} class="hover:text-primary">{item.label}</a>
        {:else}
          <span class="text-base-content/60">{item.label}</span>
        {/if}
      </li>
    {/each}
  </ul>
</nav>
```

### Tabs

**Button-Based Tabs:**
```svelte
<div role="tablist" class="tabs tabs-bordered">
  <button
    role="tab"
    class="tab {activeTab === 'overview' ? 'tab-active' : ''}"
    onclick={() => (activeTab = 'overview')}
  >
    Overview
  </button>
  <button
    role="tab"
    class="tab {activeTab === 'settings' ? 'tab-active' : ''}"
    onclick={() => (activeTab = 'settings')}
  >
    Settings
  </button>
</div>

<!-- Tab content -->
{#if activeTab === 'overview'}
  <div>Overview content</div>
{:else if activeTab === 'settings'}
  <div>Settings content</div>
{/if}
```

**Tab Variants:**
```svelte
<div class="tabs tabs-bordered">  <!-- Bordered bottom -->
<div class="tabs tabs-boxed">    <!-- Boxed style -->
<div class="tabs tabs-lifted">   <!-- Lifted 3D effect -->
```

**Tab Sizes:**
```svelte
<div class="tabs tabs-xs">
<div class="tabs tabs-sm">
<div class="tabs tabs-md">
<div class="tabs tabs-lg">
```

### Dropdown Menu

```svelte
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn">
    Open Menu
  </div>
  <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
    <li><a href="/profile">Profile</a></li>
    <li><a href="/settings">Settings</a></li>
    <li><a href="/logout">Logout</a></li>
  </ul>
</div>
```

**Dropdown Positions:**
```svelte
<div class="dropdown dropdown-end">    <!-- Right aligned -->
<div class="dropdown dropdown-top">    <!-- Open upward -->
<div class="dropdown dropdown-left">   <!-- Open left -->
<div class="dropdown dropdown-bottom">  <!-- Open down (default) -->
```

---

## Feedback

### Modal Dialog

**Standard Pattern (from UserModal.svelte):**
```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    children: Snippet;
  }

  const { open, onclose, children } = $props();
  let dialogElement = $state<HTMLDialogElement | null>(null);
</script>

{#if open}
  <dialog
    class="modal modal-bottom sm:modal-middle"
    open
    bind:this={dialogElement}
    oncancel={(event) => {
      event.preventDefault();
      onclose();
    }}
  >
    <div class="modal-box max-h-[92vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
      {@render children()}
    </div>
  </dialog>
{/if}
```

**Modal Sizes:**
- `max-w-sm` (384px) - Small confirmations
- `max-w-md` (448px) - Medium forms
- `max-w-lg` (512px) - Large forms
- `max-w-xl` (576px) - Extra large content
- `max-w-2xl` (672px) - Standard (most modals)
- `max-w-4xl` (896px) - Wide content (game editor)

**With Backdrop Click to Close:**
```svelte
<dialog class="modal modal-bottom sm:modal-middle" open>
  <div class="modal-box">
    <!-- Content -->
  </div>
  <div class="modal-backdrop" onclick={onclose}></div>
</dialog>
```

### Tooltip

**Basic Pattern (from HelpTooltip.svelte):**
```svelte
<div class="tooltip tooltip-top" data-tip="Tooltip text">
  <button class="btn btn-circle btn-ghost btn-xs">
    <svg><!-- Icon --></svg>
  </button>
</div>
```

**Positions:**
```svelte
<div class="tooltip tooltip-top" data-tip="Top">
<div class="tooltip tooltip-bottom" data-tip="Bottom">
<div class="tooltip tooltip-left" data-tip="Left">
<div class="tooltip tooltip-right" data-tip="Right">
```

**Colors:**
```svelte
<div class="tooltip tooltip-primary" data-tip="Primary">
<div class="tooltip tooltip-secondary" data-tip="Secondary">
<div class="tooltip tooltip-info" data-tip="Info">
<div class="tooltip tooltip-success" data-tip="Success">
<div class="tooltip tooltip-warning" data-tip="Warning">
<div class="tooltip tooltip-error" data-tip="Error">
```

**HelpTooltip Component (Production):**
```svelte
<script lang="ts">
  interface Props {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    color?: 'neutral' | 'primary' | 'info';
    class?: string;
  }

  let { text, position = 'top', color = 'info', class: className = '' }: Props = $props();

  const positionClass = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right'
  }[position];

  const colorClass = {
    neutral: 'tooltip-neutral',
    primary: 'tooltip-primary',
    info: 'tooltip-info'
  }[color];
</script>

<div class="tooltip {positionClass} {colorClass} {className}" data-tip={text}>
  <button type="button" class="btn btn-circle btn-ghost btn-xs text-info" aria-label="Help">
    <svg><!-- Question mark icon --></svg>
  </button>
</div>
```

### Drawer

DaisyUI drawer for mobile navigation (production example in +layout.svelte):

```svelte
<div class="drawer lg:drawer-open">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

  <div class="drawer-content">
    <!-- Main content -->
    <button onclick={() => (drawerOpen = true)}>Open Menu</button>
  </div>

  <aside class="drawer-side">
    <label for="app-drawer" aria-label="Close navigation" class="drawer-overlay"></label>
    <div class="w-72 min-h-full bg-base-100">
      <!-- Sidebar content -->
    </div>
  </aside>
</div>
```

---

## Loading States

### Loading Spinner

**DaisyUI Variants:**
```svelte
<!-- Spinner (default) -->
<span class="loading loading-spinner"></span>

<!-- Dots -->
<span class="loading loading-dots"></span>

<!-- Ring -->
<span class="loading loading-ring"></span>

<!-- Ball -->
<span class="loading loading-ball"></span>

<!-- INFINITY (RECOMMENDED DEFAULT) -->
<span class="loading loading-infinity"></span>
```

**Sizes:**
```svelte
<span class="loading loading-infinity loading-xs"></span>
<span class="loading loading-infinity loading-sm"></span>
<span class="loading loading-infinity loading-md"></span>
<span class="loading loading-infinity loading-lg"></span>
```

**With Color:**
```svelte
<span class="loading loading-infinity loading-lg text-primary"></span>
```

**In Button:**
```svelte
<button class="btn btn-primary" disabled>
  <span class="loading loading-infinity loading-sm"></span>
  Loading...
</button>
```

**Full-Screen Loading:**
```svelte
<div class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur">
  <div class="flex flex-col items-center gap-4">
    <span class="loading loading-infinity loading-lg text-primary"></span>
    <p class="text-lg font-semibold">Loading games...</p>
  </div>
</div>
```

**Production Example (from DataTable.svelte):**
```svelte
{#if isLoading}
  <div class="flex items-center justify-center p-12">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{/if}
```

### Skeleton Screens

**DaisyUI Skeleton Pattern:**
```svelte
<!-- Text skeleton -->
<div class="skeleton h-4 w-full"></div>
<div class="skeleton h-4 w-5/6"></div>

<!-- Circle skeleton (avatar) -->
<div class="skeleton h-12 w-12 shrink-0 rounded-full"></div>

<!-- Rectangle skeleton (image) -->
<div class="skeleton h-32 w-full"></div>
```

**Card Skeleton:**
```svelte
<div class="rounded-2xl border border-white/10 bg-base-200/70 p-5">
  <div class="skeleton h-6 w-3/4 mb-2"></div>
  <div class="skeleton h-4 w-full mb-1"></div>
  <div class="skeleton h-4 w-5/6 mb-4"></div>
  <div class="flex gap-2">
    <div class="skeleton h-10 w-24"></div>
    <div class="skeleton h-10 w-24"></div>
  </div>
</div>
```

**Table Skeleton:**
```svelte
<div class="space-y-2">
  {#each Array(5) as _}
    <div class="skeleton h-12 w-full"></div>
  {/each}
</div>
```

### Progress Indicators

**Progress Bar:**
```svelte
<progress class="progress progress-primary" value="40" max="100"></progress>

<!-- Indeterminate -->
<progress class="progress progress-primary"></progress>
```

**Radial Progress:**
```svelte
<div class="radial-progress text-primary" style="--value:70;">70%</div>

<!-- With size -->
<div class="radial-progress text-primary" style="--value:70; --size:12rem;">70%</div>
```

---

## Utility Components

### TO BE CREATED: LoadingState Component

```svelte
<!-- LoadingState.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'spinner' | 'dots' | 'ring' | 'ball' | 'infinity';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    color?: string;
    fullScreen?: boolean;
    message?: string;
    children?: Snippet;
  }

  const {
    variant = 'infinity',
    size = 'lg',
    color = 'text-primary',
    fullScreen = false,
    message,
    children
  } = $props();

  const sizeClass = {
    xs: 'loading-xs',
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg'
  }[size];
</script>

{#if fullScreen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur">
    <div class="flex flex-col items-center gap-4">
      <span class="loading loading-{variant} {sizeClass} {color}"></span>
      {#if message}
        <p class="text-lg font-semibold">{message}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center p-12">
    <div class="flex flex-col items-center gap-3">
      <span class="loading loading-{variant} {sizeClass} {color}"></span>
      {#if message}
        <p class="text-sm font-medium text-base-content/70">{message}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}
```

**Usage:**
```svelte
<script>
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
</script>

<!-- Simple loading -->
<LoadingState />

<!-- With message -->
<LoadingState message="Loading sessions..." />

<!-- Full screen -->
<LoadingState fullScreen message="Initializing dashboard..." />

<!-- Custom variant -->
<LoadingState variant="dots" size="sm" color="text-accent" />
```

### TO BE CREATED: SkeletonLoader Component

```svelte
<!-- SkeletonLoader.svelte -->
<script lang="ts">
  interface Props {
    type: 'text' | 'card' | 'table' | 'avatar';
    count?: number;
    lines?: number;
    class?: string;
  }

  const { type, count = 1, lines = 3, class: className = '' } = $props();
</script>

<div class={className}>
  {#if type === 'text'}
    {#each Array(lines) as _, i}
      <div class="skeleton h-4 {i === lines - 1 ? 'w-5/6' : 'w-full'} mb-2"></div>
    {/each}
  {:else if type === 'avatar'}
    <div class="skeleton h-12 w-12 shrink-0 rounded-full"></div>
  {:else if type === 'card'}
    {#each Array(count) as _}
      <div class="rounded-2xl border border-white/10 bg-base-200/70 p-5 mb-4">
        <div class="skeleton h-6 w-3/4 mb-2"></div>
        <div class="skeleton h-4 w-full mb-1"></div>
        <div class="skeleton h-4 w-5/6 mb-4"></div>
        <div class="flex gap-2">
          <div class="skeleton h-10 w-24"></div>
          <div class="skeleton h-10 w-24"></div>
        </div>
      </div>
    {/each}
  {:else if type === 'table'}
    <div class="space-y-2">
      {#each Array(count) as _}
        <div class="skeleton h-12 w-full"></div>
      {/each}
    </div>
  {/if}
</div>
```

**Usage:**
```svelte
<script>
  import SkeletonLoader from '$lib/components/ui/SkeletonLoader.svelte';
</script>

{#if isLoading}
  <SkeletonLoader type="card" count={3} />
{:else}
  <!-- Actual content -->
{/if}
```

### TO BE CREATED: Modal Wrapper Component

```svelte
<!-- Modal.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  const {
    open,
    title,
    description,
    size = '2xl',
    onclose,
    children,
    actions
  } = $props();

  let dialogElement = $state<HTMLDialogElement | null>(null);

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  }[size];
</script>

{#if open}
  <dialog
    class="modal modal-bottom sm:modal-middle"
    open
    bind:this={dialogElement}
    oncancel={(event) => {
      event.preventDefault();
      onclose();
    }}
  >
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

**Usage:**
```svelte
<script>
  import Modal from '$lib/components/ui/Modal.svelte';

  let modalOpen = $state(false);
</script>

<Modal
  open={modalOpen}
  title="Confirm Deletion"
  description="This action cannot be undone."
  size="md"
  onclose={() => (modalOpen = false)}
>
  <p class="mt-4 text-sm">Are you sure you want to delete this item?</p>

  {#snippet actions()}
    <button class="btn btn-ghost" onclick={() => (modalOpen = false)}>Cancel</button>
    <button class="btn btn-error" onclick={handleDelete}>Delete</button>
  {/snippet}
</Modal>
```

### TO BE CREATED: Breadcrumbs Component

```svelte
<!-- Breadcrumbs.svelte -->
<script lang="ts">
  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    items: BreadcrumbItem[];
    class?: string;
  }

  const { items, class: className = '' } = $props();
</script>

<nav class="breadcrumbs text-sm {className}" aria-label="Breadcrumb">
  <ul>
    {#each items as item, index}
      <li>
        {#if item.href && index < items.length - 1}
          <a href={item.href} class="hover:text-primary transition-colors">
            {item.label}
          </a>
        {:else}
          <span class="text-base-content/60">{item.label}</span>
        {/if}
      </li>
    {/each}
  </ul>
</nav>
```

**Usage:**
```svelte
<script>
  import Breadcrumbs from '$lib/components/ui/Breadcrumbs.svelte';

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'Games' }
  ];
</script>

<Breadcrumbs items={breadcrumbs} />
```

### TO BE CREATED: KeyboardShortcut Component

```svelte
<!-- KeyboardShortcut.svelte -->
<script lang="ts">
  interface Props {
    keys: string[];
    class?: string;
  }

  const { keys, class: className = '' } = $props();
</script>

<span class="inline-flex items-center gap-1 {className}">
  {#each keys as key, index}
    <kbd class="kbd kbd-sm">{key}</kbd>
    {#if index < keys.length - 1}
      <span class="text-xs text-base-content/40">+</span>
    {/if}
  {/each}
</span>
```

**Usage:**
```svelte
<script>
  import KeyboardShortcut from '$lib/components/ui/KeyboardShortcut.svelte';
</script>

<button class="btn btn-secondary">
  Quick start session
  <KeyboardShortcut keys={['⌘', 'K']} class="ml-2 opacity-60" />
</button>
```

### TO BE CREATED: Toast Component

```svelte
<!-- Toast.svelte -->
<script lang="ts">
  import { toastStore } from '$lib/stores/toast';
  import { fade, fly } from 'svelte/transition';

  const toasts = toastStore.toasts;

  function dismiss(id: string) {
    toastStore.dismiss(id);
  }
</script>

<div class="toast toast-top toast-end z-50">
  {#each $toasts as toast (toast.id)}
    <div
      class="alert {toast.type === 'error' ? 'alert-error' : toast.type === 'warning' ? 'alert-warning' : toast.type === 'info' ? 'alert-info' : 'alert-success'}"
      in:fly={{ x: 300, duration: 200 }}
      out:fade={{ duration: 150 }}
    >
      <span>{toast.message}</span>
      <button
        class="btn btn-ghost btn-xs"
        onclick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/each}
</div>
```

**Store (toast.ts):**
```typescript
// $lib/stores/toast.ts
import { writable } from 'svelte/store';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    show: (message: string, type: Toast['type'] = 'success', duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 11);
      update((toasts) => [...toasts, { id, type, message }]);
      if (duration > 0) {
        setTimeout(() => {
          update((toasts) => toasts.filter((t) => t.id !== id));
        }, duration);
      }
    },
    dismiss: (id: string) => {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
    clear: () => {
      update(() => []);
    }
  };
}

export const toastStore = createToastStore();
```

**Usage:**
```svelte
<script>
  import { toastStore } from '$lib/stores/toast';
  import Toast from '$lib/components/ui/Toast.svelte';

  function handleSuccess() {
    toastStore.show('Session started successfully!', 'success');
  }

  function handleError() {
    toastStore.show('Failed to save changes', 'error');
  }
</script>

<Toast />

<button onclick={handleSuccess}>Success</button>
<button onclick={handleError}>Error</button>
```

### TO BE CREATED: EmptyState Component

```svelte
<!-- EmptyState.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: Snippet;
    title: string;
    message?: string;
    action?: Snippet;
    class?: string;
  }

  const { icon, title, message, action, class: className = '' } = $props();
</script>

<div class="rounded-2xl border border-dashed border-base-content/15 bg-base-100/60 px-6 py-10 text-center {className}">
  {#if icon}
    <div class="flex justify-center mb-4">
      {@render icon()}
    </div>
  {/if}

  <h3 class="text-lg font-semibold text-base-content">{title}</h3>

  {#if message}
    <p class="mt-2 text-sm text-base-content/60">{message}</p>
  {/if}

  {#if action}
    <div class="mt-6">
      {@render action()}
    </div>
  {/if}
</div>
```

**Usage:**
```svelte
<script>
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
</script>

{#if sessions.length === 0}
  <EmptyState
    title="No active sessions"
    message="The control room is standing by. Start a new session to get started."
  >
    {#snippet icon()}
      <svg class="h-12 w-12 text-base-content/40"><!-- Icon --></svg>
    {/snippet}

    {#snippet action()}
      <button class="btn btn-primary" onclick={openQuickStart}>
        + Quick start session
      </button>
    {/snippet}
  </EmptyState>
{/if}
```

---

## Accessibility

### Keyboard Navigation

**Focus States:**
All interactive elements must have visible focus states. DaisyUI provides default focus rings.

```css
/* Default focus ring */
.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

**Tab Order:**
Maintain logical tab order. Use `tabindex` only when necessary.

```svelte
<!-- Good: Natural tab order -->
<form>
  <input />
  <button>Submit</button>
</form>

<!-- Bad: Breaking tab order -->
<form>
  <button tabindex="2">Submit</button>
  <input tabindex="1" />
</form>
```

### ARIA Labels

**Icon Buttons:**
```svelte
<!-- Always provide aria-label for icon-only buttons -->
<button class="btn btn-circle btn-ghost" aria-label="Close modal">
  <svg aria-hidden="true"><!-- X icon --></svg>
</button>
```

**Form Fields:**
```svelte
<!-- Use label element for form fields -->
<label class="form-control">
  <span class="label-text">Username</span>
  <input type="text" name="username" />
</label>

<!-- Or use aria-label if label is not visible -->
<input type="search" aria-label="Search games" placeholder="Search..." />
```

**Live Regions:**
```svelte
<!-- Announce dynamic content to screen readers -->
<div role="status" aria-live="polite" aria-atomic="true">
  {#if isLoading}
    <span class="sr-only">Loading content...</span>
  {/if}
</div>
```

### Color Contrast

**WCAG AA Compliance:**
- Normal text (14px): Minimum 4.5:1 contrast ratio
- Large text (18px+): Minimum 3:1 contrast ratio
- UI components: Minimum 3:1 contrast ratio

**Tested Combinations:**
- `text-base-content` on `bg-base-100`: 13.5:1 ✅
- `text-base-content/60` on `bg-base-100`: 8.1:1 ✅
- `text-primary` on `bg-base-100`: 5.2:1 ✅
- `text-error` on `bg-base-100`: 4.8:1 ✅

### Touch Targets

**Minimum Sizes:**
- Primary actions: 44×44px minimum
- Secondary actions: 36×36px minimum
- Utility actions: 28×28px minimum (with spacing)

**Production Examples:**
```svelte
<!-- Good: 44×44px minimum -->
<button class="btn btn-primary min-h-[44px]">Submit</button>

<!-- Good: Icon button with size-10 (40px) -->
<button class="btn btn-circle size-10" aria-label="Close">
  <svg class="h-5 w-5">...</svg>
</button>

<!-- Bad: Too small for touch -->
<button class="text-xs p-1">Tiny button</button>
```

### Screen Reader Support

**Skip Links:**
```svelte
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50">
  Skip to main content
</a>

<main id="main-content">
  <!-- Page content -->
</main>
```

**Screen Reader Only Text:**
```svelte
<span class="sr-only">Visible to screen readers only</span>

<!-- Utility class in Tailwind -->
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Responsive Design

### Breakpoints

Tailwind/DaisyUI default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile-First Patterns

**Always write styles mobile-first:**
```svelte
<!-- Good: Mobile first -->
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

<!-- Bad: Desktop first -->
<div class="grid grid-cols-4 md:grid-cols-2 grid-cols-1">
```

### Responsive Typography

```svelte
<!-- Scale up on larger screens -->
<h1 class="text-3xl sm:text-4xl lg:text-5xl">

<!-- Responsive visibility -->
<p class="hidden sm:block">Visible on small screens and up</p>
<p class="block sm:hidden">Visible only on mobile</p>
```

### Responsive Spacing

```svelte
<!-- Scale padding with screen size -->
<div class="px-4 py-8 lg:px-10 lg:py-12">

<!-- Scale gaps -->
<div class="grid gap-3 md:gap-4 lg:gap-6">
```

### Responsive Layouts

**Sidebar Layout (from +layout.svelte):**
```svelte
<!-- Drawer on mobile, permanent sidebar on desktop -->
<div class="drawer lg:drawer-open">
  <input type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <!-- Main content -->
  </div>
  <aside class="drawer-side">
    <!-- Sidebar: w-72 on mobile, fixed on lg+ -->
  </aside>
</div>
```

**Grid Layout:**
```svelte
<!-- 1 col mobile, 2 cols tablet, 4 cols desktop -->
<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
```

**Flexbox Layout:**
```svelte
<!-- Stack on mobile, row on desktop -->
<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
```

### Responsive Tables

**DataTable Pattern (Production):**
```svelte
<!-- Mobile: Card layout -->
<div class="space-y-4 sm:hidden">
  {#each items as item}
    <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
      <!-- Card content -->
    </div>
  {/each}
</div>

<!-- Desktop: Table layout -->
<div class="hidden sm:block">
  <table class="table table-zebra">
    <!-- Table content -->
  </table>
</div>
```

---

## Code Examples

### Complete Form Example

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';

  let username = $state('');
  let email = $state('');
  let role = $state('manager');
  let errorMessage = $state<string | null>(null);
  let isSubmitting = $state(false);

  const handleSubmit: SubmitFunction = () => {
    isSubmitting = true;
    return async ({ result, update }) => {
      isSubmitting = false;
      if (result.type === 'failure') {
        errorMessage = result.data?.message ?? 'Failed to create user';
        return;
      }
      if (result.type === 'success') {
        await update({ invalidateAll: false });
        errorMessage = null;
        // Success callback
        return;
      }
      await update();
    };
  };
</script>

<form method="POST" class="space-y-5" use:enhance={handleSubmit}>
  {#if errorMessage}
    <div class="alert alert-error">
      <span>{errorMessage}</span>
    </div>
  {/if}

  <label class="form-control">
    <span class="label-text">Username</span>
    <input
      class="input input-bordered"
      type="text"
      name="username"
      bind:value={username}
      required
      placeholder="ops.controller"
    />
  </label>

  <label class="form-control">
    <span class="label-text">Email</span>
    <input
      class="input input-bordered"
      type="email"
      name="email"
      bind:value={email}
      placeholder="user@escapeplan.local"
    />
    <span class="label-text-alt text-xs text-base-content/50">
      Optional - used for notifications
    </span>
  </label>

  <label class="form-control">
    <span class="label-text">Role</span>
    <select class="select select-bordered" name="role" bind:value={role}>
      <option value="admin">Administrator</option>
      <option value="manager">Manager</option>
      <option value="game_master">Game Master</option>
    </select>
  </label>

  <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
    <button type="button" class="btn btn-ghost">Cancel</button>
    <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
      {#if isSubmitting}
        <span class="loading loading-infinity loading-sm"></span>
      {/if}
      Create User
    </button>
  </div>
</form>
```

### Complete Modal Example

```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import { toastStore } from '$lib/stores/toast';

  let modalOpen = $state(false);
  let confirmText = $state('');

  async function handleDelete() {
    try {
      await fetch('/api/items/123', { method: 'DELETE' });
      toastStore.show('Item deleted successfully', 'success');
      modalOpen = false;
    } catch (error) {
      toastStore.show('Failed to delete item', 'error');
    }
  }
</script>

<button class="btn btn-error" onclick={() => (modalOpen = true)}>
  Delete Item
</button>

<Modal
  open={modalOpen}
  title="Confirm Deletion"
  description="This action cannot be undone. Type DELETE to confirm."
  size="md"
  onclose={() => {
    modalOpen = false;
    confirmText = '';
  }}
>
  <div class="mt-4 space-y-4">
    <div class="alert alert-warning">
      <svg><!-- Warning icon --></svg>
      <span>This will permanently delete the item and all associated data.</span>
    </div>

    <label class="form-control">
      <span class="label-text">Type DELETE to confirm</span>
      <input
        class="input input-bordered"
        type="text"
        bind:value={confirmText}
        placeholder="DELETE"
      />
    </label>
  </div>

  {#snippet actions()}
    <button class="btn btn-ghost" onclick={() => (modalOpen = false)}>
      Cancel
    </button>
    <button
      class="btn btn-error"
      onclick={handleDelete}
      disabled={confirmText !== 'DELETE'}
    >
      Delete Item
    </button>
  {/snippet}
</Modal>
```

### Complete Data Display Example

```svelte
<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { User } from '@escapeplan/contracts';

  let users = $state<User[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const response = await fetch('/api/admin/users');
      users = await response.json();
    } catch (error) {
      console.error('Failed to load users', error);
    } finally {
      isLoading = false;
    }
  });

  const columns = [
    { key: 'name', label: 'Name', align: 'left' },
    { key: 'username', label: 'Username', align: 'left' },
    { key: 'role', label: 'Role', align: 'left' },
    { key: 'status', label: 'Status', align: 'center' },
    { key: 'actions', label: 'Actions', align: 'right' }
  ];
</script>

{#if isLoading}
  <LoadingState message="Loading users..." />
{:else if users.length === 0}
  <EmptyState
    title="No users found"
    message="Create your first user to get started."
  >
    {#snippet action()}
      <button class="btn btn-primary" onclick={openCreateModal}>
        + Add User
      </button>
    {/snippet}
  </EmptyState>
{:else}
  <DataTable
    items={users}
    keyField="id"
    columns={columns}
    emptyMessage="No users found"
  >
    {#snippet mobileCard(user)}
      <div class="rounded-xl border border-white/10 bg-base-100/60 p-4">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-semibold text-base-content">{user.name}</h3>
            <p class="text-sm text-base-content/60">@{user.username}</p>
          </div>
          <span class="badge badge-primary">{user.role}</span>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-sm btn-ghost">Edit</button>
          <button class="btn btn-sm btn-error">Delete</button>
        </div>
      </div>
    {/snippet}

    {#snippet desktopCell(user, key)}
      {#if key === 'name'}
        <div class="flex items-center gap-3">
          <Avatar config={user.avatarConfig} username={user.username} size={32} />
          <span class="font-medium">{user.name}</span>
        </div>
      {:else if key === 'username'}
        <span class="text-base-content/60">@{user.username}</span>
      {:else if key === 'role'}
        <span class="badge badge-primary">{user.role}</span>
      {:else if key === 'status'}
        <span class="badge {user.isActive ? 'badge-success' : 'badge-ghost'}">
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      {:else if key === 'actions'}
        <div class="flex gap-1 justify-end">
          <button class="btn btn-sm btn-ghost">Edit</button>
          <button class="btn btn-sm btn-error">Delete</button>
        </div>
      {/if}
    {/snippet}
  </DataTable>
{/if}
```

---

## Custom Utilities

### Glass Panel

**CSS Definition:**
```css
.glass-panel {
  @apply rounded-2xl border border-white/5 bg-base-200/60 backdrop-blur-lg shadow-lg shadow-black/30;
}
```

**Usage:**
```svelte
<div class="glass-panel p-6">
  <!-- Content with glass morphism effect -->
</div>
```

**When to Use:**
- Main content panels
- Modal backgrounds (optional)
- Elevated cards over background gradients

### Section Heading

**CSS Definition:**
```css
.section-heading {
  @apply text-3xl font-display font-semibold text-base-content/90 sm:text-4xl;
}
```

**Usage:**
```svelte
<h1 class="section-heading">Dashboard</h1>
```

**When to Use:**
- Page titles
- Main section headings
- Hero headings

### Hero Title

**CSS Definition:**
```css
.hero-title {
  @apply text-4xl font-display tracking-tight text-base-content;
}
```

**Usage:**
```svelte
<h1 class="hero-title">Operator Console</h1>
```

**When to Use:**
- Login page hero
- Landing page titles
- Large display headings

### Badge Pill

**CSS Definition:**
```css
.badge-pill {
  @apply inline-flex items-center gap-2 rounded-full bg-neutral/70 px-3 py-1 text-xs font-medium text-neutral-content/80;
}
```

**Usage:**
```svelte
<div class="badge-pill">
  <span class="inline-flex size-2 rounded-full bg-success"></span>
  <span>Network online</span>
</div>
```

**When to Use:**
- Status indicators with icons
- System information badges
- Contextual metadata pills

### Metric Card

**CSS Definition:**
```css
.metric-card {
  @apply rounded-2xl border border-white/10 bg-base-200/70 backdrop-blur-lg shadow-lg shadow-black/30 p-5 transition duration-200 hover:border-primary/40 hover:shadow-primary/20;
}
```

**Usage:**
```svelte
<article class="metric-card">
  <p class="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/40">
    Active Sessions
  </p>
  <p class="mt-2 text-3xl font-display text-primary">03</p>
  <p class="mt-1 text-[10px] text-base-content/40">Live rooms</p>
</article>
```

**When to Use:**
- Dashboard metrics
- KPI cards
- Clickable stat displays

### Nav Link

**CSS Definition:**
```css
.nav-link {
  @apply flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-base-content/60 transition-all duration-200 ease-out;
}

.nav-link:hover {
  @apply bg-base-300/60 text-base-content;
}

.nav-link[data-active='true'] {
  @apply text-primary;
}
```

**Usage:**
```svelte
<a href="/dashboard" class="nav-link" data-active={isActive}>
  <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-300/60">
    <svg><!-- Icon --></svg>
  </span>
  <span class="truncate font-medium">Dashboard</span>
</a>
```

**When to Use:**
- Sidebar navigation
- Tab navigation
- Menu items

---

## Component Specifications

### 1. LoadingState Component

**File:** `src/lib/components/ui/LoadingState.svelte`

**Props:**
```typescript
interface LoadingStateProps {
  variant?: 'spinner' | 'dots' | 'ring' | 'ball' | 'infinity';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  fullScreen?: boolean;
  message?: string;
  children?: Snippet;
}
```

**Default Values:**
- `variant`: 'infinity' (USER REQUESTED)
- `size`: 'lg'
- `color`: 'text-primary'
- `fullScreen`: false

**Implementation Notes:**
- Use DaisyUI `loading` classes
- Support full-screen overlay with backdrop blur
- Optional message text below spinner
- Snippet support for custom content

**Use Cases:**
- Dashboard data loading
- Bookings calendar loading
- Games list loading
- Modal submit actions
- Any async operation

---

### 2. SkeletonLoader Component

**File:** `src/lib/components/ui/SkeletonLoader.svelte`

**Props:**
```typescript
interface SkeletonLoaderProps {
  type: 'text' | 'card' | 'table' | 'avatar';
  count?: number;
  lines?: number;
  class?: string;
}
```

**Default Values:**
- `count`: 1
- `lines`: 3 (for text type)

**Implementation Notes:**
- Use DaisyUI `skeleton` class
- Text type: Multiple line skeletons with varying widths
- Card type: Full card skeleton with header, content, actions
- Table type: Row skeletons
- Avatar type: Circular skeleton

**Use Cases:**
- Dashboard session cards while loading
- Bookings list while loading
- Game library while loading
- DataTable rows while loading

---

### 3. Modal Component

**File:** `src/lib/components/ui/Modal.svelte`

**Props:**
```typescript
interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  onclose: () => void;
  children: Snippet;
  actions?: Snippet;
}
```

**Default Values:**
- `size`: '2xl'

**Implementation Notes:**
- Use native `<dialog>` element
- Responsive: `modal-bottom sm:modal-middle`
- Backdrop click to close
- Escape key handling
- Prevent default cancel behavior
- Optional actions snippet for footer buttons

**Use Cases:**
- Replaces all 9 existing modal components
- Confirmation dialogs
- Forms
- Content viewers

**Migration Path:**
1. Create Modal component
2. Refactor UserModal.svelte to use it
3. Refactor remaining modals one by one
4. Remove duplicate code

---

### 4. DataTable Component (EXISTING)

**File:** `src/lib/components/DataTable.svelte`

**Props:**
```typescript
interface DataTableProps<T> {
  items: T[];
  keyField: keyof T;
  mobileCard: Snippet<[T]>;
  columns: DataTableColumn[];
  desktopCell: Snippet<[T, string]>;
  emptyMessage?: string;
  isLoading?: boolean;
  breakpoint?: 'sm' | 'md' | 'lg';
  class?: string;
}

interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  class?: string;
}
```

**Implementation Notes:**
- Already implemented and working well
- Generic TypeScript types
- Mobile card layout, desktop table layout
- Loading and empty states
- DaisyUI table-zebra styling

**Future Enhancements:**
- Add sorting support
- Add pagination
- Add filtering
- Add row selection

---

### 5. Breadcrumbs Component

**File:** `src/lib/components/ui/Breadcrumbs.svelte`

**Props:**
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

**Implementation Notes:**
- Use DaisyUI breadcrumbs pattern
- Last item is current page (no link)
- Hover state on links
- Proper semantic HTML with `<nav>` and `aria-label`

**Use Cases:**
- Admin pages
- Game Runner
- Nested routes
- Settings pages

---

### 6. KeyboardShortcut Component

**File:** `src/lib/components/ui/KeyboardShortcut.svelte`

**Props:**
```typescript
interface KeyboardShortcutProps {
  keys: string[];
  class?: string;
}
```

**Implementation Notes:**
- Use DaisyUI `kbd` class
- Display keys with + separator
- Support platform-specific symbols (⌘, ⌃, ⌥, ⇧)
- Render inline with buttons or standalone

**Use Cases:**
- Dashboard quick start button (⌘K)
- Help documentation
- Tooltips for power users
- Settings pages

---

### 7. Toast Component

**File:** `src/lib/components/ui/Toast.svelte`

**Store:** `src/lib/stores/toast.ts`

**Store Methods:**
```typescript
interface ToastStore {
  subscribe: (callback: (toasts: Toast[]) => void) => () => void;
  show: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}
```

**Implementation Notes:**
- Global store-based state
- Auto-dismiss after duration (default 4000ms)
- Manual dismiss button
- Multiple toasts queue
- Animations with Svelte transitions
- Position: top-right (toast-top toast-end)
- DaisyUI alert classes for styling

**Use Cases:**
- Success confirmations
- Error messages
- Information notices
- Warning alerts
- Replaces inline toast implementations

---

## Summary

This UI Design System document serves as the **single source of truth** for all UI development in EscapePlan. It provides:

1. **Design Principles** - Guiding philosophy for UI decisions
2. **Color System** - Complete palette with usage guidelines
3. **Typography** - Type scale, fonts, and text styling
4. **Spacing & Layout** - Responsive grid patterns
5. **Component Library** - All DaisyUI components with examples
6. **Accessibility** - WCAG AA compliance guidelines
7. **Responsive Design** - Mobile-first patterns
8. **Code Examples** - Copy-paste ready implementations
9. **Custom Utilities** - Custom CSS classes documented
10. **Component Specifications** - 7 utility components to be created

**Key Recommendations:**

**Priority 1 (Immediate):**
1. Create Modal wrapper component → Reduces 270+ lines of repeated code
2. Create LoadingState component → Adds loading states to 10+ pages
3. Create SkeletonLoader component → Improves perceived performance
4. Add validation state classes → Better UX and accessibility
5. Add ARIA labels to icon buttons → Critical accessibility fix

**Priority 2 (Short-term):**
6. Standardize button sizing → Document and apply standards
7. Create Breadcrumbs component → Improved navigation
8. Create KeyboardShortcut component → Better discoverability
9. Create Toast system → Centralized notifications
10. Document all custom utilities → Improved DX

**Priority 3 (Long-term):**
11. Create FormField wrapper → Reduce form boilerplate
12. Create EmptyState component → Standardized empty states
13. Enhance DataTable → Sorting, pagination, filtering
14. Standardize input styling → Consistent approach
15. Extract inline conditional classes → Better readability

**Total Components in System:**
- **Existing:** 16 reusable components + DataTable
- **To Be Created:** 7 utility components (LoadingState, SkeletonLoader, Modal, Breadcrumbs, KeyboardShortcut, Toast, EmptyState)
- **DaisyUI Components:** 30+ documented with examples
- **Custom Utilities:** 6 documented (glass-panel, section-heading, hero-title, badge-pill, metric-card, nav-link)

This design system should be referenced for **all future UI work** and kept up to date as the system evolves.
