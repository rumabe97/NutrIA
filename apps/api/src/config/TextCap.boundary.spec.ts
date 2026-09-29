import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The text cap (`0071`, D1) holds back the nightly step rewrite and nothing
 * else: a plan is never refused and a swap is never slowed by a budget. Made
 * mechanical: the names that read the month's spend or the cap appear only
 * where they are meant to, so a new caller in plan generation or swaps fails here.
 */
describe('where the text cap is read', () => {
  const sources = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map(entry => relative(SRC, join(entry.parentPath, entry.name)));

  const using = (needle: RegExp): string[] => sources.filter(path => needle.test(readFileSync(join(SRC, path), 'utf8'))).sort();

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it('reads the spend and the stop share only in the rewrite sweep', () => {
    expect(using(/\b(?:TextSpend|TEXT_SWEEP_STOP_SHARE|textCapOf)\b/)).toEqual(['modules/ai/services/RecipeRewriter.service.ts']);
  });

  it('shows the month on the console only through the admin controllers', () => {
    expect(using(/\bAdminTextSpend\b/)).toEqual([]);
  });

  it('reads AI_TEXT_MONTHLY_CAP_USD only in the sweep, the console and the environment', () => {
    expect(using(/AI_TEXT_MONTHLY_CAP_USD/)).toEqual([
      'config/Env.validation.ts',
      'modules/admin/services/Admin.service.ts',
      'modules/ai/services/RecipeRewriter.service.ts'
    ]);
  });
});
