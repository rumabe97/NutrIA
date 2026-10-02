#!/usr/bin/env node
// The local Postgres every test, evaluator run and dev-database script uses, so none of
// them spends Neon's allowance (shared with production). Postgres 18, like Neon, from the
// pinned `embedded-postgres` binaries: no Docker, no sudo.
//
//   pnpm db:local start    initialise the cluster if needed, start it, create the database
//   pnpm db:local stop
//   pnpm db:local status
//   pnpm db:local reset    drop and recreate the database, migrate, seed, load the seed
//                          library (docs/local/nutria-seed-500.sql) if present, re-run 0056
//
// Then run anything with NUTRIA_LOCAL_PG=1: the database package, the API and the probe's
// guard all connect to LOCAL_DATABASE_URL instead of what a `.env` says.
//
// The server is started with pg_ctl, detached, so it outlives this command. The data lives
// outside the repository, in NUTRIA_PG_DIR (default ~/.local/share/nutria-pg), and is never
// deleted by any subcommand: `reset` drops the database, not the cluster.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The one URL NUTRIA_LOCAL_PG=1 connects to. The same constant as `LOCAL_DATABASE_URL`
 * in packages/database/src/env.ts and in .claude/skills/local-probe/scripts/guard.mjs.
 */
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54329/nutria_local';

const { hostname: HOST, password: PASSWORD, pathname, port, username: USER } = new URL(LOCAL_DATABASE_URL);
const PORT = Number(port);
const DATABASE = pathname.slice(1);

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOME = process.env.NUTRIA_PG_DIR ?? join(homedir(), '.local/share/nutria-pg');
const DATA = join(HOME, 'data');
const LOG = join(HOME, 'postgres.log');

/** Migration 0056 is data only and was written before the seed library is loaded; re-run after it. */
const SPLIT_MIGRATION = 'packages/database/src/migrations/0056_a_lunch_is_one_plate.sql';
const SEED_LIBRARY = 'docs/local/nutria-seed-500.sql';

/** `embedded-postgres` and the binaries of this platform's package, resolved through it. */
async function engine() {
  const require = createRequire(import.meta.url);
  const main = require.resolve('embedded-postgres');
  const platform = createRequire(main).resolve(`@embedded-postgres/${process.platform}-${process.arch}`);
  const { default: EmbeddedPostgres } = await import(pathToFileURL(main).href);
  const native = resolve(dirname(platform), '..', 'native');
  const { Client } = createRequire(main)('pg');

  return { Client, EmbeddedPostgres, native, pgCtl: join(native, 'bin', 'pg_ctl') };
}

/**
 * The ICU libraries the server loads by their major version (`libicuuc.so.60`) ship as
 * `.so.60.2`, and the links between them are made by the package's postinstall, which a
 * checkout installed before `allowBuilds` listed it never ran. Same manifest, same links.
 */
function linkLibraries(native) {
  const manifest = join(native, 'pg-symlinks.json');

  if (!existsSync(manifest)) return;

  for (const { source, target } of JSON.parse(readFileSync(manifest, 'utf8'))) {
    const at = join(native, '..', target);

    try {
      symlinkSync(relative(dirname(at), join(native, '..', source)), at);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

function pgCtl(bin, args, { quiet = false } = {}) {
  return spawnSync(bin, args, { encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
}

function running(bin) {
  return existsSync(join(DATA, 'PG_VERSION')) && pgCtl(bin, ['status', '-D', DATA], { quiet: true }).status === 0;
}

async function query(Client, database, sql) {
  const client = new Client({ database, host: HOST, password: PASSWORD, port: PORT, user: USER });

  await client.connect();

  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function createDatabase(Client) {
  const { rowCount } = await query(Client, 'postgres', `select 1 from pg_database where datname = '${DATABASE}'`);

  if (!rowCount) {
    await query(Client, 'postgres', `create database "${DATABASE}"`);
    console.log(`[db:local] created database ${DATABASE}`);
  }
}

async function start() {
  const { Client, EmbeddedPostgres, native, pgCtl: bin } = await engine();

  linkLibraries(native);

  if (!existsSync(join(DATA, 'PG_VERSION'))) {
    mkdirSync(HOME, { recursive: true });
    console.log(`[db:local] initialising a cluster in ${DATA}`);
    await new EmbeddedPostgres({ databaseDir: DATA, password: PASSWORD, persistent: true, port: PORT, user: USER }).initialise();
  }

  if (running(bin)) {
    console.log('[db:local] already running');
  } else {
    const started = pgCtl(bin, ['start', '-w', '-D', DATA, '-l', LOG, '-o', `-p ${PORT} -c listen_addresses=${HOST}`], { quiet: true });

    if (started.status !== 0) {
      console.error(`[db:local] pg_ctl could not start the server — see ${LOG}\n${started.stderr}`);
      process.exit(1);
    }

    console.log(`[db:local] postgres up on ${HOST}:${PORT} (log: ${LOG})`);
  }

  await createDatabase(Client);

  return Client;
}

async function stop() {
  const { pgCtl: bin } = await engine();

  if (!running(bin)) {
    console.log('[db:local] not running');

    return;
  }

  pgCtl(bin, ['stop', '-D', DATA, '-m', 'fast'], { quiet: true });
  console.log('[db:local] stopped');
}

async function status() {
  const { Client, pgCtl: bin } = await engine();

  if (!running(bin)) {
    console.log(`[db:local] not running (data: ${DATA}) — pnpm db:local start`);
    process.exitCode = 1;

    return;
  }

  console.log(`[db:local] running on ${HOST}:${PORT}, data in ${DATA}`);

  const { rowCount } = await query(Client, 'postgres', `select 1 from pg_database where datname = '${DATABASE}'`);

  if (!rowCount) {
    console.log(`[db:local] no database ${DATABASE} — pnpm db:local reset`);
    process.exitCode = 1;

    return;
  }

  const count = async (sql) => {
    try {
      return (await query(Client, DATABASE, sql)).rows[0].n;
    } catch {
      return 'none';
    }
  };

  const [version, migrations, ingredients, recipes] = await Promise.all([
    count(`select current_setting('server_version') as n`),
    count('select count(*)::int as n from drizzle.__drizzle_migrations'),
    count('select count(*)::int as n from ingredients'),
    count('select count(*)::int as n from recipes')
  ]);

  console.log(`[db:local] ${DATABASE}: postgres ${version}, ${migrations} migrations, ${ingredients} ingredients, ${recipes} recipes`);
}

/** The main checkout: `docs/local/` is gitignored, so a worktree has no copy of its own. */
function mainCheckout() {
  const list = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });

  return list.stdout?.match(/^worktree (.+)$/m)?.[1];
}

function pnpm(args) {
  const run = spawnSync('pnpm', args, { cwd: ROOT, env: { ...process.env, NUTRIA_LOCAL_PG: '1' }, stdio: 'inherit' });

  if (run.status !== 0) {
    console.error(`[db:local] pnpm ${args.join(' ')} failed`);
    process.exit(1);
  }
}

async function reset() {
  const Client = await start();

  // `with (force)` ends whatever still holds a connection: an API left running, a stuck test.
  await query(Client, 'postgres', `drop database if exists "${DATABASE}" with (force)`);
  await createDatabase(Client);

  pnpm(['--filter', 'database', 'migrate']);
  pnpm(['--filter', 'database', 'seed']);

  const library = [ROOT, mainCheckout()].filter(Boolean).map(at => join(at, SEED_LIBRARY)).find(existsSync);

  if (library) {
    await query(Client, DATABASE, readFileSync(library, 'utf8'));
    console.log(`[db:local] loaded ${library}`);
    await query(Client, DATABASE, readFileSync(join(ROOT, SPLIT_MIGRATION), 'utf8'));
    console.log('[db:local] re-ran 0056 over the library');
  } else {
    console.log(`[db:local] no ${SEED_LIBRARY} here or in the main checkout — the library is empty`);
  }

  await status();
}

const commands = { reset, start, status, stop };
const command = commands[process.argv[2]];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!command) {
    console.error('usage: pnpm db:local start | stop | status | reset');
    process.exit(2);
  }

  await command();
}
