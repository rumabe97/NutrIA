import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

import { required } from './src/env';

config({ path: '.env' });

export default defineConfig({
  // Must match the runtime client (src/client.ts): camelCase schema keys map to snake_case
  // SQL columns. Without this, generated migrations create camelCase columns that runtime
  // queries can never find.
  casing: 'snake_case',
  dbCredentials: { url: required('ADMIN_DATABASE_URL') },
  dialect: 'postgresql',
  out: './src/migrations',
  schema: './src/schemas/*',
  schemaFilter: ['public'],
  strict: true,
  verbose: true
});
