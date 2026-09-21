// The NAMES of the variables in a dotenv file, and never a value.
//
// Usage: node .claude/hooks/env-names.mjs apps/api/.env
//
// Printing a real `.env` is refused (`.claude/hookify.no-env-contents.local.md`): its
// contents would land in a transcript. Which variables are set is often all that is asked.
import { readFileSync } from 'node:fs';

const file = process.argv[2];

if (!file) {
  console.error('usage: node .claude/hooks/env-names.mjs <dotenv file>');
  process.exit(2);
}

for (const line of readFileSync(file, 'utf8').split('\n')) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

  if (match) console.log(`${match[1]}${match[2].trim() === '' ? '   (empty)' : ''}`);
}
