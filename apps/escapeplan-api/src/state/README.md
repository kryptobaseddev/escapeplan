# State Management Architecture

## Overview

This directory contains the modular state management system for the EscapePlan API. The original monolithic `state.ts` file (2700+ lines) is being refactored into a domain-driven architecture with clear separation of concerns.

## Architecture Principles

### Domain-Driven Design

Each business domain has its own directory with dedicated types and functions:

- **network/** - WiFi management, network profiles, client connections
- **games/** - Game CRUD, puzzles, milestones, pricing
- **operators/** - User accounts, roles, permissions, authentication
- **sessions/** - Active sessions, timer control, commands
- **bookings/** - Calendar bookings, pricing, scheduling
- **dashboard/** - Real-time aggregation, system health
- **shared/** - Common types and utilities

### Type Safety

All modules use TypeScript strict mode with:
- Explicit type annotations for all function parameters and returns
- No implicit `any` types
- Proper error handling with typed error objects
- Type-safe database row to domain model conversions

### Svelte 5 Runes Pattern (.svelte.ts files)

While this is a backend API, the pattern inspiration comes from Svelte 5's state management approach:

#### Key Concepts from Svelte 5 Runes

1. **Reactive State with `$state`**
   ```typescript
   // In Svelte 5, you'd use .svelte.ts files for shared state
   export const userState = $state({
     name: 'name'
     /* ... */
   });
   ```

2. **Module-based State Management**
   - State is extracted into separate modules
   - Each module exports reactive state and operations
   - Type-safe imports across the application

3. **Clear Separation**
   - State definition separate from UI components
   - Business logic isolated from presentation
   - Easy to test and maintain

#### Applying to Backend API

Our backend architecture mirrors this pattern:

```typescript
// Each domain module exports:
// 1. Types (like state shape in Svelte)
export type { GameDetails, GameRow, GameListFilters };

// 2. Operations (like state mutations in Svelte)
export function createGame(payload: SaveGameRequest): GameDetails;
export function updateGame(id: string, payload: SaveGameRequest): GameDetails;
export function listGames(filters: GameListFilters): GameDetails[];

// 3. Utilities (like derived state in Svelte)
export function isGameArchived(game: GameDetails): boolean;
```

## Directory Structure

```
state/
├── README.md                    # This file
├── index.ts                     # Barrel exports
├── shared/
│   └── types.ts                 # Common utilities and types
├── network/
│   └── types.ts                 # Network domain types
├── games/
│   └── types.ts                 # Games domain types
├── operators/
│   └── types.ts                 # Operators domain types
├── sessions/
│   └── types.ts                 # Sessions domain types
├── bookings/
│   └── types.ts                 # Bookings domain types
└── dashboard/
    └── types.ts                 # Dashboard domain types
```

## Usage Patterns

### Importing Types

```typescript
// Import specific types from a domain
import type { GameDetails, GameListFilters } from './state/games/types.js';

// Or from the barrel export
import type { GameDetails, GameListFilters } from './state/index.js';
```

### Importing Functions (to be added)

```typescript
// Import domain-specific functions
import { createGame, updateGame, listGames } from './state/games/index.js';

// Or from the barrel export
import { createGame, updateGame, listGames } from './state/index.js';
```

### Error Handling

All domain modules define their own error types:

```typescript
import type { GameError, GameErrorCode } from './state/games/types.js';

try {
  const game = createGame(payload);
} catch (error) {
  if (isGameError(error)) {
    switch (error.code) {
      case GameErrorCode.SLUG_CONFLICT:
        // Handle slug conflict
        break;
      case GameErrorCode.INVALID_GAME_DATA:
        // Handle validation error
        break;
    }
  }
}
```

## Shared Utilities

The `shared/types.ts` module provides common utilities:

### Result Type

```typescript
import type { Result } from './state/shared/types.js';

function fetchGame(id: string): Result<GameDetails, GameError> {
  try {
    const game = getGameById(id);
    if (!game) {
      return {
        success: false,
        error: { code: GameErrorCode.GAME_NOT_FOUND, message: 'Game not found' }
      };
    }
    return { success: true, data: game };
  } catch (error) {
    return {
      success: false,
      error: { code: GameErrorCode.DATABASE_ERROR, message: String(error) }
    };
  }
}
```

### Safe JSON Parsing

```typescript
import { safeParse } from './state/shared/types.js';

const config = safeParse<GameMediaConfig>(row.media_config);
// Returns undefined if parsing fails, no exceptions thrown
```

### Archive Filtering

```typescript
import { filterArchived, isArchived } from './state/shared/types.js';

const activeGames = filterArchived(allGames, false);
// Returns only non-archived games
```

## Migration Strategy

### Phase 1: Infrastructure (Current)
- ✅ Create directory structure
- ✅ Define type files for all domains
- ✅ Create barrel exports
- ✅ Document architecture

### Phase 2: Extract Domain Logic
- Extract network functions to `network/index.ts`
- Extract games functions to `games/index.ts`
- Extract operators functions to `operators/index.ts`
- Extract sessions functions to `sessions/index.ts`
- Extract bookings functions to `bookings/index.ts`
- Extract dashboard functions to `dashboard/index.ts`

### Phase 3: Update Imports
- Update API route handlers in `index.ts`
- Update test files
- Update dependent modules

### Phase 4: Cleanup
- Archive or remove original `state.ts`
- Verify all functionality works
- Update documentation

## Best Practices

### 1. Type Safety
- Always define explicit return types for functions
- Use type guards for runtime type checking
- Never use `any` - use `unknown` and type guards instead

### 2. Error Handling
- Use domain-specific error codes
- Include helpful error messages and details
- Log errors appropriately before throwing

### 3. Database Operations
- Always use parameterized queries
- Use Drizzle ORM where possible
- Handle null/undefined database values explicitly

### 4. Testing
- Write unit tests for each domain function
- Test error cases and edge conditions
- Use in-memory database for tests

### 5. Documentation
- Document complex business logic
- Add JSDoc comments for public APIs
- Keep README updated with changes

## Real-Time Updates

State changes trigger WebSocket events via `realtime.ts`:

```typescript
import { emitSessionUpdate, emitDashboardUpdate } from '../realtime.js';

// After updating session state
emitSessionUpdate(sessionId, sessionDetails);

// After dashboard data changes
emitDashboardUpdate(dashboardData);
```

## Database Integration

Each domain module interfaces with the SQLite database:

```typescript
import { sqlite } from '../db/client.js';

// Use prepared statements for performance
const stmt = sqlite.prepare('SELECT * FROM games WHERE id = ?');
const row = stmt.get(gameId) as GameRow | undefined;
```

## Logging

Use the centralized logging system:

```typescript
import { logToDatabase } from '../logging/index.js';

logToDatabase({
  level: 'info',
  category: 'games',
  message: 'Game created',
  metadata: { gameId, gameName }
});
```

## Next Steps

For the next agent in the workflow:
1. Review this architecture documentation
2. Select a domain to implement (suggest starting with `games/`)
3. Move functions from original `state.ts` to domain modules
4. Update exports in domain `index.ts` files
5. Update imports in API handlers
6. Run tests to verify functionality
7. Update this README if patterns change

## Questions?

Refer to:
- `/project-docs/project-overview.md` - Full system architecture
- `/CLAUDE.md` - Development guidelines
- `/packages/contracts/src/index.ts` - Type definitions
