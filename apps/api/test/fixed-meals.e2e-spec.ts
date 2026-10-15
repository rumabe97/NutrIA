import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { PLAN_TOLERANCE } from 'core/domain/PlanValidation';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { INestApplication } from '@nestjs/common';
import type { NotOfferedDishDto } from '../src/modules/fixed-meals/dto/out/index.js';
import type { PlanDayView, PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A meal fixed to one day of the week, for ever (`0098`, `0099`, `0101`).
 *
 * The assertions that matter are the ones no unit test can make: that the dish
 * the route offers is one the *database's* own pool holds, that the limit and
 * the one-rule-per-meal constraint refuse what they should at the HTTP
 * boundary, and that a plan generated afterwards really serves that dish on
 * that day.
 *
 * **The free tier's numbers are hard-coded here**, as `events-premium`
 * hard-codes premium's: a change to what a tier allows is a change to this file
 * too. Both of the screen's allowances are read here, because `GET /fixed-meals`
 * answers with both (`0011` § 4 a) — a free account may fix one meal and ask for
 * no dish at all, and it has to be told the second before it types a name.
 * `dish-request.e2e-spec.ts` is where asking for one is proved.
 *
 * The second half of the file is premium's, because a day holding two rules
 * needs two allowances and free has one. Both halves live here rather than in
 * two files — unlike `events` and `events-premium` — because the global
 * `premium` switch does not change what a **free** account is allowed:
 * `tierOf` reads the account's own tier once the flag is on, so the free cases
 * above stay true while the nested block below has it on. Nothing before that
 * block may depend on it being off.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const FIXED_MEALS_FREE = 1;
const FIXED_MEALS_PREMIUM = 3;
const DISH_REQUESTS_FREE = 0;
/** What a free account's dish requests always read: none, none left, not allowed. */
const NO_DISH_REQUESTS = { allowed: false, limit: DISH_REQUESTS_FREE, remaining: DISH_REQUESTS_FREE, used: 0 };

/**
 * The weekdays the premium block uses, each for one job: the day that comes to
 * hold two rules, a second day for the third rule, and one that never holds
 * anything — which is what makes the narrowed offer's cause attributable.
 */
const PAIRED = 2;
const SPARE = 5;
const UNTOUCHED = 6;

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Which of a day's four macros are outside their band, by name.
 *
 * Reads `PLAN_TOLERANCE` rather than restating 5%, which is `0101`'s own rule
 * for the gate and the same rule for the test that checks it: a second idea of
 * what "inside the band" means is how two places come to disagree. The
 * comparison is `outOfBand`'s — not exported, and three operators long.
 */
function bandMisses(day: PlanDayView): readonly string[] {
  const targets = day.targets;

  if (!targets) {
    return ['no targets'];
  }

  const off = (actual: number, target: number, tolerance: number): boolean => Math.abs(actual - target) > target * tolerance;
  // Protein is the one band with two tolerances (`PlanValidation`): over and
  // under are separate violations, so they are read separately here too.
  const protein =
    day.totals.proteinG > targets.proteinG * (1 + PLAN_TOLERANCE.proteinOver) ||
    day.totals.proteinG < targets.proteinG * (1 - PLAN_TOLERANCE.proteinUnder);

  return [
    off(day.totals.kcal, targets.kcal, PLAN_TOLERANCE.kcal) ? 'kcal' : '',
    off(day.totals.carbsG, targets.carbsG, PLAN_TOLERANCE.carbs) ? 'carbs' : '',
    off(day.totals.fatG, targets.fatG, PLAN_TOLERANCE.fat) ? 'fat' : '',
    protein ? 'protein' : ''
  ].filter(name => name !== '');
}

describe('fixed meals', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  const made: string[] = [];
  /** One stamp for the file, so the nested block's account is named like the rest. */
  const stamp = Date.now();

  const standing = async (who: Account): Promise<FixedMealsView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/fixed-meals`).set('Cookie', who.cookie).expect(200);

    return response.body as FixedMealsView;
  };

  const fixable = async (who: Account, weekday: number, slot: string): Promise<readonly { readonly name: string; readonly slug: string }[]> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/fixed-meals/fixable?weekday=${weekday}&slot=${slot}`)
      .set('Cookie', who.cookie)
      .expect(200);

    return response.body as readonly { readonly name: string; readonly slug: string }[];
  };

  /** `POST /fixed-meals`, without an expectation: every case below asserts its own status. */
  const fix = async (who: Account, weekday: number, slot: string, dishSlug: string | undefined): Promise<Response> =>
    request(httpServer(app)).post(`/${PREFIX}/fixed-meals`).set('Cookie', who.cookie).send({ dishSlug, slot, weekday });

  const notOffered = async (who: Account, weekday: number, slot: string, query: string): Promise<readonly NotOfferedDishDto[]> => {
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals/not-offered`)
      .set('Cookie', who.cookie)
      .send({ query, slot, weekday })
      .expect(200);

    return response.body as readonly NotOfferedDishDto[];
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    account = await register(app, `fixed-meal-${stamp}@e2e.invalid`);
    made.push(account.cookie);
    stranger = await register(app, `fixed-meal-other-${stamp}@e2e.invalid`);
    made.push(stranger.cookie);
    await completeOnboarding(app, account);
    await completeOnboarding(app, stranger);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  it('starts with no rules and the free tier’s allowances', async () => {
    expect(await standing(account)).toEqual({
      dishRequests: NO_DISH_REQUESTS,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_FREE, remaining: FIXED_MEALS_FREE, used: 0 }
    });
  });

  it('offers only dishes the pool really holds, and refuses one it does not', async () => {
    const offered = await fixable(account, 4, 'dinner');

    expect(offered.length).toBeGreaterThan(0);
    // A name, not a slug: the profile prints this at somebody.
    expect(offered[0]?.name).not.toBe(offered[0]?.slug);

    await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: 'no-existe-este-plato', slot: 'dinner', weekday: 4 })
      .expect(422);

    expect((await standing(account)).rules).toEqual([]);
  });

  it('fixes a meal, counts it, and refuses the next one on the free tier', async () => {
    const [dish] = await fixable(account, 4, 'dinner');
    const created: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: dish?.slug, slot: 'dinner', weekday: 4 })
      .expect(201);

    expect(created.body).toMatchObject({ dishName: dish?.name, dishSlug: dish?.slug, slot: 'dinner', weekday: 4 });

    const after = await standing(account);

    expect(after.standing).toEqual({ allowed: false, limit: FIXED_MEALS_FREE, remaining: 0, used: FIXED_MEALS_FREE });

    // The allowance, not the weekday: a different day, and still refused.
    const [other] = await fixable(account, 1, 'lunch');

    await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: other?.slug, slot: 'lunch', weekday: 1 })
      .expect(429);
  });

  it('is nobody else’s to see or to remove (0019)', async () => {
    const [rule] = (await standing(account)).rules;

    expect((await standing(stranger)).rules).toEqual([]);
    // The same answer as an id that never existed: a 404 must not say that
    // another account's rule is there.
    await request(httpServer(app)).delete(`/${PREFIX}/fixed-meals/${rule?.id}`).set('Cookie', stranger.cookie).expect(404);
    expect((await standing(account)).rules).toHaveLength(1);
  });

  it('serves the fixed dish on its day, in a plan generated afterwards', async () => {
    const [rule] = (await standing(account)).rules;
    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const fridays = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    // A fortnight holds two of any weekday, and the rule lands on both.
    expect(fridays.length).toBeGreaterThan(0);

    for (const day of fridays) {
      const dinner = day.meals.find(meal => meal.slot === 'dinner');

      expect({ day: day.date, name: dinner?.name }).toEqual({ day: day.date, name: rule?.dishName });
    }

    // And nowhere else: a pin is a rule for its own day, not a dish the plan now prefers.
    const elsewhere = plan.days.filter(day => weekdayOf(day.date) !== rule?.weekday);

    expect(elsewhere.every(day => day.meals.every(meal => meal.name !== rule?.dishName))).toBe(true);
  });

  it('serves it again next fortnight, when the rotation would have held it back (0098)', async () => {
    // The case the first generation cannot reach: `rotatePool` holds back
    // everything served last fortnight, and the pinned dish was served. Without
    // the pool carrying its pins the scheduler would refuse the rule for want of
    // the dish rather than for want of room — the rule doing nothing, silently,
    // from the second fortnight onwards.
    const [rule] = (await standing(account)).rules;
    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const its = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    expect(its.length).toBeGreaterThan(0);

    for (const day of its) {
      expect({ day: day.date, name: day.meals.find(meal => meal.slot === 'dinner')?.name }).toEqual({ day: day.date, name: rule?.dishName });
    }
  });

  it('removes the rule, and the plan already generated keeps the dish it was built with', async () => {
    const [rule] = (await standing(account)).rules;

    await request(httpServer(app)).delete(`/${PREFIX}/fixed-meals/${rule?.id}`).set('Cookie', account.cookie).expect(204);

    expect(await standing(account)).toEqual({
      dishRequests: NO_DISH_REQUESTS,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_FREE, remaining: FIXED_MEALS_FREE, used: 0 }
    });

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const fridays = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    expect(fridays.every(day => day.meals.find(meal => meal.slot === 'dinner')?.name === rule?.dishName)).toBe(true);
  });

  /**
   * A day may hold a rule for each meal, and the second is offered only the
   * dishes that leave that day inside its bands (`0101`).
   *
   * Premium's, because two rules need two allowances. **The switch is global**
   * and on for this block only — the free cases above run before it, and they
   * would hold anyway: with the flag on, `tierOf` reads the account's own tier.
   *
   * What is proved on real rows, in the order the tests run: a stranger's rule
   * on the same weekday narrows nothing, the dinner offer for a weekday narrows
   * once that weekday holds a lunch, three of the dishes the narrowed offer
   * still names are really fixed and one it dropped cannot be,
   * the same meal twice is a 409 while the same day's other meal is a 201, the
   * dropped dish's reason is `clashes_with_fixed` on the day that holds the
   * rule and no reason at all on a day that holds nothing, a plan generated
   * afterwards serves both rules on both of that weekday's days with those days
   * inside their bands, and the allowance counts rules per account rather than
   * per day.
   *
   * **The two generation claims are the ones `0101` measured rather than
   * proved**: the offer's gate is optimistic — it builds that one day alone,
   * with no variety pressure from the other thirteen — and the plan-level
   * backstop may drop the second pin of a day it cannot honour. `0101` bounds
   * that at 8 days in 1960. So a red here is a report, not a test to loosen:
   * `PlanController.fixedMealsOf` says what the plan was built with, and a day
   * whose pins were both recorded and only one served is the backstop firing.
   */
  describe('a day that holds two of them (0101)', () => {
    let rich: Account;
    /** The dinner offer for `PAIRED` before it held anything — what the narrowed one is read against. */
    let before: readonly { readonly name: string; readonly slug: string }[] = [];
    /** The same offer once a lunch stands on that day. */
    let narrowed: readonly { readonly name: string; readonly slug: string }[] = [];
    /** One dish the lunch cost that weekday: in `before`, not in `narrowed`. */
    let dropped: { readonly name: string; readonly slug: string } | undefined;

    beforeAll(async () => {
      rich = await register(app, `fixed-meal-pair-${stamp}@e2e.invalid`);
      made.push(rich.cookie);
      await completeOnboarding(app, rich);
      // Both halves, as `events-premium` does it: the account's tier and the
      // switch that makes any tier but free exist at all.
      await UserController.setTier(rich.id, 'premium', UNAUDITED);
      await SettingsController.setFlag('premium', true, UNAUDITED);
    });

    afterAll(async () => {
      // Off again whatever happened above: every other suite in the run reads
      // this row, and a file that leaves it on hands the next one a tier it
      // never asked for.
      await SettingsController.setFlag('premium', false, UNAUDITED);
    });

    it('offers premium’s three, and fewer dinners once that weekday holds a lunch', async () => {
      expect((await standing(rich)).standing).toEqual({
        allowed: true,
        limit: FIXED_MEALS_PREMIUM,
        remaining: FIXED_MEALS_PREMIUM,
        used: 0
      });

      before = await fixable(rich, PAIRED, 'dinner');

      expect(before.length).toBeGreaterThan(0);

      // Somebody else's rule on the same weekday is not mine (`0019`), and the
      // map the offer is narrowed against is a new way into that answer: it is
      // built from `FixedMealController.forPlan(userId)`, and a filter by
      // weekday that forgot the account would narrow this list here. The
      // stranger is free and has its one rule back by now.
      const [theirs] = await fixable(stranger, PAIRED, 'lunch');

      expect((await fix(stranger, PAIRED, 'lunch', theirs?.slug)).status).toBe(201);
      expect((await fixable(rich, PAIRED, 'dinner')).map(dish => dish.slug)).toEqual(before.map(dish => dish.slug));

      // The lunch first, and from the lunch offer: a day holding nothing is
      // the unnarrowed path, which is every rule before `0101`.
      const [lunch] = await fixable(rich, PAIRED, 'lunch');
      const created = await fix(rich, PAIRED, 'lunch', lunch?.slug);

      expect(created.status).toBe(201);

      narrowed = await fixable(rich, PAIRED, 'dinner');
      dropped = before.find(dish => !narrowed.some(kept => kept.slug === dish.slug));

      // The relation, never a count: on a three-meal shape only one meal is
      // left to balance the day with, so how much survives is a property of
      // this library and this profile and would be a flake as a number.
      expect({
        dropped: dropped !== undefined,
        narrows: narrowed.length < before.length,
        offers: narrowed.length > 0,
        subset: narrowed.every(dish => before.some(each => each.slug === dish.slug))
      }).toEqual({ dropped: true, narrows: true, offers: true, subset: true });
    });

    it('offers nothing it would then refuse, and refuses what it dropped', async () => {
      // The add-time gate and the offer are the same gate, which is only
      // checkable by spending the offer: each of these is fixed for real and
      // removed again, so the allowance is where it was at the end.
      for (const candidate of narrowed.slice(0, 3)) {
        const created = await fix(rich, PAIRED, 'dinner', candidate.slug);

        expect({ slug: candidate.slug, status: created.status }).toEqual({ slug: candidate.slug, status: 201 });

        await request(httpServer(app))
          .delete(`/${PREFIX}/fixed-meals/${(created.body as { id: string }).id}`)
          .set('Cookie', rich.cookie)
          .expect(204);
      }

      // And the inverse, which is the half that says the gate is real: a dish
      // the narrowing dropped is refused rather than quietly accepted, and 422
      // rather than 409 — the dish is what is wrong with it, not the meal.
      const refused = await fix(rich, PAIRED, 'dinner', dropped?.slug);
      const body = refused.body as { code: string; fieldErrors?: Record<string, readonly string[]> };

      // The field, not only the status: this route answers 422 for three other
      // things as well — a meal they do not eat, a profile that is not finished,
      // a body that is not one — and the one meant here is about the dish.
      expect({ code: body.code, fields: Object.keys(body.fieldErrors ?? {}), status: refused.status }).toEqual({
        code: 'INVALID_INPUT',
        fields: ['dishSlug'],
        status: 422
      });
      expect((await standing(rich)).rules).toHaveLength(1);
    });

    it('lets a day hold a second meal, and refuses the same meal twice (409)', async () => {
      // The same weekday *and* slot: the lunch offer is the unnarrowed one —
      // `held` never counts the slot being chosen, because replacing a rule is
      // removing it and writing another — so this passes the dish gate and is
      // refused by the meal.
      const [lunch] = await fixable(rich, PAIRED, 'lunch');
      const clash = await fix(rich, PAIRED, 'lunch', lunch?.slug);

      expect({ code: (clash.body as { code: string }).code, status: clash.status }).toEqual({ code: 'CONFLICT', status: 409 });
      // The sentence itself, and not a pattern: *every* wording this route has
      // ever had for this mentions a meal, including the one before `0101` that
      // was about the day. A day with one meal left is not full, and a sentence
      // about the day sends somebody to the wrong fix — so a rewording here is a
      // change to this file too, exactly as a tier's number is.
      expect((clash.body as { message: string }).message).toBe('That meal of that day is already fixed');

      // The same weekday, a different meal: 201, and the pair the rest of this
      // block is about.
      const [dinner] = narrowed;
      const second = await fix(rich, PAIRED, 'dinner', dinner?.slug);

      expect(second.status).toBe(201);
      expect((await standing(rich)).rules.filter(rule => rule.weekday === PAIRED).map(rule => rule.slot).sort()).toEqual(['dinner', 'lunch']);
    });

    it('says `clashes_with_fixed` for a dish the rule cost, and nothing for the same dish on a free day', async () => {
      // The whole name, cut to what the field takes: the answer keeps five
      // reasons and sorts them by name, so a short needle can push the one
      // being asked about off the end.
      const needle = (dropped?.name ?? '').slice(0, 120);
      const refused = (await notOffered(rich, PAIRED, 'dinner', needle)).find(dish => dish.slug === dropped?.slug);

      expect(refused).toEqual({ actionable: true, name: dropped?.name, slug: dropped?.slug, why: 'clashes_with_fixed' });

      // Not `too_big_or_small`, and this is what says so rather than the string:
      // the same dish on a weekday that holds nothing is offered, so nothing
      // about the dish or the plate is what refused it.
      expect((await notOffered(rich, UNTOUCHED, 'dinner', needle)).map(dish => dish.slug)).not.toContain(dropped?.slug);
      expect((await fixable(rich, UNTOUCHED, 'dinner')).map(dish => dish.slug)).toContain(dropped?.slug);
    });

    it('serves both rules of the day, on both of its days, inside their bands', async () => {
      const rules = (await standing(rich)).rules.filter(rule => rule.weekday === PAIRED);

      expect(rules).toHaveLength(2);

      const job = await generateAndWait(app, rich);

      expect(job.status).toBe('succeeded');

      const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', rich.cookie).expect(200);
      const plan = response.body as PlanView;
      const its = plan.days.filter(day => weekdayOf(day.date) === PAIRED);

      // A fortnight holds two of any weekday, and both rules land on both.
      expect(its.length).toBeGreaterThan(0);

      for (const day of its) {
        // Per slot rather than as a set of names: two names in the wrong two
        // meals would read as the same set, and "both rules served" has to mean
        // each on its own meal.
        expect({
          date: day.date,
          misses: bandMisses(day),
          served: rules.map(rule => ({ name: day.meals.find(meal => meal.slot === rule.slot)?.name, slot: rule.slot }))
        }).toEqual({ date: day.date, misses: [], served: rules.map(rule => ({ name: rule.dishName, slot: rule.slot })) });
      }
    });

    it('counts the allowance per account and not per day', async () => {
      expect((await standing(rich)).standing).toEqual({ allowed: true, limit: FIXED_MEALS_PREMIUM, remaining: 1, used: 2 });

      // The third goes to another weekday rather than to `PAIRED`'s last meal:
      // on a three-meal day already holding two, `0101` measured the third
      // offer collapsing to a handful or to nothing, and a case that branches
      // on whether a list is empty proves nothing either way.
      const [third] = await fixable(rich, SPARE, 'lunch');
      const spent = await fix(rich, SPARE, 'lunch', third?.slug);

      expect(spent.status).toBe(201);
      // Two on one day and one on another spend exactly what three on three
      // days would: the allowance is the account's.
      expect((await standing(rich)).standing).toEqual({ allowed: false, limit: FIXED_MEALS_PREMIUM, remaining: 0, used: FIXED_MEALS_PREMIUM });

      // The fourth, on a weekday that holds nothing and from that day's own
      // offer, so what refuses it is the allowance and not the dish.
      const [fourth] = await fixable(rich, UNTOUCHED, 'dinner');
      const refused = await fix(rich, UNTOUCHED, 'dinner', fourth?.slug);

      expect({ code: (refused.body as { code: string }).code, status: refused.status }).toEqual({ code: 'QUOTA_EXCEEDED', status: 429 });
      expect((await standing(rich)).rules).toHaveLength(FIXED_MEALS_PREMIUM);
    });
  });
});
