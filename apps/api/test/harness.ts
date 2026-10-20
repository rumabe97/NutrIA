import { createHmac } from 'node:crypto';

import express from 'express';
import request from 'supertest';

import type { Response } from 'supertest';
import { Test } from '@nestjs/testing';

import { UserController } from 'core/controllers/User';
import { database } from 'database';
import { UNAUDITED } from 'core/entities/Audit';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { dayKeyIn } from 'core/domain/Period';
import { PLAN_TOLERANCE } from 'core/domain/PlanValidation';
import { shapeFor } from 'core/domain/MealShape';

import { AiClient } from '../src/modules/ai/clients/AiClient.js';
import { AppModule } from '../src/app.module.js';

import type { AuditAction } from 'core/entities/Audit';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanDayView } from 'core/controllers/Plan';
import type { Server } from 'node:http';
import type { TestingModuleBuilder } from '@nestjs/testing';

export const PREFIX = 'api/v1';

/** Nest types `getHttpServer()` as `any`; narrowing it once keeps the suites type-safe. */
export function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

export type Account = { readonly id: string; readonly cookie: string; readonly email: string };

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
 * A number written in letters — `1` is `b`, `26` is `ba` — so that a scripted
 * dish name carries no digit of its own.
 *
 * It carried two until #300's CI run. `dish-request` searches its library for a
 * three-digit mark, and the pair of its dishes that shares `170` is how one
 * search returns exactly two reasons; that run returned three, the extra being
 * `Tostada con huevo 5kmn.170.1` — another suite's dish, in the same database,
 * whose call counter had reached 170. The mark cannot give way: `storableName`
 * admits one bare number of at most three digits and no other word the
 * vocabulary does not know. So the counter does.
 */
function inLetters(value: number): string {
  let left = value;
  let written = '';

  do {
    written = String.fromCharCode(97 + (left % 26)) + written;
    left = Math.floor(left / 26);
  } while (left > 0);

  return written;
}

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
   *
   * Four letters and no digits, for the reason `inLetters` gives: a base-36
   * token could have been `170k` on its own.
   */
  private readonly token = Array.from({ length: 4 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
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

        return { ...named, name: `${named.name} ${this.token}.${inLetters(call)}.${inLetters(index + 1)}` };
      })
    );

    return Promise.resolve({ object: { dishes } as T, usage: { calls: 1, inputTokens: 0, model: 'scripted', outputTokens: 0 } });
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
    'Arroz con tomate',
    ['lunch'],
    [
      { grams: 260, slug: SEEDED.arroz },
      { grams: 150, slug: SEEDED.tomate }
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
      { grams: 170, slug: SEEDED.pollo },
      { grams: 200, slug: SEEDED.tomate }
    ]
  ),
  dish(
    'Merluza con arroz',
    ['dinner'],
    [
      { grams: 180, slug: SEEDED.merluza },
      { grams: 180, slug: SEEDED.arroz }
    ]
  ),
  dish(
    'Patata con huevo',
    ['dinner'],
    [
      { grams: 250, slug: SEEDED.patata },
      { grams: 110, slug: SEEDED.huevo }
    ]
  ),
  dish('Merluza sola', ['dinner'], [{ grams: 300, slug: SEEDED.merluza }])
];

/**
 * The application under test, with the model replaced by `ai`. `configure`
 * replaces anything else a suite must answer itself — the picture clients,
 * their store, the monthly cap (`dish-pictures.e2e-spec.ts`).
 */
export async function createApp(
  ai: AiClient,
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = builder => builder
): Promise<INestApplication> {
  const moduleRef = await configure(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiClient)
      .useValue(ai)
  ).compile();

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
  if (!(await UserController.confirmAddress(email))) {
    throw new Error(`No account to confirm for ${email}`);
  }

  if (!(await UserController.activate({ email }, UNAUDITED))) {
    throw new Error(`No account to activate for ${email}`);
  }
}

/**
 * Registers an account, confirms it, opens it and signs it in.
 *
 * `name` is the person's own name, which defaults to the address's local part
 * as every suite here has always had it. A suite passes one when the name is
 * what it is testing: `storableName` refuses a dish whose name carries a word
 * of the account's own (`dish-request.e2e-spec.ts`), and that case needs a name
 * it chose.
 */
export async function register(app: INestApplication, email: string, name = email.split('@')[0]): Promise<Account> {
  const password = 'correct-horse-battery-staple-9';
  const server = httpServer(app);

  // Paced: every `/auth/*` call of a suite spends one allowance of the API's own limiter, and the privileged
  // accounts' TOTP (`enableTotp`) spends two more each.
  const signUp = await paced(() => request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name, password }));

  if (signUp.status !== 200) {
    throw new Error(`Sign-up refused for ${email}: ${signUp.status}`);
  }

  await activate(email);

  const signIn: Response = await paced(() => request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }));

  if (signIn.status !== 200) {
    throw new Error(`Sign-in refused for ${email}: ${signIn.status}`);
  }

  const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
  const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

  return { id: (me.body as { id: string }).id, cookie, email };
}

/**
 * Gives the explicit profile consent
 * (`docs/legal/textos/05-consentimientos-cliente.md` § A) the current notice
 * asks for. `completeOnboarding` calls this before the `goal` step, which —
 * with `body-activity` and `allergies` — refuses without it (409
 * `PROFILE_CONSENT_REQUIRED`); a suite testing the gate itself skips
 * `completeOnboarding` and calls the steps directly.
 */
export async function giveProfileConsent(app: INestApplication, account: Account): Promise<void> {
  await request(httpServer(app))
    .put(`/${PREFIX}/profile/consent`)
    .set('Cookie', account.cookie)
    .send({ version: PROFILE_CONSENT_VERSION })
    .expect(200);
}

/** Walks the seven required onboarding steps so a plan may be generated. */
/**
 * The scripted name behind a served dish name — the suite token and per-call
 * variant suffix removed.
 *
 * The token is optional in the pattern, and the counters are read in letters
 * **or** in digits, because a database that is thrown away by policy rather
 * than by force still holds recipes from before either shape existed, and the
 * product will happily reuse one. Tolerating the older ones costs two `|`; not
 * tolerating them costs an afternoon.
 */
export function scriptedName(name: string): string {
  return name.replace(/ (?:[a-z0-9]+\.)?(?:[a-z]+\.[a-z]+|\d+\.\d+)$/, '');
}

export async function completeOnboarding(
  app: INestApplication,
  account: Account,
  allergenIds: readonly string[] = [],
  customAllergens: readonly string[] = [],
  crossContaminationSensitive = false,
  dietaryPatterns: readonly string[] = []
): Promise<void> {
  const server = httpServer(app);
  const patch = async (step: string, data: unknown) =>
    request(server).patch(`/${PREFIX}/onboarding`).set('Cookie', account.cookie).send({ data, step }).expect(200);

  await patch('about-you', { birthDate: '1994-03-11', country: 'ES', displayName: 'Test', sex: 'female' });
  // `goal`, `body-activity` and `allergies` are the profile-consent steps
  // (`ProfileConsentController.PROFILE_CONSENT_STEPS`): they refuse with 409
  // `PROFILE_CONSENT_REQUIRED` without this.
  await giveProfileConsent(app, account);
  await patch('goal', { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' });
  await patch('body-activity', { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 });
  await patch('how-you-eat', { mealShape: shapeFor(3, false) });
  await patch('food-preferences', { cuisines: ['Mediterránea'], preferences: [] });
  await patch('allergies', {
    allergies: allergenIds.map(allergenId => ({ allergenId, crossContaminationSensitive, severity: 'moderate' as const })),
    customAllergens,
    dietaryPatterns,
    intolerances: []
  });
  // 'lifestyle' is gone (the onboarding cleanup): the questions it asked
  // changed no plan. Required steps are now the seven above plus 'cooking'.
  await patch('cooking', { cookingTimeMinutes: 30 });

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

    if (job.status === 'succeeded' || job.status === 'failed') {
      return job;
    }
  }

  throw new Error('Generation did not finish within the timeout');
}

/**
 * Deletes every account a suite made, through the product's own path
 * (`DELETE /users/me`) — the same door `care.e2e-spec.ts` and
 * `billing.e2e-spec.ts` use.
 *
 * One shared loop so a suite's `afterAll` is a single call rather than its own
 * copy of this, and so a suite that fails mid-test still deletes whatever it
 * had registered by then. Not `.expect(204)`: an account a test already
 * deleted itself is a 404 here, and that is not this loop's failure to report.
 */
export async function deleteAccounts(app: INestApplication, cookies: readonly string[]): Promise<void> {
  const server = httpServer(app);

  for (const cookie of cookies) {
    await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
  }
}

/**
 * Deletes an account a suite never kept a cookie for — signed up (so it exists
 * to clean up) but never signed in, or signed in outside `register()`. Signs
 * in with the password every suite in this directory registers with, then
 * deletes through the same route `deleteAccounts` uses.
 *
 * A direct SQL delete would work too, but this is the product's own path, and
 * `DELETE /users/me` is `@AllowUnverified()` — reachable by a session whatever
 * state its two locks are in, which is why signing in first is always enough.
 *
 * The address is confirmed first, as its link would: an unconfirmed account
 * cannot sign in with its password (PLAN 011 phase 8), and an account a suite
 * only signed up never had its link opened.
 *
 * Silently returns when the sign-in fails: the account is already gone, which
 * a second cleanup run against the same database must tolerate. An account
 * with TOTP on is challenged rather than refused: with its `totpURI` the
 * challenge is finished with a code, and without one this throws — the
 * account would otherwise stay behind with nothing said.
 */
export async function deleteAccountByEmail(
  app: INestApplication,
  email: string,
  password = 'correct-horse-battery-staple-9',
  totpURI?: string
): Promise<void> {
  const server = httpServer(app);

  await UserController.confirmAddress(email);

  // Paced: a suite's last minute of requests may have spent the API's own allowance, and its 429 is not "gone".
  const signIn: Response = await paced(() => request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }));

  if (signIn.status !== 200) {
    return;
  }

  let cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

  if ((signIn.body as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
    if (!totpURI) {
      throw new Error(`${email} has TOTP on: deleteAccountByEmail needs its totpURI`);
    }

    cookie = await finishChallenge(app, new CookieJar().take(signIn).header, totpURI);
  }

  await paced(() => request(server).delete(`/${PREFIX}/users/me`).set('Cookie', cookie));
}

/**
 * Takes an account's address back to unconfirmed, on the table: the state of a
 * session whose address nobody proved. Since PLAN 011 phase 8 an unconfirmed
 * account cannot sign in with its password, so no route makes one any more;
 * a session from before it, or one through a provider that would not vouch for
 * the address, still can be. A suite that tests the address lock signs in
 * confirmed (`UserController.confirmAddress`), then calls this.
 */
export async function unconfirmAddress(email: string): Promise<void> {
  const sql = (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;
  const unconfirmed = await sql<{ id: string }>`update "user" set email_verified = false where email = ${email} returning id`;

  if (unconfirmed.length !== 1) {
    throw new Error(`No account to unconfirm for ${email}`);
  }
}

/**
 * Finishes a password sign-in's TOTP challenge (`challenge` is the cookie it
 * left) and answers the session's cookie. The server accepts each step's code
 * once (PLAN 011 phase 4) and this does not know which it took last, so it
 * types the next step's code and, if that one is spent, waits for the clock's
 * next step and types the one after.
 */
async function finishChallenge(app: INestApplication, challenge: string, totpURI: string): Promise<string> {
  const server = httpServer(app);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const verified = await paced(() =>
      request(server)
        .post(`/${PREFIX}/auth/two-factor/verify-totp`)
        .set('Cookie', challenge)
        .send({ code: totpCode(totpURI, 1) })
    );

    if (verified.status === 200) {
      return (verified.headers['set-cookie'] as unknown as string[]).join('; ');
    }

    await pause(30_000 - (Date.now() % 30_000) + 50);
  }

  throw new Error('The TOTP challenge was not finished');
}

/**
 * A second session for an account with TOTP on, as somebody signing in again
 * on another device: the password, then a code. For a suite that needs a
 * session that existed before something changed the account.
 */
export async function signInWithTotp(app: INestApplication, account: TotpAccount, password = 'correct-horse-battery-staple-9'): Promise<string> {
  const signIn: Response = await paced(() => request(httpServer(app)).post(`/${PREFIX}/auth/sign-in/email`).send({ email: account.email, password }));

  if (signIn.status !== 200 || !(signIn.body as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
    throw new Error(`Expected a TOTP challenge for ${account.email}: ${signIn.status}`);
  }

  return finishChallenge(app, new CookieJar().take(signIn).header, account.totpURI);
}

/** An account with the authenticator app on, and the URI a suite types its codes from. */
export type TotpAccount = Account & {
  /** What the confirmation answered: whether the account's other sessions were closed (`closeOtherSessions`). */
  readonly otherSessionsClosed?: boolean;
  readonly totpURI: string;
};

/**
 * Turns the authenticator app on for an account, the way the person does in
 * "Seguridad": `/two-factor/enable` with the password, then the first right
 * code at `/two-factor/verify-totp`. Every privileged account with a password
 * needs it (PLAN 011 phase 6) — the admin for any console route, a
 * professional for any client route — so a suite that makes one calls this
 * straight after `grantAdmin` or the grant.
 *
 * **Use the account it answers, not the one it was given.** The confirmation
 * rotates the session — and closes the account's other sessions — so the old
 * cookie is gone, and a cleanup list holding it deletes nothing. The account's
 * next password sign-in asks for a code (`signInWithTotp`; `deleteAccountByEmail`
 * takes `totpURI` for it).
 */
export async function enableTotp(app: INestApplication, account: Account, password = 'correct-horse-battery-staple-9'): Promise<TotpAccount> {
  const server = httpServer(app);
  const enabled = await paced(() => request(server).post(`/${PREFIX}/auth/two-factor/enable`).set('Cookie', account.cookie).send({ password }));

  if (enabled.status !== 200) {
    throw new Error(`Could not start TOTP for ${account.email}: ${enabled.status}`);
  }

  const { totpURI } = enabled.body as { totpURI: string };
  // The code inside the closure: a retry after a wait types the code of its own moment.
  const verified = await paced(() =>
    request(server)
      .post(`/${PREFIX}/auth/two-factor/verify-totp`)
      .set('Cookie', account.cookie)
      .send({ code: totpCode(totpURI) })
  );

  if (verified.status !== 200) {
    throw new Error(`Could not confirm TOTP for ${account.email}: ${verified.status}`);
  }

  const { otherSessionsClosed } = verified.body as { otherSessionsClosed?: boolean };

  return { ...account, cookie: (verified.headers['set-cookie'] as unknown as string[]).join('; '), otherSessionsClosed, totpURI };
}

/**
 * Opens a granted professional's practice with this many included clients, as
 * a paid practice subscription does (`0061`) — without Stripe, for the suites
 * that are about the workspace and not about paying for it. From Phase 7 of
 * project 004 the client routes need an open practice and every invitation
 * counts against the number, so a suite that grants a professional and then
 * works with clients opens the practice straight after the grant.
 *
 * Written on the table, because no route may write it: only the signed webhook
 * does, and `care-practice.e2e-spec.ts` proves that path.
 */
export async function openPractice(userId: string, includedClients = 30): Promise<void> {
  const sql = (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;
  const opened = await sql<{ userId: string }>`
    update professionals set practice_open = true, included_clients = ${includedClients} where user_id = ${userId} returning user_id as "userId"`;

  if (opened.length !== 1) {
    throw new Error(`No professional to open a practice for: ${userId}`);
  }
}

/**
 * Writes an `onboarding_state` row the way the ten-step flow could have left
 * it: `'lifestyle'` among the completed steps, `currentStep` at its old
 * ceiling — a shape no route can produce any more, since the step is gone
 * from `ONBOARDING_STEPS`. `onboarding.e2e-spec.ts` uses this to prove an
 * account that finished onboarding before the cleanup still reads as
 * complete, rather than tripping `onboardingStateSchema`'s enum on a step
 * name it no longer knows.
 *
 * Written on the table, like `openPractice`, because no route writes this
 * shape any more — only a database from before the cleanup ever held it.
 */
export async function markLegacyOnboarding(userId: string, currentStep = 10): Promise<void> {
  const sql = (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;
  const marked = await sql<{ userId: string }>`
    update onboarding_state
    set completed_steps = array_append(completed_steps, 'lifestyle'), current_step = ${currentStep}
    where user_id = ${userId}
    returning user_id as "userId"`;

  if (marked.length !== 1) {
    throw new Error(`No onboarding_state row to mark legacy for: ${userId}`);
  }
}

/**
 * Accepts the professional's own agreement (P1-1,
 * `docs/legal/go-live-checklist.md` § 1) at the current version, through
 * the route a professional's own screen calls — the door every workspace
 * route but `GET /care/practice` and the practice checkout keep shut until
 * it is open, the way `giveProfileConsent` opens the profile consent gate.
 * Suites that grant a professional and then use the workspace call this
 * right after granting, next to `openPractice`.
 */
export async function acceptAgreement(app: INestApplication, professional: Account, version: string = PROFESSIONAL_AGREEMENT_VERSION): Promise<void> {
  await request(httpServer(app)).post(`/${PREFIX}/care/practice/agreement`).set('Cookie', professional.cookie).send({ version }).expect(204);
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

/**
 * `database()`'s own `postgres.js` client, for the handful of things this
 * file reads or writes straight against a table because no route does (see
 * `openPractice`, below): the Drizzle query builder and this package's own
 * `drizzle-orm` resolve to two separate copies of its types once `apps/api`
 * builds against it, so `eq`/`desc` from `drizzle-orm` do not type-check here
 * against a schema column — only raw SQL does.
 */
function sqlClient(): <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> {
  return (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;
}

/**
 * Moves every plan of one account `days` days into the past — the plan's own
 * dates, its days' dates and its `completedAt` — so a suite can reach "the
 * scheduled plan's day is today" without a fake system clock (project 015).
 * Written on the tables, like `openPractice`, because no route moves a plan.
 */
export async function shiftPlansBack(userId: string, days: number): Promise<void> {
  const sql = sqlClient();

  await sql`update plan_days set date = date - ${days}::int where plan_id in (select id from meal_plans where user_id = ${userId})`;
  await sql`update meal_plans set start_date = start_date - ${days}::int, end_date = end_date - ${days}::int,
    completed_at = completed_at - ${days}::int where user_id = ${userId}`;
}

/** One plan's row, as a suite asserts it: status and the two dates that matter, as `YYYY-MM-DD`. */
export async function planRow(planId: string): Promise<{ completedAt: string | null; endDate: string; startDate: string; status: string } | null> {
  const rows = await sqlClient()<{ completedAt: string | null; endDate: string; startDate: string; status: string }>`
    select to_char(completed_at, 'YYYY-MM-DD') as "completedAt", to_char(end_date, 'YYYY-MM-DD') as "endDate",
      to_char(start_date, 'YYYY-MM-DD') as "startDate", status::text as status from meal_plans where id = ${planId}`;

  return rows[0] ?? null;
}

/**
 * One recipe by its slug, with how many ingredient rows hang off it — read
 * straight from the tables because no route answers either question.
 *
 * For telling "the dish was written" from "the library already had it": a
 * requested dish whose slug is taken is handed back rather than stored
 * (`DishRequestRepository.storeWithinQuota`), and the failure that would be is
 * its ingredients written a second time, which doubles every weight in a
 * shopping list. `source` and `createdBy` are here because the month's
 * allowance is counted from exactly those two columns.
 */
export async function recipeRow(slug: string): Promise<{ id: string; createdBy: string | null; ingredients: number; source: string } | null> {
  const rows = await sqlClient()<{ id: string; createdBy: string | null; ingredients: number; source: string }>`
    select recipes.id, recipes.created_by as "createdBy", recipes.source::text as source,
      (select count(*)::int from recipe_ingredients where recipe_ingredients.recipe_id = recipes.id) as ingredients
    from recipes
    where recipes.slug = ${slug}`;

  return rows[0] ?? null;
}

/** One plate of a plan, with the appliances its dish declares (`0102`). */
export type PlateRow = { readonly equipment: readonly string[]; readonly name: string; readonly slot: string };

/**
 * Every plate of one plan with what its dish says it cannot be cooked without.
 *
 * On the tables, and that is a choice rather than a shortcut: `equipment`
 * reaches a screen only on the meal **detail** (`GET /meal-plans/meals/:id`),
 * one request per plate, while the claim `0102` makes — *no* dish of the
 * fortnight needs an appliance this person said they do not have — is about all
 * fifty-six at once. A suite that wants to see the declaration travel through
 * the API asserts one detail beside this (`kitchen.e2e-spec.ts` does both).
 *
 * The raw `text[]`, not `appliancesOf` — a key this build does not know is
 * silently read as "needs nothing" downstream, so a test that filtered the
 * same way could never see one.
 */
export async function platesOfPlan(planId: string): Promise<readonly PlateRow[]> {
  return sqlClient()<PlateRow>`
    select recipes.equipment, recipes.name, meals.slot::text as slot
    from meals
    join plan_days on plan_days.id = meals.plan_day_id
    join recipes on recipes.id = meals.recipe_id
    where plan_days.plan_id = ${planId}
    order by plan_days.day_index, meals.sort_order`;
}

/**
 * Every slug in the library that declares one appliance (`0102`).
 *
 * Whose dish it is does not matter to a filter — a seeded one, one a model
 * wrote for somebody else, one this suite's own generation stored — and that is
 * exactly why the question is asked of the table rather than of the fixture: a
 * suite that only knew its own dishes would assert nothing about the 58 oven
 * dishes the development library already holds, and would have nothing at all
 * to assert on a database built the way CI builds it.
 */
export async function recipesDeclaring(appliance: string): Promise<ReadonlySet<string>> {
  const rows = await sqlClient()<{ slug: string }>`select recipes.slug from recipes where ${appliance} = any(recipes.equipment)`;

  return new Set(rows.map(row => row.slug));
}

/**
 * The slugs of every library row whose name begins with `prefix`.
 *
 * For a suite whose scripted dishes must not be left behind: their slugs are
 * the model's names slugified, and `ScriptedAiClient` makes each one unique per
 * call, so a suite cannot know in advance which of its dishes a plan will use
 * and store. A mark in the name is the only handle, and this turns it into the
 * list `forgetRecipes` takes.
 */
export async function recipeSlugsNamed(prefix: string): Promise<readonly string[]> {
  const rows = await sqlClient()<{ slug: string }>`select slug from recipes where name like ${`${prefix}%`}`;

  return rows.map(row => row.slug);
}

/**
 * Copies one library dish, declaring one appliance, under a marked name and
 * slug of its own — and answers the copy.
 *
 * **On the tables, and for a reason no route can give.** A suite that needs a
 * dish declaring an appliance cannot get one by scripting the model: a dish the
 * model writes is stored only if the **plan uses it**
 * (`PlanGeneration.service.ts` → `newRecipes`, filtered by `used`), and whether
 * the scheduler reaches for one is a property of the library it is competing
 * with. Measured on 2026-10-16 while writing `kitchen.e2e-spec.ts`: against the
 * development library's 1,128 dishes two runs stored **0 and 2** fresh rows out
 * of eighty-four plates — the shared pool's days land 6% over the protein band,
 * so a real dish wins nearly every slot — and against a database built the way
 * CI builds it, 6 of 42 plates were fresh and none of them was one of the
 * three-in-eight shapes the fixture wanted. So a scripted dish is the right
 * instrument for the **gate** (what the model returns is refused) and the wrong
 * one for the **filter** (what the library may reuse), which needs a row.
 *
 * A copy and not a dish built from nothing, because the row has to be *offered*
 * to be refused: cloned from a dish the offer already holds, it has that dish's
 * slots, minutes, servings, ingredients and macros, and the one thing that
 * differs is the field under test. Its `created_by` is left null, as provenance
 * is, and its `source` is the original's — nothing here is a dish anybody
 * requested.
 *
 * Caller's to clean up, through `forgetRecipes`, **after** its accounts are
 * deleted: a plan that served it holds it (`meals.recipe_id` is `RESTRICT`).
 */
export async function copyDishDeclaring(slug: string, appliance: string, mark: string): Promise<{ readonly name: string; readonly slug: string }> {
  const sql = sqlClient();
  const rows = await sql<{ id: string; name: string; slug: string }>`
    insert into recipes (slug, name, locale, source, meal_slots, equipment, cook_minutes, prep_minutes, servings, difficulty, cuisine, description,
      instructions, steps_version)
    select ${`${mark.toLowerCase()}-${slug}`}, ${`${mark} `} || name, locale, source, meal_slots, array[${appliance}]::text[],
      cook_minutes, prep_minutes, servings, difficulty, cuisine, description, instructions, steps_version
    from recipes where slug = ${slug}
    returning id, name, slug`;
  const copy = rows[0];

  if (!copy) {
    throw new Error(`No dish to copy: ${slug}`);
  }

  await sql`
    insert into recipe_ingredients (recipe_id, ingredient_id, grams, quantity, unit, is_optional, note)
    select ${copy.id}::uuid, items.ingredient_id, items.grams, items.quantity, items.unit, items.is_optional, items.note
    from recipe_ingredients items join recipes on recipes.id = items.recipe_id
    where recipes.slug = ${slug}`;

  return { name: copy.name, slug: copy.slug };
}

/**
 * Which of a day's four macros are outside their band, by name — `[]` for a day
 * inside all four.
 *
 * Reads `PLAN_TOLERANCE` rather than restating 5%, which is the scheduler's own
 * rule for the gate and the same rule for the test that checks it: a second
 * idea of what "inside the band" means is how two places come to disagree. The
 * comparison is `outOfBand`'s — not exported, and three operators long.
 *
 * Here rather than in one suite because two suites now read it from the two
 * sides of `0103`: the day a second rule was offered **for** closing is asserted
 * inside its bands (`fixed-meals.e2e-spec.ts`), and the day somebody accepted a
 * warning on is asserted **outside** them, which is the trade they made and the
 * only thing that distinguishes a real warning from a spurious one.
 */
export function bandMisses(day: PlanDayView): readonly string[] {
  const targets = day.targets;

  if (!targets) {
    return ['no targets'];
  }

  const off = (actual: number, target: number, tolerance: number): boolean => Math.abs(actual - target) > target * tolerance;
  // Protein is the one band with two tolerances (`PlanValidation`): over and
  // under are separate violations, so they are read separately here too.
  const protein =
    day.totals.proteinG > targets.proteinG * (1 + PLAN_TOLERANCE.proteinOver) ||
    day.totals.proteinG < targets.proteinG * (1 - PLAN_TOLERANCE.proteinUnder);

  return [
    off(day.totals.kcal, targets.kcal, PLAN_TOLERANCE.kcal) ? 'kcal' : '',
    off(day.totals.carbsG, targets.carbsG, PLAN_TOLERANCE.carbs) ? 'carbs' : '',
    off(day.totals.fatG, targets.fatG, PLAN_TOLERANCE.fat) ? 'fat' : '',
    protein ? 'protein' : ''
  ].filter(name => name !== '');
}

/**
 * Copies one library dish with every ingredient's grams multiplied, under a
 * marked name and slug of its own — and answers the copy.
 *
 * **Both ways**: a factor above 1 makes a dish no plate can hold, which is
 * `too_big_or_small` — `fitsPlate` is one of `honouredPin`'s three hard bounds
 * (`0070`, `0076`, `0078` — the gram ceiling and `PLATE_LIMIT`), the one
 * refusal `0103` deliberately left a refusal although it is arithmetic, and the
 * only way to prove `accept` cannot reach it is to have a dish it fires on. A
 * factor below 1 makes a **small** dish that is still offered, which is how a
 * caller builds the worst case instead of hoping the library hands it one.
 *
 * **How big is not this function's to know, and a constant is a trap.**
 * `fitsPlate` does not compare a dish with a plate: it asks whether the dish can
 * be *sized* onto one, over `SERVING_BOUNDS` and inside `PLATE_LIMIT`. So the
 * factor that refuses a dish out of a thousand-recipe library is simply served
 * at half a portion when the dish is a small fixture — which is how
 * `fixed-meals-warnings.e2e-spec.ts` passed everywhere here and turned CI red
 * on 2026-10-17. The caller derives its factor from those two bounds; see
 * `OVERSIZED` there.
 *
 * **On the tables, and a copy, for `copyDishDeclaring`'s reasons exactly.** A
 * scripted oversized dish is never stored — a dish the model writes is kept
 * only if the plan *uses* it, and the scheduler never reaches for one that
 * fits no plate — so it would come back `unknown_dish` and prove nothing. And
 * the local library has such dishes while a database built the way CI builds it
 * holds the ~90 rows the suites wrote, nearly all of them `POOL` dishes tuned to
 * fit their plates: picking one out of the library passes here and finds nothing
 * there. A copy with one thing changed is the same assertion on both databases.
 *
 * The per-serving macros are what the plate is judged against and they are
 * computed from the ingredients and the catalogue (`perServingIndex`), so
 * scaling the grams and leaving `servings` alone is what moves the plate's
 * answer. Everything else — slots, minutes, method, locale — is the
 * original's, and nothing `whyNotFixable` asks before `fitsPlate` reads grams at
 * all, so scaling can only change *this* verdict and never substitute another
 * reason for it.
 *
 * Caller's to clean up, through `forgetRecipes`, **after** its accounts are
 * deleted, as `copyDishDeclaring`'s copies are.
 */
export async function copyDishScaled(slug: string, factor: number, mark: string): Promise<{ readonly name: string; readonly slug: string }> {
  const sql = sqlClient();
  const rows = await sql<{ id: string; name: string; slug: string }>`
    insert into recipes (slug, name, locale, source, meal_slots, equipment, cook_minutes, prep_minutes, servings, difficulty, cuisine, description,
      instructions, steps_version)
    select ${`${mark.toLowerCase()}-${slug}`}, ${`${mark} `} || name, locale, source, meal_slots, equipment,
      cook_minutes, prep_minutes, servings, difficulty, cuisine, description, instructions, steps_version
    from recipes where slug = ${slug}
    returning id, name, slug`;
  const copy = rows[0];

  if (!copy) {
    throw new Error(`No dish to copy: ${slug}`);
  }

  await sql`
    insert into recipe_ingredients (recipe_id, ingredient_id, grams, quantity, unit, is_optional, note)
    select ${copy.id}::uuid, items.ingredient_id, items.grams * ${factor}, items.quantity, items.unit, items.is_optional, items.note
    from recipe_ingredients items join recipes on recipes.id = items.recipe_id
    where recipes.slug = ${slug}`;

  return { name: copy.name, slug: copy.slug };
}

/**
 * Clears the stored height of one account's profile, leaving its finished
 * onboarding alone.
 *
 * **The one state over HTTP that makes a judgement about somebody's food
 * uncomputable while they are still allowed to ask for it.** `targetInput`
 * returns null without a height, so `ProfileController.getFullProfile` answers
 * `targets: null` — honestly, because a calorie figure from a guessed height is
 * a number somebody would act on — and everything that assembles a generation's
 * context refuses. `GET /fixed-meals/honourability` answers `judged: false`
 * there rather than becoming an error page over the footnote beside somebody's
 * rules, and that is what this exists to reach.
 *
 * It cannot be reached by withdrawing the profile consent, which is the other
 * cause the route names: withdrawal reopens `goal`, `body-activity` and
 * `allergies`, so `@RequiresOnboarding()` answers `ONBOARDING_INCOMPLETE`
 * before the controller runs at all (`profile-consent.e2e-spec.ts`). Written on
 * the table for `markLegacyOnboarding`'s reason — no route produces this shape,
 * and only a profile from before a column was required ever held it.
 */
export async function clearProfileHeight(userId: string): Promise<void> {
  const cleared = await sqlClient()<{ userId: string }>`
    update profiles set height_cm = null where user_id = ${userId} returning user_id as "userId"`;

  if (cleared.length !== 1) {
    throw new Error(`No profiles row to clear the height of: ${userId}`);
  }
}

/**
 * What the newest generation of one account threw away, by reason, summed over
 * its model calls (`plan_generation_jobs.ai_calls` → `rejected`).
 *
 * The one way to tell a gate that fired from a scheduler that happened not to
 * pick the dish. "No oven dish in the fortnight" is true of a kitchen with an
 * oven too, most fortnights; `{ missing_equipment: n }` is only ever written by
 * `PoolBuilder` refusing what the model returned.
 */
export async function rejectionsOfLastGeneration(userId: string): Promise<Readonly<Record<string, number>>> {
  const rows = await sqlClient()<{ aiCalls: readonly { readonly rejected?: Readonly<Record<string, number>> }[] | null }>`
    select ai_calls as "aiCalls" from plan_generation_jobs where user_id = ${userId} order by created_at desc limit 1`;
  const tally: Record<string, number> = {};

  for (const call of rows[0]?.aiCalls ?? []) {
    for (const [reason, count] of Object.entries(call.rejected ?? {})) {
      tally[reason] = (tally[reason] ?? 0) + count;
    }
  }

  return tally;
}

/**
 * Takes the dishes a suite had written out of the library again, by slug.
 *
 * **The one thing a suite creates that deleting its accounts does not remove.**
 * `recipes` is shared and outlives every account (`created_by` is provenance,
 * `ON DELETE SET NULL`), which is the product working — but a suite that
 * *names* the dishes it asks for, as `dish-request` must, has to be able to run
 * twice: left behind, its own slugs are taken, and the second run is handed
 * yesterday's dish instead of writing one. The database here is also the
 * development library, which the plan measurements read, so the litter is not
 * free either.
 *
 * On the tables, like `openPractice`: no route deletes a recipe. One statement
 * per slug and never fatal — `meals.recipe_id` is `RESTRICT`, so a dish some
 * plan served stays, and a cleanup that threw would hide whatever the suite was
 * really reporting. A slug nothing holds is a no-op.
 */
export async function forgetRecipes(slugs: readonly string[]): Promise<void> {
  const sql = sqlClient();

  for (const slug of slugs) {
    try {
      await sql`delete from recipes where slug = ${slug}`;
    } catch {
      // Held by a plan, or by anything else that may not lose it. Said by what is left behind, not by a throw.
    }
  }
}

/**
 * How many rows the admin trail (`0071`) holds for one action, or for all of
 * them. Read directly from the table rather than through `GET /admin/audit`
 * so a suite proving "this call wrote no row" (a 404 that must leave the
 * trail untouched) does not need an admin session of its own — only the
 * before/after count.
 */
export async function auditCount(action?: AuditAction): Promise<number> {
  const sql = sqlClient();
  const rows =
    action === undefined
      ? await sql<{ n: number }>`select count(*)::int as n from audit_logs`
      : await sql<{ n: number }>`select count(*)::int as n from audit_logs where action = ${action}`;

  return rows[0]?.n ?? 0;
}

export type AuditRow = {
  readonly id: string;
  readonly action: string;
  readonly actorId: string | null;
  /** As the raw client hands it back — a string, not a parsed `Date`. */
  readonly createdAt: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly ipHash: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly subjectUserId: string | null;
};

/**
 * The newest row for one action, read straight from the table — `entityId`,
 * `subjectUserId` and `ipHash` included, none of which `AuditLogView`
 * (`GET /admin/audit`) exposes. `null` when the action has never been
 * written, which no suite here should see: every suite that calls this has
 * just caused the row it is reading.
 */
export async function latestAuditRow(action: AuditAction): Promise<AuditRow | null> {
  const sql = sqlClient();
  const rows = await sql<AuditRow>`
    select id, action, actor_id as "actorId", created_at as "createdAt", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
    from audit_logs
    where action = ${action}
    order by created_at desc, id desc
    limit 1`;

  return rows[0] ?? null;
}

/** One row by its own id, however its columns now read — for a suite that captured the id before an account it named was deleted. */
export async function auditRowById(id: string): Promise<AuditRow | null> {
  const sql = sqlClient();
  const rows = await sql<AuditRow>`
    select id, action, actor_id as "actorId", created_at as "createdAt", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
    from audit_logs
    where id = ${id}`;

  return rows[0] ?? null;
}

/** Every row naming this account as its subject — for a suite that must find one before deleting the account it is about. */
export async function auditRowsAboutSubject(subjectUserId: string): Promise<readonly AuditRow[]> {
  const sql = sqlClient();

  return sql<AuditRow>`
    select id, action, actor_id as "actorId", created_at as "createdAt", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
    from audit_logs
    where subject_user_id = ${subjectUserId}`;
}

/** How many rows in the whole table carry an ip hash — always zero; nothing in the product ever writes one (`0071`). */
export async function auditRowsWithIpHash(): Promise<number> {
  const sql = sqlClient();
  const rows = await sql<{ n: number }>`select count(*)::int as n from audit_logs where ip_hash is not null`;

  return rows[0]?.n ?? 0;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32, padding ignored — the alphabet an `otpauth://` URI's `secret` is written in. */
function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);

    if (index < 0) {
      throw new Error(`Not base32: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * The code an authenticator app shows for this `otpauth://` URI (RFC 6238:
 * HMAC-SHA1, 30-second steps, 6 digits), `steps` periods away from now — what
 * the person types, computed the way their phone does, with nothing of the
 * product's own code. `steps` outside ±1 is a code the server's window does
 * not accept, which is how a suite writes a wrong one.
 */
export function totpCode(totpURI: string, steps = 0, now = Date.now()): string {
  const secret = new URL(totpURI).searchParams.get('secret');

  if (!secret) {
    throw new Error('No secret in the TOTP URI');
  }

  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000) + steps));

  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const truncated = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(truncated % 1_000_000).padStart(6, '0');
}

/** The raw secret behind a TOTP URI, as the server keys its HMAC with it — for a suite looking for it where it must not be. */
export function totpSecret(totpURI: string): { readonly base32: string; readonly raw: string } {
  const base32 = new URL(totpURI).searchParams.get('secret') ?? '';

  return { base32, raw: base32Decode(base32).toString('utf8') };
}

function pause(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Right codes the server has not taken yet. It remembers the last step it
 * accepted for a secret and refuses that one and every older one
 * (`two_factor.last_totp_step`, PLAN 011 phase 4), so `fresh` hands out the
 * current step's code, or the next one's while the ±1 window allows it, and
 * otherwise waits for the clock's next step. A step is recorded as it is
 * handed out: one the server then refuses for another reason only makes the
 * next code a later one. One instance per suite.
 */
export class TotpClock {
  private readonly claimed = new Map<string, number>();

  async fresh(totpURI: string): Promise<string> {
    for (;;) {
      const now = Date.now();
      const step = Math.floor(now / 30_000);
      const last = this.claimed.get(totpURI) ?? Number.NEGATIVE_INFINITY;

      for (const ahead of [0, 1]) {
        if (step + ahead > last) {
          this.claimed.set(totpURI, step + ahead);

          return totpCode(totpURI, ahead, now);
        }
      }

      await pause((step + 1) * 30_000 - now + 50);
    }
  }

  /** A step the suite typed on its own (an older-step case): the codes after it are later ones. */
  claim(totpURI: string, step: number): void {
    this.claimed.set(totpURI, Math.max(step, this.claimed.get(totpURI) ?? Number.NEGATIVE_INFINITY));
  }
}

/** Waits out the end of a TOTP step, so what follows has at least fifteen seconds of the same one. */
export async function steadyStep(): Promise<void> {
  const into = Date.now() % 30_000;

  if (into > 15_000) {
    await pause(30_000 - into + 50);
  }
}

/**
 * The API's own limiter (`RateLimitGuard`, 120 a minute) keys a caller with no session on its address and the
 * route pattern, and every `/auth/*` path is one pattern: a suite's sign-ups, sign-ins, challenges and codes
 * all spend the same allowance. On CI's local Postgres a suite outruns it inside a minute; on Neon it never
 * does. Its refusal never reached a handler, so it is waited out and the same request sent again. It is told
 * apart by what it lacks: Better Auth's own 429 always carries `X-Retry-After`, the guard's never does (and the
 * exception filter hands its body back as `REQUEST_ERROR`, so the code cannot tell them apart). Better Auth's is
 * the product answering, and is not retried here.
 */
export async function paced(send: () => PromiseLike<Response>): Promise<Response> {
  const deadline = Date.now() + 70_000;
  let response = await send();

  while (response.status === 429 && response.headers['x-retry-after'] === undefined && Date.now() < deadline) {
    await pause(5_000);
    response = await send();
  }

  return response;
}

/**
 * A browser's cookie jar, as far as a suite needs one: each `Set-Cookie` of a
 * response replaces the cookie of that name, and one set to expire
 * (`Max-Age=0`, or an empty value) removes it. Joining a response's cookies
 * as they come would send a cleared session cookie back as if it were live.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  take(response: Response): this {
    for (const line of (response.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
      const [pair = '', ...attributes] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1).trim();
      const expired = value === '' || attributes.some(attribute => /^\s*max-age=0\s*$/i.test(attribute));

      if (expired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }

    return this;
  }

  has(fragment: string): boolean {
    return [...this.cookies.keys()].some(name => name.includes(fragment));
  }

  /** Only the cookies whose name carries `fragment` — one cookie carried to another jar. */
  only(fragment: string): string {
    return [...this.cookies]
      .filter(([name]) => name.includes(fragment))
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  get header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

/**
 * The calendar day a person in Madrid is living, as `YYYY-MM-DD` — what the API
 * calls "today" for every account these suites register (their profile keeps
 * `Europe/Madrid`). Never `new Date().toISOString().slice(0, 10)`: that is the
 * UTC day, and for two hours a night it is yesterday.
 */
export function madridToday(): string {
  return dayKeyIn(new Date(), 'Europe/Madrid');
}
