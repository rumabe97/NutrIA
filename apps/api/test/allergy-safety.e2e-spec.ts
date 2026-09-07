import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';

/**
 * The suite this product cannot ship without.
 *
 * A user declares a gluten allergy; the scripted model then proposes dishes built
 * on bread and oats **on purpose**, as a model ignoring its instructions would. The
 * assertion is not that the prompt was obeyed — it is that nothing unsafe reaches
 * the database or a response even when it is not.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

/** Safe against a gluten allergy: nothing here carries the allergen. */
const SAFE = [
  dish('Yogur con fruta', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish('Yogur y huevo', ['breakfast'], [
    { grams: 150, slug: SEEDED.yogur },
    { grams: 100, slug: SEEDED.huevo }
  ]),
  dish('Huevo con tomate', ['breakfast'], [
    { grams: 120, slug: SEEDED.huevo },
    { grams: 120, slug: SEEDED.tomate }
  ]),
  dish('Yogur solo', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }]),
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
  dish('Arroz con tomate', ['lunch'], [
    { grams: 260, slug: SEEDED.arroz },
    { grams: 150, slug: SEEDED.tomate }
  ]),
  dish('Lentejas solas', ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish('Merluza con patata', ['dinner'], [
    { grams: 200, slug: SEEDED.merluza },
    { grams: 220, slug: SEEDED.patata }
  ]),
  dish('Pollo con tomate', ['dinner'], [
    { grams: 170, slug: SEEDED.pollo },
    { grams: 200, slug: SEEDED.tomate }
  ]),
  dish('Merluza con arroz', ['dinner'], [
    { grams: 180, slug: SEEDED.merluza },
    { grams: 180, slug: SEEDED.arroz }
  ]),
  dish('Patata con huevo', ['dinner'], [
    { grams: 250, slug: SEEDED.patata },
    { grams: 110, slug: SEEDED.huevo }
  ]),
  dish('Merluza sola', ['dinner'], [{ grams: 300, slug: SEEDED.merluza }])
];

/** Deliberately unsafe: `pan-integral` and `copos-de-avena` both carry gluten. */
const UNSAFE = [
  dish('Tostada integral', ['breakfast'], [{ grams: 90, slug: SEEDED.pan }]),
  dish('Avena de la casa', ['breakfast'], [{ grams: 100, slug: SEEDED.avena }]),
  dish('Bocadillo de pollo', ['lunch'], [
    { grams: 100, slug: SEEDED.pan },
    { grams: 150, slug: SEEDED.pollo }
  ])
];

describe('allergy safety', () => {
  let app: INestApplication;
  let user: Account;
  let glutenId: string;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([...UNSAFE, ...SAFE]));

    const allergens: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);

    glutenId = (allergens.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'gluten')?.id ?? '';

    expect(glutenId).not.toBe('');

    user = await register(app, `celiac-${Date.now()}@e2e.invalid`);
    await completeOnboarding(app, user, [glutenId]);
  }, 120_000);

  afterAll(async () => {
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', user.cookie);
    await app?.close();
  });

  it('never lets a declared allergen reach a stored meal', async () => {
    const job = await generateAndWait(app, user);

    expect(job.status).toBe('succeeded');

    const server = httpServer(app);
    const active: Response = await request(server).get(`/${PREFIX}/meal-plans/active`).set('Cookie', user.cookie).expect(200);
    const plan = active.body as PlanView;

    const forbidden = ['Pan integral', 'Copos de avena'];

    for (const day of plan.days) {
      for (const meal of day.meals) {
        const detail: Response = await request(server).get(`/${PREFIX}/meal-plans/meals/${meal.id}`).set('Cookie', user.cookie).expect(200);

        for (const ingredient of (detail.body as { ingredients: readonly { name: string }[] }).ingredients) {
          // Shaped so a failure names the offending ingredient, the day and the slot.
          expect({ day: day.dayIndex, ingredient: ingredient.name, slot: meal.slot, unsafe: forbidden.includes(ingredient.name) }).toEqual({
            day: day.dayIndex,
            ingredient: ingredient.name,
            slot: meal.slot,
            unsafe: false
          });
        }
      }
    }
  }, 180_000);

  it('never lets a declared allergen reach the shopping list either', async () => {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', user.cookie).expect(200);
    const names = (listed.body as { items: readonly { name: string }[] }).items.map(item => item.name);

    // A safe plan whose shopping list still names the allergen would send someone
    // to buy the thing that can hurt them.
    expect(names).not.toContain('Pan integral');
    expect(names).not.toContain('Copos de avena');
  });

  it('rejects the unsafe dishes rather than silently dropping them from a thin pool', async () => {
    const active: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', user.cookie).expect(200);
    const plan = active.body as PlanView;
    const names = plan.days.flatMap(day => day.meals.map(meal => meal.name));

    expect(names).not.toContain('Tostada integral');
    expect(names).not.toContain('Avena de la casa');
    expect(names).not.toContain('Bocadillo de pollo');
    // The safe dishes still filled all fourteen days.
    expect(plan.days).toHaveLength(14);
  });
});
