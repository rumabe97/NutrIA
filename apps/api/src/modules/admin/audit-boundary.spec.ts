import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * `UNAUDITED` (`0071`) stands where an audit argument is otherwise required,
 * for a suite or a probe that moves a row to set a scenario up rather than to
 * exercise the console. A route in `apps/api/src` always has a session or a
 * signed link, so it always has a real audit to give — reaching for the
 * sentinel here would be a route that quietly stopped leaving its trail.
 * Mechanical, like the health-data boundary: this fails the moment the
 * import appears, not the moment an admin action goes unrecorded.
 */
describe('the UNAUDITED boundary around apps/api/src', () => {
  const sources = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map(entry => join(entry.parentPath, entry.name));

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('names UNAUDITED nowhere under apps/api/src', () => {
    const offenders = sources.filter(path => readFileSync(path, 'utf8').includes('UNAUDITED'));

    expect(offenders).toEqual([]);
  });
});
