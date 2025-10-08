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
    },
    env: {
      BASE_URL: 'http://localhost:4000',
      AUTH_BASE_URL: 'http://localhost:4000/api/auth',
      WEB_APP_ORIGIN: 'http://localhost:5173',
      BETTER_AUTH_SECRET: 'test-secret-key-min-32-chars-abcdef123456789'
    }
  }
});
