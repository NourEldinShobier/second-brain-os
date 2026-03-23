import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
