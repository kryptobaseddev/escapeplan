# EscapePlan Apps

This repository hosts the EscapePlan application stack: the Fastify API service, the SvelteKit operator PWA, and the shared TypeScript contracts consumed by both. It is organised as a pnpm workspace so the API, web client, and shared packages stay in sync.

## Structure
- `apps/escapeplan-api` – Node.js 22 Fastify service, Drizzle ORM, Vitest.
- `apps/escapeplan-web` – SvelteKit 2 PWA powered by Tailwind CSS 4 and DaisyUI.
- `packages/contracts` – Shared DTOs and validation logic published as `@escapeplan/contracts`.
- `project-docs/` – Product brief, project tracker, and operational playbooks for day-to-day work.

## Getting Started
1. Install pnpm 10.12.4 or later.
2. Run `pnpm install` at the repo root to hydrate all workspaces.
3. Start the API with `pnpm --filter escapeplan-api dev` and the web client with `pnpm --filter escapeplan-web dev`.

## Scripts
- `pnpm build` – Runs `tsup` (API), `vite build` (web), and `tsc` (contracts).
- `pnpm test` – Delegates to package-level Vitest suites.
- `pnpm lint` – Type-checks the API until ESLint/Tsup integration lands.

## Related Projects
Platform automation (pi-gen image, system services, OTA packaging) lives in the sibling `escapeplan-platform` repository under `platform/escapeplan-base/`. See `project-docs/project-overview.md` for the full release plan and cross-repo workflows.
