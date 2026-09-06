import postgres from 'postgres';

import { createClient } from 'auth/server';
import { drizzle } from 'drizzle-orm/postgres-js';

import { createDrizzle } from './drizzle';
import { required } from './env';
import { decode } from './jwt';

import { profiles } from './schemas/profiles.schema';
import { users } from './schemas/users.schema';

import type { DrizzleConfig } from 'drizzle-orm';

const schema = { profiles, users };
const config = { casing: 'snake_case', schema } satisfies DrizzleConfig<typeof schema>;

// adminDb — bypasses Supabase RLS. Safe for trusted server-side operations
// (migrations, seed scripts, admin actions). Use database() for user-scoped requests.
export const adminDb = drizzle({ client: postgres(required('ADMIN_DATABASE_URL'), { prepare: false }), ...config });

export type AdminDb = typeof adminDb;

// rlsDb — module-level singleton like adminDb. Safe to share across requests because
// the JWT context is set inside each rls() transaction (set_config with TRUE = transaction-local),
// so different users never bleed into each other's queries.
const rlsDb = drizzle({ client: postgres(required('RLS_DATABASE_URL'), { prepare: false }), ...config });

// database() — returns an auth-aware Drizzle instance for Next.js server contexts.
//   db.admin — same as adminDb, bypasses RLS
//   db.rls   — respects row-level security; use for user-scoped reads and writes
//
// Usage in a server action:
//   const db = await database();
//   const rows = await db.rls(tx => tx.select().from(users));
export async function database() {
  const { auth } = await createClient();
  const { data } = await auth.getSession();

  return createDrizzle(decode(data.session?.access_token ?? ''), { admin: adminDb, client: rlsDb });
}
