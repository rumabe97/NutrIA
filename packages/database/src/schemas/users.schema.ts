import { sql } from 'drizzle-orm';

import { authenticatedRole, authUid } from 'drizzle-orm/supabase';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Column keys use camelCase — Drizzle maps them to snake_case in SQL automatically
// because the client is configured with { casing: 'snake_case' }.
// Query results come back as camelCase, matching the Zod userSchema directly.
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    email: text().notNull().unique(),
    name: text().notNull()
  },
  table => [
    pgPolicy('Users can read their own record', { for: 'select', to: authenticatedRole, using: sql`${authUid} = ${table.id}` }),
    pgPolicy('Users can update their own record', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.id}`,
      withCheck: sql`${authUid} = ${table.id}`
    })
  ]
);
