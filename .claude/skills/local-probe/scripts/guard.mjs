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

export function assertNotProduction({ strict = false } = {}) {
  const local = hostOf(readEnv(`${ROOT}apps/api/.env`, 'DATABASE_URL'));
  const production = hostOf(readEnv(`${ROOT}packages/database/.env`, 'DATABASE_URL_PRO'));

  if (!local) {
    throw new Error('apps/api/.env has no readable DATABASE_URL');
  }

  if (readEnv(`${ROOT}apps/api/.env`, 'NODE_ENV') === 'production') {
    throw new Error('apps/api/.env says NODE_ENV=production');
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
