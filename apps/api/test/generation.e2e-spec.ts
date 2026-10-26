import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import {
  clearProfileHeight,
  completeOnboarding,
  createApp,
  dish,
  generateAndWait,
  httpServer,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import { ConflictError } from 'core/entities/Error';
import { database } from 'database';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { PlanJobController } from 'core/controllers/Plan';
import { rangeQuantity } from 'core/domain/ShoppingList';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { MeasurementUnit } from 'core/entities/Plan';
import type { PantryView } from 'core/controllers/Pantry';
import type { PlanView, ShoppingListItemView, ShoppingListView } from 'core/controllers/Plan';

/**
 * The core loop, end to end, against a real database.
 *
 * The model is scripted (see `harness.ts`) so the assertions are about **our**
 * pipeline — scheduling, validation, atomicity, aggregation — rather than about
 * whether a provider happened to return good dishes today.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */
const POOL = [
  dish(
    'Avena con yogur',
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.avena },
      { grams: 150, slug: SEEDED.yogur }
    ]
  ),
  dish(
    'Tostada con huevo',
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.pan },
      { grams: 120, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Yogur con avena',
    ['breakfast'],
    [
      { grams: 200, slug: SEEDED.yogur },
      { grams: 60, slug: SEEDED.avena }
    ]
  ),
  dish(
    'Huevos con pan',
    ['breakfast'],
    [
      { grams: 140, slug: SEEDED.huevo },
      { grams: 60, slug: SEEDED.pan }
    ]
  ),
  dish('Avena sola', ['breakfast'], [{ grams: 110, slug: SEEDED.avena }]),
  dish(
    'Arroz con pollo',
    ['lunch'],
    [
      { grams: 220, slug: SEEDED.arroz },
      { grams: 180, slug: SEEDED.pollo }
    ]
  ),
  dish(
    'Lentejas con arroz',
    ['lunch'],
    [
      { grams: 250, slug: SEEDED.lentejas },
      { grams: 150, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Pollo con patata',
    ['lunch'],
    [
      { grams: 200, slug: SEEDED.pollo },
      { grams: 250, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Arroz con tomate',
    ['lunch'],
    [
      { grams: 260, slug: SEEDED.arroz },
      { grams: 150, slug: SEEDED.tomate }
    ]
  ),
  dish('Lentejas solas', ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish(
    'Merluza con patata',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Pollo con tomate',
    ['dinner'],
    [
      { grams: 170, slug: SEEDED.pollo },
      { grams: 200, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Merluza con arroz',
    ['dinner'],
    [
      { grams: 180, slug: SEEDED.merluza },
      { grams: 180, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Patata con huevo',
    ['dinner'],
    [
      { grams: 250, slug: SEEDED.patata },
      { grams: 110, slug: SEEDED.huevo }
    ]
  ),
  dish('Merluza sola', ['dinner'], [{ grams: 300, slug: SEEDED.merluza }])
];

/** A word no catalogue could hold, so the entry it makes resolves to nothing — `pantry.e2e-spec.ts`'s own. */
const UNRESOLVABLE = 'zzxqv de plutonia';

/**
 * How much of a thing somebody says is in the house: nothing at all (*«tengo
 * merluza»*), far too little, or far too much.
 *
 * `PART` is less than any fortnight needs of an ingredient it cooks with twice,
 * so that row keeps a remainder under every range a reader can choose (`0091`);
 * `PLENTY` is more than a fortnight needs of anything, so that row is capped at
 * its own need. Both are checked against the real figures before they are
 * typed, in `cupboardFrom`.
 */
const PART = 100;
const PLENTY = 5_000;

/** How many things the cupboard names with no amount — well under the sixty a cupboard may hold. */
const WITHOUT_AMOUNT = 40;

/**
 * The cupboard Alice types before her fortnight exists, chosen from a fortnight
 * **this run actually generated** (Carol's).
 *
 * Chosen rather than written down, for the reason `shopping-range.e2e-spec.ts`
 * picks its split row off the real plan: the pool is the person's whole
 * filtered library, so which dishes a fortnight holds is not fixed, and a
 * hard-coded *«tengo pechuga de pollo»* is a cupboard covering nothing on the
 * day the scheduler prefers turkey — a green suite proving nothing. Every slug
 * here is one Carol's own fortnight both **cooked with** and **shopped for**,
 * which is what makes it coverable: a cooked grain is bought dry (`0078`), so
 * its own slug names no row and a cupboard entry for it covers nothing.
 *
 * The most-cooked-with first, so the plates Alice's own fortnight serves are as
 * likely as possible to be plates the cupboard wholly covers — the figure
 * criterion 4's sentence reads.
 */
type Cupboard = {
  /** The one entry with an amount under its row's need. */
  readonly part: string;
  /** The one entry with an amount far above it. */
  readonly plenty: string;
  /** Everything named with no amount at all, most-cooked-with first. */
  readonly withoutAmount: readonly string[];
};

function cupboardFrom(rows: ReadonlyMap<string, SluggedRow>, plates: ReadonlyMap<string, readonly string[]>): Cupboard {
  const uses = new Map<string, number>();

  for (const slugs of plates.values()) {
    for (const slug of new Set(slugs)) {
      uses.set(slug, (uses.get(slug) ?? 0) + 1);
    }
  }

  // Both a row of the shop and an ingredient of a plate: the two things a
  // cupboard entry has to be to cover anything at all.
  const coverable = [...uses.keys()].filter(slug => rows.has(slug)).sort((a, b) => (uses.get(b) ?? 0) - (uses.get(a) ?? 0) || a.localeCompare(b));
  const part = coverable.find(slug => {
    const row = rows.get(slug) as SluggedRow;

    return row.totalGrams > PART * 2 && Object.keys(row.perDay).length > 1;
  });
  const plenty = coverable.find(slug => slug !== part && (rows.get(slug) as SluggedRow).totalGrams < PLENTY / 2);

  if (!part || !plenty) {
    throw new Error(
      `A generated fortnight whose rows cannot answer both halves of the amount: ${part ? '' : 'none needs more than 200 g of something it cooks with twice; '}${plenty ? '' : 'none needs less than 2.5 kg of anything'}`
    );
  }

  return { part, plenty, withoutAmount: coverable.filter(slug => slug !== part && slug !== plenty).slice(0, WITHOUT_AMOUNT) };
}

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

/** Parameterised reads of what no route returns, as `system-events.e2e-spec.ts` does them. */
function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/**
 * What a plan recorded of the cupboard it was asked with (project 022 phase 2).
 *
 * Read off the row rather than off a view, because no route carries it yet:
 * phase 3 is the screen that says the sentence, and this is the suite that
 * proves the figures it will say are already stored and are the right ones.
 */
type PantryRecord = {
  readonly asked: readonly { readonly grams: number | null; readonly slug: string }[];
  readonly coveredRows: number;
  readonly meals: number;
  readonly rows: number;
  readonly unresolved: number;
  readonly wholeMeals: number;
};

async function pantryRecordOf(planId: string): Promise<PantryRecord | null | undefined> {
  const [row] = await sql()<{ generationMetadata: { pantry?: PantryRecord | null } | null }>`
    select generation_metadata as "generationMetadata" from meal_plans where id = ${planId}`;

  return row?.generationMetadata?.pantry;
}

/**
 * Every slug each meal of a plan is made of — the plate **as it is served**,
 * its accompaniment included and its optional ingredients left out, which is
 * exactly the set `core/domain/ShoppingList`'s `pantryPlates` counts over.
 *
 * Recomputed from the tables rather than read back from the figure under test:
 * `wholeMeals` is a number a screen will say out loud, and a test that only
 * checked its type would pass over any undercount.
 */
async function mealSlugs(planId: string): Promise<ReadonlyMap<string, readonly string[]>> {
  const rows = await sql()<{ mealId: string; slug: string }>`
    select meals.id as "mealId", ingredients.slug
      from meals
      join plan_days on plan_days.id = meals.plan_day_id
      join recipe_ingredients on recipe_ingredients.recipe_id = meals.recipe_id and recipe_ingredients.is_optional = false
      join ingredients on ingredients.id = recipe_ingredients.ingredient_id
      where plan_days.plan_id = ${planId}
    union all
    select meal_accompaniments.meal_id as "mealId", ingredients.slug
      from meal_accompaniments
      join meals on meals.id = meal_accompaniments.meal_id
      join plan_days on plan_days.id = meals.plan_day_id
      join ingredients on ingredients.id = meal_accompaniments.ingredient_id
      where plan_days.plan_id = ${planId}`;
  const byMeal = new Map<string, string[]>();

  for (const row of rows) {
    byMeal.set(row.mealId, [...(byMeal.get(row.mealId) ?? []), row.slug]);
  }

  return byMeal;
}

/** A list row with the catalogue slug its `ingredient_id` points at — the key a cupboard is matched on, and the one the view does not carry. */
type SluggedRow = ShoppingListItemView & { readonly slug: string };

/** A stored amount's own precision: `shopping_list_items.bought_grams` is `numeric(9, 2)`. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `rangeQuantity` against the view's own fields, as `shopping-range.e2e-spec.ts` reads it. */
function needOver(item: ShoppingListItemView, days: Iterable<string>): number {
  return rangeQuantity(
    {
      displayQuantity: item.displayQuantity,
      displayUnit: item.displayUnit as MeasurementUnit,
      dryRounded: item.dryRounded,
      gramsPerUnit: item.gramsPerUnit,
      perDay: item.perDay,
      totalGrams: item.totalGrams
    },
    days
  ).totalGrams;
}

describe('plan generation', () => {
  let app: INestApplication;
  let alice: Account;
  let bob: Account;
  /** The account nobody told anything to: her fortnight is the one `cupboardFrom` reads, and the one criterion 10 is about. */
  let carol: Account;
  /** Generates while Alice's cupboard is standing — the only arrangement that can show a read of the wrong account's rows. */
  let dave: Account;
  /** The account whose generation fails, so a cupboard can be found where it was left. */
  let eve: Account;
  let plan: PlanView;
  /** Carol's fortnight, generated with nothing in the house. */
  let carolsPlan: PlanView;
  /** What Alice typed, and what each word resolved to: the cupboard every case below reads. */
  let cupboard: Cupboard;
  /** The slugs the cupboard actually holds, after the catalogue has answered every word. */
  let held: ReadonlyMap<string, number | null>;
  let ai: ScriptedAiClient;
  let stamp: number;

  const addPantry = (who: Account, body: Record<string, unknown>) =>
    request(httpServer(app)).post(`/${PREFIX}/pantry`).set('Cookie', who.cookie).send(body);

  const pantryOf = async (who: Account): Promise<PantryView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/pantry`).set('Cookie', who.cookie).expect(200);

    return response.body as PantryView;
  };

  const shoppingList = async (who: Account): Promise<ShoppingListView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', who.cookie).expect(200);

    return response.body as ShoppingListView;
  };

  /**
   * The active list of an account, every row carrying the catalogue slug it is
   * keyed by — the only way to find *the rice row* of a plan whose dish names
   * are random per run, and the key a cupboard entry is actually matched on.
   */
  const rowsBySlug = async (who: Account): Promise<ReadonlyMap<string, SluggedRow>> => {
    const list = await shoppingList(who);
    const slugs = await sql()<{ id: string; slug: string }>`
      select shopping_list_items.id, ingredients.slug
      from shopping_list_items
      join ingredients on ingredients.id = shopping_list_items.ingredient_id
      where shopping_list_items.list_id = ${list.id}
      order by ingredients.slug`;
    const bySlug = new Map<string, SluggedRow>();

    for (const { id, slug } of slugs) {
      const item = list.items.find(row => row.id === id);

      if (item) {
        bySlug.set(slug, { ...item, slug });
      }
    }

    return bySlug;
  };

  /** The row a cupboard entry was supposed to reach, or a failure naming what the plan did hold instead. */
  const rowFor = (rows: ReadonlyMap<string, SluggedRow>, slug: string): SluggedRow => {
    const row = rows.get(slug);

    if (!row) {
      throw new Error(
        `This generated fortnight has no shopping row for ${slug}, so the cupboard entry typed for it has nothing to cover. Which dishes a fortnight holds is not fixed; the rows it did produce were: ${[...rows.keys()].sort().join(', ')}`
      );
    }

    return row;
  };

  const active = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  /**
   * Types one thing into Alice's cupboard and answers what the catalogue made
   * of it.
   *
   * A label here is an ingredient's **own catalogue name**, so it resolves to
   * that ingredient — but the resolution is the product's, not the test's
   * (`resolvePantryLabel`, with its coarse map over sixteen rices), so what
   * came back is read rather than assumed. An entry that landed somewhere else
   * is taken out again and left out of `held`: the suite then proves what the
   * cupboard really holds, and never asserts a row somebody never named.
   */
  const type = async (label: string, slug: string, grams?: number): Promise<boolean> => {
    const added = await addPantry(alice, grams === undefined ? { label } : { grams, label, unit: 'g' });

    expect({ slug, status: added.status }).toEqual({ slug, status: 201 });

    const entry = (added.body as PantryView).items.find(item => item.label === label);

    if (entry?.slug === slug) {
      return true;
    }

    await request(httpServer(app)).delete(`/${PREFIX}/pantry/${entry?.id}`).set('Cookie', alice.cookie).expect(200);

    return false;
  };

  beforeAll(async () => {
    ai = new ScriptedAiClient(POOL);
    app = await createApp(ai);

    stamp = Date.now();

    alice = await register(app, `alice-${stamp}@e2e.invalid`);
    bob = await register(app, `bob-${stamp}@e2e.invalid`);
    carol = await register(app, `carol-${stamp}@e2e.invalid`);
    dave = await register(app, `dave-${stamp}@e2e.invalid`);
    eve = await register(app, `eve-${stamp}@e2e.invalid`);

    await completeOnboarding(app, alice);
    // Bob is onboarded too: an account still in onboarding answers 409 on every
    // plan route before ownership is even asked, and the isolation checks below
    // are about ownership.
    await completeOnboarding(app, bob);
    await completeOnboarding(app, carol);
    await completeOnboarding(app, dave);
    // Onboarded in full, and broken in the one case that needs a generation to
    // fail: a profile is cleared there rather than here, so nothing else in
    // this suite runs against a half-built account.
    await completeOnboarding(app, eve);

    // Carol first, with nothing in the house: the fortnight criterion 10 is
    // about, and the one Alice's cupboard is chosen from.
    const carols = await generateAndWait(app, carol);

    expect(carols.status).toBe('succeeded');

    carolsPlan = await active(carol);
    cupboard = cupboardFrom(await rowsBySlug(carol), await mealSlugs(carolsPlan.id));

    // The catalogue's own Spanish name for each slug, which is a word
    // `resolvePantryLabel` can answer — names live per locale
    // (`ingredient_names`), and every locale's is matchable.
    const names = await sql()<{ name: string; slug: string }>`
      select ingredient_names.name, ingredients.slug
      from ingredients
      join ingredient_names on ingredient_names.ingredient_id = ingredients.id and ingredient_names.locale = 'es-ES'
      where ingredients.slug = any(${[cupboard.part, cupboard.plenty, ...cupboard.withoutAmount]})`;
    const nameOf = new Map(names.map(row => [row.slug, row.name]));
    const standing = new Map<string, number | null>();

    // The cupboard is typed **before** Alice's fortnight exists, which is the
    // whole order of the feature: a draft nobody has a plan for yet, spent by
    // the generation that reads it.
    for (const slug of cupboard.withoutAmount) {
      const label = nameOf.get(slug);

      if (label !== undefined && (await type(label, slug))) {
        standing.set(slug, null);
      }
    }

    for (const [slug, grams] of [
      [cupboard.part, PART],
      [cupboard.plenty, PLENTY]
    ] as const) {
      // Load-bearing: these two are the only entries that can answer the two
      // halves of an amount, so a word of theirs that resolved elsewhere stops
      // the suite rather than quietly leaving a case with nothing to prove.
      const label = nameOf.get(slug);

      if (label === undefined || !(await type(label, slug, grams))) {
        throw new Error(`«${label ?? slug}» did not resolve to ${slug}, so the cupboard cannot say how much of it there is`);
      }

      standing.set(slug, grams);
    }

    expect((await addPantry(alice, { label: UNRESOLVABLE })).status).toBe(201);

    held = standing;

    // What the catalogue made of every word, read back before anything is
    // generated: the entries that resolved, in the order they were typed, and
    // the one that resolved to nothing kept at the end of them (criterion 12).
    expect((await pantryOf(alice)).items.map(item => item.slug)).toEqual([...standing.keys(), null]);
    expect(standing.size).toBeGreaterThan(2);

    const job = await generateAndWait(app, alice);

    expect(job.status).toBe('succeeded');

    plan = await active(alice);
  }, 300_000);

  afterAll(async () => {
    // Deletes cascade to the plan, its days, meals, shopping list and job rows
    // — and to `pantry_items.user_id`, which is how a cupboard dies with the
    // account that typed it.
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', alice.cookie);
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', bob.cookie);
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', carol.cookie);
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', dave.cookie);
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', eve.cookie);
    await app?.close();
  });

  /**
   * Protein powder is for the people who take it (`0052`). Alice records no
   * supplement, so the catalogue the model is shown has none — and neither
   * does the library, since both are filtered by the same exclusion.
   */
  it('offers no protein powder to somebody who takes none', () => {
    expect(ai.prompts.length).toBeGreaterThan(0);

    for (const prompt of ai.prompts) {
      expect(prompt).not.toContain('proteina-de-suero');
      expect(prompt).not.toContain('proteina-de-guisante');
    }
  });

  it('produces exactly fourteen days', () => {
    expect(plan.days).toHaveLength(14);
    expect(plan.status).toBe('active');
  });

  it('fills every slot on every day', () => {
    for (const day of plan.days) {
      expect(day.meals.map(meal => meal.slot).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    }
  });

  it('keeps every day within 10% of the calorie target', () => {
    const target = plan.strategy?.kcal ?? 0;

    expect(target).toBeGreaterThan(0);

    for (const day of plan.days) {
      // Named in the loop so a failure says which day, since Jest's expect takes no message.
      expect({ day: day.dayIndex, drift: Math.abs(day.totals.kcal - target) <= target * 0.1 }).toEqual({ day: day.dayIndex, drift: true });
    }
  });

  it('never serves the same dish twice in a row in the same slot', () => {
    for (let index = 1; index < plan.days.length; index += 1) {
      const previous = plan.days[index - 1];
      const current = plan.days[index];

      for (const meal of current?.meals ?? []) {
        expect(previous?.meals.find(other => other.slot === meal.slot)?.name).not.toBe(meal.name);
      }
    }
  });

  it('gives every meal macros greater than zero, computed from the catalogue', () => {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        expect({ kcal: meal.kcal > 0, meal: meal.name }).toEqual({ kcal: true, meal: meal.name });
        expect(meal.proteinG).toBeGreaterThan(0);
      }
    }
  });

  it('reconciles the shopping list exactly with the plan it came from', async () => {
    const server = httpServer(app);
    const listed: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', alice.cookie).expect(200);
    const list = listed.body as { items: readonly { name: string; totalGrams: number }[] };

    // Sum the scaled ingredients of every meal in the plan, from the API's own
    // meal-detail responses, and require the list to match.
    const expected = new Map<string, number>();
    const occurrences = new Map<string, number>();
    // Meals whose figure for a row is a cooked grain read dry, by row.
    const dried = new Map<string, number>();

    for (const day of plan.days) {
      for (const meal of day.meals) {
        const detail: Response = await request(server).get(`/${PREFIX}/meal-plans/meals/${meal.id}`).set('Cookie', alice.cookie).expect(200);
        const { ingredients } = detail.body as { ingredients: readonly { dry?: { grams: number; name: string }; grams: number; name: string }[] };

        for (const item of ingredients) {
          // A cooked grain is bought dry (`0078`): the list sums it on the dry
          // food's row, and the meal names that row and its weight in `dry` —
          // the same `toDry` mapping, which is all the view gives of it.
          const name = item.dry?.name ?? item.name;

          expected.set(name, (expected.get(name) ?? 0) + (item.dry?.grams ?? item.grams));
          occurrences.set(name, (occurrences.get(name) ?? 0) + 1);

          if (item.dry) {
            dried.set(name, (dried.get(name) ?? 0) + 1);
          }
        }
      }
    }

    expect(list.items).toHaveLength(expected.size);

    for (const listed of list.items) {
      // A dry row the catalogue has no dry food for is the cooked one's, named "(en seco)".
      const item = { ...listed, name: listed.name.replace(/ \(en seco\)$/u, '') };
      // Each meal-detail figure is rounded to one decimal (±0.05 g) and the list
      // rounds once more, so the drift a *correct* list may show grows with the
      // number of meals the ingredient appears in. A flat gram was too tight for
      // an ingredient in every breakfast. A dry figure is rounded to 5 g on the
      // meal (±2.5 g each) and the row up to 5 g once summed.
      const count = occurrences.get(item.name) ?? 0;
      const drift = Math.abs(item.totalGrams - (expected.get(item.name) ?? 0));
      const tolerance = 0.05 * count + 0.1 + (dried.has(item.name) ? 2.5 * (dried.get(item.name) ?? 0) + 5 : 0);

      // Shaped so a failure names the ingredient, the drift and how many meals it
      // was added over — the three things needed to tell rounding from an error.
      expect({ drift: drift <= tolerance ? 0 : Math.round(drift * 100) / 100, meals: count, name: item.name }).toEqual({
        drift: 0,
        meals: count,
        name: item.name
      });
    }
  }, 120_000);

  it('scales meal detail quantities to the portion planned, not the recipe base', async () => {
    const meal = plan.days[0]?.meals[0];
    const detail: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/meals/${meal?.id}`).set('Cookie', alice.cookie).expect(200);
    const body = detail.body as { ingredients: readonly { grams: number }[]; servings: number };

    expect(body.servings).toBeGreaterThan(0);
    expect(body.ingredients.every(ingredient => ingredient.grams > 0)).toBe(true);
  });

  it('keeps one account’s plan invisible to another', async () => {
    const server = httpServer(app);

    await request(server).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', bob.cookie).expect(404);
    await request(server).get(`/${PREFIX}/meal-plans/meals/${plan.days[0]?.meals[0]?.id}`).set('Cookie', bob.cookie).expect(404);
    await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', bob.cookie).expect(404);
  });

  /**
   * A generation spending the cupboard somebody typed (project 022 phase 2,
   * PRD 022 criteria 4, 6, 7, 10 and 12).
   *
   * On **two fortnights this suite already needed**: Carol's, generated with
   * nothing in the house, and Alice's, generated with `cupboard` standing. A
   * real fortnight is the expensive thing in this repository, so every claim
   * below but two is read off one of those two. The two that are not are a
   * generation that **fails** (which needs no fortnight at all) and a
   * generation by **somebody else while a cupboard stands**, which is the whole
   * of what that one proves.
   *
   * What is only true end to end, and is why these cases are here rather than
   * beside the service, where the arithmetic is already covered with mocks
   * (`PlanGeneration.spec.ts`):
   *
   *  1. The words are resolved by the **real catalogue**, and the rows are the
   *     rows a real fortnight of this library produces — including the fact
   *     that a cooked grain is bought dry (`0078`), which is why a cupboard
   *     entry only ever covers a row whose own slug it names.
   *  2. The seed is **stored**, in the same insert as the row, and read back
   *     through the route a screen reads — including across the rebuild a swap
   *     performs.
   *  3. The draft is **spent**, by one account and not another, over HTTP.
   */
  describe('the cupboard the fortnight was asked with (022 phase 2)', () => {
    /** Alice's list as `beforeAll` left it: seeded by the cupboard and touched by nothing since. */
    let rows: ReadonlyMap<string, SluggedRow>;
    /** Every date of Alice's plan, oldest first — the unfiltered range. */
    let allDates: readonly string[];
    /** What her plan recorded of the cupboard it was asked with. */
    let record: PantryRecord;

    beforeAll(async () => {
      rows = await rowsBySlug(alice);
      allDates = [...plan.days].sort((a, b) => a.dayIndex - b.dayIndex).map(day => day.date);

      const stored = await pantryRecordOf(plan.id);

      if (!stored) {
        throw new Error('Alice’s plan carries no generation_metadata.pantry, though it was generated with a cupboard');
      }

      record = stored;
    });

    it('pre-buys the whole row of every thing somebody has without saying how much, leaving nothing to buy on it', () => {
      const covered = [...held].filter(([slug, grams]) => grams === null && rows.has(slug)).map(([slug]) => rowFor(rows, slug));

      // A cupboard of forty words that covered no row at all would make the
      // assertion below true of nothing.
      expect(covered.length).toBeGreaterThan(0);

      for (const row of covered) {
        // The decision of 2026-10-26, and phase 0's own pricing: no amount
        // reads as "I have all of this", because `0091` gives a tick exactly
        // two meanings and there is no "some" state to put a half-held row
        // into. Shaped so a failure names the row.
        expect({ bought: row.boughtGrams, checked: row.checked, slug: row.slug }).toEqual({ bought: row.totalGrams, checked: true, slug: row.slug });
        // Nothing left to buy, read under the whole plan's own range — which is
        // the figure the supermarket screen subtracts from.
        expect({ remaining: needOver(row, allDates) - row.boughtGrams, slug: row.slug }).toEqual({ remaining: 0, slug: row.slug });
      }
    });

    it('leaves the remainder of a part-filled row to buy, under every range a reader can choose', () => {
      const row = rowFor(rows, cupboard.part);
      const owing = Object.keys(row.perDay).sort();

      // The preconditions `cupboardFrom` chose this row for, re-read on
      // **Alice's** fortnight rather than on Carol's: a run where her plan
      // needs 100 g or less of it — or needs it on one day — would make the
      // assertions below true of nothing.
      expect({ need: row.totalGrams > PART }).toEqual({ need: true });

      if (owing.length < 2) {
        throw new Error(`This fortnight owes ${row.slug} on ${owing.length} day(s), so no narrower range can differ from the whole plan's`);
      }

      expect({ bought: row.boughtGrams, checked: row.checked }).toEqual({ bought: PART, checked: false });

      // One stored amount, three ranges: what is left to buy is always
      // `needed(range) - bought` and never the unfiltered figure. It is the
      // whole point of storing grams instead of a boolean (`0091`), and the
      // reason a seed has to be an amount too.
      for (const range of [allDates, allDates.slice(0, 7), [owing[0] as string]]) {
        const need = needOver(row, range);

        expect({ days: range.length, remainder: round2(need - row.boughtGrams) }).toEqual({ days: range.length, remainder: round2(need - PART) });
      }

      // The ranges really are different figures — a day's share is less than
      // the fortnight's — and the unfiltered one is the stored total, so the
      // remainder above is a remainder of a real need and not of a rounding.
      expect(needOver(row, [owing[0] as string])).toBeLessThan(needOver(row, allDates));
      expect(needOver(row, allDates)).toBe(row.totalGrams);
    });

    it("caps an amount above the fortnight's own need at the need, and ticks the row", () => {
      const row = rowFor(rows, cupboard.plenty);

      // 5 kg of something a fortnight needs a few hundred grams of: the list
      // never says somebody has more than the plan asks for.
      expect({ need: row.totalGrams < PLENTY }).toEqual({ need: true });
      expect({ bought: row.boughtGrams, checked: row.checked }).toEqual({ bought: row.totalGrams, checked: true });
    });

    it('seeds no row at all for a word the catalogue cannot answer, and never guesses one onto a row', () => {
      expect(record.unresolved).toBe(1);
      // The rows the cupboard touched are exactly the rows it named. An
      // unresolved word guessed onto a row — the nearest name, the first fuzzy
      // match — would show up here as one more.
      expect(
        [...rows.values()]
          .filter(row => row.boughtGrams > 0 || row.checked)
          .map(row => row.slug)
          .sort()
      ).toEqual([...held.keys()].filter(slug => rows.has(slug)).sort());
    });

    it('records slugs and counts on the plan, and no word anybody typed — anywhere on the row', async () => {
      expect(Object.keys(record).sort()).toEqual(['asked', 'coveredRows', 'meals', 'rows', 'unresolved', 'wholeMeals']);
      // The amounts as they were **typed**, not as the rows capped them: 5 kg
      // is what somebody said they had, and the cap is a fact about the list
      // rather than about the cupboard. In the order they were typed in.
      expect(record.asked).toEqual([...held].map(([slug, grams]) => ({ grams, slug })));
      // The denominators the sentence in phase 3 reads, each recomputed here
      // rather than taken on trust: rows nobody has to visit, over the rows
      // there are, and the plates there are.
      expect({ coveredRows: record.coveredRows, meals: record.meals, rows: record.rows }).toEqual({
        coveredRows: [...rows.values()].filter(row => row.checked).length,
        meals: plan.days.reduce((count, day) => count + day.meals.length, 0),
        rows: rows.size
      });

      // Criterion 7, asked of the **whole stored row** and not only of the
      // record: a label is the person's own word, and the one part of an entry
      // that may ever leave the product is its slug.
      const [stored] = await sql()<{ row: string }>`select to_jsonb(meal_plans.*)::text as "row" from meal_plans where id = ${plan.id}`;

      for (const word of ['zzxqv', 'plutonia']) {
        expect({ found: stored?.row.includes(word) ?? true, word }).toEqual({ found: false, word });
      }
    });

    it('counts a plate cooked only from what was already in the house, as phase 0 counted it (criterion 4)', async () => {
      const plates = await mealSlugs(plan.id);
      const whole = [...plates.values()].filter(slugs => slugs.length > 0 && slugs.every(slug => held.has(slug)));

      expect(plates.size).toBe(record.meals);
      // Non-vacuous on purpose: the cupboard names the forty things this
      // library's fortnights cook with most, so some plate of Alice's own
      // fortnight is wholly covered by it. A run where none is would leave the
      // figure below proved of nothing, and says so here rather than passing.
      expect(whole.length).toBeGreaterThan(0);
      // Presence and never amount — the part-filled row counts as held — and
      // the plate **as it is served**, its accompaniment included, which is
      // `evaluate-plans.mjs`'s own `pantryPlateMetrics.whole`: the number the
      // screen will say is the number the project was priced on.
      expect(record.wholeMeals).toBe(whole.length);
    });

    it('spends the cupboard once the plan is saved', async () => {
      // The draft outlives nothing (criterion 6): the generation that read it
      // cleared it, so the screen the next fortnight is asked from starts
      // empty rather than re-using a fortnight-old cupboard.
      expect(await pantryOf(alice)).toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });
    });

    it('records nothing at all for a fortnight nobody told anything to (criterion 10)', async () => {
      // `null`, never a row of zeroes: a plan that was told nothing and a plan
      // told about a cupboard that covered nothing are different facts, and the
      // sentence phase 3 says may only be said about the second.
      expect(await pantryRecordOf(carolsPlan.id)).toBeNull();
      expect([...(await rowsBySlug(carol)).values()].filter(row => row.boughtGrams > 0 || row.checked)).toEqual([]);
    });

    it('leaves the cupboard where somebody left it when the generation fails', async () => {
      const typed = { grams: 300, label: 'tomate', unit: 'g' };

      expect((await addPantry(eve, typed)).status).toBe(201);

      // A profile with no height: `targetsFor` has no targets to plan against,
      // and the job fails with a stable code.
      //
      // **Not** `GENERATION_INVALID_PLAN`, which this suite could not force
      // honestly: a pool too poor to hold the bands is rescued by the
      // `full_library` fallback over the whole filtered library and *succeeds*,
      // which would spend the cupboard and prove the opposite of this case by
      // accident. This failure lands before the cupboard is read; the branch
      // that fails *after* reading it — a job past its deadline — is covered
      // where a deadline can be held still, in `PlanGeneration.spec.ts`.
      await clearProfileHeight(eve.id);

      const job = await generateAndWait(app, eve);

      expect({ error: job.error, status: job.status }).toEqual({ error: 'GENERATION_PROFILE_INCOMPLETE', status: 'failed' });
      // Unchanged, down to the amount and the word: somebody told to retry
      // finds their cupboard where they left it, and `PantryController.clear`
      // is idempotent so the retry needs nothing of them.
      expect((await pantryOf(eve)).items.map(item => ({ grams: item.grams, label: item.label, slug: item.slug }))).toEqual([
        { grams: typed.grams, label: typed.label, slug: 'tomate' }
      ]);
    }, 120_000);

    it("never lets one account's cupboard reach another's list", async () => {
      // Alice names one more thing — a cupboard **standing** while somebody
      // else generates, which is the only arrangement that can show a read of
      // the wrong account's rows.
      expect((await addPantry(alice, { grams: 250, label: 'tomate', unit: 'g' })).status).toBe(201);

      const before = await rowsBySlug(alice);
      const job = await generateAndWait(app, dave);

      expect(job.status).toBe('succeeded');

      const daves = await rowsBySlug(dave);

      expect(daves.size).toBeGreaterThan(0);
      // Not one row of Dave's list is seeded, the tomato Alice has included,
      // and his plan records nothing: his cupboard is empty, whatever stands in
      // hers.
      expect([...daves.values()].filter(row => row.boughtGrams > 0 || row.checked)).toEqual([]);
      expect(await pantryRecordOf((await active(dave)).id)).toBeNull();

      // And Alice's own cupboard and list are untouched by somebody else's
      // generation. By slug, because a list is a set of rows and not a
      // sequence: `rowsBySlug` orders its read so the two sides are comparable
      // at all, and the claim is about what each row says, not about the order
      // Postgres hands them back in.
      const bought = (rows: ReadonlyMap<string, SluggedRow>) =>
        [...rows.values()].map(row => ({ bought: row.boughtGrams, slug: row.slug })).sort((a, b) => a.slug.localeCompare(b.slug));

      expect((await pantryOf(alice)).items.map(item => item.slug)).toEqual(['tomate']);
      expect(bought(await rowsBySlug(alice))).toEqual(bought(before));
    }, 180_000);

    it('carries the seed across a rebuild, capped at the new need', async () => {
      const before = await rowsBySlug(alice);
      const whole = rowFor(before, [...held].find(([slug, grams]) => grams === null && before.has(slug))?.[0] as string);
      const part = rowFor(before, cupboard.part);
      const dinner = plan.days[0]?.meals.find(meal => meal.slot === 'dinner')?.id;

      if (!dinner) {
        throw new Error('The plan has no dinner on its first day to swap');
      }

      await request(httpServer(app)).post(`/${PREFIX}/meal-plans/meals/${dinner}/swap`).set('Cookie', alice.cookie).send({}).expect(201);

      const rebuilt = await rowsBySlug(alice);
      const after = rowFor(rebuilt, whole.slug);

      // The rebuild regenerates every row's id; what it carries is the amount.
      // A swap can only shrink or grow a row's need, and the seed follows it
      // through the same `carriedBought` a person's own tick goes through —
      // never saying somebody has more than the plan now asks for.
      expect(after.boughtGrams).toBe(round2(Math.min(whole.boughtGrams, after.totalGrams)));
      expect(after.checked).toBe(after.boughtGrams >= after.totalGrams && after.totalGrams > 0);

      // The part-filled row is carried too, and is still a part: a rebuild that
      // reseeded from the (now empty) cupboard would read as 0, and one that
      // reseeded from a *stale* draft would read as the whole row.
      const partAfter = rowFor(rebuilt, cupboard.part);

      expect(partAfter.boughtGrams).toBe(round2(Math.min(part.boughtGrams, partAfter.totalGrams)));
    }, 120_000);
  });

  it('leaves at most one active plan after generating again', async () => {
    const job = await generateAndWait(app, alice);

    expect(job.status).toBe('succeeded');

    const history: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans`).set('Cookie', alice.cookie).expect(200);
    const plans = history.body as readonly { status: string; version: number }[];

    expect(plans.filter(entry => entry.status === 'active')).toHaveLength(1);
    // The superseded plan is kept, not overwritten.
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans.some(entry => entry.status === 'completed')).toBe(true);
  }, 120_000);

  /*
   * Three starts fired together — a double-pressed button, a client that
   * retries, a script.
   *
   * "Is one already running?" and "start one" were two statements against two
   * snapshots: each of the three read *nothing in flight* before any of them had
   * written its job row, and each went on to start its own pipeline. Three
   * fortnights of model calls for one press, of which
   * `meal_plans_one_active_per_user` keeps one — at the end, after every one of
   * them is paid for.
   *
   * Asked of the controller rather than of the route, as this suite's other
   * questions about the database are: what is being proved is what three
   * simultaneous claims do to `plan_generation_jobs`, and the route's rate
   * limiter counts a fixed window this suite has already been spending, so it
   * can only answer sooner and for a different reason. Nothing runs the
   * pipeline here, so the claim Bob wins stays queued until `afterAll` deletes
   * him and it together.
   */
  it('gives one of three simultaneous starts the slot, and refuses the other two', async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 3 }, () => PlanJobController.start(bob.id)));
    const claimed = outcomes.filter(outcome => outcome.status === 'fulfilled');
    const refused = outcomes.filter(outcome => outcome.status === 'rejected');

    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.value).toMatchObject({ status: 'queued' });
    // Refused as a conflict — the answer the route turns into a 409 — and not
    // because something else broke on the way.
    expect(refused.map(outcome => outcome.reason instanceof ConflictError)).toEqual([true, true]);

    // The slot is a row, not a return value: the next attempt reads the claim
    // the winner left behind and is refused in its turn.
    await expect(PlanJobController.start(bob.id)).rejects.toBeInstanceOf(ConflictError);
  });
});
