# Repository Guidelines

## Project Structure & Module Organization
- `apps/escapeplan-api`: Fastify 5 service; handlers in `src`, data layer in `src/db`, SQLite migrations in `migrations/`, seeds in `src/db/seed.ts`.
- `apps/escapeplan-web`: SvelteKit 2 PWA; layouts in `src/routes/(app|auth|public)`, shared utilities in `src/lib`, static assets in `static/`.
- `packages/contracts`: Shared TypeScript DTOs; run `pnpm --filter @escapeplan/contracts build` after editing `src`.
- Specs and operational notes live in `project-docs/`; update them instead of embedding long-form commentary in code.

## Build, Test, and Development Commands
- `pnpm install` to sync dependencies (requires pnpm@10.12.4).
- `pnpm --filter escapeplan-api dev` for the API (uses `tsx` and the local SQLite file in `data/`).
- `pnpm --filter escapeplan-web dev` to start the SvelteKit client with Vite.
- `pnpm build` triggers all package builds (`tsup`, `vite build`, `tsc`); run before tagging releases.
- `pnpm test` fans out to each workspace; prefer `pnpm --filter escapeplan-web check` and `pnpm --filter escapeplan-api test --run` before opening a PR.

## Coding Style & Naming Conventions
- TypeScript everywhere with two-space indentation and ESM imports; use `import type` for type-only dependencies.
- Favor named exports, camelCase functions, PascalCase Svelte components, and SCREAMING_SNAKE_CASE environment variables.
- Gate external input with Zod schemas and share domain models through `src/state.ts` and `packages/contracts` instead of redefining shapes.

## Testing Guidelines
- Backend tests live in `apps/escapeplan-api/test/*.test.ts` and run under Vitest; seed the database with `pnpm --filter escapeplan-api db:seed` before integration scenarios.
- Cover authentication, session state transitions, and realtime emitters when touching related modules; add regression cases for new routes or schemas.
- Frontend confidence currently relies on `svelte-check`; introduce Vitest + Testing Library component tests as UI logic grows.

## Commit & Pull Request Guidelines
- This workspace export lacks git history; stick to Conventional Commits (`feat:`, `fix:`, `chore:`) and prefix subjects with package context when helpful (`api:`, `web:`, `contracts:`).
- Pull requests need a concise change summary, a reference to the relevant tracker entry in `project-docs/project-tracking/`, proof of `pnpm test` (or `check`) output, and screenshots or API traces for user-facing adjustments.

## Security & Configuration Tips
- Store secrets and network settings in the environment files referenced by the PRD (e.g., `/etc/escapeplan/app.env`); never commit credentials or SQLite dumps.
- The default SQLite database sits at `apps/escapeplan-api/data/escapeplan.db`; replace it or switch to in-memory mode for test fixtures, and review `security.ts` before adjusting password policies.
