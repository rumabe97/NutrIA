// Writes the effort variants of the team's agents from their base definitions.
//
// Usage: node .claude/skills/team/scripts/effort-variants.mjs [--check]
//
// The Agent tool takes a model per spawn but no effort; effort can only come from a
// definition's frontmatter. So each agent the lead prices by effort has its base file
// (`backend.md`, effort medium) and one file per other level (`backend-low.md`,
// `backend-high.md`) that differ only in name, effort and description. They are generated,
// never edited: edit the base and run this. `--check` refuses a variant that has drifted.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'agents');
const VARIANTS = {
  accessibility: ['low', 'high'],
  backend: ['low', 'high'],
  frontend: ['low', 'high'],
  seo: ['low', 'high'],
  tests: ['low', 'high']
};
const LEVEL = /-(low|medium|high|xhigh|max)\.md$/;

function variant(agent, level) {
  const base = readFileSync(join(DIR, `${agent}.md`), 'utf8');
  const [, front, ...body] = base.split(/^---$/m);

  if (!/^effort: /m.test(front)) {
    throw new Error(`${agent}.md has no effort line: the variants replace it`);
  }

  const rewritten = front
    .replace(/^name: .*$/m, `name: ${agent}-${level}`)
    .replace(/^effort: .*$/m, `effort: ${level}`)
    .replace(
      /^description: .*$/m,
      `description: The ${agent} agent at ${level} effort — same role, prompt and file ownership. Spawned only by the /team lead when it prices a task at ${level}; never pick it directly.`
    );

  return `---\n# Generated from ${agent}.md by .claude/skills/team/scripts/effort-variants.mjs — edit the base, then run it.${rewritten}---${body.join('---')}`;
}

const check = process.argv.includes('--check');
const problems = [];
const expected = new Set();

for (const [agent, levels] of Object.entries(VARIANTS)) {
  for (const level of levels) {
    const file = `${agent}-${level}.md`;
    const text = variant(agent, level);

    expected.add(file);

    if (!check) {
      writeFileSync(join(DIR, file), text);
    } else if (!existsSync(join(DIR, file)) || readFileSync(join(DIR, file), 'utf8') !== text) {
      problems.push(`${file} does not match ${agent}.md`);
    }
  }
}

for (const file of readdirSync(DIR)) {
  if (LEVEL.test(file) && !expected.has(file)) problems.push(`${file} is a variant nobody generates`);
}

if (problems.length > 0) {
  console.error(`[effort-variants] ${problems.join('; ')} — run: node .claude/skills/team/scripts/effort-variants.mjs`);
  process.exit(1);
}

console.log(`[effort-variants] ${expected.size} variants ${check ? 'match their bases' : 'written'}`);
