import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import {
  acceptAgreement,
  completeOnboarding,
  createApp,
  deleteAccounts,
  dish,
  generateAndWait,
  httpServer,
  openPractice,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account } from './harness.js';
import type { AddedEventDto } from '../src/modules/events/dto/out/index.js';
import type { CareLinkView } from 'core/controllers/Care';
import type { JobView, MealDetailView, MealView, PlanDayView, PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * What goes beside the plate (`0079`, project 016 phase 4): bread, a salad, a
 * piece of fruit, stored on the meal and counted in its energy.
 *
 * The contract the suite is written from: `MealView` and `MealDetailView` carry
 * `accompaniments`, empty when a meal has none **or the `accompaniments` flag
 * is off**; `meals.kcal` is the whole meal, dish and sides; the shopping list
 * includes the sides' ingredients; the sides of a meal carry at most 35% of its
 * energy.
 *
 * What is proved on real rows, with the flag thrown through the owner's route:
 * a generated plan has sides on some lunches and dinners and none on a
 * breakfast, and every meal's energy is its dish (priced from the catalogue,
 * independently of the sides) plus its sides; the list asks for the sides'
 * food; a swap, an event rebuild and a professional's review and publish each
 * leave every meal consistent in the same way; allergies and patterns hold on
 * the sides as on the dishes, with the model deliberately proposing the
 * allergen; and with the flag off nothing is beside any plate.
 *
 * The flag, the `premium` switch and the `professional` switch are global: all
 * three go back off in `afterAll`. Requires a real database and a seeded
 * catalogue — see ./README.md.
 */

/** Wheat breads and the pita: what a coeliac may never be handed, by the key of `ACCOMPANIMENTS`. */
const WHEAT_SIDES = new Set(['pan-blanco', 'pan-integral', 'pan-de-centeno', 'pan-de-masa-madre', 'pan-de-pita', 'tabule']);
/** Milk in a side: the yoghurts, the fresh cheeses. */
const DAIRY_SIDES = new Set(['yogur-natural-desnatado', 'yogur-griego-natural', 'queso-de-burgos', 'requeson']);
/** The sides `0077`'s exclusions reach: a foreign tradition's, by key. */
const FOREIGN_SIDES = new Set([
  'tortilla-de-maiz',
  'pan-de-pita',
  'hummus',
  'sopa-de-miso',
  'ensalada-de-pepino',
  'pak-choi-salteado',
  'frijoles',
  'pico-de-gallo',
  'tabule',
  'ensalada-marroqui',
  'arroz-rojo',
  'arroz-blanco'
]);
const DAIRY_WORDS = /yogur|queso|reques|leche|nata/i;
const WHEAT_WORDS = /\bpan\b(?! sin gluten)|trigo|bulgur|bulgu|pita/i;
const FOREIGN_WORDS = /soja|miso|s[eé]samo|pak.?choi|ma[ií]z|alubias negras|jalape|hummus|wakame|jengibre|pita|bulgur/i;

/** The most of a meal's energy its sides may carry (`ACCOMPANIMENT_MAX_SHARE`), written out here on purpose. */
const SIDES_MAX_SHARE = 0.35;

const GLUTEN_FREE_BREAKFASTS = [
  dish('Yogur con fruta', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish(
    'Yogur y huevo',
    ['breakfast'],
    [
      { grams: 150, slug: SEEDED.yogur },
      { grams: 100, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Huevo con tomate',
    ['breakfast'],
    [
      { grams: 120, slug: SEEDED.huevo },
      { grams: 120, slug: SEEDED.tomate }
    ]
  ),
  dish('Yogur solo', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }])
];

/** Breakfasts with no milk in them, so a milk allergy can still fill a fortnight. */
const MILK_FREE_BREAKFASTS = [
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish(
    'Huevo con tomate',
    ['breakfast'],
    [
      { grams: 120, slug: SEEDED.huevo },
      { grams: 120, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Tostada con huevo',
    ['breakfast'],
    [
      { grams: 60, slug: SEEDED.pan },
      { grams: 100, slug: SEEDED.huevo }
    ]
  ),
  dish('Avena sola', ['breakfast'], [{ grams: 80, slug: SEEDED.avena }])
];

type Side = {
  readonly grams: number;
  readonly ingredients: readonly { readonly dry?: { readonly grams: number; readonly name: string }; readonly grams: number; readonly name: string }[];
  readonly kcal: number;
  readonly key: string;
  readonly name: string;
};
type Sided<T> = T & { readonly accompaniments: readonly Side[] };
type SidedMeal = Sided<MealView>;
type SidedPlan = Omit<PlanView, 'days'> & { readonly days: readonly (Omit<PlanDayView, 'meals'> & { readonly meals: readonly SidedMeal[] })[] };
type ListItem = { readonly name: string; readonly totalGrams: number };

type Tables = <Row>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<Row[]>;

function tables(): Tables {
  return (database() as unknown as { readonly $client: Tables }).$client;
}

describe('accompaniments, end to end', () => {
  let app: INestApplication;
  let stamp: number;
  let owner: Account;
  let main: Account;
  let off: Account;
  let milk: Account;
  let coeliac: Account;
  let spanish: Account;
  let pro: Account;
  let client: Account;
  let linkId: string;
  let today: string;
  /** Every session this suite opened, so `afterAll` can delete each account it made. */
  const made: string[] = [];
  const sent: OutgoingEmail[] = [];

  const server = () => httpServer(app);

  const setFlag = async (name: string, enabled: boolean): Promise<void> => {
    await request(server()).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: name }).expect(200);
  };

  const account = async (name: string): Promise<Account> => {
    const created = await register(app, `sides-${name}-${stamp}@e2e.invalid`);

    made.push(created.cookie);

    return created;
  };

  const activePlan = async (who: Account): Promise<SidedPlan> => {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as SidedPlan;
  };

  const detailOf = async (who: Account, mealId: string): Promise<Sided<MealDetailView>> => {
    const response: Response = await request(server()).get(`/${PREFIX}/meal-plans/meals/${mealId}`).set('Cookie', who.cookie).expect(200);

    return response.body as Sided<MealDetailView>;
  };

  const listOf = async (who: Account): Promise<readonly ListItem[]> => {
    const response: Response = await request(server()).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', who.cookie).expect(200);

    return (response.body as { items: readonly ListItem[] }).items;
  };

  const mealsOf = (plan: SidedPlan): readonly SidedMeal[] => plan.days.flatMap(day => day.meals);
  const sidesOf = (plan: SidedPlan): readonly Side[] => mealsOf(plan).flatMap(meal => meal.accompaniments);
  const sidedMeals = (plan: SidedPlan): readonly SidedMeal[] => mealsOf(plan).filter(meal => meal.accompaniments.length > 0);
  const sideKcal = (meal: SidedMeal): number => meal.accompaniments.reduce((sum, side) => sum + side.kcal, 0);

  /** What each meal's dish alone carries, priced from the catalogue and the recipe: nothing the sides' code produced. */
  const dishKcalOf = async (planId: string): Promise<ReadonlyMap<string, number>> => {
    const rows = await tables()<{ id: string; dish: string }>`
      select m.id, coalesce(sum(ri.grams * m.servings / nullif(r.servings, 0) * i.kcal_per_100g / 100), 0)::text as dish
      from meals m
      join plan_days d on d.id = m.plan_day_id
      join recipes r on r.id = m.recipe_id
      join recipe_ingredients ri on ri.recipe_id = r.id
      join ingredients i on i.id = ri.ingredient_id
      where d.plan_id = ${planId}
      group by m.id`;

    return new Map(rows.map(row => [row.id, Number(row.dish)]));
  };

  /**
   * The rules every plan with sides keeps, whoever made it: the meal's energy is
   * its dish plus its sides, the sides carry at most 35% of it, a meal has at
   * most one side per place beside the plate, and a day's total is its meals'.
   * Shaped so a failure names the meal.
   */
  const expectConsistent = async (plan: SidedPlan): Promise<void> => {
    const dishes = await dishKcalOf(plan.id);
    const broken: string[] = [];

    for (const day of plan.days) {
      const total = day.meals.reduce((sum, meal) => sum + meal.kcal, 0);

      if (Math.abs(total - day.totals.kcal) > 3) {
        broken.push(`day ${day.date}: meals add to ${total}, the day says ${day.totals.kcal}`);
      }

      for (const meal of day.meals) {
        const dishKcal = dishes.get(meal.id) ?? Number.NaN;
        const sides = sideKcal(meal);

        if (Math.abs(meal.kcal - (dishKcal + sides)) > 4) {
          broken.push(`${meal.name} (${meal.slot}): kcal ${meal.kcal}, dish ${Math.round(dishKcal)} + sides ${sides}`);
        }

        if (sides > SIDES_MAX_SHARE * meal.kcal + 0.1) {
          broken.push(`${meal.name}: sides carry ${Math.round((sides / meal.kcal) * 100)}% of the meal`);
        }

        if (meal.slot === 'breakfast' && meal.accompaniments.length > 0) {
          broken.push(`${meal.name}: a breakfast with sides`);
        }

        if (new Set(meal.accompaniments.map(side => side.key)).size !== meal.accompaniments.length || meal.accompaniments.length > 3) {
          broken.push(`${meal.name}: sides ${meal.accompaniments.map(side => side.key).join(', ')}`);
        }

        for (const side of meal.accompaniments) {
          if (side.kcal <= 0 || side.grams <= 0 || side.ingredients.length === 0) {
            broken.push(`${meal.name}: side ${side.key} is empty`);
          }
        }
      }
    }

    expect(broken).toEqual([]);
  };

  /**
   * The stored rows of these meals, against what the view shows: only the current
   * dish's sides remain (every row carries the meal's current recipe, so none was
   * left by the dish it replaced), and no key is stored that the view does not
   * show — nor one fewer ingredient row than the view lists.
   */
  const expectStoredSidesAre = async (plan: SidedPlan, mealIds: readonly string[]): Promise<void> => {
    const meals = mealsOf(plan).filter(meal => mealIds.includes(meal.id));
    const broken: string[] = [];

    expect(meals.length).toBe(mealIds.length);

    for (const meal of meals) {
      const rows = await tables()<{ key: string; recipe: string }>`
        select accompaniment_key as key, recipe_id::text as recipe from meal_accompaniments where meal_id = ${meal.id}`;
      const shown = meal.accompaniments.flatMap(side => side.ingredients.map(() => side.key)).sort();

      if (rows.some(row => row.recipe !== meal.recipeId)) {
        broken.push(`${meal.name}: rows left by another dish`);
      }

      if (JSON.stringify(rows.map(row => row.key).sort()) !== JSON.stringify(shown)) {
        broken.push(`${meal.name}: stored ${rows.map(row => row.key).sort().join(',')}, shown ${shown.join(',')}`);
      }
    }

    expect(broken).toEqual([]);
  };

  /** Every ingredient name the meal detail says the list will call for: the dish's and the sides'. */
  const expectListCoversSides = async (who: Account, plan: SidedPlan): Promise<void> => {
    const list = await listOf(who);
    const byName = new Map(list.map(item => [item.name, item.totalGrams]));
    const sideTotals = new Map<string, number>();
    const dishNames = new Set<string>();

    for (const meal of mealsOf(plan)) {
      const detail = await detailOf(who, meal.id);

      for (const item of detail.ingredients) {
        dishNames.add(item.dry?.name ?? item.name);
      }

      for (const side of meal.accompaniments) {
        for (const item of side.ingredients) {
          const name = item.dry?.name ?? item.name;

          sideTotals.set(name, (sideTotals.get(name) ?? 0) + (item.dry?.grams ?? item.grams));
        }
      }
    }

    expect(sideTotals.size).toBeGreaterThan(0);

    for (const [name, grams] of sideTotals) {
      // At least what the sides ask for (the dishes may add to it), within the list's rounding of every line.
      expect({ listed: byName.has(name), name }).toEqual({ listed: true, name });
      expect(byName.get(name) ?? 0).toBeGreaterThanOrEqual(grams - 5);
    }

    // A line that came from the sides alone: nothing else in the plan asks for it, so only the sides can have put it there.
    expect([...sideTotals.keys()].filter(name => !dishNames.has(name)).length).toBeGreaterThan(0);

    // And the list asks for nothing the plan does not: dish or side.
    for (const item of list) {
      expect({ asked: dishNames.has(item.name) || sideTotals.has(item.name), name: item.name }).toEqual({ asked: true, name: item.name });
    }
  };

  /** The words of an allergy on a plan's sides: never a key, never an ingredient. */
  const sidesBreaking = (plan: SidedPlan, keys: ReadonlySet<string>, words: RegExp): readonly string[] =>
    sidesOf(plan).flatMap(side => [
      ...(keys.has(side.key) ? [`side ${side.key}`] : []),
      ...side.ingredients.filter(item => words.test(item.dry?.name ?? item.name)).map(item => `${side.key}: ${item.name}`)
    ]);

  // --- The professional's side ------------------------------------------------

  const clientPath = (rest = ''): string => `/${PREFIX}/care/clients/${linkId}${rest}`;

  const tokenMailedTo = async (to: string, after: number): Promise<string> => {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const mail = sent
        .slice(after)
        .filter(message => message.to === to.toLowerCase())
        .at(-1);
      const token = mail?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('No invitation mail arrived');
  };

  const pendingPlan = async (): Promise<SidedPlan> => {
    const response: Response = await request(server()).get(clientPath('/plan/pending')).set('Cookie', pro.cookie).expect(200);

    return response.body as SidedPlan;
  };

  beforeAll(async () => {
    stamp = Date.now();
    app = await createApp(new ScriptedAiClient([...POOL, ...GLUTEN_FREE_BREAKFASTS, ...MILK_FREE_BREAKFASTS]));
    today = new Date().toISOString().slice(0, 10);

    // Nothing is sent: the invitation mail is caught on the prototype, whichever instance a module was handed.
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return true;
    });

    owner = await account('owner');
    await UserController.grantAdmin(owner.email);
    // Whatever an earlier, interrupted run left behind.
    await setFlag('accompaniments', false);

    const allergens: Response = await request(server()).get(`/${PREFIX}/safety/allergens`).expect(200);
    const idOf = (key: string): string => (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === key)?.id ?? '';

    expect(idOf('gluten')).not.toBe('');
    expect(idOf('milk')).not.toBe('');

    off = await account('off');
    main = await account('main');
    milk = await account('milk');
    coeliac = await account('coeliac');
    spanish = await account('spanish');
    pro = await account('pro');
    client = await account('client');

    await completeOnboarding(app, off);
    await completeOnboarding(app, main);
    await completeOnboarding(app, milk, [idOf('milk')]);
    await completeOnboarding(app, coeliac, [idOf('gluten')], [], true);
    await completeOnboarding(app, spanish, [], [], false, ['traditional_spanish']);
    await completeOnboarding(app, client);
  }, 240_000);

  afterAll(async () => {
    try {
      // All three are global and every later suite assumes them off.
      await SettingsController.setFlag('accompaniments', false, UNAUDITED);
      await SettingsController.setFlag('premium', false, UNAUDITED);
      await SettingsController.setFlag('professional', false, UNAUDITED);

      for (const who of [main]) {
        if (who) {
          await UserController.setTier(who.id, 'free', UNAUDITED);
        }
      }

      await deleteAccounts(app, made);

      if (stamp) {
        const left = await tables()<{ id: string }>`select id from "user" where email like ${`sides-%-${stamp}@e2e.invalid`}`;

        if (left.length > 0) {
          throw new Error(`accompaniments left ${left.length} account(s) behind`);
        }
      }
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  // --- (g) The flag off -------------------------------------------------------

  it('with the flag off puts nothing beside any plate, in the plan or in a meal', async () => {
    expect((await generateAndWait(app, off, 180_000)).status).toBe('succeeded');

    const plan = await activePlan(off);

    expect(mealsOf(plan).length).toBeGreaterThan(0);

    for (const meal of mealsOf(plan)) {
      // Present and empty, not missing: the screen reads the field.
      expect(meal.accompaniments).toEqual([]);
    }

    for (const meal of mealsOf(plan).slice(0, 6)) {
      expect((await detailOf(off, meal.id)).accompaniments).toEqual([]);
    }

    // Off, a meal's energy is its dish's, to the bit of the sum: the plan the scheduler always made.
    await expectConsistent(plan);
  }, 240_000);

  // --- (a) Generation ---------------------------------------------------------

  describe('with the flag on', () => {
    let plan: SidedPlan;

    beforeAll(async () => {
      await setFlag('accompaniments', true);
      expect((await generateAndWait(app, main, 180_000)).status).toBe('succeeded');
      plan = await activePlan(main);
    }, 240_000);

    it('gives some lunches and dinners their sides, and no breakfast', () => {
      const sided = sidedMeals(plan);

      // A person whose main meals are over 700 kcal: if this fails the premise is gone, not the rule.
      expect(sided.length).toBeGreaterThan(0);
      expect(sided.every(meal => meal.slot === 'lunch' || meal.slot === 'dinner')).toBe(true);
      expect(mealsOf(plan).filter(meal => meal.slot === 'breakfast').flatMap(meal => meal.accompaniments)).toEqual([]);
    });

    it('counts the sides in the meal: its energy is the dish plus the sides, the sides at most 35% of it, and every day adds up', async () => {
      await expectConsistent(plan);
    });

    it('says the same in the plan and in the meal', async () => {
      for (const meal of sidedMeals(plan).slice(0, 8)) {
        const detail = await detailOf(main, meal.id);

        expect(detail.accompaniments).toEqual(meal.accompaniments);
      }
    });

    it('never hands a non-coeliac the gluten-free bread', () => {
      expect(sidesBreaking(plan, new Set(['pan-sin-gluten']), /sin gluten/i)).toEqual([]);
    });

    it('does not show one person another’s sides: a stranger asking for the meal gets a 404', async () => {
      const meal = sidedMeals(plan)[0];

      await request(server()).get(`/${PREFIX}/meal-plans/meals/${meal?.id ?? ''}`).set('Cookie', milk.cookie).expect(404);
    });

    // --- (b) The shopping list ------------------------------------------------

    it('puts the sides’ ingredients on the shopping list, and nothing the plan does not ask for', async () => {
      await expectListCoversSides(main, plan);
    }, 180_000);

    // --- (c) A swap -----------------------------------------------------------

    it('replaces a meal’s sides with its dish: consistent after each swap, the list rebuilt with them', async () => {
      const targets = [sidedMeals(plan).find(meal => meal.slot === 'lunch'), sidedMeals(plan).find(meal => meal.slot === 'dinner')].filter(
        (meal): meal is SidedMeal => meal !== undefined
      );

      expect(targets.length).toBeGreaterThan(0);

      for (const target of targets) {
        await request(server()).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', main.cookie).send({}).expect(201);

        const after = await activePlan(main);
        const replaced = mealsOf(after).find(meal => meal.id === target.id);

        expect(replaced?.name).not.toBe(target.name);
        expect(replaced?.slot).toBe(target.slot);
        // The meal's rows were replaced, not added to: the view holds only the new dish's sides.
        expect(replaced?.accompaniments.length ?? 0).toBeLessThanOrEqual(3);
        await expectConsistent(after);
        await expectStoredSidesAre(after, [target.id]);
        expect((await detailOf(main, target.id)).accompaniments).toEqual(replaced?.accompaniments);
        // Every other meal is exactly as it was.
        expect(mealsOf(after).filter(meal => meal.id !== target.id)).toEqual(mealsOf(plan).filter(meal => meal.id !== target.id).map(meal => meal));
        plan = after;
      }

      await expectListCoversSides(main, plan);
    }, 240_000);

    // --- (d) An event rebuild ----------------------------------------------------

    it('rebuilds the days before an event with their sides consistent, and leaves every other day as it was', async () => {
      await UserController.setTier(main.id, 'premium', UNAUDITED);
      await SettingsController.setFlag('premium', true, UNAUDITED);

      try {
        const before = plan;
        const on = addDays(today, 5);
        const response: Response = await request(server())
          .post(`/${PREFIX}/events`)
          .set('Cookie', main.cookie)
          .send({ carbs: 'up', daysBefore: 2, fat: 'down', name: 'Media maratón', on, protein: 'same' })
          .expect(201);
        const race = response.body as AddedEventDto;

        expect(race.rebuiltDates).toEqual([addDays(on, -2), addDays(on, -1)]);

        const after = await activePlan(main);
        const rebuilt = new Set(race.rebuiltDates);

        // A rebuilt day keeps its meals (the ids) and loses nothing: every one is still consistent, sides included.
        for (const date of rebuilt) {
          const ids = (candidate: SidedPlan) =>
            candidate.days
              .find(day => day.date === date)
              ?.meals.map(meal => meal.id)
              .sort();

          expect(ids(after)).toEqual(ids(before));
        }

        await expectConsistent(after);
        await expectStoredSidesAre(
          after,
          after.days.filter(day => rebuilt.has(day.date)).flatMap(day => day.meals.map(meal => meal.id))
        );
        expect(after.days.filter(day => !rebuilt.has(day.date))).toEqual(before.days.filter(day => !rebuilt.has(day.date)));
        // The days that eat for the event are bigger: sides or not, they are built to its targets, so some meal there is sided or fits without.
        expect(after.days.filter(day => rebuilt.has(day.date)).every(day => day.loadedFor === 'Media maratón')).toBe(true);
        await expectListCoversSides(main, after);
        plan = after;
      } finally {
        await SettingsController.setFlag('premium', false, UNAUDITED);
        await UserController.setTier(main.id, 'free', UNAUDITED);
      }
    }, 240_000);

    // --- (e) A professional's review ---------------------------------------------

    it('keeps the sides through a professional’s review: swap while waiting, publish, and the client lives the same plan', async () => {
      await setFlag('professional', true);
      await UserController.setTier(pro.id, 'free', UNAUDITED);
      await request(server())
        .post(`/${PREFIX}/admin/accounts/${pro.id}/professional`)
        .set('Cookie', owner.cookie)
        .send({ collegiateNumber: `28/${String(stamp).slice(-6)}` })
        .expect(201);
      await acceptAgreement(app, pro);
      await openPractice(pro.id);

      const before = sent.length;

      await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', pro.cookie).send({ email: client.email }).expect(201);

      const token = await tokenMailedTo(client.email, before);
      const accepted: Response = await request(server())
        .post(`/${PREFIX}/care/invitations/${token}/accept`)
        .set('Cookie', client.cookie)
        .send({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })
        .expect(200);

      linkId = (accepted.body as CareLinkView).id;

      const started: Response = await request(server()).post(clientPath('/plan/generate')).set('Cookie', pro.cookie).expect(201);
      const jobId = (started.body as JobView).id;
      const deadline = Date.now() + 120_000;
      let job: JobView | undefined;

      while (Date.now() < deadline && job?.status !== 'succeeded' && job?.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 250));
        job = (await request(server()).get(clientPath(`/plan/jobs/${jobId}`)).set('Cookie', pro.cookie).expect(200)).body as JobView;
      }

      expect(job?.status).toBe('succeeded');

      let waiting = await pendingPlan();

      expect(sidedMeals(waiting).length).toBeGreaterThan(0);
      await expectConsistent(waiting);

      // The professional swaps a sided meal: its sides follow the new dish.
      const target = sidedMeals(waiting)[0];

      await request(server()).post(clientPath(`/plan/meals/${target?.id ?? ''}/swap`)).set('Cookie', pro.cookie).send({}).expect(201);
      waiting = await pendingPlan();
      await expectConsistent(waiting);

      // The client sees none of it until it is published.
      expect((await request(server()).get(`/${PREFIX}/meal-plans/meals/${target?.id ?? ''}`).set('Cookie', client.cookie)).status).toBe(404);

      await request(server()).post(clientPath('/plan/publish')).set('Cookie', pro.cookie).expect(200);

      const lived = await activePlan(client);

      expect(lived.id).toBe(waiting.id);
      // Publishing moves the plan, it does not rewrite it: every meal keeps its sides, to the row.
      expect(mealsOf(lived).map(meal => [meal.id, meal.kcal, meal.accompaniments])).toEqual(
        mealsOf(waiting).map(meal => [meal.id, meal.kcal, meal.accompaniments])
      );
      await expectConsistent(lived);
      await expectListCoversSides(client, lived);
    }, 300_000);
  });

  // --- (f) Allergies and patterns ---------------------------------------------

  describe('with the flag on, for the people the sides could hurt', () => {
    it('never gives a milk-allergic person a yoghurt or a cheese, though the model proposes them and the table offers them', async () => {
      await setFlag('accompaniments', true);
      expect((await generateAndWait(app, milk, 180_000)).status).toBe('succeeded');

      const plan = await activePlan(milk);

      // Sides exist for them: an empty set would pass for the wrong reason.
      expect(sidedMeals(plan).length).toBeGreaterThan(0);
      expect(sidesBreaking(plan, DAIRY_SIDES, DAIRY_WORDS)).toEqual([]);
      await expectConsistent(plan);

      // Nor through a swap.
      const target = sidedMeals(plan)[0];

      await request(server()).post(`/${PREFIX}/meal-plans/meals/${target?.id ?? ''}/swap`).set('Cookie', milk.cookie).send({}).expect(201);

      const swapped = await activePlan(milk);

      expect(sidesBreaking(swapped, DAIRY_SIDES, DAIRY_WORDS)).toEqual([]);
      await expectConsistent(swapped);
    }, 300_000);

    it('gives a coeliac the gluten-free bread at most, never a wheat bread, a pita or a tabbouleh', async () => {
      expect((await generateAndWait(app, coeliac, 180_000)).status).toBe('succeeded');

      const plan = await activePlan(coeliac);

      expect(sidedMeals(plan).length).toBeGreaterThan(0);
      expect(sidesBreaking(plan, WHEAT_SIDES, WHEAT_WORDS)).toEqual([]);
      await expectConsistent(plan);

      const target = sidedMeals(plan)[0];

      await request(server()).post(`/${PREFIX}/meal-plans/meals/${target?.id ?? ''}/swap`).set('Cookie', coeliac.cookie).send({}).expect(201);
      expect(sidesBreaking(await activePlan(coeliac), WHEAT_SIDES, WHEAT_WORDS)).toEqual([]);
    }, 300_000);

    it('keeps traditional Spanish to a Spanish table: no foreign accompaniment, no excluded ingredient in one', async () => {
      expect((await generateAndWait(app, spanish, 180_000)).status).toBe('succeeded');

      const plan = await activePlan(spanish);

      expect(sidedMeals(plan).length).toBeGreaterThan(0);
      expect(sidesBreaking(plan, FOREIGN_SIDES, FOREIGN_WORDS)).toEqual([]);
      await expectConsistent(plan);
      await expectListCoversSides(spanish, plan);
    }, 300_000);
  });

  // --- (g) The flag off again --------------------------------------------------

  it('goes back to nothing beside any plate when the flag is turned off, on the views and on a new swap', async () => {
    await setFlag('accompaniments', false);

    const plan = await activePlan(main);

    for (const meal of mealsOf(plan)) {
      expect(meal.accompaniments).toEqual([]);
    }

    const target = mealsOf(plan).find(meal => meal.slot === 'lunch');

    await request(server()).post(`/${PREFIX}/meal-plans/meals/${target?.id ?? ''}/swap`).set('Cookie', main.cookie).send({}).expect(201);

    const swapped = (await activePlan(main)).days.flatMap(day => day.meals).find(meal => meal.id === target?.id);

    expect(swapped?.accompaniments).toEqual([]);

    // A swapped meal is the dish alone again: its energy is the dish's.
    const dishes = await dishKcalOf(plan.id);

    expect(Math.abs((swapped?.kcal ?? 0) - (dishes.get(target?.id ?? '') ?? Number.NaN))).toBeLessThanOrEqual(4);
  }, 120_000);
});
