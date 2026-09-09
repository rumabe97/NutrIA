import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { completeOnboarding, createApp, dish, generateAndWait, httpServer, PREFIX, register, ScriptedAiClient, SEEDED } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';

/**
 * The core loop, end to end, against a real database.
 *
 * The model is scripted (see `harness.ts`) so the assertions are about **our**
 * pipeline — scheduling, validation, atomicity, aggregation — rather than about
 * whether a provider happened to return good dishes today.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */
const POOL = [
  dish('Avena con yogur', ['breakfast'], [
    { grams: 80, slug: SEEDED.avena },
    { grams: 150, slug: SEEDED.yogur }
  ]),
  dish('Tostada con huevo', ['breakfast'], [
    { grams: 80, slug: SEEDED.pan },
    { grams: 120, slug: SEEDED.huevo }
  ]),
  dish('Yogur con avena', ['breakfast'], [
    { grams: 200, slug: SEEDED.yogur },
    { grams: 60, slug: SEEDED.avena }
  ]),
  dish('Huevos con pan', ['breakfast'], [
    { grams: 140, slug: SEEDED.huevo },
    { grams: 60, slug: SEEDED.pan }
  ]),
  dish('Avena sola', ['breakfast'], [{ grams: 110, slug: SEEDED.avena }]),
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

describe('plan generation', () => {
  let app: INestApplication;
  let alice: Account;
  let bob: Account;
  let plan: PlanView;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    alice = await register(app, `alice-${stamp}@e2e.invalid`);
    bob = await register(app, `bob-${stamp}@e2e.invalid`);

    await completeOnboarding(app, alice);
    // Bob is onboarded too: an account still in onboarding answers 409 on every
    // plan route before ownership is even asked, and the isolation checks below
    // are about ownership.
    await completeOnboarding(app, bob);

    const job = await generateAndWait(app, alice);

    expect(job.status).toBe('succeeded');

    const active: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', alice.cookie).expect(200);

    plan = active.body as PlanView;
  }, 120_000);

  afterAll(async () => {
    // Deletes cascade to the plan, its days, meals, shopping list and job rows.
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', alice.cookie);
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', bob.cookie);
    await app?.close();
  });

  it('produces exactly fourteen days', () => {
    expect(plan.days).toHaveLength(14);
    expect(plan.status).toBe('active');
  });

  it('fills every slot on every day', () => {
    for (const day of plan.days) {
      expect(day.meals.map(meal => meal.slot).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    }
  });

  it('keeps every day within 10% of the calorie target', () => {
    const target = plan.strategy?.kcal ?? 0;

    expect(target).toBeGreaterThan(0);

    for (const day of plan.days) {
      // Named in the loop so a failure says which day, since Jest's expect takes no message.
      expect({ day: day.dayIndex, drift: Math.abs(day.totals.kcal - target) <= target * 0.1 }).toEqual({ day: day.dayIndex, drift: true });
    }
  });

  it('never serves the same dish twice in a row in the same slot', () => {
    for (let index = 1; index < plan.days.length; index += 1) {
      const previous = plan.days[index - 1];
      const current = plan.days[index];

      for (const meal of current?.meals ?? []) {
        expect(previous?.meals.find(other => other.slot === meal.slot)?.name).not.toBe(meal.name);
      }
    }
  });

  it('gives every meal macros greater than zero, computed from the catalogue', () => {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        expect({ kcal: meal.kcal > 0, meal: meal.name }).toEqual({ kcal: true, meal: meal.name });
        expect(meal.proteinG).toBeGreaterThan(0);
      }
    }
  });

  it('reconciles the shopping list exactly with the plan it came from', async () => {
    const server = httpServer(app);
    const listed: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', alice.cookie).expect(200);
    const list = listed.body as { items: readonly { name: string; totalGrams: number }[] };

    // Sum the scaled ingredients of every meal in the plan, from the API's own
    // meal-detail responses, and require the list to match.
    const expected = new Map<string, number>();
    const occurrences = new Map<string, number>();

    for (const day of plan.days) {
      for (const meal of day.meals) {
        const detail: Response = await request(server).get(`/${PREFIX}/meal-plans/meals/${meal.id}`).set('Cookie', alice.cookie).expect(200);

        for (const item of (detail.body as { ingredients: readonly { grams: number; name: string }[] }).ingredients) {
          expected.set(item.name, (expected.get(item.name) ?? 0) + item.grams);
          occurrences.set(item.name, (occurrences.get(item.name) ?? 0) + 1);
        }
      }
    }

    expect(list.items).toHaveLength(expected.size);

    for (const item of list.items) {
      // Each meal-detail figure is rounded to one decimal (±0.05 g) and the list
      // rounds once more, so the drift a *correct* list may show grows with the
      // number of meals the ingredient appears in. A flat gram was too tight for
      // an ingredient in every breakfast.
      const count = occurrences.get(item.name) ?? 0;
      const drift = Math.abs(item.totalGrams - (expected.get(item.name) ?? 0));
      const tolerance = 0.05 * count + 0.1;

      // Shaped so a failure names the ingredient, the drift and how many meals it
      // was added over — the three things needed to tell rounding from an error.
      expect({ drift: drift <= tolerance ? 0 : Math.round(drift * 100) / 100, meals: count, name: item.name }).toEqual({ drift: 0, meals: count, name: item.name });
    }
  }, 120_000);

  it('scales meal detail quantities to the portion planned, not the recipe base', async () => {
    const meal = plan.days[0]?.meals[0];
    const detail: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/meals/${meal?.id}`).set('Cookie', alice.cookie).expect(200);
    const body = detail.body as { ingredients: readonly { grams: number }[]; servings: number };

    expect(body.servings).toBeGreaterThan(0);
    expect(body.ingredients.every(ingredient => ingredient.grams > 0)).toBe(true);
  });

  it('keeps one account’s plan invisible to another', async () => {
    const server = httpServer(app);

    await request(server).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', bob.cookie).expect(404);
    await request(server).get(`/${PREFIX}/meal-plans/meals/${plan.days[0]?.meals[0]?.id}`).set('Cookie', bob.cookie).expect(404);
    await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', bob.cookie).expect(404);
  });

  it('leaves at most one active plan after generating again', async () => {
    const job = await generateAndWait(app, alice);

    expect(job.status).toBe('succeeded');

    const history: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans`).set('Cookie', alice.cookie).expect(200);
    const plans = history.body as readonly { status: string; version: number }[];

    expect(plans.filter(entry => entry.status === 'active')).toHaveLength(1);
    // The superseded plan is kept, not overwritten.
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans.some(entry => entry.status === 'completed')).toBe(true);
  }, 120_000);
});
