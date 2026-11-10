import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../../..');

/** Every non-test source file under `dir`, recursively. */
function sourcesUnder(dir: string): readonly string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(spec|test)\.tsx?$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name));
}

function offendersOf(sources: readonly string[], test: (text: string) => boolean): readonly string[] {
  return sources.filter(path => test(readFileSync(path, 'utf8'))).map(path => path.slice(ROOT.length + 1));
}

/**
 * The assistant reads what the plan generator reads and nothing more (`0104`
 * clause 3, project 023 PRD 2). The model behind it is reached from the AI
 * module, which `ai/health-boundary.spec.ts` already walls off; this is the same
 * wall around the module that **assembles** what the model is told, because that
 * is where a health field would be added the day somebody wants one.
 */
describe('the assistant module’s wall', () => {
  const sources = sourcesUnder(HERE);

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each([
    'core/controllers/Admin',
    'core/controllers/Health',
    'core/entities/Health',
    '#repositories/Health',
    'core/controllers/Care',
    'core/entities/Care',
    '#repositories/Care',
    'core/controllers/Professional',
    'core/entities/Professional',
    '#repositories/Professional',
    'core/controllers/Pantry',
    'core/entities/Pantry',
    '#repositories/Pantry',
    'Pantry.controller',
    'Pantry.service'
  ])('imports nothing from %s', specifier => {
    expect(offendersOf(sources, text => text.includes(specifier))).toEqual([]);
  });

  it.each(['admin', 'care', 'health-data', 'owner-alerts'])('imports nothing from the %s module', module => {
    const into = new RegExp(`(?:from\\s+|import\\(\\s*)['"][./]*(?:modules/)?${module}/`);

    expect(offendersOf(sources, text => into.test(text))).toEqual([]);
  });
});

/**
 * Nobody reads a conversation but the person who had it (project 023 PRD 8,
 * phase 4 step 4). The console sees the assistant's **spend** — calls and
 * dollars, from `analytics_events`, which names nobody — and has no path to what
 * was said: no screen, route, export or query under the console reaches the
 * conversation tables or the code that reads them.
 */
describe('the console’s distance from a conversation', () => {
  const sources = [
    ...sourcesUnder(join(ROOT, 'apps/api/src/modules/admin')),
    ...sourcesUnder(join(ROOT, 'packages/core/src/controllers/Admin')),
    ...sourcesUnder(join(ROOT, 'packages/core/src/repositories/Admin')),
    ...sourcesUnder(join(ROOT, 'apps/web/src/app/(admin)'))
  ];

  it('has sources to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each([
    'aiConversations',
    'aiMessages',
    'ai_conversations',
    'ai_messages',
    'AssistantController',
    'AssistantRepository',
    'controllers/Assistant',
    'repositories/Assistant',
    '/assistant/'
  ])('never mentions %s', needle => {
    expect(offendersOf(sources, text => text.includes(needle))).toEqual([]);
  });
});
