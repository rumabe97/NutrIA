import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { dirname, join, relative } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A picture reaches a person through one of two doors, and there is no third
 * (`0072`, PRD 009 criterion 8): `judgePicture` accepted it inside a drawing,
 * or the owner accepted it by hand from the console. Each door is one call,
 * in one file, and the owner's is reached from one route. Mechanical, like
 * the health-data boundary: this fails the moment a cron, a retry or any other
 * code starts publishing a picture — not the day somebody sees one.
 */
describe('the two doors a dish picture reaches a person through', () => {
  const sources = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map(entry => join(entry.parentPath, entry.name));

  /** The sources that contain `text`, as paths under `src`. */
  function naming(text: RegExp | string): readonly string[] {
    return sources
      .filter(path => {
        const source = readFileSync(path, 'utf8');

        return typeof text === 'string' ? source.includes(text) : text.test(source);
      })
      .map(path => relative(SRC, path).replaceAll('\\', '/'))
      .sort();
  }

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('makes a judged picture ready in the drawing service and nowhere else', () => {
    expect(naming('RecipeController.completePicture(')).toEqual(['modules/ai/services/DishPicture.service.ts']);
  });

  it('makes a hand-accepted picture ready in the candidates’ service and nowhere else', () => {
    expect(naming('RecipeController.acceptCandidate(')).toEqual(['modules/ai/services/PictureCandidates.service.ts']);
  });

  it('reaches the owner’s acceptance from the console’s catalogue service alone — no cron, no retry, no drawing', () => {
    expect(naming(/candidates\.accept\(/)).toEqual(['modules/admin/services/AdminCatalogue.service.ts']);
    expect(naming(/catalogue\.acceptCandidate\(/)).toEqual(['modules/admin/controllers/AdminCatalogue.controller.ts']);
  });

  it('writes to the public store from those two services alone', () => {
    expect(naming(/\b(?:store|published)\.put\(/)).toEqual([
      'modules/ai/services/DishPicture.service.ts',
      'modules/ai/services/PictureCandidates.service.ts'
    ]);
  });

  it('never names the pictures’ table: no insert, update or delete of `recipe_images` outside core’s repository', () => {
    expect(naming(/recipeImages|recipe_images/)).toEqual([]);
  });

  it('never asks the repositories for a picture directly: every write goes through core’s controller', () => {
    expect(naming('RecipeRepository')).toEqual([]);
  });
});
