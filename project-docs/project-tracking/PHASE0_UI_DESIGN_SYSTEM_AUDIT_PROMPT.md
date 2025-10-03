# Phase 0: UI Design System Audit & Standardization - Agent Execution Prompt

**Agent Role:** UI/UX Design System Architect
**Session:** Complete DaisyUI Audit + UI_DESIGN_SYSTEM.md Creation
**Validation By:** claude-gamesettings (collaborative session)
**Prerequisites:** ⚠️ Should run BEFORE or IN PARALLEL with Phase 1 & 2
**Estimated Duration:** 16-24 hours across 3 sessions

---

## 🎯 MISSION OVERVIEW

**Your mission is to:**
1. **AUDIT** all UI components across the entire EscapePlan app
2. **IDENTIFY** where DaisyUI 5.1.26+ components are used incorrectly or inconsistently
3. **CATALOG** all current components and their usage patterns
4. **RESEARCH** DaisyUI 5.1.26+ best practices using Context7
5. **DESIGN** a comprehensive UI_DESIGN_SYSTEM.md document
6. **STANDARDIZE** all data inputs, form fields, and interactive elements
7. **CREATE** missing utility components for SOLID/DRY architecture
8. **REFACTOR** existing components to follow the design system

**CRITICAL:** This is a COLLABORATIVE session. You will work with claude-gamesettings to make decisions about component structure, naming conventions, and design patterns.

---

## REQUIRED READING (Read ALL before starting)

**Foundation Documents:**
1. `@escapeplan-app/project-docs/project-tracking/prompt-claude.txt` - Base instructions
2. `@escapeplan-app/project-docs/project-tracking/project.yaml` - Tech stack
3. `@escapeplan-app/CLAUDE.md` - Project overview and constraints

**UI Framework:**
4. **USE CONTEXT7** to look up DaisyUI v5.1.26+ documentation (your knowledge is outdated - we're in 2025)
5. **USE CONTEXT7** to look up Tailwind CSS 4 utilities
6. **USE CONTEXT7** to look up Svelte 5 runes patterns

**Current Components:**
7. Review ALL .svelte files in `apps/escapeplan-web/src/lib/components/`
8. Review ALL route pages in `apps/escapeplan-web/src/routes/`

---

## 📋 USER REQUIREMENTS

### Required DaisyUI Components to Audit:

1. **Form Inputs**
   - Text input (`input`)
   - Textarea
   - Select dropdown
   - File input
   - Checkbox
   - Radio buttons
   - Toggle switch
   - Range slider

2. **Validation & Feedback**
   - Form validation states (error, success, warning)
   - Input groups
   - Fieldset usage
   - Helper text patterns
   - Error message display

3. **Data Display**
   - Table component (with sorting, pagination)
   - Badge variations
   - Rating (star ratings)
   - Progress indicators
   - Stats displays
   - Timeline

4. **Loading States**
   - **Loading infinity** (user specifically requested this)
   - Skeleton screens (need to plan usage across app)
   - Spinner variations

5. **Navigation**
   - Navbar (need better usage)
   - Breadcrumbs
   - Tabs
   - Menu/dropdown
   - Pagination

6. **Feedback**
   - Alert boxes
   - Toast notifications
   - Modal dialogs
   - Tooltip

7. **Interactive**
   - Button variations
   - Button groups
   - Dropdown menus
   - Collapse/accordion
   - Drawer/sidebar
   - Swap (icon toggle)

8. **Utilities**
   - Keyboard shortcuts (`kbd` component)
   - Divider
   - Stack/join
   - Indicator (notification dots)

---

## 🔍 AUDIT WORKFLOW

### Phase 1: Component Inventory (4 hours)

**Goal:** Create comprehensive inventory of ALL UI components in the app

**Execute these commands and document results:**

```bash
# 1. Find all Svelte components
find apps/escapeplan-web/src/lib/components -name "*.svelte" | sort > audit/component-list.txt

# 2. Find all route pages
find apps/escapeplan-web/src/routes -name "+page.svelte" | sort > audit/route-pages.txt

# 3. Search for DaisyUI class usage
grep -rn "class=\".*btn" apps/escapeplan-web/src --include="*.svelte" > audit/button-usage.txt
grep -rn "class=\".*input" apps/escapeplan-web/src --include="*.svelte" > audit/input-usage.txt
grep -rn "class=\".*select" apps/escapeplan-web/src --include="*.svelte" > audit/select-usage.txt
grep -rn "class=\".*toggle" apps/escapeplan-web/src --include="*.svelte" > audit/toggle-usage.txt
grep -rn "class=\".*range" apps/escapeplan-web/src --include="*.svelte" > audit/range-usage.txt
grep -rn "class=\".*card" apps/escapeplan-web/src --include="*.svelte" > audit/card-usage.txt
grep -rn "class=\".*alert" apps/escapeplan-web/src --include="*.svelte" > audit/alert-usage.txt
grep -rn "class=\".*badge" apps/escapeplan-web/src --include="*.svelte" > audit/badge-usage.txt
grep -rn "class=\".*modal" apps/escapeplan-web/src --include="*.svelte" > audit/modal-usage.txt
grep -rn "class=\".*loading" apps/escapeplan-web/src --include="*.svelte" > audit/loading-usage.txt
grep -rn "class=\".*skeleton" apps/escapeplan-web/src --include="*.svelte" > audit/skeleton-usage.txt
grep -rn "class=\".*navbar" apps/escapeplan-web/src --include="*.svelte" > audit/navbar-usage.txt
grep -rn "class=\".*breadcrumb" apps/escapeplan-web/src --include="*.svelte" > audit/breadcrumb-usage.txt
grep -rn "class=\".*table" apps/escapeplan-web/src --include="*.svelte" > audit/table-usage.txt
grep -rn "class=\".*kbd" apps/escapeplan-web/src --include="*.svelte" > audit/kbd-usage.txt

# 4. Count component files
wc -l audit/*.txt
```

**Create inventory document:**

`audit/COMPONENT_INVENTORY.md`:

```markdown
# EscapePlan UI Component Inventory

**Date:** [DATE]
**Auditor:** [YOUR NAME]

## Component Counts

- Total Svelte components: X
- Total route pages: X
- Reusable UI components: X
- Feature components: X

## DaisyUI Component Usage

### Buttons
- Total instances: X
- Variations found: [list btn-primary, btn-secondary, etc.]
- Inconsistencies: [list issues]

### Inputs
- Total instances: X
- Types found: text, number, email, password, etc.
- Missing validation states: [list]
- Inconsistencies: [list]

### Cards
- Total instances: X
- Patterns found: [list]
- Inconsistencies: [list]

[Continue for all components...]

## Missing Components

- [ ] Standardized file input
- [ ] Keyboard shortcut indicator (kbd)
- [ ] Loading infinity animation
- [ ] Skeleton screen templates
- [ ] Breadcrumb navigation
- [ ] Data table with sorting
- [ ] Rating component
- [ ] Timeline component
- [ ] Toast notification system

## Problematic Patterns

1. **Inconsistent button sizing:** Some use btn-sm, others btn-md, no standard
2. **Mixed input styles:** Some bordered, some filled, no standard
3. **No loading states:** No skeleton screens or loading indicators on data fetch
4. **Accessibility issues:** Missing aria-labels, no focus states
5. [List more...]

## Recommendations

1. Create FormInput wrapper component
2. Create DataTable wrapper component
3. Standardize all button variants
4. [List more...]
```

---

### Phase 2: DaisyUI Research (2 hours)

**CRITICAL:** Use Context7 to look up current DaisyUI documentation

**Research queries to run:**

```
CONTEXT7 LOOKUPS:
1. "DaisyUI form components v5"
2. "DaisyUI input validation states"
3. "DaisyUI loading components"
4. "DaisyUI skeleton screen examples"
5. "DaisyUI table component advanced"
6. "DaisyUI breadcrumbs navigation"
7. "DaisyUI kbd keyboard shortcut"
8. "DaisyUI rating component"
9. "DaisyUI navbar responsive"
10. "DaisyUI modal best practices"
```

**Document findings:**

`audit/DAISYUI_RESEARCH_NOTES.md`:

```markdown
# DaisyUI 5.1.26+ Research Notes

## Form Components

### Input Component
**Official docs:** [link from Context7]

**Correct usage:**
- Base class: `input input-bordered`
- Variants: `input-primary`, `input-secondary`, `input-accent`
- Sizes: `input-xs`, `input-sm`, `input-md`, `input-lg`
- States: `input-error`, `input-success`, `input-warning`, `input-info`

**Current EscapePlan usage:**
- ✅ GOOD: Most use `input input-bordered`
- ❌ BAD: No validation state classes used
- ❌ BAD: Inconsistent sizing (mix of sm/md)

**Recommendation:** Create FormInput wrapper with validation states

### Loading Component
**Official docs:** [link from Context7]

**Available variants:**
- `loading loading-spinner`
- `loading loading-dots`
- `loading loading-ring`
- `loading loading-ball`
- **`loading loading-infinity`** ← USER REQUESTED

**Current EscapePlan usage:**
- ❌ NOT FOUND: No loading components used

**Recommendation:** Create LoadingState component with infinity default

[Continue for all components...]
```

---

### Phase 3: Pattern Analysis (3 hours)

**Goal:** Identify common patterns and anti-patterns

**Create pattern analysis document:**

`audit/PATTERN_ANALYSIS.md`:

```markdown
# UI Pattern Analysis

## Current Patterns

### Pattern 1: Form Field with Label + Help
**Location:** GameModal.svelte:600-610, OperatorModal.svelte:200-210
**Current implementation:**
```svelte
<div class="form-control">
  <div class="label">
    <span class="label-text">Field Name</span>
  </div>
  <input type="text" class="input input-bordered" />
</div>
```

**Issues:**
- No help text support
- No error state
- No required indicator
- Repeated boilerplate

**Recommended pattern:**
```svelte
<FormField
  label="Field Name"
  helpText="Optional help text"
  error={errors.fieldName}
  required
>
  <input type="text" class="input input-bordered" />
</FormField>
```

### Pattern 2: Modal Dialogs
**Location:** GameModal.svelte, OperatorModal.svelte, CameraModal.svelte
**Current implementation:**
```svelte
<dialog bind:this={dialogElement} class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Title</h3>
    <!-- content -->
    <div class="modal-action">
      <button class="btn">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</dialog>
```

**Issues:**
- Repeated modal structure
- No close button (X)
- No backdrop click to close
- No escape key handler

**Recommended pattern:**
```svelte
<Modal
  bind:open
  title="Modal Title"
  onConfirm={handleSave}
  onCancel={handleCancel}
  confirmText="Save"
  confirmVariant="primary"
>
  <!-- content -->
</Modal>
```

[Continue analyzing patterns...]

## Anti-Patterns Found

### Anti-Pattern 1: Inline Styles
**Location:** Dashboard.svelte:450
```svelte
<div style="display: flex; gap: 1rem; align-items: center;">
```
**Issue:** Should use Tailwind utilities
**Fix:** `<div class="flex gap-4 items-center">`

### Anti-Pattern 2: Hardcoded Colors
**Location:** AssetBrowser.svelte:200
```svelte
<div style="background-color: #f3f4f6;">
```
**Issue:** Should use DaisyUI theme colors
**Fix:** `<div class="bg-base-200">`

[Continue documenting anti-patterns...]
```

---

### Phase 4: UI_DESIGN_SYSTEM.md Creation (6 hours)

**CRITICAL:** This is the main deliverable - create comprehensive design system documentation

**File:** `apps/DOCS/UI_DESIGN_SYSTEM.md`

**Outline:**

```markdown
# EscapePlan UI Design System

**Version:** 1.0.0
**Last Updated:** [DATE]
**Framework:** DaisyUI 5.1.26+ on Tailwind CSS 4
**Component Library:** Svelte 5

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Library](#component-library)
6. [Form Components](#form-components)
7. [Data Display](#data-display)
8. [Navigation](#navigation)
9. [Feedback Components](#feedback-components)
10. [Loading States](#loading-states)
11. [Accessibility](#accessibility)
12. [Responsive Patterns](#responsive-patterns)
13. [Code Examples](#code-examples)

---

## Design Principles

### 1. Consistency
- Use DaisyUI component classes exclusively (no custom CSS unless necessary)
- Follow established patterns for similar UI elements
- Maintain consistent spacing, sizing, and color usage

### 2. Accessibility First
- All interactive elements must be keyboard accessible
- All images/icons must have descriptive alt text or aria-labels
- Color contrast must meet WCAG AA standards (4.5:1 for text)
- Focus states must be clearly visible

### 3. Mobile-First Responsive
- Design for smallest screen first (320px)
- Use responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Test all components on mobile, tablet, and desktop

### 4. DRY Components
- Never repeat component structure
- Extract reusable patterns into wrapper components
- Use composition over duplication

### 5. Performance
- Lazy-load heavy components
- Use skeleton screens for loading states
- Minimize re-renders with proper Svelte reactivity

---

## Color System

### Theme Colors (DaisyUI)

**Primary:** `#C43131` (Red accent - primary brand color)
**Secondary:** `#00D5C8` (Cyan accent - secondary brand color)
**Accent:** Auto from theme
**Neutral:** Charcoal/black tones
**Base:** Dark theme (charcoal backgrounds)

**Usage:**
- `bg-primary` - Primary background
- `text-primary` - Primary text color
- `btn-primary` - Primary button variant
- `border-primary` - Primary border color

**Semantic Colors:**
- `bg-success` / `text-success` - Successful actions
- `bg-error` / `text-error` - Errors and destructive actions
- `bg-warning` / `text-warning` - Warnings and caution
- `bg-info` / `text-info` - Informational messages

**Base Colors:**
- `bg-base-100` - Lightest background (cards, modals)
- `bg-base-200` - Medium background (sections)
- `bg-base-300` - Darker background (input fills)
- `text-base-content` - Default text color

### Color Opacity
Use Tailwind opacity modifiers:
- `bg-primary/10` - 10% opacity
- `bg-primary/50` - 50% opacity
- `bg-primary/90` - 90% opacity

---

## Typography

### Font Family
**Primary:** System font stack (from Tailwind defaults)
**Monospace:** For code, timestamps, numerical data

### Text Sizes
- `text-xs` - 0.75rem (12px)
- `text-sm` - 0.875rem (14px)
- `text-base` - 1rem (16px) ← Default
- `text-lg` - 1.125rem (18px)
- `text-xl` - 1.25rem (20px)
- `text-2xl` - 1.5rem (24px)
- `text-3xl` - 1.875rem (30px)

### Font Weights
- `font-normal` - 400 (body text)
- `font-semibold` - 600 (headings, labels)
- `font-bold` - 700 (emphasis, CTAs)

### Usage Guidelines
- Page titles: `text-2xl font-bold`
- Section headers: `text-lg font-semibold`
- Card titles: `card-title` (DaisyUI class)
- Form labels: `label-text` (DaisyUI class)
- Body text: `text-base`
- Helper text: `text-sm text-base-content/70`
- Error text: `text-sm text-error`

---

## Spacing & Layout

### Spacing Scale (Tailwind)
- `gap-1` / `p-1` / `m-1` - 0.25rem (4px)
- `gap-2` / `p-2` / `m-2` - 0.5rem (8px)
- `gap-3` / `p-3` / `m-3` - 0.75rem (12px)
- `gap-4` / `p-4` / `m-4` - 1rem (16px) ← **Default for sections**
- `gap-6` / `p-6` / `m-6` - 1.5rem (24px)
- `gap-8` / `p-8` / `m-8` - 2rem (32px)

### Layout Patterns

**Container:**
```svelte
<div class="container mx-auto px-4 py-6">
  <!-- content -->
</div>
```

**Grid Layouts:**
```svelte
<!-- 2-column responsive -->
<div class="grid gap-4 md:grid-cols-2">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

<!-- 3-column responsive -->
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <!-- items -->
</div>

<!-- 4-column responsive -->
<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <!-- items -->
</div>
```

**Flex Layouts:**
```svelte
<!-- Horizontal with gap -->
<div class="flex gap-4 items-center">
  <!-- items -->
</div>

<!-- Vertical stack -->
<div class="flex flex-col gap-4">
  <!-- items -->
</div>

<!-- Space between -->
<div class="flex items-center justify-between">
  <div>Left</div>
  <div>Right</div>
</div>
```

**Vertical Spacing:**
```svelte
<!-- Section spacing -->
<div class="space-y-6">
  <section>...</section>
  <section>...</section>
</div>

<!-- Component spacing -->
<div class="space-y-4">
  <Component />
  <Component />
</div>
```

---

## Component Library

### Core Utility Components

#### 1. FormField
**Location:** `src/lib/components/ui/FormField.svelte`
**Purpose:** Standardized form field wrapper with label, help text, and error display

**Usage:**
```svelte
<FormField
  label="Email Address"
  helpText="We'll never share your email"
  error={errors.email}
  required
>
  <input type="email" class="input input-bordered" bind:value={email} />
</FormField>
```

**Props:**
- `label: string` - Field label text
- `helpText?: string` - Optional help tooltip text
- `error?: string | null` - Error message to display
- `required?: boolean` - Show required indicator (*)
- `children: Snippet` - Input element

#### 2. LoadingState
**Location:** `src/lib/components/ui/LoadingState.svelte`
**Purpose:** Standardized loading indicator

**Usage:**
```svelte
<LoadingState
  variant="infinity"
  size="lg"
  text="Loading games..."
/>
```

**Props:**
- `variant?: 'spinner' | 'dots' | 'ring' | 'ball' | 'infinity'` - Default: 'infinity'
- `size?: 'xs' | 'sm' | 'md' | 'lg'` - Default: 'md'
- `text?: string` - Optional loading text
- `fullScreen?: boolean` - Cover entire viewport

**Variants:**
```svelte
<!-- Infinity (default - USER REQUESTED) -->
<span class="loading loading-infinity loading-lg text-primary"></span>

<!-- Spinner -->
<span class="loading loading-spinner loading-md"></span>

<!-- Dots -->
<span class="loading loading-dots loading-sm"></span>
```

#### 3. SkeletonLoader
**Location:** `src/lib/components/ui/SkeletonLoader.svelte`
**Purpose:** Skeleton screen for content loading

**Usage:**
```svelte
<SkeletonLoader type="card" count={3} />
<SkeletonLoader type="table" rows={5} />
<SkeletonLoader type="text" lines={3} />
```

**Types:**
- `card` - Skeleton card layout
- `table` - Skeleton table rows
- `text` - Skeleton text lines
- `avatar` - Skeleton avatar circle
- `custom` - Use children for custom skeleton

**Example Implementation:**
```svelte
<script lang="ts">
  let {
    type = 'text',
    lines = 3,
    rows = 5,
    count = 1
  }: {
    type?: 'card' | 'table' | 'text' | 'avatar';
    lines?: number;
    rows?: number;
    count?: number;
  } = $props();
</script>

{#if type === 'text'}
  <div class="space-y-2">
    {#each Array(lines) as _}
      <div class="skeleton h-4 w-full"></div>
    {/each}
  </div>
{:else if type === 'card'}
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each Array(count) as _}
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="skeleton h-6 w-3/4"></div>
          <div class="skeleton h-4 w-full"></div>
          <div class="skeleton h-4 w-5/6"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if type === 'table'}
  <div class="space-y-2">
    {#each Array(rows) as _}
      <div class="skeleton h-12 w-full"></div>
    {/each}
  </div>
{/if}
```

#### 4. DataTable
**Location:** `src/lib/components/ui/DataTable.svelte`
**Purpose:** Standardized table with sorting, pagination

**Usage:**
```svelte
<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role' }
  ]}
  data={users}
  onSort={handleSort}
  onRowClick={handleRowClick}
  loading={isLoading}
/>
```

**Props:**
- `columns: Column[]` - Column definitions
- `data: T[]` - Row data
- `sortBy?: string` - Current sort column
- `sortDirection?: 'asc' | 'desc'` - Current sort direction
- `onSort?: (column: string) => void` - Sort handler
- `onRowClick?: (row: T) => void` - Row click handler
- `loading?: boolean` - Show skeleton loader
- `emptyMessage?: string` - Message when no data

#### 5. Modal
**Location:** `src/lib/components/ui/Modal.svelte`
**Purpose:** Standardized modal dialog wrapper

**Usage:**
```svelte
<Modal
  bind:open
  title="Edit Game"
  size="lg"
  onConfirm={handleSave}
  onCancel={handleCancel}
  confirmText="Save Changes"
  confirmVariant="primary"
  confirmDisabled={!isValid}
>
  <!-- modal content -->
</Modal>
```

**Props:**
- `open: boolean` - Bindable open state
- `title?: string` - Modal title
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Modal width
- `onConfirm?: () => void` - Confirm button handler
- `onCancel?: () => void` - Cancel button handler
- `confirmText?: string` - Confirm button text (default: "Confirm")
- `cancelText?: string` - Cancel button text (default: "Cancel")
- `confirmVariant?: ButtonVariant` - Confirm button style
- `confirmDisabled?: boolean` - Disable confirm button
- `showActions?: boolean` - Show footer actions (default: true)
- `children: Snippet` - Modal content

#### 6. HelpTooltip
**Location:** `src/lib/components/ui/HelpTooltip.svelte`
**Purpose:** Help icon with tooltip (ALREADY EXISTS)

**Usage:**
```svelte
<HelpTooltip>
  This is helpful information that appears on hover/click.
  Supports <strong>HTML</strong> for formatting.
</HelpTooltip>
```

#### 7. VolumeSlider
**Location:** `src/lib/components/ui/VolumeSlider.svelte`
**Purpose:** Range slider with live value display

**Usage:**
```svelte
<VolumeSlider
  bind:value={volume}
  label="Master Volume"
  helpText="Adjust system-wide volume (0-100)"
  min={0}
  max={100}
  step={5}
/>
```

#### 8. Breadcrumbs
**Location:** `src/lib/components/ui/Breadcrumbs.svelte`
**Purpose:** Navigation breadcrumb trail

**Usage:**
```svelte
<Breadcrumbs
  items={[
    { label: 'Home', href: '/' },
    { label: 'Admin', href: '/admin' },
    { label: 'Games', href: '/admin/games' },
    { label: 'Edit Game' } // Current page (no href)
  ]}
/>
```

**Implementation:**
```svelte
<script lang="ts">
  type BreadcrumbItem = {
    label: string;
    href?: string;
  };

  let {
    items
  }: {
    items: BreadcrumbItem[];
  } = $props();
</script>

<div class="breadcrumbs text-sm">
  <ul>
    {#each items as item}
      <li>
        {#if item.href}
          <a href={item.href} class="link link-hover">{item.label}</a>
        {:else}
          <span class="text-base-content/70">{item.label}</span>
        {/if}
      </li>
    {/each}
  </ul>
</div>
```

#### 9. KeyboardShortcut
**Location:** `src/lib/components/ui/KeyboardShortcut.svelte`
**Purpose:** Display keyboard shortcut using kbd component

**Usage:**
```svelte
<KeyboardShortcut keys={['Ctrl', 'S']} />
<KeyboardShortcut keys={['⌘', 'K']} />
```

**Implementation:**
```svelte
<script lang="ts">
  let {
    keys
  }: {
    keys: string[];
  } = $props();
</script>

<div class="inline-flex gap-1">
  {#each keys as key}
    <kbd class="kbd kbd-sm">{key}</kbd>
  {/each}
</div>
```

---

## Form Components

### Input Field

**Standard Text Input:**
```svelte
<input type="text" class="input input-bordered w-full" placeholder="Enter value" />
```

**With Validation States:**
```svelte
<!-- Error state -->
<input type="text" class="input input-bordered input-error" />

<!-- Success state -->
<input type="text" class="input input-bordered input-success" />

<!-- Warning state -->
<input type="text" class="input input-bordered input-warning" />
```

**Sizes:**
```svelte
<input type="text" class="input input-bordered input-xs" />
<input type="text" class="input input-bordered input-sm" />
<input type="text" class="input input-bordered input-md" />
<input type="text" class="input input-bordered input-lg" />
```

### Textarea

**Standard:**
```svelte
<textarea
  class="textarea textarea-bordered w-full"
  rows="4"
  placeholder="Enter description"
></textarea>
```

**With Error State:**
```svelte
<textarea class="textarea textarea-bordered textarea-error w-full"></textarea>
```

### Select Dropdown

**Standard:**
```svelte
<select class="select select-bordered w-full">
  <option disabled selected>Pick one</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

**With Validation:**
```svelte
<select class="select select-bordered select-error w-full">
  <!-- options -->
</select>
```

### File Input

**Standard:**
```svelte
<input
  type="file"
  class="file-input file-input-bordered w-full"
  accept="image/*"
/>
```

**With Primary Styling:**
```svelte
<input type="file" class="file-input file-input-bordered file-input-primary" />
```

### Checkbox

**Standard:**
```svelte
<input type="checkbox" class="checkbox" />

<!-- With primary color -->
<input type="checkbox" class="checkbox checkbox-primary" />

<!-- With sizes -->
<input type="checkbox" class="checkbox checkbox-xs" />
<input type="checkbox" class="checkbox checkbox-sm" />
<input type="checkbox" class="checkbox checkbox-md" />
<input type="checkbox" class="checkbox checkbox-lg" />
```

**With Label:**
```svelte
<label class="flex cursor-pointer items-center gap-2">
  <input type="checkbox" class="checkbox checkbox-primary" />
  <span class="label-text">Accept terms</span>
</label>
```

### Radio Buttons

**Standard:**
```svelte
<div class="form-control">
  <label class="flex cursor-pointer items-center gap-2">
    <input type="radio" name="radio-1" class="radio radio-primary" checked />
    <span class="label-text">Option 1</span>
  </label>
  <label class="flex cursor-pointer items-center gap-2">
    <input type="radio" name="radio-1" class="radio radio-primary" />
    <span class="label-text">Option 2</span>
  </label>
</div>
```

### Toggle Switch

**Standard:**
```svelte
<input type="checkbox" class="toggle" checked />

<!-- With colors -->
<input type="checkbox" class="toggle toggle-primary" />
<input type="checkbox" class="toggle toggle-secondary" />
<input type="checkbox" class="toggle toggle-accent" />
<input type="checkbox" class="toggle toggle-success" />

<!-- With sizes -->
<input type="checkbox" class="toggle toggle-xs" />
<input type="checkbox" class="toggle toggle-sm" />
<input type="checkbox" class="toggle toggle-md" />
<input type="checkbox" class="toggle toggle-lg" />
```

**With Label:**
```svelte
<label class="flex cursor-pointer items-center gap-3">
  <input type="checkbox" class="toggle toggle-primary" />
  <span class="label-text font-semibold">Enable feature</span>
</label>
```

### Range Slider

**Standard:**
```svelte
<input type="range" min="0" max="100" value="50" class="range range-primary" />
```

**With Steps:**
```svelte
<input
  type="range"
  min="0"
  max="100"
  value="50"
  step="25"
  class="range range-primary"
/>
<div class="flex w-full justify-between px-2 text-xs">
  <span>0</span>
  <span>25</span>
  <span>50</span>
  <span>75</span>
  <span>100</span>
</div>
```

**Use VolumeSlider Component Instead:**
Prefer the `VolumeSlider` component for consistent range input with value display.

### Form Validation Pattern

**Complete Form Example:**
```svelte
<script lang="ts">
  import FormField from '$lib/components/ui/FormField.svelte';
  import { z } from 'zod';

  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().int().positive()
  });

  let formData = $state({ name: '', email: '', age: 0 });
  let errors = $state<Record<string, string>>({});

  function validate() {
    const result = schema.safeParse(formData);
    if (!result.success) {
      errors = result.error.flatten().fieldErrors;
      return false;
    }
    errors = {};
    return true;
  }

  function handleSubmit() {
    if (validate()) {
      // Submit form
    }
  }
</script>

<form onsubmit|preventDefault={handleSubmit} class="space-y-4">
  <FormField label="Name" error={errors.name} required>
    <input type="text" class="input input-bordered" bind:value={formData.name} />
  </FormField>

  <FormField label="Email" error={errors.email} required>
    <input type="email" class="input input-bordered" bind:value={formData.email} />
  </FormField>

  <FormField label="Age" error={errors.age}>
    <input type="number" class="input input-bordered" bind:value={formData.age} />
  </FormField>

  <div class="flex gap-2 justify-end">
    <button type="button" class="btn">Cancel</button>
    <button type="submit" class="btn btn-primary">Submit</button>
  </div>
</form>
```

---

## Data Display

### Table Component

**DaisyUI Table:**
```svelte
<div class="overflow-x-auto">
  <table class="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each users as user}
        <tr class="hover">
          <td>{user.name}</td>
          <td>{user.email}</td>
          <td><span class="badge badge-primary">{user.role}</span></td>
          <td>
            <button class="btn btn-ghost btn-xs">Edit</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

**Table Variants:**
```svelte
<!-- Zebra striping -->
<table class="table table-zebra">

<!-- Pin rows -->
<table class="table table-pin-rows">

<!-- Pin columns -->
<table class="table table-pin-cols">

<!-- Compact -->
<table class="table table-xs">
```

**Prefer DataTable Component:**
Use the `DataTable` component for tables with sorting, pagination, and loading states.

### Badge

**Standard:**
```svelte
<span class="badge">Default</span>
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-accent">Accent</span>
<span class="badge badge-ghost">Ghost</span>
<span class="badge badge-neutral">Neutral</span>
```

**Sizes:**
```svelte
<span class="badge badge-xs">XS</span>
<span class="badge badge-sm">SM</span>
<span class="badge badge-md">MD</span>
<span class="badge badge-lg">LG</span>
```

**Semantic:**
```svelte
<span class="badge badge-success">Active</span>
<span class="badge badge-error">Inactive</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-info">Info</span>
```

### Rating

**Star Rating:**
```svelte
<div class="rating">
  <input type="radio" name="rating-1" class="mask mask-star" />
  <input type="radio" name="rating-1" class="mask mask-star" checked />
  <input type="radio" name="rating-1" class="mask mask-star" />
  <input type="radio" name="rating-1" class="mask mask-star" />
  <input type="radio" name="rating-1" class="mask mask-star" />
</div>
```

**With Primary Color:**
```svelte
<div class="rating">
  {#each [1, 2, 3, 4, 5] as star}
    <input
      type="radio"
      name="rating-2"
      class="mask mask-star-2 bg-primary"
      checked={difficulty === star}
    />
  {/each}
</div>
```

**Half Stars:**
```svelte
<div class="rating rating-half">
  <input type="radio" name="rating-10" class="mask mask-star-2 mask-half-1 bg-primary" />
  <input type="radio" name="rating-10" class="mask mask-star-2 mask-half-2 bg-primary" />
  <input type="radio" name="rating-10" class="mask mask-star-2 mask-half-1 bg-primary" />
  <input type="radio" name="rating-10" class="mask mask-star-2 mask-half-2 bg-primary" />
  <!-- etc -->
</div>
```

---

## Navigation

### Navbar

**Standard Navbar:**
```svelte
<div class="navbar bg-base-100 shadow-md">
  <div class="navbar-start">
    <a href="/" class="btn btn-ghost text-xl">EscapePlan</a>
  </div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal px-1">
      <li><a href="/dashboard">Dashboard</a></li>
      <li><a href="/bookings">Bookings</a></li>
      <li><a href="/games">Games</a></li>
    </ul>
  </div>
  <div class="navbar-end">
    <button class="btn btn-ghost btn-circle">
      <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  </div>
</div>
```

**With Mobile Dropdown:**
```svelte
<div class="navbar bg-base-100">
  <div class="navbar-start">
    <div class="dropdown">
      <label tabindex="0" class="btn btn-ghost lg:hidden">
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </label>
      <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/bookings">Bookings</a></li>
        <li><a href="/games">Games</a></li>
      </ul>
    </div>
    <a href="/" class="btn btn-ghost text-xl">EscapePlan</a>
  </div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal px-1">
      <li><a href="/dashboard">Dashboard</a></li>
      <li><a href="/bookings">Bookings</a></li>
      <li><a href="/games">Games</a></li>
    </ul>
  </div>
</div>
```

### Breadcrumbs

**Use Breadcrumbs Component** (see Component Library section)

### Tabs

**Standard:**
```svelte
<div role="tablist" class="tabs tabs-bordered">
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'details'}
    onclick={() => activeTab = 'details'}
  >
    Details
  </button>
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'pricing'}
    onclick={() => activeTab = 'pricing'}
  >
    Pricing
  </button>
  <button
    role="tab"
    class="tab"
    class:tab-active={activeTab === 'puzzles'}
    onclick={() => activeTab = 'puzzles'}
  >
    Puzzles
  </button>
</div>

<!-- Tab content -->
{#if activeTab === 'details'}
  <div class="p-4">Details content</div>
{:else if activeTab === 'pricing'}
  <div class="p-4">Pricing content</div>
{:else if activeTab === 'puzzles'}
  <div class="p-4">Puzzles content</div>
{/if}
```

**Tab Variants:**
```svelte
<!-- Boxed tabs -->
<div role="tablist" class="tabs tabs-boxed">

<!-- Lifted tabs -->
<div role="tablist" class="tabs tabs-lifted">

<!-- Sizes -->
<div role="tablist" class="tabs tabs-xs">
<div role="tablist" class="tabs tabs-sm">
<div role="tablist" class="tabs tabs-md">
<div role="tablist" class="tabs tabs-lg">
```

### Menu / Dropdown

**Dropdown Menu:**
```svelte
<div class="dropdown">
  <label tabindex="0" class="btn btn-primary">Open Menu</label>
  <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
    <li><a>Item 1</a></li>
    <li><a>Item 2</a></li>
    <li><a>Item 3</a></li>
  </ul>
</div>
```

**Dropdown Positions:**
```svelte
<!-- Right -->
<div class="dropdown dropdown-end">

<!-- Top -->
<div class="dropdown dropdown-top">

<!-- Left -->
<div class="dropdown dropdown-left">

<!-- Bottom (default) -->
<div class="dropdown dropdown-bottom">
```

**Hover to Open:**
```svelte
<div class="dropdown dropdown-hover">
  <!-- content -->
</div>
```

---

## Feedback Components

### Alert Boxes

**Standard Alerts:**
```svelte
<!-- Info -->
<div class="alert alert-info">
  <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>New updates available!</span>
</div>

<!-- Success -->
<div class="alert alert-success">
  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>Game saved successfully!</span>
</div>

<!-- Warning -->
<div class="alert alert-warning">
  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
  <span>Session will expire in 5 minutes</span>
</div>

<!-- Error -->
<div class="alert alert-error">
  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>Failed to save game</span>
</div>
```

**Alert with Actions:**
```svelte
<div class="alert alert-info">
  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <div>
    <h3 class="font-bold">New version available</h3>
    <div class="text-sm">Refresh to get the latest features</div>
  </div>
  <button class="btn btn-sm btn-primary">Refresh</button>
</div>
```

### Toast Notifications

**Create Toast Component:**
`src/lib/components/ui/Toast.svelte`

```svelte
<script lang="ts">
  import { fade } from 'svelte/transition';

  export let toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }> = [];

  export function addToast(message: string, type: ToastType = 'info', duration = 3000) {
    const id = Math.random().toString(36);
    toasts = [...toasts, { id, message, type }];

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  function removeToast(id: string) {
    toasts = toasts.filter(t => t.id !== id);
  }
</script>

<div class="toast toast-top toast-end z-50">
  {#each toasts as toast (toast.id)}
    <div
      class="alert alert-{toast.type}"
      transition:fade
    >
      <span>{toast.message}</span>
      <button
        class="btn btn-sm btn-ghost"
        onclick={() => removeToast(toast.id)}
      >
        ✕
      </button>
    </div>
  {/each}
</div>
```

**Usage:**
```svelte
<script>
  import Toast from '$lib/components/ui/Toast.svelte';

  let toast;

  function handleSave() {
    // ... save logic
    toast.addToast('Game saved successfully!', 'success');
  }
</script>

<Toast bind:this={toast} />
```

### Modal Dialogs

**Use Modal Component** (see Component Library section)

### Tooltip

**DaisyUI Tooltip:**
```svelte
<div class="tooltip" data-tip="This is a tooltip">
  <button class="btn">Hover me</button>
</div>
```

**Tooltip Positions:**
```svelte
<div class="tooltip tooltip-top" data-tip="Top">
<div class="tooltip tooltip-bottom" data-tip="Bottom">
<div class="tooltip tooltip-left" data-tip="Left">
<div class="tooltip tooltip-right" data-tip="Right">
```

**Tooltip Colors:**
```svelte
<div class="tooltip tooltip-primary" data-tip="Primary">
<div class="tooltip tooltip-secondary" data-tip="Secondary">
<div class="tooltip tooltip-accent" data-tip="Accent">
<div class="tooltip tooltip-info" data-tip="Info">
<div class="tooltip tooltip-success" data-tip="Success">
<div class="tooltip tooltip-warning" data-tip="Warning">
<div class="tooltip tooltip-error" data-tip="Error">
```

**Prefer HelpTooltip Component:**
Use the `HelpTooltip` component for form field help text and explanations.

---

## Loading States

### LoadingState Component

**Use LoadingState Component** (see Component Library section)

**Direct DaisyUI Usage:**
```svelte
<!-- Infinity (USER REQUESTED) -->
<span class="loading loading-infinity loading-lg text-primary"></span>

<!-- Spinner -->
<span class="loading loading-spinner loading-md"></span>

<!-- Dots -->
<span class="loading loading-dots loading-sm"></span>

<!-- Ring -->
<span class="loading loading-ring loading-md"></span>

<!-- Ball -->
<span class="loading loading-ball loading-lg"></span>
```

**Full-Screen Loading:**
```svelte
<div class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80">
  <div class="flex flex-col items-center gap-4">
    <span class="loading loading-infinity loading-lg text-primary"></span>
    <p class="text-lg font-semibold">Loading games...</p>
  </div>
</div>
```

### Skeleton Screens

**Use SkeletonLoader Component** (see Component Library section)

**Direct DaisyUI Usage:**
```svelte
<!-- Text skeleton -->
<div class="skeleton h-4 w-full"></div>
<div class="skeleton h-4 w-5/6"></div>

<!-- Circle skeleton (avatar) -->
<div class="skeleton h-12 w-12 shrink-0 rounded-full"></div>

<!-- Rectangle skeleton (image) -->
<div class="skeleton h-32 w-full"></div>
```

**Card Skeleton Example:**
```svelte
<div class="card bg-base-100 shadow">
  <div class="card-body">
    <div class="skeleton h-6 w-3/4 mb-2"></div>
    <div class="skeleton h-4 w-full mb-1"></div>
    <div class="skeleton h-4 w-5/6"></div>
  </div>
</div>
```

**Where to Use Skeletons:**
- Game list loading
- Booking calendar loading
- Dashboard widgets loading
- User profile loading
- Asset browser loading

---

## Accessibility

### Keyboard Navigation

**All interactive elements MUST be keyboard accessible:**
- Use semantic HTML elements (`<button>`, `<a>`, `<input>`)
- Add `tabindex` only when necessary (0 for focusable, -1 for programmatic focus)
- Implement keyboard event handlers for custom components

**Example:**
```svelte
<button
  class="btn btn-primary"
  onclick={handleClick}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click Me
</button>
```

### ARIA Labels

**All icons MUST have descriptive labels:**
```svelte
<!-- Bad -->
<button class="btn btn-ghost btn-circle">
  <svg>...</svg>
</button>

<!-- Good -->
<button class="btn btn-ghost btn-circle" aria-label="Open search">
  <svg>...</svg>
</button>
```

**Form inputs MUST have labels:**
```svelte
<!-- Bad -->
<input type="text" placeholder="Name" />

<!-- Good -->
<label for="name-input" class="label">
  <span class="label-text">Name</span>
</label>
<input id="name-input" type="text" />
```

### Focus States

**All interactive elements MUST have visible focus states:**
- DaisyUI components have default focus states
- Test with keyboard navigation (Tab key)
- Ensure focus ring is visible against background

**Custom focus styles:**
```svelte
<button class="btn focus:ring-2 focus:ring-primary focus:ring-offset-2">
  Custom Focus
</button>
```

### Color Contrast

**All text MUST meet WCAG AA standards (4.5:1 ratio):**
- Test with browser dev tools color picker
- Use DaisyUI semantic colors (they're designed for contrast)
- Avoid light text on light backgrounds

**Safe combinations:**
- `text-base-content` on `bg-base-100`/`bg-base-200`/`bg-base-300`
- `text-primary-content` on `bg-primary`
- `text-error-content` on `bg-error`

### Screen Reader Support

**Use semantic HTML:**
```svelte
<!-- Bad -->
<div onclick={handleClick}>Click me</div>

<!-- Good -->
<button onclick={handleClick}>Click me</button>
```

**Provide context for screen readers:**
```svelte
<nav aria-label="Main navigation">
  <!-- navigation items -->
</nav>

<section aria-labelledby="game-section-title">
  <h2 id="game-section-title">Available Games</h2>
  <!-- games -->
</section>
```

---

## Responsive Patterns

### Breakpoints

**Tailwind breakpoints:**
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

**Mobile-first approach:**
```svelte
<!-- Stack on mobile, 2 columns on md, 3 columns on lg -->
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <!-- items -->
</div>

<!-- Hide on mobile, show on lg -->
<div class="hidden lg:block">
  <!-- content -->
</div>

<!-- Show on mobile, hide on lg -->
<div class="block lg:hidden">
  <!-- content -->
</div>
```

### Responsive Typography

```svelte
<!-- Responsive heading -->
<h1 class="text-2xl md:text-3xl lg:text-4xl font-bold">
  Welcome to EscapePlan
</h1>

<!-- Responsive padding -->
<div class="p-4 md:p-6 lg:p-8">
  <!-- content -->
</div>
```

### Responsive Navigation

**Example Navbar with Mobile Menu:**
```svelte
<div class="navbar bg-base-100">
  <!-- Mobile menu button -->
  <div class="navbar-start">
    <div class="dropdown lg:hidden">
      <label tabindex="0" class="btn btn-ghost">Menu</label>
      <ul tabindex="0" class="dropdown-content menu">
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/bookings">Bookings</a></li>
      </ul>
    </div>
  </div>

  <!-- Desktop menu -->
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal">
      <li><a href="/dashboard">Dashboard</a></li>
      <li><a href="/bookings">Bookings</a></li>
    </ul>
  </div>
</div>
```

---

## Code Examples

### Complete Form with Validation

**See Form Validation Pattern in Form Components section**

### Complete Data Table with Sorting

```svelte
<script lang="ts">
  import DataTable from '$lib/components/ui/DataTable.svelte';
  import type { Column } from '$lib/components/ui/DataTable.svelte';

  type Game = {
    id: string;
    name: string;
    difficulty: string;
    duration: number;
    active: boolean;
  };

  let games = $state<Game[]>([]);
  let loading = $state(true);
  let sortBy = $state<string>('name');
  let sortDirection = $state<'asc' | 'desc'>('asc');

  const columns: Column<Game>[] = [
    { key: 'name', label: 'Game Name', sortable: true },
    { key: 'difficulty', label: 'Difficulty', sortable: true },
    { key: 'duration', label: 'Duration (min)', sortable: true },
    {
      key: 'active',
      label: 'Status',
      render: (game) =>
        game.active
          ? '<span class="badge badge-success">Active</span>'
          : '<span class="badge badge-ghost">Inactive</span>'
    }
  ];

  async function loadGames() {
    loading = true;
    const response = await fetch('/api/admin/games');
    games = await response.json();
    loading = false;
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'asc';
    }

    games.sort((a, b) => {
      const aVal = a[column as keyof Game];
      const bVal = b[column as keyof Game];

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  $effect(() => {
    loadGames();
  });
</script>

<DataTable
  {columns}
  data={games}
  {sortBy}
  {sortDirection}
  onSort={handleSort}
  onRowClick={(game) => console.log('Clicked:', game)}
  {loading}
  emptyMessage="No games found. Create your first game to get started!"
/>
```

### Complete Modal with Form

```svelte
<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';

  let modalOpen = $state(false);
  let formData = $state({ name: '', email: '' });
  let errors = $state<Record<string, string>>({});

  function validate() {
    errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.email.includes('@')) {
      errors.email = 'Invalid email';
    }
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    // Save logic
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      modalOpen = false;
      formData = { name: '', email: '' };
    }
  }
</script>

<button class="btn btn-primary" onclick={() => modalOpen = true}>
  Add User
</button>

<Modal
  bind:open={modalOpen}
  title="Add New User"
  onConfirm={handleSave}
  onCancel={() => {
    modalOpen = false;
    errors = {};
  }}
  confirmText="Create User"
  confirmDisabled={!formData.name || !formData.email}
>
  <div class="space-y-4">
    <FormField label="Name" error={errors.name} required>
      <input
        type="text"
        class="input input-bordered w-full"
        bind:value={formData.name}
      />
    </FormField>

    <FormField label="Email" error={errors.email} required>
      <input
        type="email"
        class="input input-bordered w-full"
        bind:value={formData.email}
      />
    </FormField>
  </div>
</Modal>
```

---

## Implementation Checklist

When building new features, ensure:

- [ ] All DaisyUI components use correct class names
- [ ] All form inputs have labels and validation states
- [ ] All buttons have proper sizing and variants
- [ ] All interactive elements are keyboard accessible
- [ ] All icons have aria-labels
- [ ] All text meets color contrast requirements
- [ ] Responsive design tested on mobile, tablet, desktop
- [ ] Loading states implemented (skeleton or loading spinner)
- [ ] Error states handled gracefully
- [ ] Help tooltips provided for complex fields
- [ ] Focus states visible and consistent
- [ ] No inline styles (use Tailwind utilities)
- [ ] No hardcoded colors (use DaisyUI theme colors)
- [ ] Component follows SOLID/DRY principles

---

## Maintenance

### Adding New Components

1. Create component in `src/lib/components/ui/`
2. Follow naming convention: PascalCase.svelte
3. Document in this file under Component Library section
4. Add TypeScript types
5. Include usage example
6. Add to component index if applicable

### Updating Existing Components

1. Check if component is used across multiple files
2. Update all instances consistently
3. Document breaking changes
4. Update this design system document
5. Test in all browsers

### Version Control

- Update version number at top of this document
- Document changes in CHANGELOG.md
- Tag releases for major updates

---

**Design System Version:** 1.0.0
**Last Updated:** [DATE]
**Maintained By:** EscapePlan Development Team
**Questions:** Reference this document first, then consult claude-gamesettings

```

---

### Phase 5: Component Creation (8 hours)

**Goal:** Create missing utility components based on design system

**Components to create:**

1. **LoadingState.svelte** (Priority: HIGH)
2. **SkeletonLoader.svelte** (Priority: HIGH)
3. **DataTable.svelte** (Priority: MEDIUM)
4. **Modal.svelte** (Priority: MEDIUM)
5. **Breadcrumbs.svelte** (Priority: LOW)
6. **KeyboardShortcut.svelte** (Priority: LOW)
7. **Toast.svelte** (Priority: LOW)

**For each component:**
1. Create file in correct location
2. Implement according to UI_DESIGN_SYSTEM.md spec
3. Add TypeScript types
4. Test standalone
5. Document usage examples

---

### Phase 6: Component Refactoring (6 hours)

**Goal:** Refactor existing components to follow design system

**Priority refactoring targets:**

1. **GameModal.svelte** - Use FormField components
2. **OperatorModal.svelte** - Use FormField components
3. **CameraModal.svelte** - Use FormField + standardize inputs
4. **Dashboard page** - Add skeleton loaders
5. **Games list page** - Add skeleton loaders
6. **Booking calendar** - Add skeleton loaders
7. **All forms** - Replace inline validation with FormField

**Refactoring checklist per component:**
- [ ] Replace inline form markup with FormField
- [ ] Add loading states with SkeletonLoader or LoadingState
- [ ] Standardize button sizes and variants
- [ ] Add aria-labels to icon buttons
- [ ] Ensure keyboard accessibility
- [ ] Test responsive behavior

---

## ✅ VALIDATION CHECKLIST

Mark each item as you complete it:

### Documentation
- [ ] COMPONENT_INVENTORY.md created with full audit
- [ ] DAISYUI_RESEARCH_NOTES.md created with Context7 findings
- [ ] PATTERN_ANALYSIS.md created with pattern identification
- [ ] UI_DESIGN_SYSTEM.md created (complete design system bible)
- [ ] All sections of UI_DESIGN_SYSTEM.md filled out
- [ ] Code examples tested and working

### Component Creation
- [ ] LoadingState.svelte created with infinity variant
- [ ] SkeletonLoader.svelte created with 4 types
- [ ] DataTable.svelte created with sorting
- [ ] Modal.svelte created with all props
- [ ] Breadcrumbs.svelte created
- [ ] KeyboardShortcut.svelte created
- [ ] Toast.svelte created
- [ ] All components type-check successfully

### Component Refactoring
- [ ] At least 3 major components refactored
- [ ] All forms use FormField
- [ ] Loading states added to data fetch components
- [ ] Skeleton screens implemented on 3+ pages
- [ ] All icon buttons have aria-labels
- [ ] All interactive elements keyboard accessible

### DaisyUI Standardization
- [ ] All buttons use standard size variants
- [ ] All inputs use input-bordered
- [ ] All selects use select-bordered
- [ ] All toggles use toggle-primary or toggle-success
- [ ] All cards use card + card-body
- [ ] All alerts use semantic variants
- [ ] All badges use semantic variants
- [ ] Loading infinity used as default loader

### Type Checking
- [ ] `pnpm --filter escapeplan-web check` passes with 0 errors
- [ ] All new components have proper TypeScript types
- [ ] All refactored components maintain type safety

---

## 📋 COMPLETION REQUIREMENTS

### 1. Create Session Notes

Create `project-docs/project-tracking/sessions/SESSION_52_UI_DESIGN_SYSTEM_AUDIT.md`:

```markdown
# Session 52: UI Design System Audit & Standardization

**Date:** [DATE]
**Status:** ✅ COMPLETE
**Agent:** [YOUR NAME]
**Validation:** Collaborative with claude-gamesettings

## Summary
Complete audit of all UI components across EscapePlan app. Created comprehensive UI_DESIGN_SYSTEM.md document as the bible for all future UI development. Standardized DaisyUI usage and created missing utility components.

## Audit Results

### Component Inventory
- Total components audited: X
- DaisyUI components found: X
- Inconsistencies identified: X
- Anti-patterns found: X

### Context7 Research
[PASTE KEY FINDINGS FROM DAISYUI RESEARCH]

### Pattern Analysis
[SUMMARIZE COMMON PATTERNS AND ANTI-PATTERNS]

## Deliverables Created

### Documentation (Priority)
1. **UI_DESIGN_SYSTEM.md** (lines: X) - COMPLETE DESIGN SYSTEM BIBLE
2. COMPONENT_INVENTORY.md (lines: X)
3. DAISYUI_RESEARCH_NOTES.md (lines: X)
4. PATTERN_ANALYSIS.md (lines: X)

### Components Created
1. LoadingState.svelte (lines: X)
2. SkeletonLoader.svelte (lines: X)
3. DataTable.svelte (lines: X)
4. Modal.svelte (lines: X)
5. Breadcrumbs.svelte (lines: X)
6. KeyboardShortcut.svelte (lines: X)
7. Toast.svelte (lines: X)

**Total:** 7 components, ~X lines

### Components Refactored
1. GameModal.svelte - Added FormField usage
2. OperatorModal.svelte - Standardized inputs
3. [LIST ALL REFACTORED COMPONENTS]

**Total refactored:** X components

## Standardization Improvements

### Before
- Inconsistent button sizes (mix of sm/md/lg)
- No loading states on data fetch
- No skeleton screens
- Mixed input styling
- No validation state classes
- Missing aria-labels on X icon buttons

### After
- ✅ All buttons use standard variants
- ✅ Loading infinity as default loader
- ✅ Skeleton screens on 5+ pages
- ✅ All inputs use input-bordered
- ✅ Validation states use DaisyUI classes
- ✅ All icon buttons have aria-labels

## Validation Results

### Type Checking
```bash
pnpm --filter escapeplan-web check: ✅ SUCCESS (0 errors)
```

### Manual Testing
- [x] LoadingState component: ✅ WORKS
- [x] SkeletonLoader component: ✅ WORKS
- [x] DataTable component: ✅ WORKS
- [x] All refactored forms: ✅ WORKS

## Issues Encountered
[LIST ANY PROBLEMS AND HOW YOU SOLVED THEM]

## Checklist Status
[COPY VALIDATION CHECKLIST WITH ALL CHECKMARKS]

## Notes for Future Development
- **ALL new UI components MUST follow UI_DESIGN_SYSTEM.md**
- Use Context7 for DaisyUI v5+ documentation (knowledge is outdated)
- Prefer composition (FormField, LoadingState, etc.) over inline markup
- Always add loading states and skeleton screens for data fetches
- Test keyboard accessibility on all interactive elements

## Handoff to Next Phase
UI Design System complete. Ready for Phase 1 (Rooms Removal) and Phase 2 (Pricing Rebuild) to use standardized components.
```

### 2. DO NOT Commit Yet

- ❌ Do NOT commit changes
- ❌ Do NOT push to remote
- ✅ Leave changes staged for validation by claude-gamesettings

### 3. Report Completion

Reply with:
```
✅ UI DESIGN SYSTEM AUDIT COMPLETE

Documentation created:
- UI_DESIGN_SYSTEM.md (COMPLETE BIBLE)
- COMPONENT_INVENTORY.md
- DAISYUI_RESEARCH_NOTES.md
- PATTERN_ANALYSIS.md

Components created: 7
Components refactored: X
DaisyUI standardization: ✅ COMPLETE

Key improvements:
- Loading infinity as default
- Skeleton screens on 5+ pages
- FormField standardization across app
- All aria-labels added
- Keyboard accessibility verified

Session notes: SESSION_52_UI_DESIGN_SYSTEM_AUDIT.md
Ready for validation by claude-gamesettings

**UI_DESIGN_SYSTEM.md is now the BIBLE for all future UI work** 📖
```

---

## 🎯 SUCCESS CRITERIA

You are DONE when:

1. ✅ UI_DESIGN_SYSTEM.md is complete with ALL sections filled
2. ✅ Component inventory audit completed
3. ✅ Context7 research documented
4. ✅ Pattern analysis completed
5. ✅ ALL 7 utility components created
6. ✅ At least 3 major components refactored
7. ✅ `pnpm check` succeeds with 0 errors
8. ✅ Loading infinity implemented as default
9. ✅ Skeleton screens on 3+ pages
10. ✅ Session notes created with complete audit
11. ✅ Completion report posted

**Estimated Time:** 16-24 hours across 3 sessions
**Your Priority:** Create comprehensive, usable documentation + standardize all UI
**When Stuck:** Use Context7 for current DaisyUI documentation

**Remember:** UI_DESIGN_SYSTEM.md will be THE BIBLE for all future UI development. Make it comprehensive, clear, and easy to follow.

Good luck! Build a design system that will guide EscapePlan UI for years to come. 📖✨
