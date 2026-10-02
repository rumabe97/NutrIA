/**
 * The local Postgres `pnpm db:local` runs (`scripts/local-pg.mjs`). Hard-coded on
 * purpose: the switch below may only ever point at this machine's loopback, so no
 * variable can widen it. `scripts/local-pg.mjs` and the probe's `guard.mjs` carry the
 * same string — change all three together.
 */
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54329/nutria_local';

/** What `NUTRIA_LOCAL_PG=1` replaces: both connection strings, nothing else. */
const LOCAL_SWITCHED = new Set(['DATABASE_URL', 'DIRECT_DATABASE_URL']);

/**
 * `NUTRIA_LOCAL_PG=1`: every connection this package opens goes to the local
 * Postgres, whatever a `.env` or the shell says.
 *
 * Only `1` turns it on, and any other value throws: a `true` read as "off" would send
 * a run someone meant to keep local to the Neon URL in their `.env`.
 */
export function isLocalPg(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.NUTRIA_LOCAL_PG;

  if (value === undefined || value === '' || value === '0') {
    return false;
  }

  if (value !== '1') {
    throw new Error(`NUTRIA_LOCAL_PG must be 1 or unset, not "${value}".`);
  }

  return true;
}

/**
 * Reads a required env var. Throws with a clear message at module-load time if it's
 * missing — much friendlier than the cryptic `ENOTFOUND` / `invalid URL` you'd get
 * from the Postgres client on first query.
 *
 * Under `NUTRIA_LOCAL_PG=1` the two connection strings are the local one, and that
 * beats an exported value too: dotenv, `--env-file` and Nest's `ConfigModule` all
 * leave a variable already in the environment alone, so a Neon URL left exported in a
 * shell would otherwise win.
 *
 * Imported by `client.ts` and `drizzle.config.ts`. Add new required env reads here
 * (and update `.env.example` at the repo root) when the schema gains new connection
 * strings or credentials.
 */
export function required(name: string): string {
  if (LOCAL_SWITCHED.has(name) && isLocalPg()) {
    return LOCAL_DATABASE_URL;
  }

  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}. Set it in your .env file.`);
  }

  return value;
}
