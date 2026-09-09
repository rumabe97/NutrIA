import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';

/**
 * The health-data boundary, asserted where it matters rather than where it is
 * convenient.
 *
 * `docs/decisions/0004` says medications are stored, shown back, and used for
 * nothing. `0008` says one condition — coeliac disease — may exclude gluten,
 * because avoiding it *is* the definition of managing the condition, and that
 * everything else infers nothing.
 *
 * The unit-level guard is `modules/ai/health-boundary.spec.ts`, which asserts the
 * AI module cannot even import the health layer. This one asserts the outcome:
 * a real medication, recorded on a real account, generating a real plan, and
 * absent from every prompt that was sent.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

const MEDICATION = 'Levotiroxina';
/* Deliberately not a catalogue ingredient: whey protein is one, and a supplement
   sharing its name with something the model may legitimately be offered would make
   this assertion unpassable rather than meaningful. */
const SUPPLEMENT = 'Colágeno hidrolizado';
const CONSENT_VERSION = '1.0.0';

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

describe('recorded health data, end to end', () => {
  let app: INestApplication;
  let account: Account;
  let ai: ScriptedAiClient;

  beforeAll(async () => {
    ai = new ScriptedAiClient(POOL);
    app = await createApp(ai);
    account = await register(app, `health-data-${Date.now()}@example.invalid`);
    await completeOnboarding(app, account);

    await request(httpServer(app))
      .put(`/${PREFIX}/health-data`)
      .set('Cookie', account.cookie)
      .send({
        conditions: [{ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' }],
        consentVersion: CONSENT_VERSION,
        medications: [{ name: MEDICATION }],
        // Not a catalogue ingredient: whey protein is one, and a supplement that shares
        // its name with something the model may legitimately be offered proves nothing.
        supplements: [{ name: SUPPLEMENT, proteinGPerServing: 24, servingsPerDay: 1 }]
      })
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    if (account) {await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', account.cookie);}

    await app.close();
  });

  it('stores it, shows it back, and raises the supervision notice', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/health-data`).set('Cookie', account.cookie).expect(200);
    const view = response.body as {
      conditions: { label: string }[];
      derivedExclusions: unknown[];
      medications: { name: string }[];
      supervisionRecommended: boolean;
      supplementProteinG: number;
    };

    expect(view.medications).toEqual([{ id: expect.any(String) as unknown as string, name: MEDICATION }]);
    expect(view.supervisionRecommended).toBe(true);
    // Supplement protein is reported, never deducted from the target a plan is
    // built against.
    expect(view.supplementProteinG).toBe(24);
    // Hypothyroidism is one of the conditions ruled out as an individualised
    // prescription: recorded, and inferring nothing about food.
    expect(view.derivedExclusions).toEqual([]);
  });

  it('never puts a medication or a condition in a prompt', async () => {
    const job = await generateAndWait(app, account, 180_000);

    expect(job.status).toBe('succeeded');
    expect(ai.prompts.length).toBeGreaterThan(0);

    for (const prompt of ai.prompts.map(text => text.toLowerCase())) {
      expect(prompt).not.toContain(MEDICATION.toLowerCase());
      expect(prompt).not.toContain('hipotiroidismo');
      expect(prompt).not.toContain('hypothyroid');
      expect(prompt).not.toContain(SUPPLEMENT.toLowerCase());
    }
  }, 200_000);

  it('deletes all of it, and the consent with it, on withdrawal', async () => {
    await request(httpServer(app)).delete(`/${PREFIX}/health-data`).set('Cookie', account.cookie).expect(200);

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/health-data`).set('Cookie', account.cookie).expect(200);
    const view = response.body as { conditions: unknown[]; consentIsCurrent: boolean; medications: unknown[]; supplements: unknown[] };

    expect(view.conditions).toEqual([]);
    expect(view.medications).toEqual([]);
    expect(view.supplements).toEqual([]);
    // Holding a consent for data that is gone is the state nobody can explain
    // afterwards, so the two go together.
    expect(view.consentIsCurrent).toBe(false);
  });
});
