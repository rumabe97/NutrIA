import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import {
  activeShoppingList,
  completeOnboarding,
  createApp,
  dish,
  generateAndWait,
  httpServer,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';

/**
 * The two halves of the free-text allergy promise, both asserted end to end —
 * and, since P0-3 (owner's decision, 2026-09-25), that none of it, nor a
 * religious way of eating, nor a check-in comment, ever reaches the model.
 *
 * A user types "Tomate" — an ingredient the catalogue has, and one carrying no
 * EU-14 allergen at all, so nothing in the allergen tables would ever stop it.
 * The scripted model then proposes tomato dishes **on purpose**, as a model
 * ignoring its instructions would.
 *
 * They also type "marisco", which is a *group* the matcher deliberately refuses
 * to resolve — mapping it to one member would exclude that member and leave the
 * rest on the plate under an interface saying the allergy was enforced. Until
 * P0-3 that unresolved label was named to the model as the one mitigation left;
 * now nothing typed reaches it at all, mitigated in code instead
 * (`bestEffortExclusions`) and never claimed as a guarantee.
 *
 * They also declare `halal`: a religious pattern, enforced in code
 * (`PATTERN_EXCLUSIONS`, `PATTERN_SLUG_RUNS`) and never named to the model,
 * because a label that reveals a belief does not leave the building — and a
 * check-in comment between the first plan and a redo, to prove that free text
 * does not reach the model either.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

/** Their own words. Never sent anywhere the model could read them. */
const SECRET_COMMENT = 'las lentejas me encantaron pero necesito menos huevo por favor xyz123';

const SAFE = [
  dish('Yogur natural', ['breakfast'], [{ grams: 250, slug: SEEDED.yogur }]),
  dish('Huevos revueltos', ['breakfast'], [{ grams: 160, slug: SEEDED.huevo }]),
  dish(
    'Avena con yogur',
    ['breakfast'],
    [
      { grams: 60, slug: SEEDED.avena },
      { grams: 150, slug: SEEDED.yogur }
    ]
  ),
  dish(
    'Huevo con pan',
    ['breakfast'],
    [
      { grams: 120, slug: SEEDED.huevo },
      { grams: 60, slug: SEEDED.pan }
    ]
  ),
  dish(
    'Yogur con avena',
    ['breakfast'],
    [
      { grams: 200, slug: SEEDED.yogur },
      { grams: 40, slug: SEEDED.avena }
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
  dish(
    'Lentejas con patata',
    ['lunch'],
    [
      { grams: 250, slug: SEEDED.lentejas },
      { grams: 200, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Arroz con lentejas',
    ['lunch'],
    [
      { grams: 200, slug: SEEDED.arroz },
      { grams: 200, slug: SEEDED.lentejas }
    ]
  ),
  dish(
    'Merluza con patata',
    ['dinner'],
    [
      { grams: 200, slug: SEEDED.merluza },
      { grams: 220, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Merluza con arroz',
    ['dinner'],
    [
      { grams: 190, slug: SEEDED.merluza },
      { grams: 200, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Pollo con arroz',
    ['dinner'],
    [
      { grams: 190, slug: SEEDED.pollo },
      { grams: 210, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Huevo con patata',
    ['dinner'],
    [
      { grams: 150, slug: SEEDED.huevo },
      { grams: 250, slug: SEEDED.patata }
    ]
  ),
  dish(
    'Merluza con lentejas',
    ['dinner'],
    [
      { grams: 180, slug: SEEDED.merluza },
      { grams: 200, slug: SEEDED.lentejas }
    ]
  )
];

/** Tomato, proposed anyway. The gate is what has to stop these, not the prompt. */
const WITH_TOMATO = [
  dish('Ensalada de tomate', ['breakfast'], [{ grams: 200, slug: SEEDED.tomate }]),
  dish(
    'Tomate con huevo',
    ['lunch'],
    [
      { grams: 180, slug: SEEDED.tomate },
      { grams: 140, slug: SEEDED.huevo }
    ]
  ),
  dish(
    'Arroz con tomate',
    ['dinner'],
    [
      { grams: 220, slug: SEEDED.arroz },
      { grams: 160, slug: SEEDED.tomate }
    ]
  )
];

describe('free-text allergies, end to end', () => {
  let app: INestApplication;
  let account: Account;
  let ai: ScriptedAiClient;

  beforeAll(async () => {
    ai = new ScriptedAiClient([...WITH_TOMATO, ...SAFE]);
    app = await createApp(ai);
    account = await register(app, `custom-allergen-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account, [], ['Tomate', 'marisco'], false, ['halal']);
  }, 120_000);

  afterAll(async () => {
    if (account) {
      await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', account.cookie);
    }

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

  it('takes a check-in comment and redoes the plan, so a second prompt carries it in context', async () => {
    const active: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const planId = (active.body as PlanView).id;

    await request(httpServer(app))
      .post(`/${PREFIX}/check-ins`)
      .set('Cookie', account.cookie)
      // `hunger: 'right'` so the nudge this would otherwise trigger does not
      // touch a target this suite is not testing.
      .send({ comments: SECRET_COMMENT, difficulty: 'ok', hunger: 'right', planId, satisfaction: 4 })
      .expect(201);

    const redone = await generateAndWait(app, account, 180_000);

    expect(redone.status).toBe('succeeded');
  }, 200_000);

  it('never lets free text — the unresolved allergy, the religious pattern or the check-in comment — reach the model', () => {
    // Both generations: the first prompt and the redo the check-in fed.
    expect(ai.prompts.length).toBeGreaterThan(1);

    for (const prompt of ai.prompts) {
      const lower = prompt.toLowerCase();

      // The catalogue listing is the matched allergy's enforcement.
      expect(lower).not.toContain('tomate (');
      // Until P0-3 (2026-09-25) the unresolved label was the one thing named to
      // the model, because there was no catalogue row to withhold instead. Now
      // nothing typed reaches it: the mitigation moved into code
      // (`bestEffortExclusions`), and it is never claimed as a guarantee there
      // either.
      expect(lower).not.toContain('marisco');
      // A religious way of eating is enforced in code and never named — a label
      // that reveals a belief does not leave the building.
      expect(lower).not.toContain('halal');
      expect(prompt).not.toContain(SECRET_COMMENT);
    }
  });
});
