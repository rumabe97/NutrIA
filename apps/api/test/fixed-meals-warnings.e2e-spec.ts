import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { MAX_FIXED_MEALS_PER_DAY } from 'core/entities/FixedMeal';
import { PLATE_LIMIT, SERVING_BOUNDS } from 'core/domain/Scheduler';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import {
  bandMisses,
  clearProfileHeight,
  completeOnboarding,
  copyDishDeclaring,
  copyDishScaled,
  createApp,
  deleteAccounts,
  forgetRecipes,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  scriptedName
} from './harness.js';

import type { Account } from './harness.js';
import type { FixedMealConsequenceDto, FixedMealHonourabilityDto, NotOfferedDishDto } from '../src/modules/fixed-meals/dto/out/index.js';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { INestApplication } from '@nestjs/common';
import type { KitchenView } from 'core/controllers/Kitchen';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A day's arithmetic is a warning somebody may accept (`0103`), a weekday holds
 * at most two rules, and a rule the next plan cannot honour says so (project
 * 021 phase 5b, `0102`).
 *
 * One file for two phases because they are one screen: the rules list says
 * which standing rules are in trouble, and the picker beside it says what a new
 * one would cost. `fixed-meals.e2e-spec.ts` keeps what `0098`, `0099` and
 * `0101` already claimed — the allowances, the pair a day can close, the plan
 * serving it — and this file owns what neither phase had an end-to-end test
 * for.
 *
 * What is proved on real rows, and what no unit test can say:
 *
 * 1. **The dish that clashes is offered.** `GET /fixed-meals/fixable` lists a
 *    dish the day cannot hold beside the rule it already has, which is the
 *    whole of `0103` — before it, the offer paid 4.05 s to hide exactly that
 *    dish. `POST /fixed-meals/consequence` is what puts the sentence on it:
 *    `{ acceptable: true, fixable: false, why: 'clashes_with_fixed' }`.
 * 2. **`add` refuses the warning nobody accepted and takes it once they do**:
 *    409 `FIXED_MEAL_WARNING` with the reason on the wire, then 201 for the same
 *    body carrying `accept: ['clashes_with_fixed']`.
 * 3. **The meal is then actually served**, which is the owner's own requirement
 *    (*«aunque no se cumplan las macros, el plan se tiene que generar con esas
 *    comidas»*) and the one claim a unit test cannot make: the fortnight is
 *    generated, both rules of that weekday are on both of its days, and those
 *    days are **outside** their bands — which is the trade, and the only thing
 *    that tells a real warning from a spurious one.
 * 4. **`too_big_or_small` cannot be accepted**, although it is arithmetic too:
 *    it is `fitsPlate`, one of `honouredPin`'s three hard bounds, so accepting
 *    it would take somebody's yes and then drop the pin at generation. 422 with
 *    its own reason in `fieldErrors.dishSlug`, whatever `accept` names.
 * 5. **A weekday holds at most `MAX_FIXED_MEALS_PER_DAY`**: the offer and the
 *    explanation are empty for a full day, `consequence` and `add` are 409
 *    `FIXED_MEAL_DAY_FULL` with the number, `accept` reaches nothing past it,
 *    and the other weekdays are untouched.
 * 6. **A rule the next plan cannot honour is named**, with a cause reached
 *    without a model: a dish declaring an oven, then a kitchen that says it has
 *    none. `missing_equipment`, actionable, on that rule's own id — and
 *    **absent from another account's answer** (`0019`).
 * 7. **`judged: false` is not a 500.** An account whose targets the equations
 *    can no longer compute gets both lists empty and a 200, rather than an error
 *    page over the footnote beside its rules.
 *
 * **It deliberately does not bring `PAIRABLE`.** `fixed-meals.e2e-spec.ts` adds
 * four oil-bearing dishes because the one claim it keeps needs a day the
 * scheduler can close inside all four bands. This file needs the opposite: a day
 * that **cannot** close, which is every day of the shared `POOL` (README § *The
 * shared pool cannot reach the macro bands* — 0 of 14 days in band on a database
 * built the way CI builds it). The warning is therefore reachable on either
 * database, and the search below is bounded rather than hopeful.
 *
 * **`POOL` declares no `equipment` and must keep declaring none**, so the oven
 * dish is a **copy of a library dish** with the one field added
 * (`copyDishDeclaring`), as `kitchen.e2e-spec.ts` does and for the reason given
 * there: a scripted dish is the right instrument for a gate on what the model
 * returns and the wrong one for a filter on what the library may reuse, which
 * needs a row. The oversized dish is a copy for the same reason
 * (`copyDishScaled`), and because a database built the way CI builds it holds
 * the ~90 rows the suites wrote, nearly all of them `POOL` dishes tuned to fit
 * their plates — picking an oversized one out of the library passes here and
 * finds nothing there.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */

/** The free tier's one rule and premium's three (`0099`), hard-coded as `fixed-meals.e2e-spec.ts` hard-codes them. */
const FIXED_MEALS_PREMIUM = 3;

/**
 * The weekdays, each for one job: the day that comes to hold the accepted pair
 * and then its two, a second day for the third rule, one that never holds
 * anything — so a refusal there is attributable to the dish — and the day the
 * unhonourable rule stands on. 0 is Monday, as `weekdayOf` counts.
 */
const ACCEPTED = 2;
const SPARE = 5;
const UNTOUCHED = 6;
const RULED = 3;

/**
 * How wide the search for a clashing dinner is allowed to be.
 *
 * Bounded because `POST /fixed-meals/consequence` allows sixty an hour — one
 * assembly of this person's library each — and a real library has hundreds of
 * dinners, every one of them its own shape. On the shared pool no day is ever
 * inside its bands, so the first lunch and the first dinner answer; on the
 * local library of a thousand recipes more of them close, which is what the
 * second number is for. Running out fails with the counts rather than with a
 * 429.
 */
const LUNCHES_TRIED = 3;
const DINNERS_ASKED = 8;

/**
 * How many times its own size a copy of an **offered** dish has to be before no
 * plate of any meal can hold it — computed from the domain's own bounds rather
 * than chosen, because a number chosen is a number that works on one library.
 *
 * **This is the lesson of a red CI run** (2026-10-17, PR #292, which read this
 * assertion back with the copy sitting in the offer). The first version scaled
 * by a constant 4, and `fitsPlate` does not compare a dish with a plate — it
 * asks whether the dish can be **sized** onto one, over `SERVING_BOUNDS`
 * (0.5–4 servings) and inside `PLATE_LIMIT` (0.5–1.5 of the slot's energy). So
 * four times a dish out of a 1,148-recipe library bursts every bound, and four
 * times a small fixture breakfast is simply served at half a serving — the
 * sizer undoes the fixture. It passed here and on a CI-shaped database because
 * the dish the offer happened to list first was big enough both times, which is
 * the same accident as the `[0]` lunch this README records from 2026-10-15.
 *
 * The bound that holds for **any** offered dish: being offered means some
 * serving count in `SERVING_BOUNDS` puts it inside `PLATE_LIMIT`, so its
 * one-serving share is at worst `PLATE_LIMIT.min / SERVING_BOUNDS.max` — a
 * dish the sizer had to quadruple to reach half a plate. The copy is refused
 * only when even the **smallest** plate the sizer can make of it,
 * `SERVING_BOUNDS.min`, still passes `PLATE_LIMIT.max`. One more than that
 * ratio is the first whole factor that cannot be argued with, and the grams and
 * capped-food ceilings (`0078`, `PLATE_FOOD_MAX`) can only refuse it sooner.
 *
 * It is still a fixture rather than a proof, which is why the test leads with
 * `consequence` and asserts the reason: a copy that failed to be oversized says
 * so in one line instead of passing on a slug's absence from a list.
 */
const OVERSIZED = 2 * (Math.ceil((PLATE_LIMIT.max * SERVING_BOUNDS.max) / (SERVING_BOUNDS.min * PLATE_LIMIT.min)) + 1);

/**
 * How far **down** the dish is scaled first, to stand in for the smallest dish
 * an offer may hold.
 *
 * `OVERSIZED` is derived and correct, and deriving it is not the same as having
 * tested it: the database this suite was first proved on hands the offer a dish
 * big enough that even the constant 4 it started with was refused, so a run
 * here had no power over the case CI failed on — a **small** dish, where the
 * sizer undoes the scaling by serving half a portion. Measured on 2026-10-17:
 * the CI-shaped database built here passes at a factor of 4, and CI does not.
 *
 * So the small dish is made rather than hoped for — and **how** small is asked
 * of the library rather than guessed, which is the same mistake one level down.
 * A quarter of an offered dinner is already past the bottom of `PLATE_LIMIT` on
 * a fixture library and refused as too *small* (measured here, 2026-10-17), so
 * the divisors are tried in turn and the first copy the offer still lists is
 * the one used: the smallest fair starting point this library can give. The
 * oversized copy is made from **that**, so the assertion is about the case CI
 * failed on rather than about whatever the offer sorted first.
 */
const SMALLER_BY = [4, 3, 2] as const;

/** One stamp for the file, so its accounts and its two copied dishes are named together. */
const stamp = Date.now();
const MARK = `W${stamp}`;
/**
 * Two marks, because the two copies are of two dishes the offer may sort first
 * for two accounts — and on a small library that is the **same** dish, whose
 * copy would then collide on `recipes_slug_unique` (seen on the first run of
 * this file, 2026-10-16). A mark per copy is what makes each slug its own.
 */
const MARK_OVERSIZED = `${MARK}B`;
const MARK_OVEN = `${MARK}O`;
const MARK_SMALL = `${MARK}S`;

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * One dish per distinct shape, at most `most` of them.
 *
 * The variants of a scripted dish are nutritionally the same dish — `0009`'s
 * numbering is what gives a slot seven distinct names — so probing two of them
 * asks the same question twice and spends a rate-limit window on it.
 */
function shapesOf<T extends { readonly name: string }>(dishes: readonly T[], most: number): readonly T[] {
  const shapes = new Map<string, T>();

  for (const dish of dishes) {
    if (!shapes.has(scriptedName(dish.name))) {
      shapes.set(scriptedName(dish.name), dish);
    }
  }

  return [...shapes.values()].slice(0, most);
}

describe('a day’s arithmetic is a warning somebody may accept (0103)', () => {
  let app: INestApplication;
  /**
   * The model stand-in, held so that **"the model was never called" is
   * assertable**: a full day refuses a dish request before the call, and that
   * promise is about a call that does not happen. Its answers are never read
   * here — no test in this file wants a dish written — which is why `POOL` goes
   * in unchanged.
   */
  let ai: ScriptedAiClient;
  /** Premium, because the accepted pair plus a third rule is three allowances. */
  let warned: Account;
  /** Holds nothing on `ACCEPTED`, so the same dish is judged there without anybody else's rule in the way (`0019`). */
  let alone: Account;
  /** Free, one rule, and the kitchen that stops it being honourable. */
  let ruled: Account;
  /** Premium and otherwise untouched: two requests fired together at one weekday are the only way to the cap inside the lock. */
  let racer: Account;
  const made: string[] = [];
  /** The copies this file writes into the shared library; removed after its accounts are. */
  const copies: string[] = [];

  /** The lunch standing on `ACCEPTED`, and the dinner that day cannot hold beside it. */
  let lunch: { readonly name: string; readonly slug: string } | undefined;
  let clashing: { readonly name: string; readonly slug: string } | undefined;

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

  /** `POST /fixed-meals`, without an expectation: every case below asserts its own status. `accept` is sent only when a case names it. */
  const fix = async (who: Account, weekday: number, slot: string, dishSlug: string | undefined, accept?: readonly string[]): Promise<Response> =>
    request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', who.cookie)
      .send({ dishSlug, slot, weekday, ...(accept === undefined ? {} : { accept }) });

  /** `POST /fixed-meals/consequence`, without an expectation. */
  const consequence = async (who: Account, weekday: number, slot: string, dishSlug: string | undefined): Promise<Response> =>
    request(httpServer(app)).post(`/${PREFIX}/fixed-meals/consequence`).set('Cookie', who.cookie).send({ dishSlug, slot, weekday });

  const notOffered = async (who: Account, weekday: number, slot: string, query: string): Promise<readonly NotOfferedDishDto[]> => {
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals/not-offered`)
      .set('Cookie', who.cookie)
      .send({ query, slot, weekday })
      .expect(200);

    return response.body as readonly NotOfferedDishDto[];
  };

  const honourability = async (who: Account): Promise<FixedMealHonourabilityDto> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/fixed-meals/honourability`).set('Cookie', who.cookie).expect(200);

    return response.body as FixedMealHonourabilityDto;
  };

  beforeAll(async () => {
    // The shared pool alone, and that is the fixture decision: no day it builds
    // is inside all four of its bands, so a second rule on any day is a warning
    // — which is what this file is about (`PAIRABLE`, `fixed-meals.e2e-spec.ts`).
    ai = new ScriptedAiClient(POOL);
    app = await createApp(ai);

    warned = await register(app, `fixed-warning-${stamp}@e2e.invalid`);
    made.push(warned.cookie);
    alone = await register(app, `fixed-warning-alone-${stamp}@e2e.invalid`);
    made.push(alone.cookie);
    ruled = await register(app, `fixed-warning-ruled-${stamp}@e2e.invalid`);
    made.push(ruled.cookie);
    racer = await register(app, `fixed-warning-race-${stamp}@e2e.invalid`);
    made.push(racer.cookie);

    // The same answers for all three, which is what makes the isolation claim
    // readable: the same dish fits the same plate, so a different verdict can
    // only come from whose rules were counted.
    await completeOnboarding(app, warned);
    await completeOnboarding(app, alone);
    await completeOnboarding(app, ruled);
    await completeOnboarding(app, racer);

    // Both halves, as `events-premium` does it: the account's own tier and the
    // switch that makes any tier but free exist at all. `alone` and `ruled` stay
    // free, and with the flag on `tierOf` reads each account's own tier.
    await UserController.setTier(warned.id, 'premium', UNAUDITED);
    await UserController.setTier(racer.id, 'premium', UNAUDITED);
    await SettingsController.setFlag('premium', true, UNAUDITED);
  });

  afterAll(async () => {
    // Off again whatever happened above: every other suite in the run reads this
    // row, and a file that leaves it on hands the next one a tier it never asked
    // for.
    await SettingsController.setFlag('premium', false, UNAUDITED);

    for (const account of [warned, racer]) {
      if (account) {
        await UserController.setTier(account.id, 'free', UNAUDITED);
      }
    }

    await deleteAccounts(app, made);
    // After the accounts, because a plan that served a copy holds it
    // (`meals.recipe_id` is `RESTRICT`).
    await forgetRecipes(copies);
    await app?.close();
  });

  it('offers the dish the day cannot hold, and says what fixing it would cost', async () => {
    expect(await standing(warned)).toMatchObject({
      maxPerDay: MAX_FIXED_MEALS_PER_DAY,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_PREMIUM, remaining: FIXED_MEALS_PREMIUM, used: 0 }
    });

    // The lunch first, from the lunch offer: a day holding nothing has nothing
    // to clash with. **Which** lunch is searched for rather than assumed — on a
    // library whose days can close, whether a dinner clashes beside a given
    // lunch is a property of that library and not of this code, and `[0]` is
    // whatever the offer sorted first.
    for (const candidate of shapesOf(await fixable(warned, ACCEPTED, 'lunch'), LUNCHES_TRIED)) {
      const created = await fix(warned, ACCEPTED, 'lunch', candidate.slug);

      expect({ slug: candidate.slug, status: created.status }).toEqual({ slug: candidate.slug, status: 201 });

      for (const dinner of shapesOf(await fixable(warned, ACCEPTED, 'dinner'), DINNERS_ASKED)) {
        const read = await consequence(warned, ACCEPTED, 'dinner', dinner.slug);

        expect({ slug: dinner.slug, status: read.status }).toEqual({ slug: dinner.slug, status: 200 });

        const verdict = read.body as FixedMealConsequenceDto;

        if (!verdict.fixable && verdict.why === 'clashes_with_fixed') {
          clashing = dinner;
          break;
        }
      }

      if (clashing) {
        lunch = candidate;
        break;
      }

      await request(httpServer(app))
        .delete(`/${PREFIX}/fixed-meals/${(created.body as { id: string }).id}`)
        .set('Cookie', warned.cookie)
        .expect(204);
    }

    // Not "this library is rich": a library every one of whose days closes
    // around every pair has no warning to show, and that is the one thing this
    // file cannot work around. The counts travel inside the failure so a red run
    // says how far the search got.
    expect({ dinner: clashing !== undefined, lunch: lunch !== undefined, tried: `${LUNCHES_TRIED} lunches, ${DINNERS_ASKED} dinners each` }).toEqual({
      dinner: true,
      lunch: true,
      tried: expect.any(String)
    });

    // **`0103`, and the whole of it**: the dish the day cannot hold is in the
    // list. Before it, `offerFor` ran `dayHolds` per candidate — 4.05 s on an
    // 851-dish pool — and what those four seconds bought was hiding exactly this
    // dish. The screen now shows it with the sentence on the row.
    expect((await fixable(warned, ACCEPTED, 'dinner')).map(dish => dish.slug)).toContain(clashing?.slug);

    // The sentence itself, as the wire carries it: the reason named, and
    // `acceptable` saying it is theirs to overrule. `clashes_with_fixed` is the
    // only reason that is ever true of, and the field is not a synonym for
    // `actionable` — five reasons are actionable without being acceptable.
    const read = await consequence(warned, ACCEPTED, 'dinner', clashing?.slug);

    expect({ body: read.body as FixedMealConsequenceDto, status: read.status }).toEqual({
      body: { acceptable: true, fixable: false, why: 'clashes_with_fixed' },
      status: 200
    });

    // And it is **not** in the list of dishes the library has and the person was
    // not offered, because it was offered. `NotOfferedDish` carries no
    // `acceptable` field for that reason: the one acceptable reason cannot reach
    // it. The whole name, cut to what the field takes — the answer keeps five
    // reasons and sorts them by name, so a short needle pushes one off the end.
    const reasons = await notOffered(warned, ACCEPTED, 'dinner', (clashing?.name ?? '').slice(0, 120));

    expect({
      clashes: reasons.filter(dish => dish.why === 'clashes_with_fixed'),
      listed: reasons.some(dish => dish.slug === clashing?.slug)
    }).toEqual({ clashes: [], listed: false });
  });

  it('is somebody else’s arithmetic and not mine (0019)', async () => {
    // The same dish, the same weekday, the same meal, the same profile — and a
    // rule standing there that belongs to another account. `heldOn` is built
    // from `FixedMealController.forPlan(userId)`, so a filter by weekday that
    // forgot the account would answer `clashes_with_fixed` here too.
    //
    // **This is where that claim lives now.** It used to be read off the
    // narrowed offer in `fixed-meals.e2e-spec.ts`, and under `0103` nothing
    // narrows, so the assertion would pass against a filter that counted
    // everybody's rules. Asked of the one dish, it still fails if the account is
    // forgotten.
    expect((await standing(alone)).rules).toEqual([]);

    const read = await consequence(alone, ACCEPTED, 'dinner', clashing?.slug);

    expect({ body: read.body as FixedMealConsequenceDto, dish: clashing?.slug, status: read.status }).toEqual({
      body: { fixable: true },
      dish: clashing?.slug,
      status: 200
    });
  });

  it('refuses the warning nobody accepted (409), and takes the same body once they do', async () => {
    // Not a 422: nothing about the request is wrong. The dish is real, the rule
    // is theirs to write, and the reason is on the body so the screen can say
    // what will happen rather than only that something will
    // (`FixedMealWarningError`).
    const refused = await fix(warned, ACCEPTED, 'dinner', clashing?.slug);

    expect({ code: (refused.body as { code: string }).code, status: refused.status, warning: (refused.body as { warning: string }).warning }).toEqual(
      { code: 'FIXED_MEAL_WARNING', status: 409, warning: 'clashes_with_fixed' }
    );
    expect((await standing(warned)).rules).toHaveLength(1);

    // An explicit empty `accept` is the same refusal as none at all: the default
    // is what every ordinary fix sends, and a client that names no reason has
    // accepted no reason.
    const empty = await fix(warned, ACCEPTED, 'dinner', clashing?.slug, []);

    expect({ code: (empty.body as { code: string }).code, status: empty.status }).toEqual({ code: 'FIXED_MEAL_WARNING', status: 409 });

    // A reason that is not a reason is a body that is not one: `accept` is an
    // enum of the acceptable reasons, so a refusal's name cannot be smuggled
    // through it.
    const nonsense = await fix(warned, ACCEPTED, 'dinner', clashing?.slug, ['too_big_or_small']);

    expect({ code: (nonsense.body as { code: string }).code, status: nonsense.status }).toEqual({ code: 'INVALID_INPUT', status: 422 });

    // And the same body naming the reason it found: 201.
    const accepted = await fix(warned, ACCEPTED, 'dinner', clashing?.slug, ['clashes_with_fixed']);

    expect({ slug: clashing?.slug, status: accepted.status }).toEqual({ slug: clashing?.slug, status: 201 });
    expect(accepted.body).toMatchObject({ dishName: clashing?.name, dishSlug: clashing?.slug, slot: 'dinner', weekday: ACCEPTED });
    expect(
      (await standing(warned)).rules
        .filter(rule => rule.weekday === ACCEPTED)
        .map(rule => rule.slot)
        .sort()
    ).toEqual(['dinner', 'lunch']);
  });

  it('serves the accepted meal, on both of that weekday’s days, with those days out of band', async () => {
    // The owner's own requirement and the one claim no unit test can make:
    // *«aunque no se cumplan las macros, el plan se tiene que generar con esas
    // comidas»*. `honouredPin` yields a pin to three bounds — the pool, the slot
    // and the plate — and the day's macro bands are not one of them, so the pin
    // is placed and the day is simply built outside them.
    const rules = (await standing(warned)).rules.filter(rule => rule.weekday === ACCEPTED);

    expect(rules).toHaveLength(2);

    const job = await generateAndWait(app, warned);

    expect(job.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', warned.cookie).expect(200);
    const plan = response.body as PlanView;
    const its = plan.days.filter(day => weekdayOf(day.date) === ACCEPTED);

    // A fortnight holds two of any weekday, and both rules land on both.
    expect(its.length).toBeGreaterThan(0);

    for (const day of its) {
      // Per slot rather than as a set of names: two names in the wrong two meals
      // would read as the same set, and "both rules served" has to mean each on
      // its own meal.
      //
      // **And the day missing at least one band, which is the trade.** Asserted
      // rather than tolerated: `dayHolds`'s own promise is that a pair it
      // refuses can never work, so a day that came back inside all four bands
      // would mean the warning somebody accepted was not true of their plan —
      // which is the one way this whole path can be wrong without anything
      // turning red. The names of the bands missed are not asserted: which of
      // the four a library misses is the library's business.
      const misses = bandMisses(day);

      expect({
        date: day.date,
        outOfBand: misses.length > 0,
        served: rules.map(rule => ({ name: day.meals.find(meal => meal.slot === rule.slot)?.name, slot: rule.slot }))
      }).toEqual({ date: day.date, outOfBand: true, served: rules.map(rule => ({ name: rule.dishName, slot: rule.slot })) });
    }
  });

  it('refuses `too_big_or_small` whatever is accepted, because that pin would be dropped', async () => {
    // The refusal `0103` deliberately left a refusal although it is arithmetic
    // too. `too_big_or_small` **is** `fitsPlate` failing, which is one of
    // `honouredPin`'s three hard bounds (`0070`, `0076`, `0078` — the gram
    // ceiling and `PLATE_LIMIT`), so accepting it would take somebody's yes and
    // then serve them nothing. That is worse than saying no.
    //
    // A copy of a dish this person **is** offered, scaled by `OVERSIZED`, so
    // nothing but the plate can be what refuses it: same slots, same minutes,
    // same method, same locale, same ingredients (`copyDishScaled`). Nothing
    // `whyNotFixable` asks before `fitsPlate` reads grams at all, so scaling can
    // only move the verdict from fixable to `too_big_or_small` and never to some
    // other reason.
    const [plain] = shapesOf(await fixable(warned, UNTOUCHED, 'dinner'), 1);

    expect(plain?.slug).toEqual(expect.any(String));

    // The smallest copy of it this library still offers, which is the stand-in
    // for the smallest dish an offer can hold — the case CI failed on, and the
    // one a run here has no power over otherwise (`SMALLER_BY`). A copy the
    // offer no longer lists is already refused for being too small, which would
    // make everything below it pass for the wrong reason, so each candidate is
    // read back and the search stops at the first that is really there.
    let small: { readonly name: string; readonly slug: string } | undefined;

    for (const divisor of SMALLER_BY) {
      const candidate = await copyDishScaled(plain?.slug ?? '', 1 / divisor, `${MARK_SMALL}${divisor}`);

      copies.push(candidate.slug);

      if ((await fixable(warned, UNTOUCHED, 'dinner')).map(dish => dish.slug).includes(candidate.slug)) {
        small = candidate;
        break;
      }
    }

    // A library that offers no fraction of its own dish has nothing to say about
    // a plate, and says that rather than passing.
    expect({ divisors: SMALLER_BY.join(', '), small: small !== undefined }).toEqual({ divisors: expect.any(String), small: true });

    const oversized = await copyDishScaled(small?.slug ?? '', OVERSIZED, MARK_OVERSIZED);

    copies.push(oversized.slug);

    // **This assertion first, and that is the fix as much as the factor is.**
    // The reason named, with `acceptable: false` beside it — the screen must not
    // offer a way past this one. Led with because it is the only one here that
    // fails loudly when the fixture is not oversized after all: a copy the plate
    // still holds says `fixable: true` in one line, where "the slug is not in the
    // offer" would also be satisfied by a copy that was never created or an
    // offer that came back empty for some unrelated reason. The factor travels
    // in the payload so a red run says what was tried.
    const read = await consequence(warned, UNTOUCHED, 'dinner', oversized.slug);

    expect({ body: read.body as FixedMealConsequenceDto, scaled: `${OVERSIZED}x ${small?.slug ?? ''}`, status: read.status }).toEqual({
      body: { acceptable: false, fixable: false, why: 'too_big_or_small' },
      scaled: `${OVERSIZED}x ${small?.slug ?? ''}`,
      status: 200
    });

    // And so it is not offered — which is the offer and the per-dish read being
    // one oracle, now that the line above has established the state rather than
    // assumed it.
    expect((await fixable(warned, UNTOUCHED, 'dinner')).map(dish => dish.slug)).not.toContain(oversized.slug);

    // 422 and not the warning's 409, with the reason in the field error —
    // **`accept` naming the one acceptable reason reaches nothing**, because the
    // service checks the reason it found against the ones named rather than
    // reading `accept` as a bare yes.
    const refused = await fix(warned, UNTOUCHED, 'dinner', oversized.slug, ['clashes_with_fixed']);
    const body = refused.body as { code: string; fieldErrors?: Record<string, readonly string[]> };

    expect({ code: body.code, fieldErrors: body.fieldErrors, status: refused.status }).toEqual({
      code: 'INVALID_INPUT',
      fieldErrors: { dishSlug: ['too_big_or_small'] },
      status: 422
    });

    // And it is named where a dish the library has and nobody was offered
    // belongs, with a way forward: another meal.
    const named = (await notOffered(warned, UNTOUCHED, 'dinner', oversized.name.slice(0, 120))).find(dish => dish.slug === oversized.slug);

    expect(named).toEqual({ actionable: true, name: oversized.name, slug: oversized.slug, why: 'too_big_or_small' });
  });

  it('holds at most two meals of one weekday, and `accept` reaches nothing past it', async () => {
    // A product bound and therefore a refusal, not a warning: accepting a
    // consequence does not make a third rule a good idea. It exists *because*
    // of the change above — `0101` set no number, reasoning that the arithmetic
    // filter was the cap, and `0103` removed that filter.
    expect((await standing(warned)).maxPerDay).toBe(MAX_FIXED_MEALS_PER_DAY);

    // Nothing is offered and nothing is explained for a full day: the offer must
    // never list what `add` would refuse.
    expect(await fixable(warned, ACCEPTED, 'breakfast')).toEqual([]);
    expect(await notOffered(warned, ACCEPTED, 'breakfast', (lunch?.name ?? '').slice(0, 120))).toEqual([]);

    // A breakfast this account really is offered on an untouched day, so what
    // refuses it below is the day and not the dish.
    const [breakfast] = shapesOf(await fixable(warned, SPARE, 'breakfast'), 1);

    expect(breakfast?.slug).toEqual(expect.any(String));

    // 409 with its own code and the number on the body, here and on `add` — and
    // not one of `NotFixable`'s reasons, because a full day is not a fact about
    // any dish.
    const read = await consequence(warned, ACCEPTED, 'breakfast', breakfast?.slug);

    expect({ code: (read.body as { code: string }).code, dayLimit: (read.body as { dayLimit: number }).dayLimit, status: read.status }).toEqual({
      code: 'FIXED_MEAL_DAY_FULL',
      dayLimit: MAX_FIXED_MEALS_PER_DAY,
      status: 409
    });

    const refused = await fix(warned, ACCEPTED, 'breakfast', breakfast?.slug, ['clashes_with_fixed']);

    expect({
      code: (refused.body as { code: string }).code,
      dayLimit: (refused.body as { dayLimit: number }).dayLimit,
      status: refused.status
    }).toEqual({ code: 'FIXED_MEAL_DAY_FULL', dayLimit: MAX_FIXED_MEALS_PER_DAY, status: 409 });

    // The cap is the day's and not the account's: the third rule goes to another
    // weekday and is taken, which is also what spends the last of premium's
    // three.
    const spent = await fix(warned, SPARE, 'breakfast', breakfast?.slug);

    expect({ slug: breakfast?.slug, status: spent.status }).toEqual({ slug: breakfast?.slug, status: 201 });
    expect((await standing(warned)).standing).toEqual({ allowed: false, limit: FIXED_MEALS_PREMIUM, remaining: 0, used: FIXED_MEALS_PREMIUM });
  });

  it('says the allowance before the day when both would refuse (0103)', async () => {
    // `0103`'s own words, and `FixedMealDayFullError`'s docstring and
    // `FixedMealRepository.createWithinQuota`'s comment with it: *"the allowance
    // is asked first, because 'you have used all three' is the truer sentence
    // when it is also true"*. This account now holds all three of its rules, two
    // of them on `ACCEPTED`, so both bounds refuse the same request — and what
    // it should hear is the one it can do something about by removing a rule
    // anywhere, not the one about this day.
    //
    // **The case this file was written against a defect for** (found 2026-10-16,
    // fixed the same day): the order is honoured inside the repository's lock,
    // and `FixedMeals.service.ts` → `add` used to refuse a full day *before*
    // reaching it, so from HTTP a premium account with three rules heard 409
    // `FIXED_MEAL_DAY_FULL` — the sentence about the day it cannot act on
    // instead of the one it can. The fast path is gone and the two bounds are
    // asked in one place; this is what keeps it that way, because the
    // contradiction was invisible from every other case here.
    const [breakfast] = shapesOf(await fixable(warned, UNTOUCHED, 'breakfast'), 1);
    const refused = await fix(warned, ACCEPTED, 'breakfast', breakfast?.slug);

    expect({ code: (refused.body as { code: string }).code, status: refused.status }).toEqual({ code: 'QUOTA_EXCEEDED', status: 429 });
    expect((await standing(warned)).rules).toHaveLength(FIXED_MEALS_PREMIUM);
  });

  it('refuses a dish request for a full day before the model is called, and spends no allowance', async () => {
    // The third route the cap reaches, and the only one where being refused
    // **late** would cost something a person feels: a model call is money, and
    // the month's three dish requests are what they bought. So the day is read
    // before the build, for the same reason the allowance is read before it —
    // nobody pays for a dish that could not be fixed where they asked for it.
    //
    // 409 `FIXED_MEAL_DAY_FULL` and not the warning's code: `request` spends the
    // dish-request allowance and never the fixed-meal one, so there is no order
    // for a day to jump here and nothing to accept — a full day is not a fact
    // about any dish, and no dish has been written yet to have a fact about.
    const before = (await standing(warned)).dishRequests;
    const calls = ai.calls;
    const refused: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals/request`)
      .set('Cookie', warned.cookie)
      .send({ name: 'un bizcocho de avena para desayunar', slot: 'breakfast', weekday: ACCEPTED });

    expect({
      code: (refused.body as { code: string }).code,
      dayLimit: (refused.body as { dayLimit: number }).dayLimit,
      status: refused.status
    }).toEqual({ code: 'FIXED_MEAL_DAY_FULL', dayLimit: MAX_FIXED_MEALS_PER_DAY, status: 409 });
    // The two halves of "before the model": no call, and no allowance gone. The
    // call count is the stronger of the two — an allowance read twice would
    // leave the allowance intact and still have paid for the answer.
    expect({ calls: ai.calls, requests: (await standing(warned)).dishRequests }).toEqual({ calls, requests: before });
  });

  it('lets exactly one of two requests fired together fill the day (the lock, not the read)', async () => {
    // **The one bound in `packages/core` nothing else covers.** `packages/core`
    // has no repository tests, and the service deliberately keeps no pre-check
    // to help: both bounds are re-counted inside `FixedMealRepository`'s own
    // locked transaction, because a count read outside the lock is a different
    // snapshot from the insert that follows it. The hazard is the one a security
    // scan found in `EventController.add` on 2026-09-22 — two requests both
    // passing a read and both inserting — and the only way to the code that
    // stops it is to race it.
    //
    // A premium account of its own, one rule already on the weekday, and the
    // other **two** meals fired at once: three writes against an allowance of
    // three, so what refuses the loser is the day and never the quota. The
    // lunch and the dinner are different meals, so the unique index on
    // (account, weekday, slot) cannot be what refuses either — only the count.
    const [lunch] = shapesOf(await fixable(racer, SPARE, 'lunch'), 1);
    const first = await fix(racer, SPARE, 'lunch', lunch?.slug, ['clashes_with_fixed']);

    expect({ slug: lunch?.slug, status: first.status }).toEqual({ slug: lunch?.slug, status: 201 });

    const [dinner] = shapesOf(await fixable(racer, SPARE, 'dinner'), 1);
    const [breakfast] = shapesOf(await fixable(racer, SPARE, 'breakfast'), 1);

    expect({ breakfast: breakfast?.slug, dinner: dinner?.slug }).toEqual({ breakfast: expect.any(String), dinner: expect.any(String) });

    // Both carry `accept`, so a warning cannot be what refuses either of them —
    // whichever loses, loses to the cap.
    const fired = await Promise.all([
      fix(racer, SPARE, 'dinner', dinner?.slug, ['clashes_with_fixed']),
      fix(racer, SPARE, 'breakfast', breakfast?.slug, ['clashes_with_fixed'])
    ]);
    const written = fired.filter(response => response.status === 201);
    const refused = fired.filter(response => response.status !== 201);

    // The invariant first, straight off the account's own rules: the weekday
    // holds two and not three, whatever the two responses said. A cap that
    // failed here would have left a third row and no error at all.
    expect(
      (await standing(racer)).rules
        .filter(rule => rule.weekday === SPARE)
        .map(rule => rule.slot)
        .sort()
    ).toHaveLength(MAX_FIXED_MEALS_PER_DAY);

    // And the two answers: one 201, one 409 `FIXED_MEAL_DAY_FULL` with the
    // number. **Not the lock's own `CONFLICT`** — `createWithinQuota` takes
    // `pg_try_advisory_xact_lock` with eight attempts and a backoff
    // (`LOCK_ATTEMPTS`), so the loser retries into the lock rather than bouncing
    // off it and reaches the count. A `CONFLICT` here would mean the race was
    // decided by lock contention before the cap was ever consulted, which is a
    // weaker thing than this test claims — so it is asserted strictly and a red
    // here is a number to report, not an assertion to widen.
    expect({
      codes: refused.map(response => (response.body as { code: string }).code),
      limits: refused.map(response => (response.body as { dayLimit: number }).dayLimit),
      refused: refused.length,
      written: written.length
    }).toEqual({ codes: ['FIXED_MEAL_DAY_FULL'], limits: [MAX_FIXED_MEALS_PER_DAY], refused: 1, written: 1 });

    // The allowance was never the bound: two of premium's three are left unspent
    // by the day being full, so the account can still fix a rule elsewhere.
    expect((await standing(racer)).standing).toEqual({ allowed: true, limit: FIXED_MEALS_PREMIUM, remaining: 1, used: MAX_FIXED_MEALS_PER_DAY });
  });

  /**
   * Which of this account's standing rules the plan it would generate next
   * cannot honour, and why (project 021 phase 5b, `0102`, `0103`).
   *
   * **A cause reached without a model**, which is what makes it a test rather
   * than a measurement: a dish declaring an oven, fixed while the account's
   * kitchen is the one somebody who has never said anything has — and then a
   * kitchen that says it has no oven. `withinEquipment` takes the dish out of
   * the pool the generation restores pins from, so the day is built as though
   * the rule did not exist; before phase 5b that happened silently.
   *
   * **The two lists are different facts** (`0103`). `unhonoured` is the rules
   * the plan will **not** carry, and its `why` excludes `clashes_with_fixed` in
   * the type; `outOfBand` is the days that **are** carried and will miss their
   * numbers for it, every rule of such a day in it because every one of them is
   * served and every one contributes. The account that accepted a warning above
   * is read here for exactly that: its pair is in `outOfBand` and its
   * `unhonoured` is empty, which is the coherent end of `0103` rather than phase
   * 5b telling somebody a rule is not honoured while the plan serves it.
   */
  describe('which standing rules the next plan cannot honour (021 phase 5b)', () => {
    /** The oven dish, a copy of one `ruled` is really offered. */
    let ovenDinner: { readonly name: string; readonly slug: string } | undefined;
    /** The rule it stands on. */
    let rule: { readonly id: string } | undefined;

    beforeAll(async () => {
      const [plain] = shapesOf(await fixable(ruled, RULED, 'dinner'), 1);

      ovenDinner = await copyDishDeclaring(plain?.slug ?? '', 'oven', MARK_OVEN);
      copies.push(ovenDinner.slug);
    });

    it('names the rule, the reason and nothing else once the kitchen loses its oven', async () => {
      // Fixed **before** the kitchen changes, which is the order the cause needs:
      // a dish needing an oven is not offered to a kitchen that has none, so a
      // rule on it can only be written while the kitchen still has one. That is
      // also the real shape of the thing — somebody fixes a dish and *then*
      // tells us their oven is broken.
      const created = await fix(ruled, RULED, 'dinner', ovenDinner?.slug);

      expect({ slug: ovenDinner?.slug, status: created.status }).toEqual({ slug: ovenDinner?.slug, status: 201 });

      rule = created.body as { id: string };

      // Honourable while the kitchen is the default one, which marks the oven
      // present: the rule is new and nothing else is wrong with it, so both
      // lists are empty and `judged` is true. Read first so the answer below is
      // attributable to the kitchen.
      expect(await honourability(ruled)).toEqual({ judged: true, outOfBand: [], unhonoured: [] });

      const said: Response = await request(httpServer(app))
        .patch(`/${PREFIX}/profile/preferences`)
        .set('Cookie', ruled.cookie)
        .send({ kitchen: [{ appliance: 'oven', stance: 'missing' }] })
        .expect(200);

      expect((said.body as { kitchen: KitchenView }).kitchen.appliances.oven).toBe('missing');

      // The rule's own id, the domain's `actionable` — there is a way forward and
      // it is theirs: another dish, or say they have an oven (`0102`) — and
      // `outOfBand` still empty, because a rule the plan will not carry is not a
      // day that misses its numbers.
      expect(await honourability(ruled)).toEqual({
        judged: true,
        outOfBand: [],
        unhonoured: [{ id: rule?.id, actionable: true, why: 'missing_equipment' }]
      });
    });

    it('is nobody else’s answer (0019)', async () => {
      // An account with no rules at all, on the same library and the same
      // request: the unhonourable rule beside it is not its business. A read
      // that forgot the session would name it here.
      expect(await honourability(alone)).toEqual({ judged: true, outOfBand: [], unhonoured: [] });
    });

    it('calls the accepted day out of band rather than unhonoured (0103)', async () => {
      // The account that accepted the warning. Its pair **is** served — the plan
      // above proves it on real rows — so naming it `unhonoured` would be the
      // product telling somebody a rule is being ignored while the plan carries
      // it, and telling it about the lunch they made no trade about at all.
      //
      // Both rules of the day, in `outOfBand`, each with the weekday beside its
      // id so a screen can group them without matching back; the third rule, on
      // a day of its own, is in neither list because a lone pin always holds.
      const rules = (await standing(warned)).rules;
      const paired = rules.filter(each => each.weekday === ACCEPTED);
      const answer = await honourability(warned);

      expect(paired).toHaveLength(2);
      expect({ judged: answer.judged, outOfBand: [...answer.outOfBand].map(day => day.id).sort(), unhonoured: answer.unhonoured }).toEqual({
        judged: true,
        outOfBand: paired.map(each => each.id).sort(),
        unhonoured: []
      });
      expect(answer.outOfBand.every(day => day.weekday === ACCEPTED)).toBe(true);
    });

    it('answers `judged: false` rather than an error when the targets cannot be computed', async () => {
      // The route's own promise, and the reason it never throws: a screen that
      // lists somebody's rules must not become an error page over the footnote
      // beside them. `judged: false` means the answer could not be computed —
      // **not** that every rule is fine — so both lists are empty and say
      // nothing.
      //
      // Reached by clearing the stored height (`clearProfileHeight`), which is
      // what makes `targetInput` return null and so every assembly of a
      // generation's context refuse. Not by withdrawing the profile consent, the
      // other cause the route names: withdrawal reopens three onboarding steps,
      // so `@RequiresOnboarding()` answers `ONBOARDING_INCOMPLETE` before the
      // controller runs at all (`profile-consent.e2e-spec.ts`), and that path
      // cannot reach this one.
      await clearProfileHeight(ruled.id);

      expect(await honourability(ruled)).toEqual({ judged: false, outOfBand: [], unhonoured: [] });

      // Still its rule, and still readable: the footnote failed, the list did
      // not.
      expect((await standing(ruled)).rules).toHaveLength(1);
    });
  });
});
