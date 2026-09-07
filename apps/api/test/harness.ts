import express from 'express';
import request from 'supertest';

import type { Response } from 'supertest';
import { Test } from '@nestjs/testing';

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
 * A model stand-in that returns exactly the dishes a test dictates.
 *
 * These suites must never call a real provider: they would be slow, cost money, and
 * — fatally for the safety suite — non-deterministic, so "the allergy gate held"
 * would only ever mean "it held this once".
 */
export class ScriptedAiClient extends AiClient {
  public calls = 0;

  constructor(private readonly dishes: readonly unknown[]) {
    super();
  }

  get isAvailable(): boolean {
    return true;
  }

  generate<T>(_request: AiRequest<T>): Promise<AiResponse<T>> {
    this.calls += 1;

    return Promise.resolve({
      object: { dishes: this.dishes } as T,
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
    steps: [{ text: 'Preparar y servir.' }]
  };
}

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

export async function register(app: INestApplication, email: string): Promise<Account> {
  const password = 'correct-horse-battery-staple-9';
  const server = httpServer(app);

  await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: email.split('@')[0], password }).expect(200);

  const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }).expect(200);
  const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
  const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

  return { id: (me.body as { id: string }).id, cookie, email };
}

/** Walks the eight required onboarding steps so a plan may be generated. */
export async function completeOnboarding(app: INestApplication, account: Account, allergenIds: readonly string[] = []): Promise<void> {
  const server = httpServer(app);
  const patch = async (step: string, data: unknown) =>
    request(server).patch(`/${PREFIX}/onboarding`).set('Cookie', account.cookie).send({ data, step }).expect(200);

  await patch('about-you', { birthDate: '1994-03-11', country: 'ES', displayName: 'Test', sex: 'female' });
  await patch('goal', { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' });
  await patch('body-activity', { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 });
  await patch('how-you-eat', { includesSnacks: false, mealsPerDay: 3 });
  await patch('food-preferences', { cuisines: ['Mediterránea'], preferences: [] });
  await patch('allergies', {
    allergies: allergenIds.map(allergenId => ({ allergenId, crossContaminationSensitive: false, severity: 'moderate' as const })),
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
