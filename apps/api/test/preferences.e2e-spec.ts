import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { FullProfileView } from 'core/controllers/Profile';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * What somebody said they do not eat, enforced in code rather than asked of the
 * model (`0023`, `0025`, `0026`).
 *
 * This is the suite that would have caught the bug a user reported: "I put fish
 * in the things I dislike and the plan gave me salmon." The model here is told
 * to serve fish on purpose, exactly as a real one eventually will — the test is
 * about what happens to that dish on the way to the plan.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const POOL = [
  dish(
    'Avena con yogur',
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.avena },
      { grams: 150, slug: SEEDED.yogur }
    ]
  ),
  dish(
    'Tostada con huevo',
    ['breakfast'],
    [
      { grams: 80, slug: SEEDED.pan },
      { grams: 120, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Yogur con avena',
    ['breakfast'],
    [
      { grams: 200, slug: SEEDED.yogur },
      { grams: 60, slug: SEEDED.avena }
    ]
  ),
  dish(
    'Huevos con pan',
    ['breakfast'],
    [
      { grams: 140, slug: SEEDED.huevo },
      { grams: 60, slug: SEEDED.pan }
    ]
  ),
  dish('Avena sola', ['breakfast'], [{ grams: 110, slug: SEEDED.avena }]),
  // Fish in every slot the plan has to fill, so a plan that avoids it can only
  // have done so by refusing these dishes rather than by not needing them.
  dish(
    'Merluza con arroz',
    ['lunch'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 200, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Arroz con pollo',
    ['lunch'],
    [
      { grams: 220, slug: SEEDED.arroz },
      { grams: 180, slug: SEEDED.pollo }
    ]
  ),
  dish(
    'Lentejas con arroz',
    ['lunch'],
    [
      { grams: 250, slug: SEEDED.lentejas },
      { grams: 150, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Pollo con patata',
    ['lunch'],
    [
      { grams: 200, slug: SEEDED.pollo },
      { grams: 250, slug: SEEDED.patata }
    ]
  ),
  dish('Lentejas solas', ['lunch'], [{ grams: 350, slug: SEEDED.lentejas }]),
  dish(
    'Merluza con patata',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Pollo con tomate',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.pollo },
      { grams: 150, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Huevos con patata',
    ['dinner'],
    [
      { grams: 160, slug: SEEDED.huevo },
      { grams: 250, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Lentejas con tomate',
    ['dinner'],
    [
      { grams: 300, slug: SEEDED.lentejas },
      { grams: 120, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Arroz con huevo',
    ['dinner'],
    [
      { grams: 250, slug: SEEDED.arroz },
      { grams: 120, slug: SEEDED.huevo }
    ]
  )
];

describe('preferences are enforced, not requested', () => {
  let app: INestApplication;

  const mealNames = (plan: PlanView) => plan.days.flatMap(day => day.meals.map(meal => meal.name.toLowerCase()));

  const activePlan = async (account: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('never serves fish to somebody who said they dislike fish', async () => {
    const account = await register(app, `dislike-fish-${Date.now()}@e2e.invalid`);

    await completeOnboarding(app, account);
    await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { cuisines: ['Mediterránea'], preferences: [{ label: 'pescado', sentiment: 'disliked' }] }, step: 'food-preferences' })
      .expect(200);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const names = mealNames(await activePlan(account));

    // Not "the model was asked nicely": the ingredient is excluded before the
    // pool is built, so a fish dish cannot be scheduled at all.
    expect(names.some(name => name.includes('merluza'))).toBe(false);
    expect(names.length).toBeGreaterThan(0);
  });

  it('never serves meat or fish to a vegetarian, whatever the model proposes', async () => {
    const account = await register(app, `vegetarian-${Date.now()}@e2e.invalid`);

    await completeOnboarding(app, account);
    await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { allergies: [], customAllergens: [], dietaryPatterns: ['vegetarian'], intolerances: [] }, step: 'allergies' })
      .expect(200);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const names = mealNames(await activePlan(account));

    expect(names.some(name => name.includes('pollo') || name.includes('merluza'))).toBe(false);
  });

  it('keeps a preference that cannot be matched, and says it cannot enforce it', async () => {
    const account = await register(app, `unenforceable-${Date.now()}@e2e.invalid`);

    await completeOnboarding(app, account);
    await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { cuisines: ['Mediterránea'], preferences: [{ label: 'comida de avión', sentiment: 'disliked' }] }, step: 'food-preferences' })
      .expect(200);

    const profile: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);
    const labels = (profile.body as FullProfileView).foodPreferences.map(preference => preference.label);

    // Kept and shown, never silently dropped: a preference the product cannot
    // enforce is still a thing the person told us.
    expect(labels).toContain('comida de avión');
  });
});
