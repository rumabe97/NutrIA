import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

import { required } from './src/env';

config({ path: '.env' });

export default defineConfig({
  // Must match the runtime client (src/client.ts): camelCase schema keys map to snake_case
  // SQL columns. Without this, generated migrations create camelCase columns that runtime
  // queries can never find.
  casing: 'snake_case',
  // Session-mode (direct, non-pooled) endpoint. DDL cannot run through PgBouncer
  // in transaction mode, which is what DATABASE_URL points at.
  dbCredentials: { url: required('DIRECT_DATABASE_URL') },
  dialect: 'postgresql',
  out: './src/migrations',
  // The barrel, not a glob: a glob would also match index.ts and re-register
  // every table a second time.
  schema: './src/schemas/index.ts',
  schemaFilter: ['public'],
  strict: true,
  verbose: true
});
