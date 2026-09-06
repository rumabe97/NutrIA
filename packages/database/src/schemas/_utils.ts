import { sql } from 'drizzle-orm';

import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase';
import { pgPolicy, pgTable, uuid } from 'drizzle-orm/pg-core';

import type { PgColumnBuilderBase } from 'drizzle-orm/pg-core';

export type Column = { [K in string]: PgColumnBuilderBase };

export function pgPrivateCrud<T extends Column>(tableName: string, key: string, columns: T) {
  return pgTable(
    tableName,
    {
      id: uuid().primaryKey().defaultRandom(),
      userId: uuid()
        .references(() => authUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' })
        .notNull(),
      ...columns
    },
    table => [
      pgPolicy(`Users can create their own ${key}`, { for: 'insert', to: authenticatedRole, withCheck: sql`${table.userId} = ${authUid}` }),
      pgPolicy(`Users can read their own ${key}`, { for: 'select', to: authenticatedRole, using: sql`${table.userId} = ${authUid}` }),
      pgPolicy(`Users can update their own ${key}`, {
        for: 'update',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
        withCheck: sql`${table.userId} = ${authUid}`
      }),
      pgPolicy(`Users can delete their own ${key}`, { for: 'delete', to: authenticatedRole, using: sql`${table.userId} = ${authUid}` })
    ]
  );
}
