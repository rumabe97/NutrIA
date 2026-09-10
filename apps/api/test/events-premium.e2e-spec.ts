import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';
import { loadedTargets } from 'core/domain/Event';
import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import {
  activeShoppingList,
  completeOnboarding,
  createApp,
  dish,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { AddedEventDto } from '../src/modules/events/dto/out/index.js';
import type { AllowancesView, PlanDayView, PlanView } from 'core/controllers/Plan';
import type { EventView } from 'core/controllers/Event';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The paid half of events: the fortnight under way is rebuilt for a new one
 * (`0044`).
 *
 * Its own suite rather than a second half of `events.e2e-spec.ts`, because the
 * `premium` switch is global and stays on for the whole of this file, and
 * every account here needs a plan nobody has loaded yet — the free suite's
 * plan already eats for a race, and one file would have to reason about which
 * events were declared under which tier.
 *
 * What is proved on real rows: the loaded days after today are rebuilt without
 * a model call and the answer says which, every other day is exactly as it
 * was, the meal rows keep their ids, the shopping list still reconciles, the
 * allowance spent is the mid-plan one and only that, today is never touched,
 * the fourth mid-plan event is accepted and rebuilds nothing, removing the
 * event leaves the days as they are, and a declared allergen never reaches a
 * rebuilt day.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */

/**
 * Breakfasts a gluten allergy allows. `POOL`'s five all carry bread or oats,
 * which is what makes the safety case below a case: the library the rebuild
 * draws from holds them, built into the athlete's fortnight in this same suite.
 */
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

/** The premium numbers, as `0044` decided them. Written out so a change to the domain is a change to this file too. */
const EVENTS_PER_PLAN = 10;
const MID_PLAN_EVENTS_PER_PLAN = 3;

describe('events on premium', () => {
  let app: INestApplication;
  let ai: ScriptedAiClient;
  let athlete: Account;
  let celiac: Account;
  let today: string;
  /** The athlete's fortnight as generated, before anything ate for anything. */
  let before: PlanView;
  /** The same fortnight after the first rebuild, and the event it was rebuilt for. */
  let after: PlanView;
  let race: AddedEventDto;

  /** The shape the person chooses; the same one the free suite proves at generation, so the bounds are known to accept it. */
  const shape = { carbs: 'up', daysBefore: 2, fat: 'down', protein: 'same' } as const;

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  const allowances = async (who: Account): Promise<AllowancesView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', who.cookie).expect(200);

    return response.body as AllowancesView;
  };

  const declare = (who: Account, event: Record<string, unknown>) =>
    request(httpServer(app)).post(`/${PREFIX}/events`).set('Cookie', who.cookie).send(event);

  const dayOn = (plan: PlanView, date: string): PlanDayView => {
    const day = plan.days.find(candidate => candidate.date === date);

    if (!day) {
      throw new Error(`the plan has no day on ${date}`);
    }

    return day;
  };

  beforeAll(async () => {
    ai = new ScriptedAiClient([...POOL, ...GLUTEN_FREE_BREAKFASTS]);
    app = await createApp(ai);

    const stamp = Date.now();
    const allergens: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);
    const glutenId = (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'gluten')?.id ?? '';

    expect(glutenId).not.toBe('');

    athlete = await register(app, `premium-event-${stamp}@e2e.invalid`);
    celiac = await register(app, `premium-celiac-${stamp}@e2e.invalid`);
    await completeOnboarding(app, athlete);
    // Trace-sensitive, so oats count too: the library's breakfasts carry bread
    // and oats, and the premise of the safety case is that neither may be served.
    await completeOnboarding(app, celiac, [glutenId], [], true);
    today = new Date().toISOString().slice(0, 10);

    expect((await generateAndWait(app, athlete)).status).toBe('succeeded');
    expect((await generateAndWait(app, celiac)).status).toBe('succeeded');
    before = await activePlan(athlete);

    // Granted, and the switch thrown: the flag outranks the column (`0042`),
    // so both are needed for the tier to read premium.
    await UserController.setTier(athlete.id, 'premium');
    await UserController.setTier(celiac.id, 'premium');
    await SettingsController.setFlag('premium', true);
  }, 240_000);

  afterAll(async () => {
    // The switch is global and every later suite assumes the free tier, so it
    // goes back off whatever happened above — and the grants with it.
    await SettingsController.setFlag('premium', false);

    for (const account of [athlete, celiac]) {
      if (account) {
        await UserController.setTier(account.id, 'free');
      }
    }

    await app?.close();
  });

  it('says a premium fortnight may hold ten events and rebuild three of them', async () => {
    const standing = await allowances(athlete);

    expect(standing.tier).toBe('premium');
    // Exactly the tier's numbers (`0044`), and `midPlan` present rather than
    // null: the screen shows the control because this is here.
    expect(standing.events).toEqual({
      limit: EVENTS_PER_PLAN,
      midPlan: { limit: MID_PLAN_EVENTS_PER_PLAN, remaining: MID_PLAN_EVENTS_PER_PLAN },
      remaining: EVENTS_PER_PLAN
    });
  });

  it('rebuilds the days before the event on the spot, from the library, and says which', async () => {
    const on = addDays(today, 5);
    const calls = ai.calls;
    const response: Response = await declare(athlete, { ...shape, name: 'Media maratón', on }).expect(201);

    race = response.body as AddedEventDto;

    // Both loaded days are after today, so both are rebuilt — and listed.
    expect(race).toMatchObject({
      ...shape,
      loadedDates: [addDays(on, -2), addDays(on, -1)],
      loading: false,
      name: 'Media maratón',
      on,
      rebuiltDates: [addDays(on, -2), addDays(on, -1)]
    });
    // No model call, by construction: the pool is the library. A rebuild that
    // spent a generation would be a bug on a product whose binding constraint
    // is the provider's free tier (`0044`).
    expect(ai.calls).toBe(calls);

    after = await activePlan(athlete);

    const { strategy } = after;

    if (!strategy) {
      throw new Error('a generated plan carries its strategy');
    }

    for (const date of race.rebuiltDates) {
      const day = dayOn(after, date);

      expect(day.loadedFor).toBe('Media maratón');
      // The plan's own strategy moved by the domain's step — not the profile's
      // current targets, which may have moved since the plan was made.
      expect(day.targets).toEqual(loadedTargets(strategy, shape));
      // Rebuilt, not emptied: every slot the day had is still there.
      expect(day.meals.map(meal => meal.slot).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    }
  });

  it('leaves every other day exactly as it was', () => {
    const rebuilt = new Set(race.rebuiltDates);

    // Not merely "still built to the plan's targets": the same meals, the same
    // ids, the same totals. A rebuild that reshuffled the neighbours would be a
    // regeneration wearing a smaller name.
    expect(after.days.filter(day => !rebuilt.has(day.date))).toEqual(before.days.filter(day => !rebuilt.has(day.date)));
  });

  it('keeps the meal rows of the rebuilt days, so a swap on them is not refunded', () => {
    // `meal_swaps.meal_id` cascades on delete: a meal thrown away and inserted
    // again takes the record of its swap with it, and the allowance with that.
    // The rows are updated in place, and the ids say so (`0044`).
    for (const date of race.rebuiltDates) {
      const ids = (plan: PlanView) =>
        dayOn(plan, date)
          .meals.map(meal => meal.id)
          .sort();

      expect(ids(after)).toEqual(ids(before));
    }
  });

  it('rebuilds the shopping list from the whole plan, and it still reconciles', async () => {
    const server = httpServer(app);
    const listed: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', athlete.cookie).expect(200);
    const list = listed.body as { items: readonly { name: string; totalGrams: number }[] };

    // Sum the scaled ingredients of every meal — kept and rebuilt alike — from
    // the API's own meal-detail responses, and require the list to match. The
    // list is rebuilt from the whole plan because quantities add across meals
    // (`0015`): a list patched for two days would drift on everything shared.
    const expected = new Map<string, number>();
    const occurrences = new Map<string, number>();

    for (const day of after.days) {
      for (const meal of day.meals) {
        const detail: Response = await request(server).get(`/${PREFIX}/meal-plans/meals/${meal.id}`).set('Cookie', athlete.cookie).expect(200);

        for (const item of (detail.body as { ingredients: readonly { grams: number; name: string }[] }).ingredients) {
          expected.set(item.name, (expected.get(item.name) ?? 0) + item.grams);
          occurrences.set(item.name, (occurrences.get(item.name) ?? 0) + 1);
        }
      }
    }

    expect(list.items).toHaveLength(expected.size);

    for (const item of list.items) {
      // The same tolerance as generation's reconciliation: each rounded figure
      // may drift ±0.05 g, so a correct list drifts with the number of meals.
      const count = occurrences.get(item.name) ?? 0;
      const drift = Math.abs(item.totalGrams - (expected.get(item.name) ?? 0));
      const tolerance = 0.05 * count + 0.1;

      expect({ drift: drift <= tolerance ? 0 : Math.round(drift * 100) / 100, meals: count, name: item.name }).toEqual({
        drift: 0,
        meals: count,
        name: item.name
      });
    }
  }, 180_000);

  it('spends one mid-plan event and nothing else', async () => {
    const standing = await allowances(athlete);

    expect(standing.events).toEqual({
      limit: EVENTS_PER_PLAN,
      midPlan: { limit: MID_PLAN_EVENTS_PER_PLAN, remaining: MID_PLAN_EVENTS_PER_PLAN - 1 },
      remaining: EVENTS_PER_PLAN - 1
    });
    // Its own counter: a rebuild is neither a swap nor a redo (`0044`).
    expect(standing.mealSwaps).toMatchObject({ used: 0 });
    expect(standing.planRedo).toMatchObject({ used: 0 });
  });

  it('leaves today alone when the load includes it, and says which day it did reach', async () => {
    const on = addDays(today, 2);
    const response: Response = await declare(athlete, { ...shape, name: 'Partido', on }).expect(201);

    // The load begins today, and today may already be eaten: the past is
    // read-only (`0021`). What can be applied is, and the answer says which.
    expect(response.body as AddedEventDto).toMatchObject({
      loadedDates: [today, addDays(today, 1)],
      loading: true,
      rebuiltDates: [addDays(today, 1)]
    });

    const plan = await activePlan(athlete);

    expect(dayOn(plan, today)).toEqual(dayOn(before, today));
    expect(dayOn(plan, addDays(today, 1)).loadedFor).toBe('Partido');
  });

  it('leaves the rebuilt days as they are when the event is removed', async () => {
    const server = httpServer(app);

    await request(server).delete(`/${PREFIX}/events/${race.id}`).set('Cookie', athlete.cookie).expect(204);

    const listed: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', athlete.cookie).expect(200);

    expect((listed.body as EventView[]).map(event => event.id)).not.toContain(race.id);

    // What was there is gone, and the day says what it ate for: the event may
    // go, the plan is history (`0043`, `0044`). Un-rebuilding could only put
    // *something* there, not what was there.
    const plan = await activePlan(athlete);

    for (const date of race.rebuiltDates) {
      expect(dayOn(plan, date)).toEqual(dayOn(after, date));
    }
  });

  it('spends the third mid-plan event, and removing an event refunded none of them', async () => {
    const on = addDays(today, 7);
    const response: Response = await declare(athlete, { ...shape, daysBefore: 1, name: 'Tirada larga', on }).expect(201);

    expect((response.body as AddedEventDto).rebuiltDates).toEqual([addDays(on, -1)]);

    // Two events stand — the race was removed — and three rebuilds are spent:
    // the counter is a column on the plan, not a count of its events, so
    // deleting one hands nothing back (`0044`).
    expect((await allowances(athlete)).events).toEqual({
      limit: EVENTS_PER_PLAN,
      midPlan: { limit: MID_PLAN_EVENTS_PER_PLAN, remaining: 0 },
      remaining: EVENTS_PER_PLAN - 2
    });
  });

  it('accepts a fourth mid-plan event and rebuilds nothing, which is the free tier’s answer', async () => {
    const on = addDays(today, 9);
    const untouched = dayOn(await activePlan(athlete), addDays(on, -1));
    const response: Response = await declare(athlete, { ...shape, daysBefore: 1, name: 'Series', on }).expect(201);

    // Not a 429: the fortnight may still hold the event (three of ten stand),
    // and the event applies at the next generation. Every "no" of the rebuild
    // is the same "no" — an empty list — and the day is as it was (`0044`).
    expect((response.body as AddedEventDto).rebuiltDates).toEqual([]);
    expect(dayOn(await activePlan(athlete), addDays(on, -1))).toEqual(untouched);
    expect((await allowances(athlete)).events).toEqual({
      limit: EVENTS_PER_PLAN,
      midPlan: { limit: MID_PLAN_EVENTS_PER_PLAN, remaining: 0 },
      remaining: EVENTS_PER_PLAN - 3
    });
  });

  it('never lets a declared allergen into a rebuilt day, or onto the list', async () => {
    const on = addDays(today, 4);
    const response: Response = await declare(celiac, { ...shape, name: 'Carrera', on }).expect(201);
    const event = response.body as AddedEventDto;

    // Rebuilt from the library — the shelf that holds the athlete's bread-and-
    // oats breakfasts, built from it a minute ago in this same suite. A rebuild
    // that read the shelf without the gate would serve them.
    expect(event.rebuiltDates).toEqual([addDays(on, -2), addDays(on, -1)]);

    const forbidden = ['Pan integral', 'Copos de avena'];
    const plan = await activePlan(celiac);

    for (const date of event.rebuiltDates) {
      const day = dayOn(plan, date);

      expect(day.loadedFor).toBe('Carrera');

      for (const meal of day.meals) {
        for (const ingredient of meal.ingredients) {
          // Shaped so a failure names the ingredient, the day and the slot.
          expect({ date, ingredient: ingredient.name, slot: meal.slot, unsafe: forbidden.includes(ingredient.name) }).toEqual({
            date,
            ingredient: ingredient.name,
            slot: meal.slot,
            unsafe: false
          });
        }
      }
    }

    // A safe plan whose list still names the allergen would send someone to
    // buy the thing that can hurt them.
    const names = (await activeShoppingList(app, celiac)).items.map(item => item.name);

    for (const name of forbidden) {
      expect(names).not.toContain(name);
    }
  });

  it('neither rebuilds nor spends for a load outside the fortnight under way', async () => {
    const response: Response = await declare(celiac, { ...shape, daysBefore: 1, name: 'Dentro de tres semanas', on: addDays(today, 20) }).expect(201);

    expect((response.body as AddedEventDto).rebuiltDates).toEqual([]);
    // Counted against the fortnight it lands in, tiled forward from this one,
    // and this one's rebuild allowance untouched: two left, as after the race.
    expect((await allowances(celiac)).events).toEqual({
      limit: EVENTS_PER_PLAN,
      midPlan: { limit: MID_PLAN_EVENTS_PER_PLAN, remaining: MID_PLAN_EVENTS_PER_PLAN - 1 },
      remaining: EVENTS_PER_PLAN - 1
    });
  });
});
