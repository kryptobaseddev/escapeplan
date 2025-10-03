# EscapePlan UI Component Inventory

**Date:** 2025-10-02
**Auditor:** Claude (UI Design System Audit - Session 52)
**Tech Stack:** DaisyUI 5.1.25+, Tailwind CSS 4, SvelteKit 2, Svelte 5 (runes)

---

## Executive Summary

**Total Svelte Components:** 16 reusable components + 16 route pages
**DaisyUI Usage:** Extensive throughout - 39 files contain DaisyUI classes
**Current State:** Inconsistent patterns, missing loading states, no validation state classes

---

## Component Counts

### Reusable UI Components (src/lib/components/)

- **Total Components:** 16
- **Modal Components:** 7 (GameModal, GameDetailsModal, UserModal, CameraModal, RoleModal, HintModal, MediaModal, QuickStartModal, PasswordResetModal)
- **Utility Components:** 5 (DataTable, HelpTooltip, AssetUpload, AssetBrowser, ConfirmDialogHost)
- **Tab Components:** 3 (RolesTab, PermissionsTab, ArchiveReasonContent)
- **Specialized:** 1 (Avatar/AvatarEditor)

### Route Pages (src/routes/)

- **Active Routes:** 13 pages
- **Archived Routes:** 4 pages (_archived/)
- **Auth Routes:** 1 (login)
- **Public Routes:** 1 (timer/[slug])
- **App Routes:** 11 protected pages

---

## DaisyUI Component Usage Analysis

### Form Inputs (✅ GOOD COVERAGE)

**Text Input:**
- Total instances: ~50+ across components
- Pattern: `<input class="input input-bordered" />`
- Variations found:
  - ✅ `input-bordered` (standard)
  - ✅ `input-primary/70` (Login page - with opacity modifier)
  - ✅ `bg-base-100/70` (Login page - custom background)
  - ❌ NO validation state classes (`input-error`, `input-success`)
  - ❌ NO size variants used (`input-sm`, `input-lg`)

**Locations:**
- UserModal.svelte: username, name, email fields
- CameraModal.svelte: name, host, port, stream_path fields
- Login page: username, password
- Bookings page: date input

**Textarea:**
- Total instances: ~5
- Pattern: `<textarea class="textarea textarea-bordered" />`
- Variations:
  - ✅ `min-h-[6rem]` (UserModal)
  - ❌ NO validation states

**Locations:**
- UserModal.svelte: bio field (with maxlength="500")

**Select Dropdown:**
- Total instances: ~10+
- Pattern: `<select class="select select-bordered" />`
- Consistent usage across:
  - UserModal: role selection
  - CameraModal: protocol, resolution, transport selection

### Buttons (✅ EXTENSIVE USE, ⚠️ INCONSISTENT SIZING)

**Button Classes Found:**
- `btn` (base class - everywhere)
- `btn-primary` (CTAs, main actions)
- `btn-ghost` (secondary actions, cancel buttons)
- `btn-outline` (randomize avatar, alternative actions)
- `btn-sm` (compact contexts like bookings scope filter)
- `btn-block` (login submit button)
- `btn-circle` (HelpTooltip icon button)
- `btn-xs` (HelpTooltip)
- `btn-square` (not found in audit, but available in DaisyUI)

**Issues Identified:**
1. **Inconsistent sizing:**
   - Some modals use default size buttons
   - Bookings uses `btn-sm`
   - HelpTooltip uses `btn-xs`
   - No standard guideline

2. **Mixed patterns for secondary actions:**
   - UserModal: `btn-ghost` for cancel
   - Bookings: `btn-ghost border border-white/10` for print
   - CameraModal: likely similar pattern

**Button Usage Locations:**
- UserModal.svelte: Cancel (ghost), Submit (primary)
- Login page: Submit (primary, block)
- Bookings: Scope filters (sm, conditional primary)
- HelpTooltip: Help icon (circle, ghost, xs)
- Dashboard: Quick actions

### Checkboxes & Toggles (✅ PROPER USAGE)

**Toggle:**
- Pattern: `<input type="checkbox" class="toggle toggle-primary" />`
- Location: UserModal.svelte (mustResetPassword field)
- ✅ Proper label association with `<label>` wrapper
- ✅ `bind:checked` for Svelte 5 reactivity

**Checkbox:**
- Standard DaisyUI pattern expected
- Used for collapse components (see below)

### Radio Buttons

**Limited Direct Usage:**
- Not heavily used in current codebase
- DaisyUI supports: `radio radio-primary`, size variants
- Tabs component uses radio inputs internally (see Tabs section)

### Modal Dialogs (✅ STANDARDIZED PATTERN)

**Pattern:**
```svelte
<dialog class="modal modal-bottom sm:modal-middle" open bind:this={dialogElement}>
  <div class="modal-box max-h-[92vh] w-full max-w-2xl overflow-y-auto px-6 py-6">
    <!-- content -->
  </div>
</dialog>
```

**Modals Identified:**
1. UserModal.svelte
2. GameModal.svelte (large file, 26k+ tokens)
3. GameDetailsModal.svelte
4. CameraModal.svelte
5. RoleModal.svelte
6. HintModal.svelte
7. MediaModal.svelte
8. QuickStartModal.svelte
9. PasswordResetModal.svelte

**Consistency:**
- ✅ All use `modal modal-bottom sm:modal-middle` responsive pattern
- ✅ Consistent modal-box sizing (`max-w-2xl` standard)
- ✅ Proper scroll handling (`overflow-y-auto`)
- ✅ Cancel handler with `oncancel` event
- ❌ No standardized close button (X) in header
- ❌ No backdrop click handling
- ❌ Repeated boilerplate across all modals

### Alerts (✅ PROPER USAGE)

**Alert Pattern:**
```svelte
<div class="alert alert-error mt-4 border border-error/30 bg-error/10 text-sm text-error-content">
  <span>{errorMessage}</span>
</div>
```

**Locations:**
- UserModal.svelte: error alerts
- Login page: form error display
- Likely in other modals for validation feedback

**Variations:**
- ✅ `alert-error` for errors
- Custom styling: `border border-error/30 bg-error/10` (UserModal)
- ⚠️ Mix of DaisyUI semantic and custom colors

### Badges (✅ FOUND)

**Usage:**
- Bookings page: timezone badge (`badge-pill` - custom class?)
- Expected in dashboard for status indicators
- DaisyUI supports: `badge badge-primary`, `badge-ghost`, size variants

### Loading States (❌ CRITICAL GAP)

**Loading Spinner:**
- Found in DataTable.svelte: `<span class="loading loading-spinner loading-lg">`
- ✅ Correct DaisyUI pattern
- ❌ **NOT FOUND** elsewhere:
  - No loading states on dashboard data fetch
  - No loading states on modals
  - No loading states on forms
  - CameraModal has `isTesting` state but likely needs spinner

**Loading Variants Available (DaisyUI):**
- `loading-spinner` ✅ (used)
- `loading-dots`
- `loading-ring`
- `loading-ball`
- `loading-infinity` ← **USER REQUESTED as default**

**Missing Implementations:**
- ❌ Dashboard page: no loading state while fetching sessions
- ❌ Bookings page: no loading state
- ❌ Games page: no loading state
- ❌ All modal submit actions: no loading indicators

### Skeleton Screens (❌ NOT FOUND)

**Search Results:** ZERO skeleton screen implementations

**Critical Missing:**
- Dashboard: should show skeleton cards while loading sessions
- Bookings calendar: should show skeleton while loading
- Game list: should show skeleton cards
- DataTable: has loading spinner but could use skeleton rows

### Tables (✅ CUSTOM COMPONENT EXISTS)

**DataTable.svelte:**
- ✅ Uses `table table-zebra` DaisyUI classes
- ✅ Responsive: mobile card layout, desktop table layout
- ✅ Has loading state with spinner
- ✅ Empty state handled
- ⚠️ No sorting indicators
- ⚠️ No pagination

**DaisyUI Table Pattern:**
```svelte
<table class="table table-zebra">
  <thead class="bg-base-300/60 text-xs uppercase tracking-[0.28em] text-base-content/40">
    <tr><th>...</th></tr>
  </thead>
  <tbody>
    <tr class="hover"><td>...</td></tr>
  </tbody>
</table>
```

### Navbar (❌ NOT FOUND IN AUDIT)

**Expected Location:** `(app)/+layout.svelte`

**DaisyUI Navbar Available:**
- `navbar` base class
- `navbar-start`, `navbar-center`, `navbar-end` sections
- Dropdown menus supported

### Breadcrumbs (❌ NOT FOUND)

**No implementations found.**

**DaisyUI Pattern Available:**
```html
<div class="breadcrumbs">
  <ul>
    <li><a>Home</a></li>
    <li><a>Admin</a></li>
  </ul>
</div>
```

### Tabs (⚠️ POTENTIALLY USED)

**Not explicitly found in audit subset, but:**
- RolesTab.svelte and PermissionsTab.svelte exist
- Likely tab navigation in admin panels
- DaisyUI supports: `tabs tabs-bordered`, `tabs-boxed`, `tabs-lifted`

### Tooltips (✅ IMPLEMENTED)

**HelpTooltip.svelte:**
```svelte
<div class="tooltip {positionClass} {colorClass}" data-tip={text}>
  <button type="button" class="btn btn-circle btn-ghost btn-xs text-info" tabindex="-1">
    <!-- SVG icon -->
  </button>
</div>
```

**Props:**
- `position`: top | bottom | left | right
- `color`: neutral | primary | info
- ✅ Reusable component
- ✅ Proper DaisyUI tooltip usage

### Dropdown (⚠️ LIKELY USED)

**Expected in:**
- Dashboard navbar
- User profile menu
- Admin menus

**DaisyUI Pattern:**
```html
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button">...</div>
  <ul tabindex="0" class="dropdown-content menu">...</ul>
</div>
```

### Collapse/Accordion (⚠️ UNKNOWN)

**Not found in audit.**

**DaisyUI Supports:**
- Checkbox-based collapse
- Radio-based accordion groups

### Divider (⚠️ UNKNOWN)

**Not audited but likely needed for section separation.**

### Keyboard Shortcuts (kbd) (❌ NOT FOUND)

**Dashboard has keyboard shortcut (Cmd/Ctrl+K) but NO visual indicator**

**Location:** Dashboard.svelte line 126-132
```ts
if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
  quickStartOpen = true;
}
```

**DaisyUI Pattern:**
```html
<kbd class="kbd">⌘</kbd>+<kbd class="kbd">K</kbd>
```

### Rating Component (❌ NOT FOUND)

**Use Case:** Game difficulty ratings

**DaisyUI Supports:**
- Star ratings with `mask mask-star`
- Half-star ratings

### Progress Indicators (❌ NOT FOUND)

**Potential Use Cases:**
- Session timer progress bar
- Upload progress for assets

### Stats Display (❌ NOT FOUND)

**Potential Use Cases:**
- Dashboard summary stats
- Analytics cards

### Timeline (❌ NOT FOUND)

**Potential Use Case:**
- Hint send history
- Session event log

---

## Missing Components (High Priority)

### Immediate Needs:
1. ❌ **LoadingState** component (infinity variant as default)
2. ❌ **SkeletonLoader** component (cards, table, text variants)
3. ❌ **FormField** wrapper (label + input + error + help text)
4. ❌ **Modal** standardized wrapper (reduce boilerplate)
5. ❌ **Breadcrumbs** component
6. ❌ **KeyboardShortcut** visual indicator component
7. ❌ **Toast** notification system

### Nice to Have:
- Rating component wrapper
- Progress bar component
- Stats card component
- Timeline component
- Standardized DataTable with sorting/pagination

---

## Problematic Patterns Identified

### 1. Inconsistent Button Sizing
**Problem:** No standard sizing guideline
- Login: default + `btn-block`
- Bookings: `btn-sm`
- HelpTooltip: `btn-xs`
- Modals: default size

**Recommendation:** Establish size standards per context

### 2. Mixed Input Styling
**Problem:** Some use opacity modifiers, others don't
- Login: `input-primary/70 bg-base-100/70`
- Modals: plain `input-bordered`

**Recommendation:** Standardize on one approach

### 3. No Loading States on Data Fetch
**Problem:** Users see blank screens while data loads
- Dashboard sessions load
- Bookings calendar load
- Game list load

**Recommendation:** Add skeleton screens + loading infinity

### 4. No Validation State Classes
**Problem:** Form errors shown in alerts, not inline
- No `input-error` usage
- No `textarea-error` usage
- No `select-error` usage

**Recommendation:** Use DaisyUI validation state classes

### 5. Repeated Modal Boilerplate
**Problem:** Every modal repeats dialog structure
- Same `modal modal-bottom sm:modal-middle` pattern
- Same modal-box sizing
- Same cancel handling

**Recommendation:** Create Modal wrapper component

### 6. Missing ARIA Labels
**Problem:** Icon-only buttons lack accessibility
- HelpTooltip button has `tabindex="-1"` but no aria-label
- Likely other icon buttons missing labels

**Recommendation:** Add aria-label to all icon buttons

### 7. Custom Classes Mixed with DaisyUI
**Problem:** Inconsistent approach
- `badge-pill` (custom)
- `glass-panel` (custom)
- `hero-title` (custom)

**Recommendation:** Document custom utility classes

---

## DaisyUI Standardization Opportunities

### Currently Missing DaisyUI Features:
1. **Form validation states** (`input-error`, `select-success`, etc.)
2. **Loading infinity** animation (user requested)
3. **Skeleton** loading screens
4. **Breadcrumb** navigation
5. **Kbd** keyboard shortcut display
6. **Rating** stars for difficulty
7. **Progress** bars
8. **Stats** cards
9. **Timeline** event display
10. **Collapse** / Accordion groups

### Standardization Priorities:
1. ✅ Keep: Current modal pattern, DataTable, HelpTooltip
2. ⚠️ Improve: Button sizing consistency, input validation states
3. ❌ Add: Loading states, skeleton screens, FormField wrapper, Modal wrapper

---

## Component Usage Heat Map

**High Usage (10+ instances):**
- `btn` (everywhere)
- `input input-bordered` (all forms)
- `modal` (9 modal components)

**Medium Usage (5-10 instances):**
- `select select-bordered`
- `alert alert-error`
- `textarea textarea-bordered`

**Low Usage (1-5 instances):**
- `toggle toggle-primary`
- `tooltip`
- `table table-zebra`
- `loading loading-spinner`

**Zero Usage (missing):**
- `loading-infinity`
- `skeleton`
- `breadcrumbs`
- `kbd`
- `rating`
- `progress`
- `stats`
- `timeline`
- `collapse`

---

## Accessibility Audit Findings

### GOOD:
- ✅ Form labels present with `label-text`
- ✅ Semantic HTML (`<button>`, `<input>`, `<select>`)
- ✅ `autocomplete` attributes on login inputs

### NEEDS IMPROVEMENT:
- ⚠️ HelpTooltip: `tabindex="-1"` removes from keyboard navigation
- ⚠️ Missing aria-labels on icon buttons
- ⚠️ Modal escape key handling unclear
- ⚠️ No visible focus states documented
- ⚠️ Keyboard shortcut (Cmd+K) not visually indicated

---

## Recommendations Summary

### Immediate Actions:
1. **Create LoadingState.svelte** with `loading-infinity` as default
2. **Create SkeletonLoader.svelte** for cards, tables, text
3. **Create FormField.svelte** wrapper component
4. **Create Modal.svelte** wrapper to reduce boilerplate
5. **Add validation state classes** to all form inputs
6. **Add loading states** to Dashboard, Bookings, Games pages
7. **Add aria-labels** to all icon buttons

### Short-Term Improvements:
1. Standardize button sizing per context
2. Create Breadcrumbs component
3. Create KeyboardShortcut display component
4. Add toast notification system
5. Document custom utility classes

### Long-Term Enhancements:
1. Add rating component for game difficulty
2. Add progress bars for timers
3. Add stats cards for dashboard
4. Add timeline for session events
5. Enhance DataTable with sorting/pagination

---

**Next Steps:** Proceed to DaisyUI research documentation and pattern analysis.
