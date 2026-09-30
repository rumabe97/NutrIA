import { describe, expect, it } from 'vitest';

import {
  jsonbSafe,
  keepingDrawings,
  PICTURE_DRAWING_VERSION,
  PICTURE_DRAWINGS_KEPT,
  PICTURE_JUDGEMENT_BYTES,
  PICTURE_RECIPE_BYTES,
  pictureDrawingsOf,
  pictureEvidenceOf,
  pictureJudgedDrawing,
  pictureJudgement
} from './PictureJudgement';

import type { JudgedAnswers, PictureJudgedDrawing, PictureJudgement } from './PictureJudgement';

const AT = new Date('2026-09-30T10:00:00Z');
const RICE = { ingredients: [{ grams: 200, name: 'Cooked white rice', slug: 'arroz-blanco-cocido' }], name: 'Arroz blanco' };

/** What the two calls and the rule answered on a picture of rice with prawns beside it. */
const ANSWERS: JudgedAnswers = {
  match: { extras: ['shrimp'], ingredients: [{ matched: ['white rice'], slug: 'arroz-blanco-cocido', status: 'seen' }] },
  seen: {
    extraDishes: 0,
    foods: [
      { amount: 'main', name: 'white rice', specific: true },
      { amount: 'side', name: 'shrimp', specific: true }
    ],
    nonFood: ['fork'],
    plasticOrCgi: false,
    realism: 8,
    sharpness: 9
  },
  verdict: { accepted: false, notes: ['extra_allergen:shrimp=crustaceans', 'extra_food:shrimp'] }
};

function judged(number: number, at: Date = AT, answers: JudgedAnswers = ANSWERS): PictureJudgement {
  const judgement = pictureJudgement({ ...answers, at, number });

  if (judgement === null) {
    throw new Error('expected a judgement');
  }

  return judgement;
}

function drawing(at: string): PictureJudgedDrawing {
  const found = pictureJudgedDrawing(RICE, [judged(1, new Date(at))]);

  if (found === null) {
    throw new Error('expected a drawing');
  }

  return found;
}

describe('pictureJudgement', () => {
  it('keeps both answers and the verdict as they came, marked with the attempt and when it was judged', () => {
    expect(judged(2)).toEqual({
      at: '2026-09-30T10:00:00.000Z',
      attempt: 2,
      match: ANSWERS.match,
      reduced: false,
      seen: ANSWERS.seen,
      verdict: { accepted: false, notes: ANSWERS.verdict.notes }
    });
  });

  it('keeps only what the verdict and the answers are: no extras the rule computed, nothing else handed to it', () => {
    const verdict = { ...ANSWERS.verdict, extras: [{ foreignAllergens: ['crustaceans'], name: 'shrimp' }] };
    const judgement = pictureJudgement({ ...ANSWERS, at: AT, number: 1, verdict, ...{ recipeId: 'x' } });

    expect(Object.keys(judgement ?? {}).sort()).toEqual(['at', 'attempt', 'match', 'reduced', 'seen', 'verdict']);
    expect(Object.keys(judgement?.verdict ?? {}).sort()).toEqual(['accepted', 'notes']);
  });

  it('cuts an answer longer than the bound, and says so — never refuses it', () => {
    const long = 'a'.repeat(500);
    const judgement = pictureJudgement({
      ...ANSWERS,
      at: AT,
      match: { extras: Array.from({ length: 40 }, (_, index) => `extra ${index}`), ingredients: [] },
      number: 1,
      seen: { foods: Array.from({ length: 40 }, (_, index) => ({ amount: 'main', name: index === 0 ? long : `food ${index}`, specific: true })) }
    });

    expect(judgement?.reduced).toBe(true);
    expect(judgement?.seen.foods).toHaveLength(16);
    expect(judgement?.seen.foods[0]?.name).toHaveLength(60);
    expect(judgement?.match.extras).toHaveLength(16);
  });

  it('stores a malformed answer reduced: a wrong type dropped, an unknown word replaced, what Postgres refuses inside jsonb removed', () => {
    const judgement = pictureJudgement({
      at: AT,
      match: {
        extras: ['ok', 42 as unknown as string, 'nul\u0000byte'],
        ingredients: [{ matched: 'not a list' as unknown as string[], slug: 'arroz-blanco-cocido', status: 'maybe' }]
      },
      number: 1,
      seen: {
        extraDishes: Number.NaN,
        foods: [
          { amount: 'heaps', name: 'lone \ud800 surrogate', specific: 'yes' as unknown as boolean },
          { amount: 'main', name: '   ', specific: true }
        ]
      },
      verdict: { accepted: false, notes: ['extra_food:x'] }
    });

    expect(judgement).toMatchObject({
      match: { extras: ['ok', 'nul byte'], ingredients: [{ matched: [], slug: 'arroz-blanco-cocido', status: 'unsure' }] },
      reduced: true,
      seen: { foods: [{ amount: 'main', name: 'lone  surrogate', specific: true }] }
    });
    expect(judgement?.seen).not.toHaveProperty('extraDishes');
    expect(JSON.stringify(judgement)).not.toMatch(/\\u0000|\\ud800/);
  });

  it('marks as reduced an answer whose name had to be cleaned, even when nothing was cut', () => {
    const judgement = pictureJudgement({
      ...ANSWERS,
      at: AT,
      number: 1,
      seen: { foods: [{ amount: 'main', name: 'shrimp\u0000\ud800', specific: true }] }
    });

    expect(judgement).toMatchObject({ reduced: true, seen: { foods: [{ name: 'shrimp' }] } });
  });

  /* Review P3: the cut counts what the schema counts — UTF-16 units — so a name of emoji is cut, not dropped with its attempt. */
  it('cuts a name of astral characters to the bound without splitting a pair, and keeps the attempt', () => {
    const judgement = pictureJudgement({
      ...ANSWERS,
      at: AT,
      number: 1,
      seen: { foods: [{ amount: 'main', name: '😀'.repeat(45), specific: true }] }
    });

    expect(judgement?.reduced).toBe(true);
    expect(judgement?.seen.foods[0]?.name).toBe('😀'.repeat(30));
  });

  it('marks as reduced a `specific` that is not a boolean, taken as specific', () => {
    const judgement = pictureJudgement({
      ...ANSWERS,
      at: AT,
      number: 1,
      seen: { foods: [{ amount: 'main', name: 'rice', specific: 'yes' as unknown as boolean }] }
    });

    expect(judgement).toMatchObject({ reduced: true, seen: { foods: [{ specific: true }] } });
  });

  it('stores nothing, and throws nothing, for answers that are not answers at all', () => {
    expect(pictureJudgement({ ...ANSWERS, at: AT, number: 1, seen: null as unknown as JudgedAnswers['seen'] })).toBeNull();
    expect(pictureJudgement({ ...ANSWERS, at: new Date(Number.NaN), number: 1 })).toBeNull();
    expect(pictureJudgement({ ...ANSWERS, at: AT, number: 0 })).toBeNull();
  });

  it('stores nothing of an attempt still larger than the ceiling once cut', () => {
    const name = 'n'.repeat(60);
    const ingredients = Array.from({ length: 30 }, (_, index) => ({
      matched: [name, name, name, name],
      slug: `slug-${index}-${'s'.repeat(70)}`,
      status: 'seen'
    }));

    expect(JSON.stringify({ ingredients }).length).toBeGreaterThan(PICTURE_JUDGEMENT_BYTES);
    expect(pictureJudgement({ ...ANSWERS, at: AT, match: { extras: [], ingredients }, number: 1 })).toBeNull();
  });
});

describe('pictureJudgedDrawing', () => {
  it('holds the recipe as it was judged once, beside the drawing’s attempts', () => {
    expect(pictureJudgedDrawing(RICE, [judged(1), judged(2)])).toEqual({
      attempts: [judged(1), judged(2)],
      recipe: { ...RICE, reduced: false },
      v: PICTURE_DRAWING_VERSION
    });
  });

  it('is nothing for a drawing none of whose attempts reached the judge', () => {
    expect(pictureJudgedDrawing(RICE, [])).toBeNull();
  });

  it('drops a recipe’s last ingredients until it fits its byte ceiling, and says so', () => {
    const ingredients = Array.from({ length: 30 }, (_, index) => ({
      grams: index,
      name: `ñ${'é'.repeat(59)}`,
      slug: `slug-${index}-${'s'.repeat(70)}`
    }));
    const found = pictureJudgedDrawing({ ingredients, name: 'Arroz' }, [judged(1)]);

    expect(found?.recipe.reduced).toBe(true);
    expect(found?.recipe.ingredients.length).toBeLessThan(30);
    expect(found?.recipe.ingredients[0]?.slug).toBe(ingredients[0]?.slug);
    expect(new TextEncoder().encode(JSON.stringify({ ingredients: found?.recipe.ingredients, name: 'Arroz' })).length).toBeLessThanOrEqual(
      PICTURE_RECIPE_BYTES
    );
  });

  it('keeps a drawing’s last three attempts, and a recipe cut to the bound', () => {
    const ingredients = Array.from({ length: 40 }, (_, index) => ({ grams: index, name: `food ${index}`, slug: `slug-${index}` }));
    const found = pictureJudgedDrawing(
      { ingredients, name: 'x'.repeat(400) },
      [1, 2, 3, 4].map(number => judged(number))
    );

    expect(found?.attempts.map(attempt => attempt.attempt)).toEqual([2, 3, 4]);
    expect(found?.recipe.ingredients).toHaveLength(30);
    expect(found?.recipe.name).toHaveLength(160);
    expect(found?.recipe.reduced).toBe(true);
  });
});

describe('keepingDrawings', () => {
  const [first, second, third, fourth] = ['2026-09-01', '2026-09-09', '2026-09-17', '2026-09-25'].map(day => drawing(`${day}T10:00:00Z`));

  it('adds a drawing after the ones the row held, oldest first, and drops the oldest beyond the bound', () => {
    expect(PICTURE_DRAWINGS_KEPT).toBe(3);
    expect(keepingDrawings({ reason: 'judge_allergen' }, { drawings: [first, second] }, third)).toEqual({
      drawings: [first, second, third],
      reason: 'judge_allergen'
    });
    expect(keepingDrawings({}, { drawings: [first, second, third] }, fourth)).toEqual({ drawings: [second, third, fourth] });
  });

  it('adds no key when there is nothing to keep', () => {
    expect(keepingDrawings({ reason: 'other' }, null)).toEqual({ reason: 'other' });
    expect(keepingDrawings({ reason: 'other' }, { drawings: 'not a list' })).toEqual({ reason: 'other' });
  });

  it('never trusts a `drawings` key in what is written, nor a drawing of its own that does not fit this version’s shape', () => {
    expect(keepingDrawings({ drawings: [fourth] }, { drawings: [first] })).toEqual({ drawings: [first] });
    expect(keepingDrawings({}, null, { ...first, attempts: [] } as unknown as PictureJudgedDrawing)).toEqual({});
  });

  /* Review P2: a shape change, or a rollback past one, must not delete every dish's history at its next end. */
  it('carries a stored drawing of an older or a newer shape as it is, and drops only what is not an object', () => {
    const older = { attempts: [{ seen: { foods: [] } }], recipe: { name: 'Arroz' } };
    const newer = { ...first, attempts: first?.attempts.map(attempt => ({ ...attempt, model: 'judge-2' })), v: 2 };

    expect(keepingDrawings({ reason: 'other' }, { drawings: [older, 'garbage', null, [1], newer] }, fourth)).toEqual({
      drawings: [older, newer, fourth],
      reason: 'other'
    });
  });

  it('reads the stored drawings within the bound', () => {
    expect(pictureDrawingsOf({ drawings: [first, second, third, fourth] })).toEqual([second, third, fourth]);
    expect(pictureDrawingsOf(null)).toEqual([]);
  });
});

describe('jsonbSafe', () => {
  it('takes out of every note what Postgres refuses inside jsonb — a NUL, a lone surrogate — so a provider’s words cannot fail a drawing’s end', () => {
    const written = {
      c2pa: true,
      judge: ['extra_food:lone\udc00'],
      notes: ['1:failed:OpenRouter /images answered 503: nul\u0000byte', '2:rejected:extra_food:emoji 😀 stays'],
      released: 'why\ud800'
    };

    expect(keepingDrawings(written, null)).toEqual({
      c2pa: true,
      judge: ['extra_food:lone'],
      notes: ['1:failed:OpenRouter /images answered 503: nul byte', '2:rejected:extra_food:emoji 😀 stays'],
      released: 'why'
    });
    expect(JSON.stringify(keepingDrawings(written, null))).not.toMatch(/\\u0000|\\ud800|\\udc00/);
    expect(jsonbSafe({ nested: [{ deep: 'a\u0000b' }], number: 3 })).toEqual({ nested: [{ deep: 'a b' }], number: 3 });
  });
});

describe('pictureEvidenceOf', () => {
  const kept = drawing('2026-09-29T10:00:00Z');

  it('keeps the rejections’ notes and the judged drawings of a failed row — never its candidate’s pointer or its reason', () => {
    const provenance = {
      candidate: { extras: [], model: 'm', path: 'dish-picture-candidates/x/2.0.0-y.jpg', promptVersion: '2.0.0' },
      drawings: [kept],
      notes: ['1:rejected:extra_allergen:shrimp=crustaceans', 2, '2:rejected:extra_food:shrimp'],
      reason: 'judge_allergen'
    };

    expect(pictureEvidenceOf(provenance)).toEqual({
      drawings: [kept],
      notes: ['1:rejected:extra_allergen:shrimp=crustaceans', '2:rejected:extra_food:shrimp']
    });
  });

  it('is empty for a row that stored neither', () => {
    expect(pictureEvidenceOf({ candidate: {}, reason: 'judge_allergen' })).toEqual({});
    expect(pictureEvidenceOf(null)).toEqual({});
  });
});
