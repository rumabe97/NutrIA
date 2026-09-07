import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { ResolvedTargets } from 'core/domain/Nutrition';

/**
 * A corrected target is the one a plan is built against.
 *
 * Generation used to compute its own targets, which meant the number a plan was
 * planned around and the number the profile screen showed came from two call
 * sites that only happened to agree — and an override would have reached one and
 * not the other. This suite is what makes that impossible to reintroduce
 * quietly: it sets an override and asserts the *stored plan's* strategy carries
 * it.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

const POOL = [
  dish('Yogur natural', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish('Yogur con huevo', ['breakfast'], [
    { grams: 150, slug: SEEDED.yogur },
    { grams: 100, slug: SEEDED.huevo }
  ]),
  dish('Huevo con tomate', ['breakfast'], [
    { grams: 120, slug: SEEDED.huevo },
    { grams: 120, slug: SEEDED.tomate }
  ]),
  dish('Yogur doble', ['breakfast'], [{ grams: 300, slug: SEEDED.yogur }]),
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

describe('a corrected target, end to end', () => {
  let app: INestApplication;
  let account: Account;
  let computed: ResolvedTargets;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
    account = await register(app, `targets-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account);

    const profile: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);

    computed = (profile.body as { targets: ResolvedTargets }).targets;
  }, 120_000);

  afterAll(async () => {
    if (account) {await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', account.cookie);}

    await app.close();
  });

  it('refuses a figure below the floor, and says which bound it hit', async () => {
    const response: Response = await request(httpServer(app))
      .patch(`/${PREFIX}/profile/targets`)
      .set('Cookie', account.cookie)
      .send({ kcal: 900 })
      .expect(422);

    const body = response.body as { fieldErrors: { targets?: string[] } };

    expect(body.fieldErrors.targets?.length).toBeGreaterThan(0);
    // A refusal that says only "invalid" teaches nothing. This one names the number.
    expect(body.fieldErrors.targets?.join(' ')).toContain(String(Math.ceil(computed.bounds.floorKcal)));
  });

  it('accepts one inside the bounds and marks it as the user’s', async () => {
    const target = Math.round(computed.computed.kcal) - 100;
    const response: Response = await request(httpServer(app))
      .patch(`/${PREFIX}/profile/targets`)
      .set('Cookie', account.cookie)
      .send({ kcal: target })
      .expect(200);

    const resolved = response.body as ResolvedTargets;

    expect(resolved.overrideStatus).toBe('applied');
    expect(resolved.effective.kcal).toBe(target);
    // The macros are re-derived around the new figure rather than left as they
    // were, so the set stays coherent.
    expect(resolved.effective.proteinG).not.toBe(0);
  });

  it('builds the plan against the corrected figure, not the computed one', async () => {
    const job = await generateAndWait(app, account, 180_000);

    expect(job.status).toBe('succeeded');

    const plan: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const strategy = (plan.body as PlanView).strategy;
    const profile: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);
    const effective = (profile.body as { targets: ResolvedTargets }).targets.effective;

    expect(strategy).not.toBeNull();
    // The stored plan and the profile screen agree because they are the same
    // number, resolved once, in one place.
    expect(strategy?.kcal).toBe(effective.kcal);
    expect(strategy?.proteinG).toBe(effective.proteinG);
    expect(strategy?.kcal).not.toBe(Math.round(computed.computed.kcal));
  }, 200_000);
});
