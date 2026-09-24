import { closeDatabase, database } from 'database';

/**
 * Parameterised reads on the tables themselves, through the pool Drizzle
 * wraps (`$client`, the process's one pool) — the same pattern
 * `care.e2e-spec.ts` and `billing.e2e-spec.ts` use to prove a row is gone
 * rather than merely unlisted.
 */
type Tables = <Row>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<Row[]>;

function tables(): Tables {
  return (database() as unknown as { readonly $client: Tables }).$client;
}

/**
 * The backstop for every suite's own cleanup: runs once, after every suite in
 * the run has finished, outside any suite's module registry — which is what
 * lets it see an account *any* suite left, not only its own.
 *
 * A suite deletes what it creates in its own `afterAll`. This exists for the
 * one that failed before reaching it (an exception inside `beforeAll` skips
 * `afterAll` for nothing that ran), or a suite added later that forgets to.
 *
 * Every account these suites make is registered under a `.invalid` address —
 * `e2e.invalid`, `example.invalid` (RFC 2606, reserved so it can never resolve
 * to a real mailbox) — which is what makes the pattern safe: it names every
 * account a suite could have made without naming the seed, which never writes
 * to `user` at all, only to the ingredient and allergen catalogue.
 *
 * `jest-e2e.json` → `globalTeardown` runs this file once, in its own process,
 * after `setup-e2e.ts`'s per-file `afterAll` has already closed every suite's
 * own pool.
 */
export default async function globalTeardown(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  let left: readonly { readonly email: string }[];

  try {
    left = await tables()<{ email: string }>`select email from "user" where email like ${'%.invalid'} order by email`;
  } finally {
    await closeDatabase();
  }

  if (left.length > 0) {
    const shown = left.slice(0, 20).map(row => row.email);
    const rest = left.length > shown.length ? `, and ${left.length - shown.length} more` : '';

    throw new Error(`e2e run left ${left.length} account(s) behind: ${shown.join(', ')}${rest}`);
  }
}
