# Phase 0 · UI Design System Research (Codex Session)

> **⚠️ DEPRECATED:** Research findings consolidated into [`UI-OPTIMIZATION-PLAN.md`](./UI-OPTIMIZATION-PLAN.md)
> **This was initial research only.** Use the optimization plan for implementation.

## Scope
- Analyze existing EscapePlan UI implementation without modifying runtime code.
- Document DaisyUI 5.1.26+/Tailwind CSS 4/Svelte 5 runes guidance from Context7 research.
- Identify audit focus areas for claude-gamesettings before implementation work begins.

## Tech Stack Snapshot
- Frontend: SvelteKit 2 + Svelte 5 runes (`<svelte:options runes={true} />` usage across components).
- Styling: Tailwind CSS 4 pipeline (`@tailwindcss/postcss` in `postcss.config.cjs`; `@source` directive in `src/app.css`).
- Component library: DaisyUI 5 theme variables defined under `data-theme="escapeplan"` in `src/app.css`.
- State: Drizzle + Better Auth via API; real-time via Socket.IO (relevant for live UI states).

## Component Inventory Overview
- `src/lib/components`: ArchiveReasonContent, CameraModal, ConfirmDialogHost, DataTable, PasswordResetModal, PermissionsTab, RoleModal, RolesTab, UserModal, plus domain clusters under `assets/`, `games/`, `media/`, `sessions/`, `ui/`.
- `src/lib/avatar`: Avatar & AvatarEditor customizing operator avatars.
- `src/lib/pwa/ReloadPrompt.svelte` for update prompts.
- `src/routes/(app)`: dashboard, bookings, games, admin sub-sections (users, cameras, system tabs), account profile/security.
- Archived routes retain older patterns (`src/routes/_archived/...`), still useful for regression references.

## DaisyUI Usage Audit by Category

### 1. Form Inputs & Controls
- Forms heavily rely on deprecated `form-control`, `label-text`, `label-text-alt` patterns (e.g. `UserModal` uses them for almost every field). → DaisyUI upgrade guidance recommends migrating to semantic `fieldset`, `legend`, and `label` constructs for v5+ ([Context7 · DaisyUI upgrade guide](https://daisyui.com/docs/upgrade/)).
- Checkbox/toggle/range inputs use DaisyUI primitives correctly, but grouping is inconsistent—no shared `fieldset` wrappers around related options (cf. `NetworkTab` broadcast form).
- File input handling appears only in `GameModal` media uploader; uses raw `<input type="file">` without DaisyUI `file-input` styling, missing accessible helper text.
- Recommendation: define reusable Svelte snippets for `FormField` (label, helper, validation state) aligned with DaisyUI 5 semantics.

### 2. Validation & Feedback
- Error reporting mostly via `alert` components (e.g. `CameraModal` test results and failures) rather than inline input states.
- No usage of DaisyUI validator utilities (`validator`, `validator-hint`) for required/invalid fields per Context7 snippet (`<form> ... class="$$validator"`), meaning client-side validation lacks consistent visuals.
- Required: map API failure payloads into per-field messaging and adopt DaisyUI validation classes for success/error/warning states.

### 3. Data Display
- `DataTable.svelte` renders zebra table variant with custom breakpoints and manual loading spinner (`loading-spinner`) instead of themable `loading-infinity` ([DaisyUI loading docs](https://daisyui.com/components/loading/)).
- Stats/metrics implemented via bespoke `metric-card` utility CSS rather than DaisyUI `stat` component (Context7 reference shows standard markup).
- No timeline component despite requirement; status history currently freeform text blocks.

### 4. Loading States
- Global loaders use spinner variants; no occurrences of `loading-infinity` (prompt requirement confirmed via `rg`).
- Skeleton screens absent (`rg "skeleton"` returns nothing). DaisyUI skeleton guidance implies we should plan skeleton bundles for high-latency screens (e.g. dashboard, bookings, game runner).
- Opportunity: standardize `LoadingState` Svelte snippet wrapping DaisyUI `loading-infinity` with size props + optional helper text.

### 5. Navigation Elements
- Primary navigation relies on custom drawer + `nav-link` utilities; DaisyUI `navbar`, `menu`, and `breadcrumbs` patterns only partially adopted. Example: no breadcrumbs on deep routes even though DaisyUI makes it trivial (`<div class="breadcrumbs">` structure per Context7 doc).
- Tabs implemented manually (`Tabs` variant not referenced); system sub-tabs (Alerts/Logs/etc.) could adopt DaisyUI `tabs` API for consistency and keyboard accessibility.

### 6. Feedback & Overlays
- Alerts: uses default `alert` blocks but mixes layout directions (`alert-horizontal` vs default) without responsive modifiers.
- Toasts implemented as bespoke `badge-pill` + `setToast` pattern (`dashboard` page) rather than DaisyUI `toast` container; aligning with DaisyUI `toast` would unlock placement utilities (`toast-top`, `toast-end`).
- Modals: follow DaisyUI patterns but embed `form-control` internals. Confirm dialog host already centralises modal UX; good candidate for codifying button variants per DaisyUI button API.

### 7. Interactions
- Buttons: widespread mixture of `btn`, `btn-sm`, `btn-outline`, but variant usage is inconsistent (e.g. danger actions sometimes `btn-secondary` vs `btn-error`). Without documented scale tokens adoption, teams will default to divergent choices.
- Button groups still rely on custom CSS rather than DaisyUI `join` utilities (Context7 upgrade doc stresses migrating off `btn-group`/`input-group`).
- Dropdowns/menus use DaisyUI markup in some admin tables, while other areas hand-roll toggled panels.

### 8. Utilities & Micro-components
- Tooltips centralised via `HelpTooltip` component (wraps DaisyUI `tooltip` classes) – solid base to expand with accessible toggling.
- No dedicated components for `kbd`, `indicator`, `stack`, or `divider` utilities even though they appear inline (`NetworkTab` uses `<div class="divider">`). A shared `KeyboardShortcut` component remains a gap from Phase 0 goals.

## Tailwind CSS 4 Considerations
- Current setup already uses Tailwind v4 plugin (`@tailwindcss/postcss`). Must ensure contributors avoid legacy config patterns—per Tailwind v4 upgrade guide, container utility overrides require `@utility` blocks instead of config (`@utility container { ... }`).
- Variant ordering switched to left-to-right stacking; audit existing arbitrary variants to confirm compatibility (guide snippet suggests reviewing sequences like `*:first` vs `first:*`).
- Encourage removal of residual `shadow-sm` usage replaced by v4 scales (`shadow-xs`).

## Svelte 5 Runes Best Practices
- Components correctly opt into runes mode; maintainers must avoid legacy `$:` mutation patterns—use `$effect` for side effects and `$derived` for computed state (Context7 docs remind that runes cannot run inside cleanup functions and require parentheses).
- Shared stores should export `$state` objects from `.svelte.ts` modules when cross-component sharing is needed (see Svelte doc snippet showing `$state` outside Svelte files).
- Lint for multiple `$props()` calls—Context7 warns the rune cannot be invoked twice per component.

## Outstanding Research Questions for Implementation Phase
1. How should we design a reusable `FormField` rune-aware component that wraps DaisyUI `fieldset` semantics while exposing validation slots?
2. Which pages demand skeleton coverage first (dashboard, bookings, game runner) based on data fetch latency—what placeholder layouts suit each?
3. Can `DataTable` evolve into a compound component that handles sorting/pagination using DaisyUI table accessories (pinning, join for pagination controls)?
4. What theming tokens should drive button/alert variants so that operators distinguish privilege levels at a glance (map to DaisyUI color intents)?
5. Do we centralize toast/alert handling with a Svelte store + DaisyUI `toast`, replacing bespoke random toasts to satisfy accessibility (role="alert") requirements?

## References (Context7)
- DaisyUI upgrade semantics for forms & joins (`https://daisyui.com/docs/upgrade/`).
- DaisyUI component APIs: input/select/checkbox/range/radio/file-input/loading/skeleton/table/badge/rating/progress/stat/timeline/navbar/breadcrumbs/tabs/dropdown/pagination/alert/toast/modal/tooltip/button (all retrieved via Context7 `/daisyui.com/llmstxt`).
- Tailwind CSS v4 upgrade guide snippets (`https://tailwindcss.com/docs/upgrade-guide`).
- Svelte runes documentation (`https://svelte.dev/docs/svelte/$state`, `$effect`, runes notes via Context7 `/llmstxt/svelte_dev_llms-full_txt`).

---
Prepared by Codex (research-only session). No code changes performed.
