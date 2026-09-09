/**
 * A logical export of every table, as newline-delimited JSON.
 *
 * Not the restore path — Neon's own point-in-time restore is, and it is one
 * click and a branch (see `docs/reference/deployment.md` §8). This is the thing
 * that survives losing the Neon project itself: an account closed, a plan
 * expired, a database dropped by hand. It is a file on a disk the platform does
 * not own.
 *
 * Written with the driver this package already uses rather than `pg_dump`,
 * which is not installed on the machine that runs it and would be one more
 * thing to keep at the right version.
 *
 * Deliberately not encrypted and not uploaded anywhere: it carries every user's
 * health data, so where it goes is a decision for whoever runs it, not a
 * default this script picks.
 */
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

config({ path: ['.env.local', '.env'], quiet: true });

const DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Set DIRECT_DATABASE_URL (or DATABASE_URL) to the database you want to export.');
  process.exit(1);
}

const OUT_ROOT = process.env.BACKUP_DIR ?? 'backups';

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL as string, { max: 1, ssl: 'require' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = join(OUT_ROOT, stamp);

  mkdirSync(directory, { recursive: true });

  try {
    const tables = (
      await sql<{ name: string }[]>`
        select table_name as name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
      `
    ).map(row => row.name);

    const counts: Record<string, number> = {};

    for (const table of tables) {
      // Identifier interpolation, not a value: the names come from the catalogue
      // above, never from an argument.
      const rows = await sql.unsafe<Record<string, unknown>[]>(`select * from "${table}"`);

      writeFileSync(join(directory, `${table}.ndjson`), rows.map(row => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : ''), 'utf8');
      counts[table] = rows.length;
    }

    const [migration] = await sql<{ hash: string }[]>`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`;

    writeFileSync(
      join(directory, 'manifest.json'),
      JSON.stringify(
        {
          // The schema is not in this folder: it is the migrations in git, and this
          // says which one the data was shaped by. A restore applies migrations up
          // to here, then loads the rows.
          counts,
          host: new URL(DATABASE_URL as string).host,
          lastMigrationHash: migration?.hash ?? null,
          takenAt: new Date().toISOString(),
          tables: tables.length
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    console.info(`[backup] ${tables.length} tables, ${total} rows → ${directory}`);
  } finally {
    await sql.end();
  }
}

// `void main()` rather than a top-level await: this package compiles to CJS, and
// tsx refuses a top-level await there.
main().catch((error: unknown) => {
  console.error(`[backup] failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
});
