import { sql } from 'drizzle-orm';

import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Column keys use camelCase — Drizzle maps them to snake_case in SQL automatically
// because the client is configured with { casing: 'snake_case' }.
// Query results come back as camelCase, matching the Zod profileSchema directly.
export const profiles = pgTable(
  'profiles',
  {
    id: uuid().primaryKey().defaultRandom(),
    avatarUrl: text(),
    bio: text(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    userId: uuid()
      .references(() => authUsers.id, { onDelete: 'cascade' })
      .notNull(),
    username: text().notNull().unique()
  },
  table => [
    pgPolicy('Users can read their own profile', { for: 'select', to: authenticatedRole, using: sql`${authUid} = ${table.userId}` }),
    pgPolicy('Users can create their own profile', { for: 'insert', to: authenticatedRole, withCheck: sql`${authUid} = ${table.userId}` }),
    pgPolicy('Users can update their own profile', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${authUid} = ${table.userId}`,
      withCheck: sql`${authUid} = ${table.userId}`
    }),
    pgPolicy('Users can delete their own profile', { for: 'delete', to: authenticatedRole, using: sql`${authUid} = ${table.userId}` })
  ]
);
