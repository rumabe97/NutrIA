import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { activeShoppingList, completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';

/**
 * The two halves of the free-text allergy promise, both asserted end to end.
 *
 * A user types "Tomate" — an ingredient the catalogue has, and one carrying no
 * EU-14 allergen at all, so nothing in the allergen tables would ever stop it.
 * The scripted model then proposes tomato dishes **on purpose**, as a model
 * ignoring its instructions would.
 *
 * They also type "marisco", which is a *group* the matcher deliberately refuses
 * to resolve — mapping it to one member would exclude that member and leave the
 * rest on the plate under an interface saying the allergy was enforced.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

const SAFE = [
  dish('Yogur natural', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish('Avena con yogur', ['breakfast'], [
    { grams: 60, slug: SEEDED.avena },
    { grams: 150, slug: SEEDED.yogur }
  ]),
  dish('Huevo con pan', ['breakfast'], [
    { grams: 120, slug: SEEDED.huevo },
    { grams: 60, slug: SEEDED.pan }
  ]),
  dish('Yogur con avena', ['breakfast'], [
    { grams: 200, slug: SEEDED.yogur },
    { grams: 40, slug: SEEDED.avena }
  ]),
  dish('Arroz con pollo', ['lunch'], [
    { grams: 220, slug: SEEDED.arroz },
    { grams: 180, slug: SEEDED.pollo }
  ]),
  dish('Lentejas con arroz', ['lunch'], [
    { grams: 250, slug: SEEDED.lentejas },
    { grams: 150, slug: SEEDED.arroz }
  ]),
  dish('Pollo con patata', ['lunch'], [
    { grams: 200, slug: SEEDED.pollo },
    { grams: 250, slug: SEEDED.patata }
  ]),
  dish('Lentejas con patata', ['lunch'], [
    { grams: 250, slug: SEEDED.lentejas },
    { grams: 200, slug: SEEDED.patata }
  ]),
  dish('Arroz con lentejas', ['lunch'], [
    { grams: 200, slug: SEEDED.arroz },
    { grams: 200, slug: SEEDED.lentejas }
  ]),
  dish('Merluza con patata', ['dinner'], [
    { grams: 200, slug: SEEDED.merluza },
    { grams: 220, slug: SEEDED.patata }
  ]),
  dish('Merluza con arroz', ['dinner'], [
    { grams: 190, slug: SEEDED.merluza },
    { grams: 200, slug: SEEDED.arroz }
  ]),
  dish('Pollo con arroz', ['dinner'], [
    { grams: 190, slug: SEEDED.pollo },
    { grams: 210, slug: SEEDED.arroz }
  ]),
  dish('Huevo con patata', ['dinner'], [
    { grams: 150, slug: SEEDED.huevo },
    { grams: 250, slug: SEEDED.patata }
  ]),
  dish('Merluza con lentejas', ['dinner'], [
    { grams: 180, slug: SEEDED.merluza },
    { grams: 200, slug: SEEDED.lentejas }
  ])
];

/** Tomato, proposed anyway. The gate is what has to stop these, not the prompt. */
const WITH_TOMATO = [
  dish('Ensalada de tomate', ['breakfast'], [{ grams: 200, slug: SEEDED.tomate }]),
  dish('Tomate con huevo', ['lunch'], [
    { grams: 180, slug: SEEDED.tomate },
    { grams: 140, slug: SEEDED.huevo }
  ]),
  dish('Arroz con tomate', ['dinner'], [
    { grams: 220, slug: SEEDED.arroz },
    { grams: 160, slug: SEEDED.tomate }
  ])
];

describe('free-text allergies, end to end', () => {
  let app: INestApplication;
  let account: Account;
  let ai: ScriptedAiClient;

  beforeAll(async () => {
    ai = new ScriptedAiClient([...WITH_TOMATO, ...SAFE]);
    app = await createApp(ai);
    account = await register(app, `custom-allergen-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account, [], ['Tomate', 'marisco']);
  }, 120_000);

  afterAll(async () => {
    if (account) {await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', account.cookie);}

    await app.close();
  });

  it('stores both entries and marks only the one it can enforce', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);
    const entries = (response.body as { customAllergens: { ingredientName: string | null; label: string }[] }).customAllergens;

    expect(entries).toHaveLength(2);

    const tomato = entries.find(entry => entry.label === 'Tomate');
    const shellfish = entries.find(entry => entry.label === 'marisco');

    // Matched: it names the exact ingredient it will withhold — the catalogue's
    // name for it, which is not always the word the person typed.
    expect(tomato?.ingredientName).toBe('Tomate fresco');
    // Unmatched, and stored as such. Storing it is the point — it has to reach
    // the screen that says we cannot guarantee it.
    expect(shellfish?.ingredientName).toBeNull();
  });

  it('never lets the matched ingredient reach a plate, however hard the model pushes', async () => {
    const job = await generateAndWait(app, account, 180_000);

    expect(job.status).toBe('succeeded');
    expect(job.planId).not.toBeNull();

    const plan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const names = (plan.body as PlanView).days.flatMap(day => day.meals.map(meal => meal.name.toLowerCase()));

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(name => name.includes('tomate'))).toEqual([]);
  }, 200_000);

  it('keeps it off the shopping list too, which is the copy a user actually shops from', async () => {
    const list = await activeShoppingList(app, account);

    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.filter(item => item.name.toLowerCase().includes('tomate'))).toEqual([]);
  });

  it('never offers the excluded ingredient to the model in the first place', () => {
    expect(ai.prompts.length).toBeGreaterThan(0);

    for (const prompt of ai.prompts) {
      // The catalogue listing is the enforcement; the gate is the guarantee.
      // Both, because a prompt is a request and this is a promise.
      expect(prompt).not.toContain('tomate (');
      // The unmatched one is the single case where an allergy *is* named to the
      // model, because there is no row to withhold.
      expect(prompt).toContain('marisco');
    }
  });
});
