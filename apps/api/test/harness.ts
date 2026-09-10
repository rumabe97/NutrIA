import express from 'express';
import request from 'supertest';

import type { Response } from 'supertest';
import { Test } from '@nestjs/testing';

import { UserController } from 'core/controllers/User';
import { shapeFor } from 'core/domain/MealShape';

import { AiClient } from '../src/modules/ai/clients/AiClient.js';
import { AppModule } from '../src/app.module.js';

import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

export const PREFIX = 'api/v1';

/** Nest types `getHttpServer()` as `any`; narrowing it once keeps the suites type-safe. */
export function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

export type Account = { readonly id: string; readonly cookie: string; readonly email: string; };

/**
 * How many named variants of each scripted dish a call returns. The variety
 * rules allow a dish twice a fortnight (`0009`), so a slot needs at least seven
 * distinct dishes, and a redo must find dishes it has not served — a real model
 * answers both by writing new dishes every time. The stand-in does the same by
 * numbering: every call yields fresh names, and so fresh slugs, for the same
 * ingredients, which is what the suites are about.
 */
const VARIANTS_PER_DISH = 3;

/**
 * A model stand-in that returns the dishes a test dictates — as many named
 * variants of each as a real model would return distinct dishes.
 *
 * These suites must never call a real provider: they would be slow, cost money, and
 * — fatally for the safety suite — non-deterministic, so "the allergy gate held"
 * would only ever mean "it held this once".
 */
export class ScriptedAiClient extends AiClient {
  public calls = 0;
  /**
   * Unique per client, and so per suite.
   *
   * Recipes are keyed by slug and shared by every account, which is the
   * product's own reuse working — so two suites scripting "Merluza con arroz"
   * with different ingredients would be writing over each other's recipe, and
   * the failure surfaces three steps later as a shopping list that does not
   * reconcile. A token in the name makes a suite's dishes its own.
   */
  private readonly token = Math.random().toString(36).slice(2, 6);
  /**
   * Every prompt this client was sent, in order.
   *
   * Kept so a suite can assert what did **not** reach the model. "A medication
   * never appears in a prompt" is only checkable if the prompt is checkable.
   */
  public prompts: string[] = [];

  constructor(private readonly dishes: readonly unknown[]) {
    super();
  }

  get isAvailable(): boolean {
    return true;
  }

  generate<T>(request: AiRequest<T>): Promise<AiResponse<T>> {
    this.calls += 1;
    this.prompts.push(request.prompt);

    const call = this.calls;
    const dishes = this.dishes.flatMap(base =>
      Array.from({ length: VARIANTS_PER_DISH }, (_, index) => {
        const named = base as { name: string };

        return { ...named, name: `${named.name} ${this.token}.${call}.${index + 1}` };
      })
    );

    return Promise.resolve({
      object: { dishes } as T,
      usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 }
    });
  }
}

/** Ingredients the seed guarantees, so scripted dishes resolve against a real catalogue. */
export const SEEDED = {
  arroz: 'arroz-blanco-cocido',
  avena: 'copos-de-avena',
  huevo: 'huevo',
  lentejas: 'lentejas-cocidas',
  merluza: 'merluza',
  pan: 'pan-integral',
  patata: 'patata',
  pollo: 'pechuga-de-pollo',
  tomate: 'tomate',
  yogur: 'yogur-griego-natural'
} as const;

export function dish(name: string, slots: readonly string[], ingredients: readonly { grams: number; slug: string }[]) {
  return {
    cookMinutes: 10,
    cuisine: 'mediterranea',
    difficulty: 'easy',
    ingredients: [...ingredients],
    name,
    prepMinutes: 5,
    servings: 1,
    slots: [...slots],
    // Two documented steps: a ten-minute cook needs two under `domain/Method`, and a
    // step is twenty characters at least. The suites are about safety, not cooking,
    // but a fixture the schema rejects tests nothing.
    steps: [
      { cue: 'hasta que el aceite brille', minutes: 1, text: 'Calentar el aceite en la sartén a fuego medio' },
      { minutes: 9, text: 'Añadir los ingredientes y cocinar, removiendo, hasta que estén hechos' }
    ]
  };
}

/**
 * A pool wide enough for a fortnight: five dishes a slot, each of them three
 * variants per call, which is what the variety rules need to fill fourteen days
 * without repeating a dish more than twice (`0009`).
 *
 * Shared so a suite that is not *about* the pool does not carry sixty lines of
 * one. A suite about a particular dish still writes its own.
 */
export const POOL = [
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

export async function createApp(ai: AiClient): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AiClient)
    .useValue(ai)
    .compile();

  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix(PREFIX);
  // Better Auth needs the raw stream, exactly as in main.ts.
  app.use(`/${PREFIX}/auth`, (_q: express.Request, _s: express.Response, next: express.NextFunction) => next());
  app.use(express.json());
  await app.init();

  return app;
}

/**
 * Opens both locks (0030, 0031): the owner's, the way the owner does it, and the
 * address, which in the product is a click in a mail nobody reads here.
 *
 * Without either, every route past sign-in answers 409 — the product working and
 * the suite failing.
 */
export async function activate(email: string): Promise<void> {
  if (!(await UserController.confirmAddress(email))) {throw new Error(`No account to confirm for ${email}`);}

  if (!(await UserController.activate({ email }))) {throw new Error(`No account to activate for ${email}`);}
}

export async function register(app: INestApplication, email: string): Promise<Account> {
  const password = 'correct-horse-battery-staple-9';
  const server = httpServer(app);

  await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: email.split('@')[0], password }).expect(200);
  await activate(email);

  const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }).expect(200);
  const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
  const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

  return { id: (me.body as { id: string }).id, cookie, email };
}

/** Walks the eight required onboarding steps so a plan may be generated. */
/**
 * The scripted name behind a served dish name — the suite token and per-call
 * variant suffix removed.
 *
 * The token is optional in the pattern because a database that is thrown away
 * by policy rather than by force still holds recipes from before it existed,
 * and the product will happily reuse one. Tolerating the older shape costs a
 * `?`; not tolerating it costs an afternoon.
 */
export function scriptedName(name: string): string {
  return name.replace(/ (?:[a-z0-9]+\.)?\d+\.\d+$/, '');
}

export async function completeOnboarding(
  app: INestApplication,
  account: Account,
  allergenIds: readonly string[] = [],
  customAllergens: readonly string[] = [],
  crossContaminationSensitive = false
): Promise<void> {
  const server = httpServer(app);
  const patch = async (step: string, data: unknown) =>
    request(server).patch(`/${PREFIX}/onboarding`).set('Cookie', account.cookie).send({ data, step }).expect(200);

  await patch('about-you', { birthDate: '1994-03-11', country: 'ES', displayName: 'Test', sex: 'female' });
  await patch('goal', { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' });
  await patch('body-activity', { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 });
  await patch('how-you-eat', { mealShape: shapeFor(3, false) });
  await patch('food-preferences', { cuisines: ['Mediterránea'], preferences: [] });
  await patch('allergies', {
    allergies: allergenIds.map(allergenId => ({ allergenId, crossContaminationSensitive, severity: 'moderate' as const })),
    customAllergens,
    dietaryPatterns: [],
    intolerances: []
  });
  await patch('lifestyle', { trainingDaysPerWeek: 3 });
  await patch('cooking', { budget: 'medium', cookingFrequency: 'often', cookingTimeMinutes: 30 });

  await request(server).post(`/${PREFIX}/onboarding/complete`).set('Cookie', account.cookie).expect(201);
}

export type JobResult = { error: string | null; planId: string | null; status: string };

/** Starts a generation and waits for the in-process runner to finish it. */
export async function generateAndWait(app: INestApplication, account: Account, timeoutMs = 60_000): Promise<JobResult> {
  const server = httpServer(app);
  const started: Response = await request(server).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', account.cookie).expect(201);
  const jobId = (started.body as { id: string }).id;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));

    const polled: Response = await request(server).get(`/${PREFIX}/meal-plans/jobs/${jobId}`).set('Cookie', account.cookie).expect(200);
    const job = polled.body as JobResult;

    if (job.status === 'succeeded' || job.status === 'failed') {return job;}
  }

  throw new Error('Generation did not finish within the timeout');
}

/** Sets the account's language. Everything server-side reads it from the profile. */
export async function setLocale(app: INestApplication, account: Account, locale: string): Promise<void> {
  await request(httpServer(app)).patch(`/${PREFIX}/profile`).set('Cookie', account.cookie).send({ locale }).expect(200);
}

/** The active plan's shopping list, as the web app reads it. */
export async function activeShoppingList(app: INestApplication, account: Account): Promise<{ items: { name: string }[] }> {
  const response: Response = await request(httpServer(app)).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', account.cookie).expect(200);

  return response.body as { items: { name: string }[] };
}
