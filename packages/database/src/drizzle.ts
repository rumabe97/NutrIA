import { sql } from 'drizzle-orm';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

type SupabaseToken = { aud?: string | string[]; exp?: number; iat?: number; iss?: string; jti?: string; nbf?: number; role?: string; sub?: string };

export function createDrizzle<TSchema extends Record<string, unknown>, Token extends SupabaseToken = SupabaseToken>(
  token: Token,
  { admin, client }: { admin: PostgresJsDatabase<TSchema>; client: PostgresJsDatabase<TSchema> }
) {
  return {
    admin,
    rls: (async (transaction, ...rest) => {
      return await client.transaction(
        async tx => {
          // Supabase exposes auth.uid() and auth.jwt()
          // https://supabase.com/docs/guides/database/postgres/row-level-security#helper-functions
          try {
            await tx.execute(sql`
          -- auth.jwt()
          select set_config('request.jwt.claims', '${sql.raw(JSON.stringify(token))}', TRUE);
          -- auth.uid()
          select set_config('request.jwt.claim.sub', '${sql.raw(token.sub ?? '')}', TRUE);
          -- set local role
          set local role ${sql.raw(token.role ?? 'anon')};
          `);

            return await transaction(tx);
          } finally {
            await tx.execute(sql`
            -- reset
            select set_config('request.jwt.claims', NULL, TRUE);
            select set_config('request.jwt.claim.sub', NULL, TRUE);
            reset role;
            `);
          }
        },
        ...rest
      );
    }) as typeof client.transaction
  };
}
