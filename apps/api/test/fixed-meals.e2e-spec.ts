import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { MAX_FIXED_MEALS_PER_DAY } from 'core/entities/FixedMeal';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import {
  bandMisses,
  completeOnboarding,
  createApp,
  deleteAccounts,
  dish,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  scriptedName,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { FixedMealConsequenceDto, NotOfferedDishDto } from '../src/modules/fixed-meals/dto/out/index.js';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A meal fixed to one day of the week, for ever (`0098`, `0099`, `0101`,
 * `0103`).
 *
 * The assertions that matter are the ones no unit test can make: that the dish
 * the route offers is one the *database's* own pool holds, that the limit and
 * the one-rule-per-meal constraint refuse what they should at the HTTP
 * boundary, and that a plan generated afterwards really serves that dish on
 * that day.
 *
 * **What `0103` changed here, and what it did not.** The offer no longer asks
 * the day's arithmetic of the library: `GET /fixed-meals/fixable` is the plate
 * fit, so a dish the day cannot hold beside the rule it already has is now *in*
 * the list, with the sentence read from `POST /fixed-meals/consequence` when
 * somebody touches it. Three claims of `0101`'s own block were claims about
 * that filter and are gone with it — the narrowed second offer, the dish the
 * narrowing dropped, and `not-offered` naming `clashes_with_fixed`, which it
 * can no longer say about any dish. What survived is the half that was never
 * about filtering: a day holds two rules, the same meal twice is refused, and
 * the plan really serves both of them on both of that weekday's days, inside
 * their bands. The second rule is now chosen by asking `consequence` for a
 * dinner the day can hold rather than by reading the offer's set difference —
 * the same oracle (`dayHolds`), asked of one dish instead of the library.
 *
 * **The warning path itself is not here**:
 * `fixed-meals-warnings.e2e-spec.ts` owns it, with the day's cap, the refusal
 * `0103` left a refusal, and which standing rules the next plan cannot honour.
 * This file keeps what `0101` and `0099` already claimed and makes it true
 * again.
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

/** Olive oil, which the seed guarantees and the shared pool has no equivalent of. */
const OIL = 'aceite-de-oliva-virgen-extra';

/**
 * Four dishes this file adds to the shared pool, because the one claim it keeps
 * about a day's arithmetic asks the library for something `POOL` cannot give.
 *
 * **No day of the shared pool is ever inside all four of its bands**: its ten
 * ingredients carry almost no fat — egg 9.5 g per 100, Greek yogurt 5, oats 6.5,
 * and nothing else above 3.5 — so a fortnight built from it lands every one of
 * its fourteen days outside the protein band, 6% over. Measured on a database
 * built the way CI builds it (migrations and `seed`, no library): 0 of 14 days
 * in band. That is what turned CI red on 2026-10-15, with the suite green on a
 * developer's machine, where a thousand real recipes were in the way of
 * noticing.
 *
 * **`0103` changed which assertion needs them, not whether one does.** The
 * offer is no longer gated on a day the scheduler can close, so on the bare
 * pool every dinner of a weekday holding a lunch is still *offered* — with a
 * warning. What is unreachable without a fat source is the opposite answer:
 * `consequence` saying `fixable: true` about a second rule, and so the pair
 * being served on two days **inside their bands**, which is the half of `0101`
 * this file still proves. With these four in the pool it is 4 of 14 days in
 * band and both days of the pinned weekday close; without them the search below
 * finds no dinner the day can hold and says so.
 *
 * They live here and not in `harness.ts` because `0009` tuned `POOL` for the
 * variety rules of every suite that shares it, and this is the only file that
 * needs a day the library can actually close. `fixed-meals-warnings.e2e-spec.ts`
 * deliberately does not take them: it needs a day that *cannot* close.
 */
const PAIRABLE = [
  dish(
    'Avena con yogur y aceite',
    ['breakfast'],
    [
      { grams: 70, slug: SEEDED.avena },
      { grams: 150, slug: SEEDED.yogur },
      { grams: 6, slug: OIL }
    ]
  ),
  dish(
    'Arroz con tomate y aceite',
    ['lunch'],
    [
      { grams: 260, slug: SEEDED.arroz },
      { grams: 150, slug: SEEDED.tomate },
      { grams: 10, slug: OIL }
    ]
  ),
  dish(
    'Merluza con patata y aceite',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata },
      { grams: 8, slug: OIL }
    ]
  ),
  dish(
    'Tortilla con pan y aceite',
    ['dinner'],
    [
      { grams: 150, slug: SEEDED.huevo },
      { grams: 70, slug: SEEDED.pan },
      { grams: 5, slug: OIL }
    ]
  )
];

/**
 * The weekdays the premium block uses, each for one job: the day that comes to
 * hold two rules, a second day for the third rule, and one that never holds
 * anything — which is what makes the narrowed offer's cause attributable.
 */
const PAIRED = 2;
const SPARE = 5;
const UNTOUCHED = 6;

/**
 * How wide the search for a pair the day can close is allowed to be.
 *
 * It is bounded because `POST /fixed-meals/consequence` allows sixty an hour
 * (one assembly of this person's library each) and a real library has hundreds
 * of dinners: `LUNCHES_TRIED * DINNERS_ASKED` is the worst case, and it has to
 * leave the block's own reads inside the window. Measured against the fixture
 * pool, the lunch that works is not the first one the offer sorts and the
 * dinners that work are about a third of what is offered beside it (README
 * § *The shared pool cannot reach the macro bands*), so four and eight is room
 * rather than hope — and running out of it fails with the counts rather than
 * with a 429.
 */
const LUNCHES_TRIED = 4;
const DINNERS_ASKED = 8;

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * One dish per distinct shape, at most `most` of them.
 *
 * The variants of a scripted dish are nutritionally the same dish — `0009`'s
 * numbering is what gives a slot seven distinct names — so probing two of them
 * asks the same question twice and spends a rate-limit window on it. `most`
 * bounds the search on a real library, where every name is its own shape and
 * there are hundreds: a bound that fails with a sentence beats a probe that
 * fails with a 429.
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
    // The shared pool and the four dishes above, which are what makes a day this
    // library can close — and so a second rule possible at all (`PAIRABLE`).
    app = await createApp(new ScriptedAiClient([...POOL, ...PAIRABLE]));

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
    // `maxPerDay` is on the wire since `0103`, beside the two allowances and for
    // the same reason: the screen greys out a full weekday before anybody taps,
    // and a number repeated in a dictionary is a number that will disagree with
    // the server. Read from the entity rather than restated, as the tier's own
    // figures are not — those are hard-coded above on purpose, because a change
    // to what a tier allows is a change to this file.
    expect(await standing(account)).toEqual({
      dishRequests: NO_DISH_REQUESTS,
      maxPerDay: MAX_FIXED_MEALS_PER_DAY,
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
      maxPerDay: MAX_FIXED_MEALS_PER_DAY,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_FREE, remaining: FIXED_MEALS_FREE, used: 0 }
    });

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const fridays = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    expect(fridays.every(day => day.meals.find(meal => meal.slot === 'dinner')?.name === rule?.dishName)).toBe(true);
  });

  /**
   * A day may hold a rule for each meal, and the plan serves both of them
   * (`0101`, as `0103` leaves it).
   *
   * Premium's, because two rules need two allowances. **The switch is global**
   * and on for this block only — the free cases above run before it, and they
   * would hold anyway: with the flag on, `tierOf` reads the account's own tier.
   *
   * What is proved on real rows, in the order the tests run: the dinner offer
   * for a weekday is **the same list** once that weekday holds a lunch, which
   * is `0103`'s change and the opposite of what this block asserted before it;
   * the offer names nothing `add` refuses outright, every dish of it answering
   * 201 or the warning `0103` put in place of the refusal; the same meal twice
   * is a 409 while the same day's other meal is a 201; a plan generated
   * afterwards serves both rules on both of that weekday's days with those days
   * inside their bands; and the allowance counts rules per account rather than
   * per day.
   *
   * **The second rule is chosen by asking `consequence`, not by reading the
   * offer.** Before `0103` the offer itself was the answer — a dish still in
   * the narrowed list was a dish the day could hold — and the block found its
   * pair by set difference. The same oracle is now asked of one dish at a time
   * (`dayHoldsPin`, 20 ms against the 4.05 s the whole-library form cost), so
   * the search is a loop over `POST /fixed-meals/consequence` instead. The
   * dishes it is asked about are deduped by shape and bounded, because the
   * route allows sixty an hour and a real library has hundreds of dinners.
   *
   * **The generation claim is the one `0101` measured rather than proved**: the
   * `dayHolds` answer is optimistic — it builds that one day alone, with no
   * variety pressure from the other thirteen — and the plan-level backstop may
   * drop the second pin of a day it cannot honour. `0101` bounds that at 8 days
   * in 1960. So a red here is a report, not a test to loosen:
   * `PlanController.fixedMealsOf` says what the plan was built with, and a day
   * whose pins were both recorded and only one served is the backstop firing.
   *
   * The in-band half rests on the four dishes this file adds to the pool
   * (`PAIRABLE`): on the shared pool alone no day is inside its bands, so
   * `consequence` says `clashes_with_fixed` about every dinner and the search
   * below finds nothing — which is what `fixed-meals-warnings.e2e-spec.ts`
   * wants and what this block cannot work with.
   *
   * **Somebody else's rule on the same weekday is not here any more.** It used
   * to be read off the narrowed offer, and under `0103` nothing narrows, so the
   * assertion would pass against a filter that forgot the account entirely. The
   * claim moved to where it can still fail: the warnings suite asks
   * `consequence` about a dish that clashes with a *stranger's* lunch and gets
   * `fixable: true`.
   */
  describe('a day that holds two of them (0101, 0103)', () => {
    let rich: Account;
    /** The dinner offer for `PAIRED` before it held anything — what the unnarrowed one is read against. */
    let before: readonly { readonly name: string; readonly slug: string }[] = [];
    /** The same offer once a lunch stands on that day: the same list, since `0103`. */
    let after: readonly { readonly name: string; readonly slug: string }[] = [];
    /** The lunch standing on `PAIRED`, and a dinner `consequence` says that day can hold beside it. */
    let lunch: { readonly name: string; readonly slug: string } | undefined;
    let fitting: { readonly name: string; readonly slug: string } | undefined;

    /** `POST /fixed-meals/consequence`, without an expectation: the search below reads the status. */
    const consequence = async (who: Account, weekday: number, slot: string, dishSlug: string | undefined): Promise<Response> =>
      request(httpServer(app)).post(`/${PREFIX}/fixed-meals/consequence`).set('Cookie', who.cookie).send({ dishSlug, slot, weekday });

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

    it('offers premium’s three, and the same dinners once that weekday holds a lunch', async () => {
      expect((await standing(rich)).standing).toEqual({ allowed: true, limit: FIXED_MEALS_PREMIUM, remaining: FIXED_MEALS_PREMIUM, used: 0 });

      before = await fixable(rich, PAIRED, 'dinner');

      expect(before.length).toBeGreaterThan(0);

      // The lunch first, and from the lunch offer: a day holding nothing has
      // nothing to clash with, which is every rule before `0101` and the
      // cheapest path through `judge`.
      //
      // **Which** lunch is looked for rather than assumed, and that is the
      // lesson of a red run: `[0]` is whatever the offer sorted first, and
      // whether the day can still close beside it is a property of the library,
      // not of this code. On the fixture pool `[0]` is a lunch no dinner
      // survives beside — on a thousand real recipes it is not, so the suite
      // was green on a developer's machine and red on CI.
      //
      // What the search asks has changed with `0103` and the oracle has not:
      // the offer no longer answers "can the day hold this", so each candidate
      // dinner is put to `consequence`, which is `dayHoldsPin` — the same
      // `dayHolds` the narrowed offer used, asked of one dish. A rule removed
      // costs nothing but the insert: the allowance counts the rules standing,
      // not the ones written.
      for (const candidate of shapesOf(await fixable(rich, PAIRED, 'lunch'), LUNCHES_TRIED)) {
        const created = await fix(rich, PAIRED, 'lunch', candidate.slug);

        expect({ slug: candidate.slug, status: created.status }).toEqual({ slug: candidate.slug, status: 201 });

        after = await fixable(rich, PAIRED, 'dinner');

        for (const dinner of shapesOf(after, DINNERS_ASKED)) {
          const read = await consequence(rich, PAIRED, 'dinner', dinner.slug);

          expect({ slug: dinner.slug, status: read.status }).toEqual({ slug: dinner.slug, status: 200 });

          if ((read.body as FixedMealConsequenceDto).fixable) {
            fitting = dinner;
            break;
          }
        }

        if (fitting) {
          lunch = candidate;
          break;
        }

        await request(httpServer(app))
          .delete(`/${PREFIX}/fixed-meals/${(created.body as { id: string }).id}`)
          .set('Cookie', rich.cookie)
          .expect(204);
      }

      // Not "this library is poor": a library with no day inside its four bands
      // can hold a second rule only as a warning, and the in-band half of this
      // block is the one thing it cannot work around — see `PAIRABLE`. The
      // counts travel inside the failure so a red run says which of the two
      // halves of the search came up empty.
      expect({ dinner: fitting !== undefined, lunch: lunch !== undefined, tried: `${LUNCHES_TRIED} lunches, ${DINNERS_ASKED} dinners each` }).toEqual(
        { dinner: true, lunch: true, tried: expect.any(String) }
      );

      // **`0103`, and the opposite of what stood here**: the offer is the plate
      // fit, so a lunch standing on the day takes nothing out of the dinner
      // list — not even the dishes the day can no longer close around, which
      // are now offered with a warning on them. Slug for slug and in order,
      // because `pinnable`'s answer is deterministic and a list that merely has
      // the same length would hide a swap.
      expect({ offers: `${after.length} of ${before.length}`, slugs: after.map(dish => dish.slug) }).toEqual({
        offers: `${before.length} of ${before.length}`,
        slugs: before.map(dish => dish.slug)
      });
    });

    it('offers nothing it refuses outright: every dish of it is fixed, or carries the warning', async () => {
      // The add-time gate and the offer are the same gate, which is only
      // checkable by spending the offer: each of these is fixed for real and
      // removed again, so the allowance is where it was at the end.
      //
      // **Two answers are right and a third is not** (`0103`). 201 is a dish the
      // day can hold; 409 `FIXED_MEAL_WARNING` is one it cannot, which is a
      // sentence somebody may accept and is why the dish is in the list at all.
      // A 422 would be the offer naming a dish `add` says cannot be fixed to
      // that meal at all, and that is the thing this has always been about.
      const answers: { readonly code?: string; readonly slug: string; readonly status: number; readonly warning?: string }[] = [];

      for (const candidate of shapesOf(after, 3)) {
        const created = await fix(rich, PAIRED, 'dinner', candidate.slug);
        const body = created.body as { id?: string; code?: string; warning?: string };

        answers.push({ slug: candidate.slug, status: created.status, ...(created.status === 201 ? {} : { code: body.code, warning: body.warning }) });

        if (created.status === 201) {
          await request(httpServer(app)).delete(`/${PREFIX}/fixed-meals/${body.id}`).set('Cookie', rich.cookie).expect(204);
        }
      }

      // The whole tally in one assertion, so a red run says which dish answered
      // what rather than only that one of them did.
      expect({ answers, offered: answers.length, refused: answers.filter(answer => answer.status !== 201 && answer.status !== 409) }).toEqual({
        answers,
        offered: answers.length,
        refused: []
      });

      for (const warned of answers.filter(answer => answer.status === 409)) {
        expect(warned).toEqual({ code: 'FIXED_MEAL_WARNING', slug: warned.slug, status: 409, warning: 'clashes_with_fixed' });
      }

      expect((await standing(rich)).rules).toHaveLength(1);
    });

    it('never says `clashes_with_fixed` about a dish it did not offer', async () => {
      // The inverse of what stood here, and it is `0103`'s own promise about
      // this route rather than a weakening: a dish the day cannot hold is
      // *offered* now, so it can never also be in the list of dishes the
      // library has and the person was not offered. `NotOfferedDish` carries no
      // `acceptable` field for the same reason — the one acceptable reason
      // cannot reach it.
      //
      // **While the day holds exactly one rule**, which is what makes the
      // question live: a weekday holding its two answers `[]` to this route
      // whatever is searched for (`0103`), so run after the pair below it would
      // pass on the empty list and say nothing. The count is asserted, not
      // assumed.
      expect((await standing(rich)).rules.filter(rule => rule.weekday === PAIRED)).toHaveLength(1);

      // The whole name, cut to what the field takes, because the answer keeps
      // five reasons and sorts them by name — a short needle pushes the one
      // being asked about off the end.
      for (const dinner of shapesOf(after, 3)) {
        const reasons = await notOffered(rich, PAIRED, 'dinner', dinner.name.slice(0, 120));

        expect({
          clashes: reasons.filter(dish => dish.why === 'clashes_with_fixed'),
          dish: dinner.slug,
          listed: reasons.some(dish => dish.slug === dinner.slug)
        }).toEqual({ clashes: [], dish: dinner.slug, listed: false });
      }
    });

    it('lets a day hold a second meal, and refuses the same meal twice (409)', async () => {
      // The same weekday *and* slot: the lunch offer never counts the slot being
      // chosen — replacing a rule is removing it and writing another — so this
      // passes the dish gate and is refused by the meal.
      const clash = await fix(rich, PAIRED, 'lunch', lunch?.slug);

      expect({ code: (clash.body as { code: string }).code, status: clash.status }).toEqual({ code: 'CONFLICT', status: 409 });
      // The sentence itself, and not a pattern: *every* wording this route has
      // ever had for this mentions a meal, including the one before `0101` that
      // was about the day. A day with one meal left is not full, and a sentence
      // about the day sends somebody to the wrong fix — so a rewording here is a
      // change to this file too, exactly as a tier's number is.
      expect((clash.body as { message: string }).message).toBe('That meal of that day is already fixed');

      // The same weekday, a different meal: 201, and the pair the rest of this
      // block is about. The dinner is the one `consequence` said the day can
      // hold, so the pin is not a warning being accepted silently — the 201
      // below carries no `accept` and would be a 409 for any other dinner the
      // day cannot close around.
      const second = await fix(rich, PAIRED, 'dinner', fitting?.slug);

      expect({ slug: fitting?.slug, status: second.status }).toEqual({ slug: fitting?.slug, status: 201 });
      expect(
        (await standing(rich)).rules
          .filter(rule => rule.weekday === PAIRED)
          .map(rule => rule.slot)
          .sort()
      ).toEqual(['dinner', 'lunch']);
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

      // The third goes to another weekday rather than to `PAIRED`'s last meal,
      // and since `0103` for a plainer reason than the one that stood here: a
      // weekday holds at most `MAX_FIXED_MEALS_PER_DAY` rules, so `PAIRED` is
      // **full** and its third meal is a 409 whatever the allowance says.
      // `fixed-meals-warnings.e2e-spec.ts` is where that is proved, including
      // which of the two bounds answers when both apply.
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
