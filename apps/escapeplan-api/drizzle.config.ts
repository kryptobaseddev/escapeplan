import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/escapeplan.db'
  }
});
