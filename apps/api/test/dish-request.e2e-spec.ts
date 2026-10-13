import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { AiClient } from '../src/modules/ai/clients/AiClient.js';

import { completeOnboarding, createApp, deleteAccounts, dish, httpServer, PREFIX, recipeRow, register, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { FixableDish, NotOfferedDish } from '../src/modules/fixed-meals/services/index.js';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Asking us to write a dish the library does not have, and being told why a
 * dish it does have was not offered (`0011` § 2 and § 4 a).
 *
 * What is proved on real rows, and what no unit test can prove: that a dish
 * written for somebody **comes back out of the library it was written into** —
 * through `reusablePool`, which filters by locale, safety, cooking time, method
 * and meal — and can then be fixed to that day. A dish sold, stored, and never
 * offered again would be the whole feature failing silently.
 *
 * Then the three ways it must cost nothing: the output gate's refusals, the
 * tier, and a slug the library already holds.
 *
 * **The tiers' numbers are hard-coded here**, as `events-premium` hard-codes
 * premium's: a change to what a tier allows is a change to this file too.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const DISH_REQUESTS_FREE = 0;
const DISH_REQUESTS_PREMIUM = 3;
const FIXED_MEALS_PREMIUM = 3;
/** `FixedMealsService.NOT_OFFERED_SHOWN`: how many reasons one answer carries. */
const NOT_OFFERED_SHOWN = 5;

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
const FRIDAY = 4;

/**
 * This run's own number, written into every dish name this suite dictates.
 *
 * Two things rest on it. The library is **shared and outlives the run** — the
 * accounts are deleted, the recipes are not — so a second run meeting the first
 * one's dishes would find its slugs already taken and never write a row, which
 * is the one case here that must be reached deliberately and not by accident.
 * And digits are the one kind of word `storableName` admits without the
 * vocabulary knowing it, which is why the mark is a number: a random token of
 * letters — what `ScriptedAiClient` appends — is precisely the unknown word the
 * gate refuses.
 */
const stamp = Date.now();

function marked(name: string, mark: string): string {
  return `${name} ${stamp}${mark}`;
}

/**
 * The slug the product will give a dictated name (`PoolBuilder`'s `slugify`),
 * for the rows a test must find — or prove are not there — before it has an
 * answer to read one out of. Every name here is ASCII with single spaces, which
 * is all this has to handle.
 */
function slugOf(name: string): string {
  return name.toLowerCase().replace(/ /g, '-');
}

/**
 * A dinner this profile can actually be served: the harness's own
 * merluza-and-potato dinner, which the library serves and `pinnable` accepts.
 *
 * Every dictated dish that is meant to *reach* the name gate is built from it,
 * so that a refusal can only be the gate's — a dish the scheduler would have
 * refused anyway proves nothing about a name.
 */
function dinner(name: string) {
  return dish(
    name,
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  );
}

/**
 * A model stand-in that answers with the dishes a test dictates, **name for
 * name as written**.
 *
 * `ScriptedAiClient` cannot be used for this feature: it makes each answer
 * unique by appending a random token of letters to the name, and the name a
 * model writes back for a requested dish is read by `storableName` against a
 * vocabulary built from the catalogue and the library — where that token is an
 * unknown word, and every answer would be refused. So this one leaves the name
 * alone, and numbers its answers only where a test asks for it.
 */
class DictatedDishes extends AiClient {
  public calls = 0;
  /** Every prompt this client was sent, so a test can assert what did and did not reach the model. */
  public prompts: string[] = [];
  private arrived = 0;
  private dishes: readonly unknown[] = [];
  private held: Promise<void> = Promise.resolve();
  private numbered = false;
  private open: (() => void) | null = null;
  private wanted = 0;

  get isAvailable(): boolean {
    return true;
  }

  /** What every call answers from now on, exactly as written. */
  answers(dishes: readonly unknown[]): void {
    this.dishes = dishes;
    this.numbered = false;
  }

  /**
   * The same, with the call's own number appended to each name — so requests
   * fired together are answered with *different* dishes, and so different
   * slugs.
   *
   * Without it concurrent requests all receive one dish, the first to store it
   * wins and the rest are handed it back harmlessly: a cap test that can never
   * see the cap.
   */
  answersPerCall(dishes: readonly unknown[]): void {
    this.dishes = dishes;
    this.numbered = true;
  }

  /**
   * Holds every call until `count` of them have arrived.
   *
   * This is what makes the in-lock refusal the only refusal available. The
   * month's allowance is read twice — once before the model call, so nobody
   * pays for a request that cannot be honoured, and again inside the lock that
   * stores the dish, which is where it binds. With every contender waiting
   * here, all of them are already past the first read, so whichever one is
   * refused was refused by the second.
   */
  gate(count: number): void {
    this.arrived = 0;
    this.wanted = count;
    this.held = new Promise<void>(resolve => {
      this.open = resolve;
    });
  }

  async generate<T>(call: AiRequest<T>): Promise<AiResponse<T>> {
    this.calls += 1;
    this.prompts.push(call.prompt);

    const at = this.calls;
    const numbered = this.numbered;
    const dictated = this.dishes;

    if (this.wanted > 0) {
      this.arrived += 1;

      if (this.arrived < this.wanted) {
        await this.held;
      } else {
        this.wanted = 0;
        this.open?.();
      }
    }

    const dishes = dictated.map(base => {
      const written = base as { name: string };

      return numbered ? { ...written, name: `${written.name} ${at}` } : written;
    });

    return { object: { dishes } as T, usage: { calls: 1, inputTokens: 0, model: 'dictated', outputTokens: 0 } };
  }
}

describe('a dish the library does not have', () => {
  let app: INestApplication;
  let ai: DictatedDishes;
  /** Asks for a dish, fixes it, and asks for it again. */
  let asker: Account;
  /** Whose own surname is a food — the case the exact name check exists for. */
  let oliva: Account;
  /** Spends a whole month's allowance at once, with four requests fired together. */
  let racer: Account;
  /** Writes the two library dishes the `not-offered` cases are about. */
  let cook: Account;
  /** The only account that is never granted premium, and the one with an allergy. */
  let celiac: Account;
  /** Every account this suite registered, so `afterAll` deletes each one. */
  const made: string[] = [];

  /** The dish the whole loop is about: asked for, stored, offered, then fixed. */
  const askedFor = dinner(marked('Merluza con patata', '11'));
  /**
   * 45 minutes, which a 30-minute profile does not admit — `timeAllowance(30)`
   * is 40 — and four steps, which is what a dish cooking a quarter of an hour or
   * more owes (`minimumSteps`). Two steps and the schema refuses it, which is
   * the product being right and the fixture being wrong.
   */
  const slowly = {
    ...dinner(marked('Merluza al horno', '41')),
    cookMinutes: 35,
    prepMinutes: 10,
    steps: [
      { cue: 'hasta que marque la temperatura', minutes: 10, text: 'Precalentar el horno a doscientos grados, con calor arriba y abajo' },
      { minutes: 10, text: 'Pelar la patata y cortarla en rodajas de medio centimetro, lo mas iguales que se pueda' },
      { cue: 'hasta que empiecen a dorarse por los bordes', minutes: 20, text: 'Repartir la patata en la bandeja y hornearla a media altura' },
      {
        cue: 'hasta que la carne se separe en lascas',
        minutes: 15,
        text: 'Poner la merluza encima de la patata y seguir horneando a la misma altura'
      }
    ]
  };
  /** Bread and egg: safe for most, an allergen for the celiac, and a breakfast rather than a dinner. */
  const toasted = dish(
    marked('Tostada con huevo', '42'),
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.pan },
      { grams: 120, slug: SEEDED.huevo }
    ]
  );

  const standing = async (who: Account): Promise<FixedMealsView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/fixed-meals`).set('Cookie', who.cookie).expect(200);

    return response.body as FixedMealsView;
  };

  const fixable = async (who: Account, weekday: number, slot: string): Promise<readonly FixableDish[]> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/fixed-meals/fixable?weekday=${weekday}&slot=${slot}`)
      .set('Cookie', who.cookie)
      .expect(200);

    return response.body as readonly FixableDish[];
  };

  const notOffered = async (who: Account, weekday: number, slot: string, query: string): Promise<readonly NotOfferedDish[]> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/fixed-meals/not-offered?weekday=${weekday}&slot=${slot}&q=${encodeURIComponent(query)}`)
      .set('Cookie', who.cookie)
      .expect(200);

    return response.body as readonly NotOfferedDish[];
  };

  const ask = (who: Account, name: string, slot: string, weekday = FRIDAY) =>
    request(httpServer(app)).post(`/${PREFIX}/fixed-meals/request`).set('Cookie', who.cookie).send({ name, slot, weekday });

  const setCookingTime = async (who: Account, cookingTimeMinutes: number): Promise<void> => {
    await request(httpServer(app)).patch(`/${PREFIX}/profile/preferences`).set('Cookie', who.cookie).send({ cookingTimeMinutes }).expect(200);
  };

  beforeAll(async () => {
    ai = new DictatedDishes();
    app = await createApp(ai);

    const allergens: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);
    const glutenId = (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'gluten')?.id ?? '';

    expect(glutenId).not.toBe('');

    asker = await register(app, `dish-request-${stamp}@e2e.invalid`);
    made.push(asker.cookie);
    // The name is the point: `storableName` refuses a dish whose name carries a
    // word of this person's own, whatever the vocabulary says, and "Oliva" is
    // both a Spanish surname and a word the catalogue uses for oil.
    oliva = await register(app, `dish-request-oliva-${stamp}@e2e.invalid`, 'Ana Oliva');
    made.push(oliva.cookie);
    racer = await register(app, `dish-request-race-${stamp}@e2e.invalid`);
    made.push(racer.cookie);
    cook = await register(app, `dish-request-cook-${stamp}@e2e.invalid`);
    made.push(cook.cookie);
    celiac = await register(app, `dish-request-celiac-${stamp}@e2e.invalid`);
    made.push(celiac.cookie);

    for (const account of [asker, oliva, racer, cook]) {
      await completeOnboarding(app, account);
    }

    // Trace-sensitive, so the toast is unsafe for its bread and nothing else has to be arranged.
    await completeOnboarding(app, celiac, [glutenId], [], true);

    // Granted, and the switch thrown: the flag outranks the column (`0042`), so
    // both are needed for a tier to read premium. The celiac is left free,
    // which is the tier case — being refused before the model is called has
    // nothing to do with an allergy.
    for (const account of [asker, oliva, racer, cook]) {
      await UserController.setTier(account.id, 'premium', UNAUDITED);
    }

    await SettingsController.setFlag('premium', true, UNAUDITED);

    // The two library dishes the `not-offered` cases are about, written through
    // the route itself — the only way into the library here. The slow one needs
    // a profile that admits 45 minutes to be written at all (`timeAllowance(40)`
    // is 50); the cooking time then goes back to the 30 minutes everybody else
    // has, which is what makes the dish unservable to its own author.
    await setCookingTime(cook, 40);
    ai.answers([slowly]);
    await ask(cook, 'merluza al horno, con su tiempo', 'dinner').expect(201);
    ai.answers([toasted]);
    await ask(cook, 'una tostada con huevo', 'breakfast').expect(201);
    await setCookingTime(cook, 30);
  }, 240_000);

  afterAll(async () => {
    // The switch is global and every later suite assumes the free tier, so it
    // goes back off whatever happened above — and the grants with it.
    await SettingsController.setFlag('premium', false, UNAUDITED);

    for (const account of [asker, oliva, racer, cook]) {
      if (account) {
        await UserController.setTier(account.id, 'free', UNAUDITED);
      }
    }

    await deleteAccounts(app, made);
    await app?.close();
  });

  it('says what is left of both allowances before anybody asks', async () => {
    expect(await standing(asker)).toEqual({
      dishRequests: { allowed: true, limit: DISH_REQUESTS_PREMIUM, remaining: DISH_REQUESTS_PREMIUM, used: 0 },
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_PREMIUM, remaining: FIXED_MEALS_PREMIUM, used: 0 }
    });

    // A free account is told it may ask for none *before* it types a dish's
    // name, which is the whole reason the two allowances travel together.
    expect((await standing(celiac)).dishRequests).toEqual({ allowed: false, limit: DISH_REQUESTS_FREE, remaining: DISH_REQUESTS_FREE, used: 0 });
  });

  it('writes the dish, offers it for that meal, and fixes it to that day', async () => {
    const calls = ai.calls;

    ai.answers([askedFor]);

    const typed = 'merluza al horno como la hacen en Zarauz';
    const written: Response = await ask(asker, typed, 'dinner').expect(201);

    expect(written.body).toEqual({ id: slugOf(askedFor.name), name: askedFor.name, slug: slugOf(askedFor.name) });
    expect(ai.calls).toBeGreaterThan(calls);

    // What they typed reached the prompt — and stops there. It is never stored,
    // never logged and never put in an answer (`DishRequest`, and the
    // conditions in `docs/legal/analysis.md`), and the name that comes back is
    // the model's, not theirs.
    expect(ai.prompts.at(-1)).toContain('Zarauz');
    expect(JSON.stringify(written.body).toLowerCase()).not.toContain('zarauz');

    // A row of its own, marked as the one thing the month's allowance counts.
    const slug = (written.body as FixableDish).slug;
    const row = await recipeRow(slug);

    expect(row).toEqual({ id: expect.any(String), createdBy: asker.id, ingredients: askedFor.ingredients.length, source: 'user' });

    // The claim nobody had walked: the dish has to come back out of the library
    // it went into — `reusablePool` filters by locale, safety, time, method and
    // meal, and `pinnable` by the day's plate. A dish stored and never offered
    // again is somebody sold a dish they cannot fix.
    const offered = await fixable(asker, FRIDAY, 'dinner');

    expect(offered.map(candidate => candidate.slug)).toContain(slug);

    const fixed: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', asker.cookie)
      .send({ dishSlug: slug, slot: 'dinner', weekday: FRIDAY })
      .expect(201);

    expect(fixed.body).toMatchObject({ dishName: askedFor.name, dishSlug: slug, slot: 'dinner', weekday: FRIDAY });

    const after = await standing(asker);

    expect(after.dishRequests).toEqual({ allowed: true, limit: DISH_REQUESTS_PREMIUM, remaining: DISH_REQUESTS_PREMIUM - 1, used: 1 });
    expect(after.rules).toHaveLength(1);
  });

  it('puts it in the library every other account draws from', async () => {
    // `recipes` is global and `createdBy` is provenance, not an access check
    // (`DishRequest`): a requested dish is in front of every other account for
    // ever, which is published and is why the name is gated at all. Every
    // account here answered onboarding the same way, so the same dinner fits
    // the same plate.
    const offered = await fixable(celiac, FRIDAY, 'dinner');

    expect(offered.map(candidate => candidate.name)).toContain(askedFor.name);
  });

  it('hands back the dish the library already holds, and writes nothing twice', async () => {
    const slug = slugOf(askedFor.name);
    const before = await recipeRow(slug);

    // The model answers with the dish the library already has — which is what a
    // real one does when two accounts ask for the same thing in one month, and
    // what a generation can do between the model's answer and the insert.
    // `recipes.slug` is unique across the whole table, so without
    // `onConflictDoNothing` this is a unique violation dressed up as a 500,
    // after the model call was paid for.
    ai.answers([askedFor]);

    const again: Response = await ask(asker, 'otra vez la merluza al horno', 'dinner').expect(201);

    expect((again.body as FixableDish).slug).toBe(slug);

    // The same row, with its ingredients written once. Written twice, every
    // weight of it in a shopping list would double.
    expect(await recipeRow(slug)).toEqual(before);
    // Nothing spent either: the allowance buys a dish, and that dish exists.
    expect((await standing(asker)).dishRequests.used).toBe(1);
  });

  it('refuses what is not a dish name before the model is called', async () => {
    const calls = ai.calls;

    // The bound is `MAX_DISH_REQUEST`, and one line: the field is a dish's
    // name, not a message box.
    await ask(oliva, 'a'.repeat(121), 'dinner').expect(422);
    await ask(oliva, 'merluza\nal horno', 'dinner').expect(422);

    expect(ai.calls).toBe(calls);
  });

  it('stores nothing when the name the model wrote uses a word the library never has', async () => {
    // Three candidates, which is what a request asks for
    // (`REQUEST_CANDIDATES`), each of them the dinner this suite has already
    // had stored. **That is what makes the refusal attributable**: the pool
    // builder keeps all three, so the build is not short and the model is
    // asked exactly once — a candidate the pool builder had refused would have
    // left it short and sent it back for another round. One call, three dishes
    // kept, and nothing stored: what refused them is the gate on the name.
    const unknown = ['1', '2', '3'].map(nth => dinner(marked('Merluza con patata wzqkt', `21${nth}`)));
    const calls = ai.calls;

    ai.answers(unknown);
    // 409 and not a dish: every candidate was refused, so there is nothing to
    // hand back.
    await ask(oliva, 'merluza con patata', 'dinner').expect(409);

    expect(ai.calls).toBe(calls + 1);

    for (const candidate of unknown) {
      expect(await recipeRow(slugOf(candidate.name))).toBeNull();
    }

    expect((await standing(oliva)).dishRequests).toEqual({ allowed: true, limit: DISH_REQUESTS_PREMIUM, remaining: DISH_REQUESTS_PREMIUM, used: 0 });
  });

  it('stores nothing when the name the model wrote says the person', async () => {
    // "Oliva" is this account's own surname and a word the catalogue uses for
    // oil, so the vocabulary would let it through: the exact check on their own
    // name is the only thing standing between them and a dish named after them
    // in front of everybody, for ever.
    const theirs = ['1', '2', '3'].map(nth => dinner(marked('Merluza con patata y oliva', `22${nth}`)));
    const calls = ai.calls;

    ai.answers(theirs);
    await ask(oliva, 'merluza con patatas', 'dinner').expect(409);

    expect(ai.calls).toBe(calls + 1);

    for (const candidate of theirs) {
      expect(await recipeRow(slugOf(candidate.name))).toBeNull();
    }

    expect((await standing(oliva)).dishRequests.used).toBe(0);
  });

  it('stores nothing when the dish could not be fixed to that meal anyway', async () => {
    // Fifty grams of dinner. Every word of these names is one the vocabulary
    // knows and the pool builder keeps all three — one call again — so what
    // refuses them is `pinnable`: no number of servings between a half and four
    // puts fifty grams inside half of this person's dinner.
    const crumbs = ['1', '2', '3'].map(nth =>
      dish(
        marked('Merluza con patata', `23${nth}`),
        ['dinner'],
        [
          { grams: 25, slug: SEEDED.merluza },
          { grams: 25, slug: SEEDED.patata }
        ]
      )
    );
    const calls = ai.calls;

    ai.answers(crumbs);
    await ask(oliva, 'algo de merluza', 'dinner').expect(409);

    expect(ai.calls).toBe(calls + 1);

    for (const candidate of crumbs) {
      expect(await recipeRow(slugOf(candidate.name))).toBeNull();
    }

    expect((await standing(oliva)).dishRequests.used).toBe(0);
  });

  it('refuses a free account before the model is called', async () => {
    const calls = ai.calls;

    ai.answers([dinner(marked('Merluza con patata', '51'))]);

    const refused: Response = await ask(celiac, 'merluza al horno', 'dinner').expect(429);

    expect((refused.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
    // The point of reading the allowance before the call: a free account's
    // request costs nothing, because no model ever hears it.
    expect(ai.calls).toBe(calls);
  });

  it('gives the month’s three dishes to four requests fired together, and refuses the fourth inside the lock', async () => {
    const contenders = DISH_REQUESTS_PREMIUM + 1;

    // Three dinners a Spanish table serves: no rice, which Table 2 keeps to
    // lunch — a dish `fitSlots` refuses would leave the build short and send it
    // back for a second round the gate below is not counting.
    ai.answersPerCall([
      dinner(marked('Merluza con patata', '31')),
      dish(
        marked('Pollo con tomate', '32'),
        ['dinner'],
        [
          { grams: 170, slug: SEEDED.pollo },
          { grams: 200, slug: SEEDED.tomate }
        ]
      ),
      dish(
        marked('Patata con huevo', '33'),
        ['dinner'],
        [
          { grams: 250, slug: SEEDED.patata },
          { grams: 110, slug: SEEDED.huevo }
        ]
      )
    ]);
    // Every contender waits at the model until all four are there, so all four
    // are past the allowance read that precedes the call: the one refusal that
    // follows can only be the second read, inside the lock that stores a dish.
    ai.gate(contenders);

    const raced: Response[] = await Promise.all(
      Array.from({ length: contenders }, (_none, index) => ask(racer, `una merluza distinta ${index}`, 'dinner'))
    );
    const written = raced.filter(response => response.status === 201);
    const refused = raced.filter(response => response.status === 429);

    expect(written).toHaveLength(DISH_REQUESTS_PREMIUM);
    expect(refused).toHaveLength(contenders - DISH_REQUESTS_PREMIUM);

    for (const response of refused) {
      expect((response.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
    }

    // Four different dishes were offered and three of them exist: the cap is
    // the cap, and the one that lost the race is a dish nobody has.
    expect(new Set(written.map(response => (response.body as FixableDish).slug)).size).toBe(DISH_REQUESTS_PREMIUM);

    for (const response of written) {
      expect(await recipeRow((response.body as FixableDish).slug)).toMatchObject({ createdBy: racer.id, source: 'user' });
    }

    expect((await standing(racer)).dishRequests).toEqual({ allowed: false, limit: DISH_REQUESTS_PREMIUM, remaining: 0, used: DISH_REQUESTS_PREMIUM });
  });

  it('refuses the next request before the model, once the month’s three are written', async () => {
    const calls = ai.calls;
    const refused: Response = await ask(racer, 'una mas, por favor', 'dinner').expect(429);

    expect((refused.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
    expect(ai.calls).toBe(calls);
  });

  it('says a dish the library has was not offered because it is too slow, and that they can act on it', async () => {
    const offered = await fixable(cook, FRIDAY, 'dinner');

    // It is in the library and it is not in the list, which is the defect this
    // route exists for: the owner searched for a dish he had and the screen
    // showed him a shorter list and said nothing.
    expect(offered.map(candidate => candidate.name)).not.toContain(slowly.name);

    const why = await notOffered(cook, FRIDAY, 'dinner', `${stamp}41`);

    expect(why).toEqual([{ actionable: true, name: slowly.name, slug: expect.any(String), why: 'too_slow' }]);
  });

  it('says nothing for a query under three letters, and nothing about a dish it did offer', async () => {
    // Below three letters every dish matches and the answer says nothing.
    expect(await notOffered(cook, FRIDAY, 'dinner', 'me')).toEqual([]);

    const offered = await fixable(cook, FRIDAY, 'dinner');

    expect(offered.map(candidate => candidate.name)).toContain(askedFor.name);
    // Asked about a dish it just offered, it says nothing: the two answers are
    // computed from one assembly precisely so they cannot disagree.
    expect(await notOffered(cook, FRIDAY, 'dinner', `${stamp}11`)).toEqual([]);
  });

  it('never calls an allergen something they can act on, and leads with what they can', async () => {
    const allergen = await notOffered(celiac, FRIDAY, 'breakfast', `${stamp}42`);

    // An allergen is never softened into advice: a refusal, and the screen owes
    // them a plain no rather than two taps.
    expect(allergen).toEqual([{ actionable: false, name: toasted.name, slug: expect.any(String), why: 'allergen' }]);

    // Both of the cook's dishes, read at a dinner by somebody who may eat
    // neither: the slow one they could do something about, the toast they
    // cannot. The one they can act on comes first — a list that leads with a
    // refusal buries the two taps that would have fixed it.
    const both = await notOffered(celiac, FRIDAY, 'dinner', `${stamp}4`);

    expect(both.length).toBeLessThanOrEqual(NOT_OFFERED_SHOWN);
    expect(both.map(entry => [entry.name, entry.actionable, entry.why])).toEqual([
      [slowly.name, true, 'too_slow'],
      [toasted.name, false, 'allergen']
    ]);
  });
});
