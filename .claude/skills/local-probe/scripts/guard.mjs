// Refuses to go on when the local API would talk to production.
//
// The probe signs accounts up and deletes them, so the one mistake that matters is a
// `.env` pointing at the production database. The check compares hosts and prints
// neither: a connection string in a terminal is a connection string in a transcript.
//
// Usage: node guard.mjs            exits 0 when it is safe, 1 with a reason when not
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** One variable out of a dotenv file, unquoted. Never logged. */
export function readEnv(file, key) {
  if (!existsSync(file)) return undefined;

  const match = readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));

  return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * What `NUTRIA_LOCAL_PG=1` connects to: the Postgres `pnpm db:local` runs. The same
 * constant as `LOCAL_DATABASE_URL` in packages/database/src/env.ts and
 * scripts/local-pg.mjs — this file cannot import a TypeScript package.
 */
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54329/nutria_local';

/** Only `1` is on; any other value is refused rather than read as off. */
export function isLocalPg() {
  const value = process.env.NUTRIA_LOCAL_PG;

  if (value === undefined || value === '' || value === '0') return false;
  if (value !== '1') throw new Error(`NUTRIA_LOCAL_PG must be 1 or unset, not "${value}"`);

  return true;
}

export function assertNotProduction({ strict = false } = {}) {
  const switched = isLocalPg();
  // Under the switch every client connects to the constant, so that is what is checked —
  // and apps/api/.env need not exist at all.
  const local = switched ? hostOf(LOCAL_DATABASE_URL) : hostOf(readEnv(`${ROOT}apps/api/.env`, 'DATABASE_URL'));
  const production = hostOf(readEnv(`${ROOT}packages/database/.env`, 'DATABASE_URL_PRO'));

  if (!local) {
    throw new Error('apps/api/.env has no readable DATABASE_URL');
  }

  if (readEnv(`${ROOT}apps/api/.env`, 'NODE_ENV') === 'production') {
    throw new Error('apps/api/.env says NODE_ENV=production');
  }

  if (switched) {
    if (local !== '127.0.0.1' || (production && local === production)) {
      throw new Error('NUTRIA_LOCAL_PG=1 but the local URL is not loopback — refusing');
    }

    // Loopback on this machine is never production, so a write needs no comparison.
    return 'database: local Postgres on 127.0.0.1:54329 (NUTRIA_LOCAL_PG=1)';
  }

  // Pooled and direct endpoints of one branch differ only by a "-pooler" suffix.
  const same = (a, b) => a.replace('-pooler', '') === b.replace('-pooler', '');

  if (production && same(local, production)) {
    throw new Error('apps/api/.env points at the PRODUCTION database — refusing');
  }

  // A command that writes grants, links or switches may not run on a guess.
  if (strict && !production) {
    throw new Error('no DATABASE_URL_PRO in packages/database/.env to compare with — refusing to write without proving this is not production');
  }

  return production ? 'database: not production (hosts compared, neither printed)' : 'database: no DATABASE_URL_PRO to compare with — make sure this is not production';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(`[probe] ${assertNotProduction()}`);
  } catch (error) {
    console.error(`[probe] ${error.message}`);
    process.exit(1);
  }
}
