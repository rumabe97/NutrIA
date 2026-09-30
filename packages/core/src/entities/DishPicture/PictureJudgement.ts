import { z } from 'zod';

import type { PictureProvenance } from './DishPicture';

/**
 * What the judge said, kept (project 010, phase 3). Each attempt that reached
 * the judge — both calls answered and the rule ran — stores the two answers and
 * the rule's verdict, and each drawing stores the recipe as it was judged: what
 * `judgePicture({ catalogue, match, recipe, seen })` needs to replay a picture
 * through another rule, a recipe rewritten or re-portioned since included.
 *
 * It lives in `recipe_images.provenance.drawings`, oldest first, and survives
 * the dish's next drawings within `PICTURE_DRAWINGS_KEPT`. **A model's words
 * are stored here and nowhere is shown**: no view, answer, audit row or log
 * line reads this key, and the console's reads leave it out in SQL. Nothing
 * about a person: a picture of a dish, and a model's words about it.
 *
 * Closed and bounded: every list and every string has its cap, and what does
 * not fit is cut (`reduced`), never refused — storing must never change how a
 * drawing ends. An attempt still larger than `PICTURE_JUDGEMENT_BYTES` once cut
 * is not stored at all; a recipe larger than `PICTURE_RECIPE_BYTES` loses its
 * last ingredients until it fits. A row holds at most 3 × (3 × 6 KB + 4 KB), about
 * 68 KB of drawings; a real one about 6 KB a drawing, 19 KB for three.
 *
 * **Versioned** (`v`): what this code writes is checked against the strict
 * shape, but what a row already holds is carried as it is — an older shape, or
 * a newer one a rolled-back deploy left, is never dropped for not being this
 * version's. Only what is not an object at all is.
 */

/** The drawings a row keeps, most recent last: three drawings of three attempts at most — nine judged pictures. */
export const PICTURE_DRAWINGS_KEPT = 3;

/** The judged attempts one drawing keeps: `PICTURE_ATTEMPTS`, as the storage's own bound. */
const ATTEMPTS_PER_DRAWING = 3;

/** An attempt larger than this once cut is not stored: about four times a real one (~1.5 KB in the pilot). */
export const PICTURE_JUDGEMENT_BYTES = 6_144;

/** A drawing's recipe larger than this loses its last ingredients until it fits: about four times a real one. */
export const PICTURE_RECIPE_BYTES = 4_096;

/** The stored drawing's shape. Raised with any change to it; entries of another version are carried untouched. */
export const PICTURE_DRAWING_VERSION = 1;

const FOODS = 16;
const NAME = 60;
const NON_FOOD = 6;
const INGREDIENTS = 30;
const MATCHED = 4;
const SLUG = 80;
const NOTES = 16;
const NOTE = 160;
const TITLE = 160;

const seenFoodSchema = z.strictObject({
  amount: z.enum(['garnish', 'main', 'side', 'trace']),
  name: z.string().min(1).max(NAME),
  specific: z.boolean()
});

/** Call (a)'s answer, as `SeenPicture` holds it. */
const seenSchema = z.strictObject({
  extraDishes: z.number().optional(),
  foods: z.array(seenFoodSchema).max(FOODS),
  nonFood: z.array(z.string().min(1).max(NAME)).max(NON_FOOD).optional(),
  plasticOrCgi: z.boolean().optional(),
  realism: z.number().optional(),
  sharpness: z.number().optional()
});

/** Call (b)'s answer, as `PictureMatch` holds it. */
const matchSchema = z.strictObject({
  extras: z.array(z.string().min(1).max(NAME)).max(FOODS),
  ingredients: z
    .array(
      z.strictObject({
        matched: z.array(z.string().min(1).max(NAME)).max(MATCHED),
        slug: z.string().min(1).max(SLUG),
        status: z.enum(['not_seen', 'seen', 'unsure'])
      })
    )
    .max(INGREDIENTS)
});

/** One attempt that reached the judge. `attempt` is its number in its drawing; `at`, when it was judged. */
export const pictureJudgementSchema = z.strictObject({
  at: z.iso.datetime(),
  attempt: z.number().int().min(1).max(99),
  match: matchSchema,
  /** Something of the answers was cut to fit: a replay of this attempt is not faithful. */
  reduced: z.boolean(),
  seen: seenSchema,
  verdict: z.strictObject({ accepted: z.boolean(), notes: z.array(z.string().min(1).max(NOTE)).max(NOTES) })
});

export type PictureJudgement = z.infer<typeof pictureJudgementSchema>;

/** One drawing's judged attempts, with the recipe as it was judged — stored once, not once per attempt. */
export const pictureJudgedDrawingSchema = z.strictObject({
  attempts: z.array(pictureJudgementSchema).min(1).max(ATTEMPTS_PER_DRAWING),
  recipe: z.strictObject({
    ingredients: z
      .array(z.strictObject({ grams: z.number().min(0), name: z.string().min(1).max(NAME), slug: z.string().min(1).max(SLUG) }))
      .max(INGREDIENTS),
    name: z.string().max(TITLE),
    /** Something of the recipe was cut to fit. */
    reduced: z.boolean()
  }),
  v: z.literal(PICTURE_DRAWING_VERSION)
});

export type PictureJudgedDrawing = z.infer<typeof pictureJudgedDrawingSchema>;

/** A drawing as a row holds it: this version's `PictureJudgedDrawing`, or another version's, carried as it is. */
export type PictureStoredDrawing = PictureJudgedDrawing | Readonly<Record<string, unknown>>;

/** What the judge's two calls and the rule answered, as the drawing holds them: `SeenPicture`, `PictureMatch`, `PictureVerdict`. */
export type JudgedAnswers = {
  readonly match: {
    readonly extras: readonly string[];
    readonly ingredients: readonly { readonly matched: readonly string[]; readonly slug: string; readonly status: string }[];
  };
  readonly seen: {
    readonly extraDishes?: number;
    readonly foods: readonly { readonly amount: string; readonly name: string; readonly specific: boolean }[];
    readonly nonFood?: readonly string[];
    readonly plasticOrCgi?: boolean;
    readonly realism?: number;
    readonly sharpness?: number;
  };
  readonly verdict: { readonly accepted: boolean; readonly notes: readonly string[] };
};

/** A recipe as it was judged: `PictureRecipe`. */
export type JudgedRecipe = {
  readonly ingredients: readonly { readonly grams: number; readonly name: string; readonly slug: string }[];
  readonly name: string;
};

/** What Postgres refuses inside `jsonb` text: `\u0000` among the control characters, and a surrogate with no pair. */
// eslint-disable-next-line no-control-regex -- the control characters are what is removed
const CONTROL = /[\u0000-\u001f\u007f]/g;
const LONE_SURROGATE = /\p{Cs}/gu;

/**
 * Every string inside `value`, nested in arrays and plain objects, without
 * what Postgres refuses inside `jsonb`: control characters become spaces and
 * lone surrogates go. For what a drawing's end writes besides the drawings —
 * the notes, the judge's notes, why a drawing was given back — which carry a
 * provider's and a model's text: a NUL there must never fail the end's write.
 */
export function jsonbSafe<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(CONTROL, ' ').replace(LONE_SURROGATE, '') as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => jsonbSafe(item as unknown)) as T;
  }

  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [jsonbSafe(key), jsonbSafe(item as unknown)])) as T;
  }

  return value;
}

/**
 * Cuts what a model wrote to the bound, and says when it did. Strings lose
 * control characters and lone surrogates — Postgres refuses both inside
 * `jsonb`, and a refused write would fail the drawing's end — then are cut to
 * their cap; lists keep their first items. A value of the wrong type is dropped.
 */
function cutter() {
  let reduced = false;

  const cut = {
    list<T>(value: unknown, max: number, each: (item: unknown) => T | null): T[] {
      if (!Array.isArray(value)) {
        reduced = true;

        return [];
      }

      if (value.length > max) {
        reduced = true;
      }

      const kept = value.slice(0, max).map(each);

      if (kept.some(item => item === null)) {
        reduced = true;
      }

      return kept.filter((item): item is T => item !== null);
    },
    /** A value that was not one the shape allows, replaced. */
    mark(): void {
      reduced = true;
    },
    number(value: unknown): number | undefined {
      if (value === undefined) {
        return undefined;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        reduced = true;

        return undefined;
      }

      return value;
    },
    get reduced(): boolean {
      return reduced;
    },
    text(value: unknown, max: number): string | null {
      if (typeof value !== 'string') {
        reduced = true;

        return null;
      }

      const clean = value.replace(CONTROL, ' ').replace(LONE_SURROGATE, '').trim();

      // A name that had to be cleaned is no longer the model's own: a replay of it is not faithful.
      if (clean !== value.trim()) {
        reduced = true;
      }

      // Cut in UTF-16 units, as the schema's `max` counts them, and never between the two halves of a pair.
      let kept = '';

      for (const point of clean) {
        if (kept.length + point.length > max) {
          reduced = true;

          break;
        }

        kept += point;
      }

      kept = kept.trim();

      if (kept.length === 0) {
        reduced = true;

        return null;
      }

      return kept;
    }
  };

  return cut;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], otherwise: T, cut: ReturnType<typeof cutter>): T {
  if ((allowed as readonly unknown[]).includes(value)) {
    return value as T;
  }

  cut.mark();

  return otherwise;
}

function aBoolean(value: unknown, otherwise: boolean, cut: ReturnType<typeof cutter>): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  cut.mark();

  return otherwise;
}

function sizeOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * One judged attempt as it is stored, cut to the bound; null when nothing that
 * fits the shape can be kept. **Never throws**: whatever the answers hold, the
 * drawing ends as it would have.
 */
export function pictureJudgement(attempt: { readonly at: Date; readonly number: number } & JudgedAnswers): PictureJudgement | null {
  try {
    const cut = cutter();
    const { match, seen, verdict } = attempt;
    const nonFood = seen.nonFood === undefined ? undefined : cut.list(seen.nonFood, NON_FOOD, item => cut.text(item, NAME));
    const numbers = { extraDishes: cut.number(seen.extraDishes), realism: cut.number(seen.realism), sharpness: cut.number(seen.sharpness) };
    const judged = {
      at: attempt.at.toISOString(),
      attempt: attempt.number,
      match: {
        extras: cut.list(match.extras, FOODS, item => cut.text(item, NAME)),
        ingredients: cut.list(match.ingredients, INGREDIENTS, item => {
          const ingredient = item as JudgedAnswers['match']['ingredients'][number];
          const slug = cut.text(ingredient.slug, SLUG);

          return slug === null
            ? null
            : {
                matched: cut.list(ingredient.matched, MATCHED, name => cut.text(name, NAME)),
                slug,
                status: oneOf(ingredient.status, ['not_seen', 'seen', 'unsure'] as const, 'unsure', cut)
              };
        })
      },
      seen: {
        foods: cut.list(seen.foods, FOODS, item => {
          const food = item as JudgedAnswers['seen']['foods'][number];
          const name = cut.text(food.name, NAME);

          return name === null
            ? null
            : {
                amount: oneOf(food.amount, ['garnish', 'main', 'side', 'trace'] as const, 'main', cut),
                name,
                // Not a boolean: taken as specific, as the judge's client does, and marked.
                specific: aBoolean(food.specific, true, cut)
              };
        }),
        ...Object.fromEntries(Object.entries(numbers).filter(([, value]) => value !== undefined)),
        ...(nonFood === undefined ? {} : { nonFood }),
        ...(typeof seen.plasticOrCgi === 'boolean' ? { plasticOrCgi: seen.plasticOrCgi } : {})
      },
      verdict: { accepted: verdict.accepted === true, notes: cut.list(verdict.notes, NOTES, note => cut.text(note, NOTE)) }
    };
    const parsed = pictureJudgementSchema.safeParse({ ...judged, reduced: cut.reduced });

    return parsed.success && sizeOf(parsed.data) <= PICTURE_JUDGEMENT_BYTES ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * One drawing's judged attempts and the recipe they were judged against, as
 * stored; null for a drawing none of whose attempts reached the judge — a file
 * without its manifest, a call that broke. The last attempts when there are
 * more than a drawing keeps. Never throws.
 */
export function pictureJudgedDrawing(recipe: JudgedRecipe, attempts: readonly PictureJudgement[]): PictureJudgedDrawing | null {
  if (attempts.length === 0) {
    return null;
  }

  try {
    const cut = cutter();
    const ingredients = cut.list(recipe.ingredients, INGREDIENTS, item => {
      const ingredient = item as JudgedRecipe['ingredients'][number];
      const name = cut.text(ingredient.name, NAME);
      const slug = cut.text(ingredient.slug, SLUG);
      const grams = cut.number(ingredient.grams);

      return name === null || slug === null || grams === undefined || grams < 0 ? null : { grams, name, slug };
    });
    const name = typeof recipe.name === 'string' ? (cut.text(recipe.name, TITLE) ?? '') : '';
    let over = false;

    while (ingredients.length > 0 && sizeOf({ ingredients, name }) > PICTURE_RECIPE_BYTES) {
      ingredients.pop();
      over = true;
    }

    const parsed = pictureJudgedDrawingSchema.safeParse({
      attempts: attempts.slice(-ATTEMPTS_PER_DRAWING),
      recipe: { ingredients, name, reduced: cut.reduced || over || name.length === 0 },
      v: PICTURE_DRAWING_VERSION
    });

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The drawings a row stored, oldest first, within the bound — each **as it is**:
 * one of another version, older or newer, is carried untouched, since a shape
 * this code does not know is not a shape that is wrong. Only an entry that is
 * not an object at all is dropped.
 */
export function pictureDrawingsOf(provenance: PictureProvenance | null | undefined): PictureStoredDrawing[] {
  const stored: unknown = provenance !== null && typeof provenance === 'object' ? provenance.drawings : undefined;

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .filter((drawing): drawing is Record<string, unknown> => drawing !== null && typeof drawing === 'object' && !Array.isArray(drawing))
    .slice(-PICTURE_DRAWINGS_KEPT);
}

/**
 * What a write of `provenance` stores, keeping the judged drawings (project
 * 010): `written`, with the drawings the row already held and `drawing` — this
 * drawing's, when it judged anything — after them, the oldest dropped beyond
 * `PICTURE_DRAWINGS_KEPT`. No `drawings` key when there are none. A `drawings`
 * key in `written` itself is never trusted: only what was built here is kept.
 * Every string of `written` goes through `jsonbSafe`.
 */
export function keepingDrawings(
  written: PictureProvenance,
  stored: PictureProvenance | null | undefined,
  drawing: PictureJudgedDrawing | null = null
): PictureProvenance {
  const { drawings: _ignored, ...rest } = jsonbSafe(written);
  const own = drawing === null ? null : pictureJudgedDrawingSchema.safeParse(drawing);
  const drawings = [...pictureDrawingsOf(stored), ...(own?.success === true ? [own.data] : [])].slice(-PICTURE_DRAWINGS_KEPT);

  return drawings.length === 0 ? rest : { ...rest, drawings };
}

/**
 * What the owner's acceptance keeps of the failed row it publishes (`0072`,
 * project 010): the rejections' notes and the judged drawings. Never the
 * candidate's pointer, its reason or anything else the row held — the
 * acceptance writes its own marks beside these.
 */
export function pictureEvidenceOf(provenance: PictureProvenance | null | undefined): PictureProvenance {
  const notes: unknown = provenance !== null && typeof provenance === 'object' ? provenance.notes : undefined;
  const kept = Array.isArray(notes) ? notes.filter((note): note is string => typeof note === 'string').slice(-NOTES) : [];

  return keepingDrawings(kept.length === 0 ? {} : { notes: kept }, provenance);
}
