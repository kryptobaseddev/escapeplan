import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Serialize test execution to prevent database conflicts (unique constraint violations)
    // Each test file seeds the database and shares the same SQLite instance
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
