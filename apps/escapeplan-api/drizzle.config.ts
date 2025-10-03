import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from '@escapeplan/contracts/paths';

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath()
  }
});
