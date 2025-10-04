import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    // Only include integration tests for now (Svelte 5 component testing needs additional setup)
    include: ['src/**/**.integration.test.{js,ts}']
  },
  resolve: {
    alias: {
      '$env/dynamic/public': '/src/__mocks__/$env-dynamic-public.ts'
    }
  }
});
