// What a machine can say about a migration before it reaches production.
//
// Usage: node scripts/check-migrations.mjs [--drift]
//   BASE   the ref the change is measured against (default origin/main; on main itself, HEAD^)
//   --drift  also run `drizzle-kit generate` and refuse a schema that changed with no migration
//
// A migration here runs against production during the API's build, with no staging database
// before it (apps/api `vercel-build`). The end-to-end job proves the SQL runs on an empty
// schema; this refuses what no test can take back:
//   1. a migration that is already merged, edited or deleted — production has run the old one;
//   2. a statement that can destroy data or fail on the rows already there, without a line
//      saying a person looked: `-- reviewed-destructive: <where the data goes, and why it is safe>`;
//   3. a journal that does not describe the files beside it — drizzle-kit applies the journal;
//   4. with --drift, a schema changed and no migration written for it.
// What it cannot judge — whether the old API survives the new schema, locks, the way back —
// is the `migration-reviewer` agent's (.claude/agents/migration-reviewer.md).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'packages/database/src/migrations';
const MARKER = /^\s*--\s*reviewed-destructive:\s*(.{20,})$/im;
const DESTRUCTIVE = [
  [/\bDROP\s+TABLE\b/i, 'drops a table'],
  [/\bDROP\s+COLUMN\b/i, 'drops a column'],
  [/\bTRUNCATE\b/i, 'truncates a table'],
  [/\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i, 'changes a column type, which rewrites or refuses the rows already there'],
  [/\bRENAME\s+(COLUMN|TO)\b/i, 'renames something the API still running reads by its old name'],
  [/\bALTER\s+COLUMN\s+"?\w+"?\s+SET\s+NOT\s+NULL\b/i, 'adds NOT NULL to a column that may hold nulls'],
  [/\bADD\s+COLUMN\s+(?:(?!DEFAULT|;|-->)[\s\S])*?\bNOT\s+NULL\b(?:(?!DEFAULT|;|-->)[\s\S])*?(;|-->|$)/i, 'adds a NOT NULL column with no DEFAULT, which fails on a table with rows'],
  [/\bDELETE\s+FROM\s+"?\w+"?\s*(;|-->|$)/i, 'deletes every row of a table']
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const problems = [];

let base = process.env.BASE || 'origin/main';

try {
  if (git('rev-parse', base) === git('rev-parse', 'HEAD')) base = 'HEAD^';
} catch {
  console.error(`[migrations] cannot resolve ${base} — fetch it first (CI: fetch-depth: 0)`);
  process.exit(2);
}

// 1. merged migrations are immutable
const changed = git('diff', '--name-status', `${base}...HEAD`, '--', DIR)
  .split('\n')
  .filter(Boolean)
  .map(line => line.split('\t'));
const added = [];

for (const [status, ...paths] of changed) {
  const path = paths.at(-1);

  if (!path.endsWith('.sql')) continue;

  if (status === 'A') added.push(path);
  else problems.push(`${path}: a merged migration was ${status === 'D' ? 'deleted' : 'edited'}. Production has already run it as it was — write a new migration instead.`);
}

// 2. destructive statements need a person's line
for (const path of added) {
  const sql = readFileSync(path, 'utf8');
  const statements = sql.replace(/^\s*--(?!>).*$/gm, '');
  const found = DESTRUCTIVE.filter(([pattern]) => pattern.test(statements)).map(([, why]) => why);

  if (found.length > 0 && !MARKER.test(sql)) {
    problems.push(
      `${path}: ${found.join('; ')}.\n    Add a line saying a person looked, and where the data goes:\n    -- reviewed-destructive: <at least a sentence>\n    and have the migration-reviewer agent read it.`
    );
  }
}

// 3. the journal describes the files
const journal = JSON.parse(readFileSync(join(DIR, 'meta', '_journal.json'), 'utf8'));
const tags = new Set(journal.entries.map(entry => entry.tag));
const files = readdirSync(DIR).filter(name => name.endsWith('.sql')).map(name => name.slice(0, -4));

for (const file of files) if (!tags.has(file)) problems.push(`${DIR}/${file}.sql is not in the journal: drizzle-kit will never apply it.`);
for (const tag of tags) if (!files.includes(tag)) problems.push(`the journal names ${tag}, and there is no such file.`);

const newest = journal.entries.at(-1);
const snapshot = join(DIR, 'meta', `${String(newest.idx).padStart(4, '0')}_snapshot.json`);

if (!existsSync(snapshot)) {
  problems.push(`${snapshot} is missing: the newest migration was written by hand, and the next \`generate\` will diff against an older schema (packages/database/AGENTS.md § Migrations).`);
}

// 4. a schema that changed without a migration
if (process.argv.includes('--drift')) {
  const before = git('status', '--porcelain', '--', DIR);

  try {
    execFileSync('pnpm', ['--filter', 'database', 'generate'], {
      encoding: 'utf8',
      env: { ...process.env, DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || 'postgresql://localhost:5432/none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000
    });
  } catch (error) {
    problems.push(`\`drizzle-kit generate\` did not finish — if it asked whether a column is a rename, the snapshots have drifted (packages/database/AGENTS.md § Migrations):\n    ${String(error.stderr || error.message).split('\n')[0]}`);
  }

  const after = git('status', '--porcelain', '--', DIR);

  if (after !== before) {
    problems.push(`the schemas changed and no migration says so. \`generate\` wrote:\n    ${after.split('\n').filter(line => !before.includes(line)).join('\n    ')}\n    Run \`pnpm --filter database generate\` and commit what it writes.`);
  }
}

if (problems.length > 0) {
  console.error(`[migrations] ${problems.length} problem(s) against ${base}:\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(`[migrations] ${added.length} new, ${files.length} in all, journal and snapshot in order${process.argv.includes('--drift') ? ', schema and migrations agree' : ''}`);
