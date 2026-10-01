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
import { shapeFor } from 'core/domain/MealShape';

import { AiClient } from '../src/modules/ai/clients/AiClient.js';
import { AppModule } from '../src/app.module.js';

import type { AuditAction } from 'core/entities/Audit';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { INestApplication } from '@nestjs/common';
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

export async function register(app: INestApplication, email: string): Promise<Account> {
  const password = 'correct-horse-battery-staple-9';
  const server = httpServer(app);

  await request(server)
    .post(`/${PREFIX}/auth/sign-up/email`)
    .send({ email, name: email.split('@')[0], password })
    .expect(200);
  await activate(email);

  const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }).expect(200);
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
 * Silently returns when the sign-in fails: the account is already gone, which
 * a second cleanup run against the same database must tolerate.
 */
export async function deleteAccountByEmail(app: INestApplication, email: string, password = 'correct-horse-battery-staple-9'): Promise<void> {
  const server = httpServer(app);
  const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password });

  if (signIn.status !== 200) {
    return;
  }

  const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

  await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
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
 * `docs/legal/checklist-activacion.md` § 1) at the current version, through
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
    return [...this.cookies].filter(([name]) => name.includes(fragment)).map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}
