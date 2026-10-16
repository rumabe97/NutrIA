import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { DEFAULT_KITCHEN, MAX_PREFERRED_APPLIANCES } from 'core/entities/Kitchen';

import {
  completeOnboarding,
  copyDishDeclaring,
  createApp,
  deleteAccounts,
  dish,
  forgetRecipes,
  generateAndWait,
  httpServer,
  platesOfPlan,
  POOL,
  PREFIX,
  recipesDeclaring,
  recipeSlugsNamed,
  register,
  rejectionsOfLastGeneration,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account, PlateRow } from './harness.js';
import type { FixableDishDto, NotOfferedDishDto } from '../src/modules/fixed-meals/dto/out/index.js';
import type { INestApplication } from '@nestjs/common';
import type { KitchenView } from 'core/controllers/Kitchen';
import type { MealDetailView, PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A kitchen is what it has, what it has not, and what somebody would rather use
 * (`0102`, project 021).
 *
 * **Only the constraint half is here, and that is a measurement rather than a
 * shortcut.** "Does not have" is enforced in code — a prompt line, a gate on
 * what the model returns, and a filter on what the library may reuse — so every
 * claim below is reachable with `AI_PROVIDER=stub`. "Would rather use" is asked
 * of the model and may never remove a dish, so the only honest test of it is one
 * generation against a real provider, which is the owner's (`0102` § *Still
 * owed*). What *is* asserted here about a preference is the half that is code:
 * the bound on how many may be held, and that holding one changes nothing else
 * about the request it arrived in.
 *
 * **The oven, and nothing else.** Phase 6 counted the `equipment` column in both
 * libraries: stovetop 1,041, oven 58, blender 20, microwave 3, and **zero**
 * dishes declaring an air fryer, a grill, a steamer, a slow cooker or a rice
 * cooker. An assertion about a preferred air fryer bringing air-fryer dishes
 * cannot pass against any library that exists, and an air-fryer *fixture* would
 * pass against a filter that does nothing. The oven is the one appliance with a
 * real library behind it, so it is the one the gate is tested with.
 *
 * What no unit test can say, and this does:
 *
 * 1. A fortnight generated for a kitchen with no oven holds **no** oven dish,
 *    while the model answers with oven dishes and the library holds dozens of
 *    them — and the same library serves one to the kitchen that has an oven, on
 *    the weekday it was asked for.
 * 2. The fixed-meal offer refuses one of those dishes with `missing_equipment`,
 *    actionable, and **offers the same dish, by slug, to the account that has an
 *    oven** — so the refusal is about the kitchen and not about the dish.
 * 3. One account's kitchen narrows nothing of another's (`0019`), including when
 *    a body names somebody else's id.
 * 4. The route the web never uses carries it: `PATCH /profile/preferences` takes
 *    `kitchen` beside `cookingTimeMinutes`, and a refused fourth preference
 *    leaves the cooking time where it was.
 * 5. Preferring an appliance the library **does** have dishes for takes none of
 *    them away: the offered library comes back slug for slug.
 *
 * **It brings its own dishes, twice over, because the gate and the filter need
 * different instruments.**
 *
 * `POOL` (`harness.ts`) declares no equipment at all, so nothing in it can be
 * refused by a kitchen — and it must stay that way, because every other suite
 * here shares it and a dish needing an oven would quietly narrow their pools
 * too. The nine dishes below are copies of `POOL`'s own, same ingredients and
 * same grams, with one field added, and what they are for is the **gate**: it
 * can only fire on a dish the model returns.
 *
 * The **filter** needs a row, and a row cannot be had by scripting one: a dish
 * the model writes is stored only if the plan uses it, and whether the
 * scheduler reaches for one is a property of the library it competes with.
 * Measured both ways while writing this (2026-10-16): against the development
 * library's 1,128 dishes two runs of this suite stored **0 and 2** fresh rows
 * out of eighty-four plates, because the pool's days land 6% over the protein
 * band (README § *The shared pool cannot reach the macro bands*) and a real
 * dish wins nearly every slot; against a database built the way CI builds it, 6
 * plates of 42 were fresh and **none of the six was one of the nine**. Neither
 * number is a bug and neither can be relied on. So the dish the offer and the plan are read
 * on is a **copy of a dish this person is already offered**, with the oven
 * declared on it (`copyDishDeclaring`) — same slots, same minutes, same
 * ingredients, same macros, one field different, on either database. A filter
 * does not care whose dish it is, which is the whole reason this works: the 58
 * oven dishes the development library already holds are refused by the same
 * line of code, and this suite watches them being refused too.
 *
 * No in-band day is needed anywhere here: every offer read below is the
 * **first** rule on a weekday that holds nothing, which is the unnarrowed path.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
const THURSDAY = 3;

/** One stamp for the file, so three accounts and nine dishes are named together. */
const stamp = Date.now();
const MARK = `H${stamp}`;

/**
 * The nine dishes that declare an oven: three of each slot's five `POOL` shapes,
 * copied with `equipment` added.
 *
 * Nine rather than one because the claim they serve is a count — the gate fired
 * on what the model returned — and three slots rather than one because a model
 * is asked per slot, so a single-slot fixture would leave two calls with nothing
 * to refuse and no way to tell that from a gate that does not work.
 */
const OVEN = [
  dish(
    `${MARK} Avena con yogur`,
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.avena },
      { grams: 150, slug: SEEDED.yogur }
    ]
  ),
  dish(
    `${MARK} Tostada con huevo`,
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.pan },
      { grams: 120, slug: SEEDED.huevo }
    ]
  ),
  dish(`${MARK} Avena sola`, ['breakfast'], [{ grams: 110, slug: SEEDED.avena }]),
  dish(
    `${MARK} Arroz con pollo`,
    ['lunch'],
    [
      { grams: 220, slug: SEEDED.arroz },
      { grams: 180, slug: SEEDED.pollo }
    ]
  ),
  dish(
    `${MARK} Lentejas con arroz`,
    ['lunch'],
    [
      { grams: 250, slug: SEEDED.lentejas },
      { grams: 150, slug: SEEDED.arroz }
    ]
  ),
  dish(`${MARK} Lentejas solas`, ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish(
    `${MARK} Merluza con patata`,
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  ),
  dish(
    `${MARK} Merluza con arroz`,
    ['dinner'],
    [
      { grams: 180, slug: SEEDED.merluza },
      { grams: 180, slug: SEEDED.arroz }
    ]
  ),
  dish(`${MARK} Merluza sola`, ['dinner'], [{ grams: 300, slug: SEEDED.merluza }])
].map(each => ({ ...each, equipment: ['oven'] }));

/** The kitchen of somebody who has never said anything, as a route answers it. */
const UNSPOKEN: KitchenView = { appliances: DEFAULT_KITCHEN, described: false, maxPreferred: MAX_PREFERRED_APPLIANCES };

/** Which of a plan's plates declare an appliance, by name — the sentence a red run needs. */
function declaring(plates: readonly PlateRow[], appliance: string): readonly string[] {
  return plates.filter(plate => plate.equipment.includes(appliance)).map(plate => plate.name);
}

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

describe('the kitchen somebody cooks in (0102)', () => {
  let app: INestApplication;
  /** Says nothing about their kitchen: the default, which has an oven. */
  let cook: Account;
  /** Says they have no oven, through the preferences route. */
  let noOven: Account;
  /** Only ever used for the bound on `prefers`, so nothing it says can move a pool above. */
  let fussy: Account;
  const made: string[] = [];
  /** Every slug the library declares an oven for — this suite's copy, the seed's, anybody's. */
  let ovenSlugs: ReadonlySet<string> = new Set();
  /** The copy: a dinner `cook` is offered, with an oven declared on it. */
  let ovenDinner: { readonly name: string; readonly slug: string } | undefined;

  const kitchenOfProfile = async (who: Account): Promise<KitchenView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', who.cookie).expect(200);

    return (response.body as { kitchen: KitchenView }).kitchen;
  };

  /** `PATCH /profile/preferences`, without an expectation: every case below asserts its own status. */
  const patchPreferences = async (who: Account, body: object): Promise<Response> =>
    request(httpServer(app)).patch(`/${PREFIX}/profile/preferences`).set('Cookie', who.cookie).send(body);

  const cookingTime = async (who: Account): Promise<number | null> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', who.cookie).expect(200);

    return (response.body as { preferences: { cookingTimeMinutes: number | null } | null }).preferences?.cookingTimeMinutes ?? null;
  };

  const fixable = async (who: Account, weekday: number, slot: string): Promise<readonly FixableDishDto[]> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/fixed-meals/fixable?weekday=${weekday}&slot=${slot}`)
      .set('Cookie', who.cookie)
      .expect(200);

    return response.body as readonly FixableDishDto[];
  };

  const notOffered = async (who: Account, weekday: number, slot: string, query: string): Promise<readonly NotOfferedDishDto[]> => {
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals/not-offered`)
      .set('Cookie', who.cookie)
      .send({ query, slot, weekday })
      .expect(200);

    return response.body as readonly NotOfferedDishDto[];
  };

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    // One client for both generations, so the kitchen is the only difference
    // between them: the same nine oven dishes reach `cook` and `noOven`, and one
    // of the two throws every one of them away.
    app = await createApp(new ScriptedAiClient([...POOL, ...OVEN]));

    cook = await register(app, `kitchen-oven-${stamp}@e2e.invalid`);
    made.push(cook.cookie);
    noOven = await register(app, `kitchen-no-oven-${stamp}@e2e.invalid`);
    made.push(noOven.cookie);
    fussy = await register(app, `kitchen-prefers-${stamp}@e2e.invalid`);
    made.push(fussy.cookie);

    await completeOnboarding(app, cook);
    await completeOnboarding(app, noOven);
    await completeOnboarding(app, fussy);
  }, 120_000);

  afterAll(async () => {
    await deleteAccounts(app, made);
    // Every dish this suite put in the library, which is the one thing deleting
    // its accounts does not remove: the copy, and whichever of the nine scripted
    // oven dishes a plan happened to use and so store — four of them on a
    // CI-shaped database, none at all against the development library. Left
    // behind they would be oven dishes named `H<timestamp> …` in the development
    // library for ever, narrowing the pool of every account without an oven.
    //
    // **The accounts first**: a plan that served one holds it
    // (`meals.recipe_id` is `RESTRICT`), and the plans go with the accounts.
    await forgetRecipes([...(ovenDinner ? [ovenDinner.slug] : []), ...(await recipeSlugsNamed(`${MARK} `))]);
    await app?.close();
  });

  it('reads the default kitchen for somebody who has never said anything, and says they have not', async () => {
    // `described: false` is what lets a screen say that silence means a normal
    // kitchen rather than show three choices nobody made (`0102`); and the whole
    // ten-appliance answer is asserted, because every caller reads
    // `kitchen[appliance]` without asking first whether this person ever opened
    // the screen.
    //
    // It is also the **skip path**, end to end and for free: `completeOnboarding`
    // walks the seven required steps and never the optional kitchen one, and
    // `POST /onboarding/complete` accepted it — so three accounts finished
    // onboarding, generate plans below, and read as the kitchen of somebody who
    // was never asked. An optional step that had quietly become required would
    // fail this file in `beforeAll`.
    expect(await kitchenOfProfile(cook)).toEqual(UNSPOKEN);
    expect(await kitchenOfProfile(noOven)).toEqual(UNSPOKEN);
  });

  it('takes a kitchen on the preferences route, which no screen sends it on', async () => {
    // The route's own path and not the screen's: the web describes a kitchen
    // through onboarding, and `PATCH /profile/preferences` is what the API
    // accepts as well (`UpdatePreferences.dto.ts` → `kitchenChanges`). A suite
    // that only drove what the screen drives would never cover it.
    const said = await patchPreferences(noOven, { kitchen: [{ appliance: 'oven', stance: 'missing' }] });

    expect(said.status).toBe(200);
    expect((said.body as { kitchen: KitchenView }).kitchen).toEqual({
      appliances: { ...DEFAULT_KITCHEN, oven: 'missing' },
      described: true,
      maxPreferred: MAX_PREFERRED_APPLIANCES
    });
    // And it is a row rather than an answer: read back through the other route.
    expect(await kitchenOfProfile(noOven)).toEqual({ ...UNSPOKEN, appliances: { ...DEFAULT_KITCHEN, oven: 'missing' }, described: true });
  });

  it('is nobody else’s kitchen, and a body naming another account changes nothing (0019)', async () => {
    // Said after `noOven` has spoken and before anything is generated: every
    // pool below rests on these accounts having different kitchens, and nothing
    // but their own words put them there.
    expect(await kitchenOfProfile(cook)).toEqual(UNSPOKEN);

    const spoofed = await patchPreferences(fussy, { kitchen: [{ appliance: 'oven', stance: 'has' }], userId: noOven.id });

    expect(spoofed.status).toBe(200);
    // The id in the body is not read — the account comes from the session on
    // every route (`ProfilesController`) — so `noOven` still has no oven, and
    // what `fussy` wrote is `fussy`'s own.
    expect((await kitchenOfProfile(noOven)).appliances.oven).toBe('missing');
    expect(await kitchenOfProfile(fussy)).toEqual({ ...UNSPOKEN, described: true });
  });

  it('generates for the kitchen that has an oven, refusing none of what the model returned', async () => {
    // **First, and that is about the whole run rather than about this suite.**
    // Jest orders files by size, so where this one lands among fifty-three is a
    // property of how long it is; on CI the library is whatever the suites
    // before it generated, and for the first of them that is **nothing at all**
    // (README § *In CI*). A suite whose first act is to read an offer would pass
    // alone, after a dozen others had filled the library, and fail the day it
    // grew a paragraph and moved up the list. This generation is what makes the
    // offer below exist, on an empty database and on a thousand recipes alike.
    const job = await generateAndWait(app, cook);

    expect(job.status).toBe('succeeded');
    // Nothing of what the model returned was thrown away for an appliance,
    // because this kitchen lacks none — the tally for `noOven` later is the same
    // nine dishes from the same client, and it is not empty. The comparison is
    // what makes that one the gate's doing rather than the library's.
    expect(await rejectionsOfLastGeneration(cook.id)).not.toHaveProperty('missing_equipment');
  }, 180_000);

  it('offers an oven dish to the kitchen that has one, and none at all to the kitchen that has not', async () => {
    const before = await fixable(cook, THURSDAY, 'dinner');

    ovenSlugs = await recipesDeclaring('oven');

    // The offer is not empty, which is what the copy below rests on — and an
    // empty one would make every refusal after this vacuous.
    expect(before.length).toBeGreaterThan(0);

    // The shortest-named dinner that needs **no** appliance: the mark goes in
    // front of its name, and a dish's name is bounded at 120 characters
    // wherever the product parses one. Needing none matters more — the
    // generation above may have stored some of the nine, and copying one of
    // those would make the comparison below two oven dishes rather than a dish
    // and itself.
    const plain = before.filter(each => !ovenSlugs.has(each.slug)).sort((a, b) => a.name.length - b.name.length)[0];

    expect(plain).toBeDefined();

    // A dinner this person is **already offered**, copied with an oven on it:
    // so if the copy is then refused, the only thing that can have refused it
    // is the field that differs.
    ovenDinner = await copyDishDeclaring(plain?.slug ?? '', 'oven', MARK);
    ovenSlugs = await recipesDeclaring('oven');

    expect(ovenSlugs.has(ovenDinner.slug)).toBe(true);

    const mine = await fixable(cook, THURSDAY, 'dinner');
    const theirs = await fixable(noOven, THURSDAY, 'dinner');

    // The whole claim in one assertion, because no half of it stands alone: one
    // library, two reusable pools, the copy in one of them and in the other
    // neither it nor any other oven dish — on this machine that second list is
    // where the development library's own 58 are refused as well.
    expect({
      copy: mine.some(each => each.slug === ovenDinner?.slug),
      offered: theirs.length > 0,
      original: theirs.some(each => each.slug === plain?.slug),
      theirs: theirs.filter(each => ovenSlugs.has(each.slug)).map(each => each.slug)
    }).toEqual({ copy: true, offered: true, original: true, theirs: [] });
  }, 60_000);

  it('says `missing_equipment` for it, actionable, and refuses to fix it — while fixing it for the other account', async () => {
    // The whole name, so the answer holds exactly this dish: the reasons are
    // capped at five and sorted, and a shorter needle could push the one being
    // asked about off the end.
    const needle = (ovenDinner?.name ?? '').slice(0, 120);
    const refusedReason = (await notOffered(noOven, THURSDAY, 'dinner', needle)).find(each => each.slug === ovenDinner?.slug);

    expect(refusedReason).toEqual({ actionable: true, name: ovenDinner?.name, slug: ovenDinner?.slug, why: 'missing_equipment' });

    // Nothing was said to `cook` about it, which is what makes the reason
    // attributable: the dish is absent from its *not offered* answer because it
    // is present in its offer.
    expect((await notOffered(cook, THURSDAY, 'dinner', needle)).map(each => each.slug)).not.toContain(ovenDinner?.slug);

    // The offer and the add-time gate are the same gate, which is only
    // checkable by spending the offer. 422 and the field is the **dish**: this
    // route answers 422 for a meal they do not eat and for an unfinished profile
    // too, and the one meant here is about the dish.
    const theirs = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', noOven.cookie)
      .send({ dishSlug: ovenDinner?.slug, slot: 'dinner', weekday: THURSDAY });
    const body = theirs.body as { code: string; fieldErrors?: Record<string, readonly string[]> };

    expect({ code: body.code, fields: Object.keys(body.fieldErrors ?? {}), status: theirs.status }).toEqual({
      code: 'INVALID_INPUT',
      fields: ['dishSlug'],
      status: 422
    });

    // The same dish, the same weekday, the same meal, for the account that has
    // an oven: 201. The rule stays standing — the generation below is what it is
    // for.
    const mine = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', cook.cookie)
      .send({ dishSlug: ovenDinner?.slug, slot: 'dinner', weekday: THURSDAY });

    expect({ slug: ovenDinner?.slug, status: mine.status }).toEqual({ slug: ovenDinner?.slug, status: 201 });
  });

  it('serves that oven dish to the kitchen that has an oven, and names the appliance on the plate', async () => {
    // The control for the fortnight below, and a deterministic one: a pin is
    // honoured on both of its weekday's days (`0098`, proved on real rows by
    // `fixed-meals.e2e-spec.ts`), so this library demonstrably *can* put an oven
    // dish on a plate — which is what makes "no oven dish at all" next door a
    // statement about the kitchen rather than about the library or the dice.
    const job = await generateAndWait(app, cook);

    expect(job.status).toBe('succeeded');

    const plates = await platesOfPlan(job.planId ?? '');

    expect(declaring(plates, 'oven').length).toBeGreaterThan(0);

    const plan = await activePlan(cook);
    const thursdays = plan.days.filter(day => weekdayOf(day.date) === THURSDAY);

    expect(thursdays.length).toBeGreaterThan(0);

    for (const day of thursdays) {
      const dinner = day.meals.find(meal => meal.slot === 'dinner');

      expect({ day: day.date, name: dinner?.name }).toEqual({ day: day.date, name: ovenDinner?.name });

      // The declaration travels to a screen and not only to the filter
      // (`0102`): the meal detail names the appliances, an icon and a word each,
      // which is where a person reads them before they start cooking.
      const detail: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/meals/${dinner?.id}`).set('Cookie', cook.cookie).expect(200);

      expect((detail.body as MealDetailView).equipment).toContain('oven');
    }
  }, 180_000);

  it('serves a fortnight with no oven dish at all to the kitchen that has none', async () => {
    const job = await generateAndWait(app, noOven);

    expect(job.status).toBe('succeeded');

    const plates = await platesOfPlan(job.planId ?? '');
    const rejected = await rejectionsOfLastGeneration(noOven.id);

    // Both halves in one assertion, because either alone passes for the wrong
    // reason: zero oven plates is true of many fortnights whatever the kitchen,
    // and a rejection tally says the gate fired without saying the plan came out
    // clean. `missing_equipment` is only ever written by `PoolBuilder` refusing a
    // dish the model returned for an appliance this person said they lack — the
    // nine above, which the same client had just handed `cook`.
    expect({ gateFired: (rejected.missing_equipment ?? 0) > 0, oven: declaring(plates, 'oven'), plates: plates.length > 0 }).toEqual({
      gateFired: true,
      oven: [],
      plates: true
    });

    // Said on its own, so a red run names which half of the claim went wrong:
    // there were oven dishes in the library to be served, which on this machine
    // is 58 of them beside the copy and on a CI-shaped database is the copy and
    // whatever of the nine was stored. `reusablePool` is where they were kept
    // out of the pool this plan was built from.
    expect(ovenSlugs.size).toBeGreaterThan(0);
  }, 180_000);

  /**
   * What somebody would rather use: the half of it that is code.
   *
   * Three at most, the same on both tiers — a product bound and not a price
   * (`marketing`, 2026-10-15) — checked inside the repository's lock and
   * answered as 422 with `fieldErrors.appliance`, because nothing here is spent
   * or counted and there is no tier to upgrade to.
   *
   * Every case is on `fussy`, which never generates: a `prefers` stance may not
   * remove a dish (`withinEquipment` compares `missing` and nothing else), and
   * whether the prompt line works is not a question a stubbed model can answer.
   */
  describe('the bound on what somebody would rather use', () => {
    /**
     * The **oven** among them, deliberately: it is the one appliance this
     * library has dishes for, so it is the only one whose preference could
     * remove anything if `withinEquipment` read `prefers` as well as `missing`.
     * Preferring an air fryer and asserting that nothing moved would pass
     * against a filter that was wrong in exactly that way, because there is no
     * air-fryer dish for it to take.
     */
    const PREFERRED = ['oven', 'air_fryer', 'grill'] as const;

    it('writes three preferences in one body, and removes nothing from the library', async () => {
      const before = (await fixable(fussy, THURSDAY, 'dinner')).map(each => each.slug).sort();

      // The claim is only worth making if there was something to lose: oven
      // dishes among the ones offered, which the copy above guarantees on either
      // database.
      expect(before.filter(slug => ovenSlugs.has(slug)).length).toBeGreaterThan(0);

      const three = await patchPreferences(fussy, { kitchen: PREFERRED.map(appliance => ({ appliance, stance: 'prefers' })) });

      expect(three.status).toBe(200);
      expect((three.body as { kitchen: KitchenView }).kitchen.appliances).toEqual({
        ...DEFAULT_KITCHEN,
        air_fryer: 'prefers',
        grill: 'prefers',
        oven: 'prefers'
      });

      // A preference is an order the library is read in and a line in the
      // prompt, and **never** a dish taken away (`0102`): `withinEquipment`
      // compares `missing` and nothing else. Same slugs, every one of them.
      expect((await fixable(fussy, THURSDAY, 'dinner')).map(each => each.slug).sort()).toEqual(before);
    }, 60_000);

    it('refuses the fourth and leaves the cooking time it arrived beside untouched', async () => {
      // The case no screen will ever generate, which is exactly why a suite
      // should: a kitchen and a cooking time in one body. `ProfilesService`
      // applies the kitchen **first**, so a refused appliance leaves the
      // preferences of the same request unwritten — and a change to that order
      // would be a 422 that quietly moved somebody's cooking time.
      const before = await cookingTime(fussy);

      expect(before).toBe(30);

      const refused = await patchPreferences(fussy, { cookingTimeMinutes: 90, kitchen: [{ appliance: 'slow_cooker', stance: 'prefers' }] });
      const body = refused.body as { code: string; fieldErrors?: Record<string, readonly string[]> };

      expect({ code: body.code, fields: Object.keys(body.fieldErrors ?? {}), status: refused.status }).toEqual({
        code: 'INVALID_INPUT',
        fields: ['appliance'],
        status: 422
      });
      expect(await cookingTime(fussy)).toBe(before);

      const after = await kitchenOfProfile(fussy);

      // The three it had are still there and the fourth was not written: a
      // refusal that had cleared one to make room would read as a success.
      expect(after.appliances.slow_cooker).toBe('missing');
      expect(Object.values(after.appliances).filter(stance => stance === 'prefers')).toHaveLength(MAX_PREFERRED_APPLIANCES);
    });

    it('never counts an appliance against itself', async () => {
      // Re-stating a preference somebody already holds is the fourth write and
      // never the fourth preference: the appliance being written is left out of
      // the count by the repository.
      const again = await patchPreferences(fussy, { kitchen: [{ appliance: 'air_fryer', stance: 'prefers' }] });

      expect(again.status).toBe(200);
      expect((again.body as { kitchen: KitchenView }).kitchen.appliances.air_fryer).toBe('prefers');
    });

    it('swaps one preference for another in a single body', async () => {
      // The order `KitchenController.applyChanges` exists for: written as they
      // arrive, the new preference meets the old one still standing and is
      // refused as a fourth. Everything that is not `prefers` goes first, and
      // the body below is in the wrong order on purpose.
      const swapped = await patchPreferences(fussy, {
        kitchen: [
          { appliance: 'slow_cooker', stance: 'prefers' },
          { appliance: 'grill', stance: 'has' }
        ]
      });

      expect(swapped.status).toBe(200);

      const kitchen = (swapped.body as { kitchen: KitchenView }).kitchen;

      expect({ grill: kitchen.appliances.grill, slow_cooker: kitchen.appliances.slow_cooker }).toEqual({ grill: 'has', slow_cooker: 'prefers' });
      expect(Object.values(kitchen.appliances).filter(stance => stance === 'prefers')).toHaveLength(MAX_PREFERRED_APPLIANCES);
    });

    it('takes a stance back with null, and clearing one nobody ever set answers the same', async () => {
      const cleared = await patchPreferences(fussy, { kitchen: [{ appliance: 'grill', stance: null }] });

      expect(cleared.status).toBe(200);
      // Back to whatever the default says about it — not to an absence of its
      // own: silence is not a state (`0102`).
      expect((cleared.body as { kitchen: KitchenView }).kitchen.appliances.grill).toBe(DEFAULT_KITCHEN.grill);

      // Idempotent on purpose, and the one place this controller does not answer
      // a missing row with a 404: `rice_cooker` is a catalogue key every account
      // shares, and no answer about it says anything about anybody.
      const never = await patchPreferences(fussy, { kitchen: [{ appliance: 'rice_cooker', stance: null }] });

      expect(never.status).toBe(200);
      expect((never.body as { kitchen: KitchenView }).kitchen.appliances.rice_cooker).toBe(DEFAULT_KITCHEN.rice_cooker);
    });

    it('refuses a shape it does not know and writes nothing of the request', async () => {
      // The DTO's half of the same body: an appliance outside the catalogue, an
      // appliance named twice, a stance that is not one of the three. All three
      // are 422 before anything is applied, so the cooking time beside them is
      // untouched for a second reason — the controller is never reached at all.
      for (const kitchen of [
        [{ appliance: 'toaster', stance: 'has' }],
        [
          { appliance: 'oven', stance: 'has' },
          { appliance: 'oven', stance: 'missing' }
        ],
        [{ appliance: 'oven', stance: 'sometimes' }]
      ]) {
        const refused = await patchPreferences(fussy, { cookingTimeMinutes: 45, kitchen });

        expect({ kitchen, status: refused.status }).toEqual({ kitchen, status: 422 });
      }

      expect(await cookingTime(fussy)).toBe(30);
    });
  });
});
