import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { activeShoppingList, completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, scriptedName, SEEDED, setLocale } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';

/**
 * An English user gets an English shopping list, which is the half that actually
 * matters.
 *
 * The dish names in these fixtures are English because the *model* was told to
 * write in English — that half is the prompt's job and is asserted through the
 * prompt. The ingredient names are the product's job: they come from
 * `ingredient_names`, resolved by the profile's locale, and they are what a user
 * reads while standing in a supermarket.
 *
 * Requires DATABASE_URL and a seeded catalogue **including `en-GB` names** — run
 * `pnpm --filter database seed` after migrating. See ./README.md.
 */

/** Slug → the seeded en-GB name. If the seed drifts, these are the assertions that say so. */
const ENGLISH_NAMES: Record<string, string> = {
  [SEEDED.arroz]: 'Cooked white rice',
  [SEEDED.huevo]: 'Egg',
  [SEEDED.lentejas]: 'Cooked lentils',
  [SEEDED.merluza]: 'Hake',
  [SEEDED.patata]: 'Potato',
  [SEEDED.pollo]: 'Chicken breast',
  [SEEDED.yogur]: 'Natural Greek yoghurt'
};

const POOL = [
  dish('Greek yoghurt bowl', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Scrambled eggs', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish('Yoghurt and egg', ['breakfast'], [
    { grams: 150, slug: SEEDED.yogur },
    { grams: 100, slug: SEEDED.huevo }
  ]),
  dish('Egg and potato hash', ['breakfast'], [
    { grams: 120, slug: SEEDED.huevo },
    { grams: 120, slug: SEEDED.patata }
  ]),
  dish('Yoghurt bowl, large', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }]),
  dish('Rice with chicken', ['lunch'], [
    { grams: 220, slug: SEEDED.arroz },
    { grams: 180, slug: SEEDED.pollo }
  ]),
  dish('Lentils with rice', ['lunch'], [
    { grams: 250, slug: SEEDED.lentejas },
    { grams: 150, slug: SEEDED.arroz }
  ]),
  dish('Chicken with potato', ['lunch'], [
    { grams: 200, slug: SEEDED.pollo },
    { grams: 250, slug: SEEDED.patata }
  ]),
  dish('Rice and lentils', ['lunch'], [
    { grams: 200, slug: SEEDED.arroz },
    { grams: 200, slug: SEEDED.lentejas }
  ]),
  dish('Lentil bowl', ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish('Hake with potato', ['dinner'], [
    { grams: 200, slug: SEEDED.merluza },
    { grams: 220, slug: SEEDED.patata }
  ]),
  dish('Hake with rice', ['dinner'], [
    { grams: 190, slug: SEEDED.merluza },
    { grams: 200, slug: SEEDED.arroz }
  ]),
  dish('Chicken with rice', ['dinner'], [
    { grams: 190, slug: SEEDED.pollo },
    { grams: 210, slug: SEEDED.arroz }
  ]),
  dish('Egg with potato', ['dinner'], [
    { grams: 150, slug: SEEDED.huevo },
    { grams: 250, slug: SEEDED.patata }
  ]),
  dish('Hake with lentils', ['dinner'], [
    { grams: 180, slug: SEEDED.merluza },
    { grams: 200, slug: SEEDED.lentejas }
  ])
];

describe('an English account, end to end', () => {
  let app: INestApplication;
  let account: Account;
  let ai: ScriptedAiClient;

  beforeAll(async () => {
    ai = new ScriptedAiClient(POOL);
    app = await createApp(ai);
    account = await register(app, `locale-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account);
    await setLocale(app, account, 'en-GB');
    // Shopping in Britain, so the Spain-only shelf is not theirs (`0034`).
    await request(httpServer(app)).patch(`/${PREFIX}/profile`).set('Cookie', account.cookie).send({ country: 'GB' }).expect(200);
  }, 120_000);

  afterAll(async () => {
    if (account) {await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', account.cookie);}

    await app.close();
  });

  it('writes the prompt in English and asks for English back', async () => {
    const job = await generateAndWait(app, account, 180_000);

    expect(job.status).toBe('succeeded');
    expect(ai.prompts.length).toBeGreaterThan(0);

    const prompt = ai.prompts[0] as string;

    // One prompt, in English, for every user — the output language is the only
    // part that varies.
    expect(prompt).toContain('Design dishes for a 14-day meal plan.');
    expect(prompt).toContain('BRITISH ENGLISH');
    // The catalogue listing is in the user's language too, so dish names come
    // back using words they know.
    expect(prompt).toContain(`${SEEDED.arroz} (${ENGLISH_NAMES[SEEDED.arroz] as string})`);
    expect(prompt).not.toContain('Arroz blanco cocido');
  }, 200_000);

  it('reads the shopping list back in whatever language they are in now', async () => {
    const server = httpServer(app);

    // Built while they were English; read again in Spanish. The stored name is a
    // snapshot of the day the list was made, and a person who switches language
    // was keeping it forever.
    await setLocale(app, account, 'es-ES');

    const spanish: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', account.cookie).expect(200);
    const names = (spanish.body as { items: { name: string }[] }).items.map(item => item.name);

    expect(names.length).toBeGreaterThan(0);
    expect(names.some(name => Object.values(ENGLISH_NAMES).includes(name))).toBe(false);

    await setLocale(app, account, 'en-GB');
  }, 60_000);

  it('never offers them a food that is only sold in Spain', async () => {
    const prompt = ai.prompts[0] as string;

    // The catalogue the model is given is already filtered: a dish it cannot
    // propose is a dish nothing downstream has to reject. Sobrasada is the
    // clearest case — a Mallorcan sausage with no British shelf.
    expect(prompt).not.toContain('sobrasada');
    expect(prompt).not.toContain('jamon-serrano');
    expect(prompt).not.toContain('pimenton-dulce');
    // And the rest of the catalogue is still there, which is why filtering
    // cannot starve a plan: thirty rows out of nine hundred.
    expect(prompt).toContain(SEEDED.arroz);
  }, 200_000);

  it('gives them a shopping list with no Spanish in it', async () => {
    const list = await activeShoppingList(app, account);

    expect(list.items.length).toBeGreaterThan(0);

    // Every name must be one the en-GB catalogue supplied. A fallback to Spanish
    // is a legitimate *runtime* state — a locale the catalogue lacks — but not
    // here: the seed has en-GB for every one of these.
    const english = new Set(Object.values(ENGLISH_NAMES));

    for (const item of list.items) {
      expect(english.has(item.name)).toBe(true);
    }
  });

  it('scopes reuse to the locale, so a Spanish recipe cannot arrive in an English plan', async () => {
    const plan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const names = (plan.body as PlanView).days.flatMap(day => day.meals.map(meal => meal.name));

    expect(names.length).toBeGreaterThan(0);

    // Every dish came from this generation's English pool. A recipe is
    // locale-bound in a way an ingredient is not: handing "Tostada de aguacate"
    // to an English user is not a translation gap, it is the wrong dish.
    const scripted = new Set(POOL.map(candidate => candidate.name));

    for (const name of names) {
      expect(scripted.has(scriptedName(name))).toBe(true);
    }
  });
});
