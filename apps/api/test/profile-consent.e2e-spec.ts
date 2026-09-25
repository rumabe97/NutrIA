import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import type { Response } from 'supertest';

import { database } from 'database';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';

import {
  completeOnboarding,
  createApp,
  deleteAccounts,
  generateAndWait,
  giveProfileConsent,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { FullProfileView, ProfileConsentView } from 'core/controllers/Profile';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { INestApplication } from '@nestjs/common';

/**
 * The explicit profile consent (`docs/legal/textos/05-consentimientos-cliente.md`
 * § A, P0-2) and the minimum age (18, owner's decision 2026-09-25) — both from
 * the same commit, both asserted here.
 *
 * Without a current consent, `goal`, `body-activity` and `allergies` — the
 * onboarding steps that collect what the consent covers — refuse, and so does
 * everything else that reads or writes that data: `PATCH /profile/goal`,
 * `PATCH /profile` with a height, `PUT /safety/restrictions`,
 * `POST /progress/weight`, and generation itself, which starts no job.
 * Withdrawing it deletes what it covered, in one transaction, and reopens
 * onboarding at those same three steps.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

type Tables = <Row>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<Row[]>;

/** Parameterised reads on the tables themselves — the pattern `care.e2e-spec.ts` and `billing.e2e-spec.ts` use, so a deletion is proved by asking the table, not by trusting the presenter that reads it. */
function tables(): Tables {
  return (database() as unknown as { readonly $client: Tables }).$client;
}

/**
 * Simulates an account whose profile predates this change: registered,
 * onboarded and consented through the product exactly as any account did, then
 * the row `0039` added is removed underneath it — no route may do this, only
 * the migration's absence of one for every account that existed before it.
 */
async function forgetConsent(userId: string): Promise<void> {
  await tables()`delete from profile_data_consents where user_id = ${userId}`;
}

async function goalCount(userId: string): Promise<number> {
  const [row] = await tables()<{ count: number }>`select count(*)::int as count from goals where user_id = ${userId}`;

  return row?.count ?? 0;
}

async function jobCount(userId: string): Promise<number> {
  const [row] = await tables()<{ count: number }>`select count(*)::int as count from plan_generation_jobs where user_id = ${userId}`;

  return row?.count ?? 0;
}

async function progressWeights(userId: string): Promise<readonly (number | null)[]> {
  const rows = await tables()<{ weightKg: string | null }>`select weight_kg as "weightKg" from progress_entries where user_id = ${userId}`;

  return rows.map(row => (row.weightKg === null ? null : Number(row.weightKg)));
}

async function checkInWeights(userId: string): Promise<readonly (number | null)[]> {
  const rows = await tables()<{ weightKg: string | null }>`select weight_kg as "weightKg" from check_ins where user_id = ${userId}`;

  return rows.map(row => (row.weightKg === null ? null : Number(row.weightKg)));
}

/** `years` ago today, as the `YYYY-MM-DD` `updateProfileSchema.birthDate` takes. */
function isoDateYearsAgo(years: number): string {
  const on = new Date();

  on.setUTCFullYear(on.getUTCFullYear() - years);

  return on.toISOString().slice(0, 10);
}

describe('profile consent and the minimum age, end to end', () => {
  let app: INestApplication;
  /** Every account this suite registered, so `afterAll` can delete each one. */
  const made: string[] = [];

  async function onboardingView(account: Account): Promise<OnboardingView> {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/onboarding`).set('Cookie', account.cookie).retry(1).expect(200);

    return response.body as OnboardingView;
  }

  async function profileView(account: Account): Promise<FullProfileView> {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).retry(1).expect(200);

    return response.body as FullProfileView;
  }

  async function consentView(account: Account): Promise<ProfileConsentView> {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile/consent`).set('Cookie', account.cookie).retry(1).expect(200);

    return response.body as ProfileConsentView;
  }

  async function expectConsentRequired(run: () => Promise<Response>): Promise<void> {
    const response = await run();

    expect(response.status).toBe(409);
    expect((response.body as { code: string }).code).toBe('PROFILE_CONSENT_REQUIRED');
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
  }, 30_000);

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app.close();
  });

  describe('a new account, before consent', () => {
    let account: Account;

    beforeAll(async () => {
      account = await register(app, `consent-new-${Date.now()}@example.invalid`);
      made.push(account.cookie);
      await request(httpServer(app))
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', account.cookie)
        .send({ data: { birthDate: '1994-03-11', country: 'ES', displayName: 'Consent', sex: 'female' }, step: 'about-you' })
        .expect(200);
    }, 30_000);

    it('refuses every step and route the consent covers, and stores nothing', async () => {
      const server = httpServer(app);

      // `POST /progress/weight` and `POST /meal-plans/generate` are not in this
      // sweep: both carry `@RequiresOnboarding()`, and this account has not
      // finished onboarding either (that is exactly what these steps refusing
      // to save prevents) — so the guard answers 409 `ONBOARDING_INCOMPLETE`
      // before the controller ever asks for consent, the same way it already
      // does for any unfinished account (`access.e2e-spec.ts`). Consent's own
      // refusal on those two routes needs onboarding complete first, which is
      // exactly what "an account from before this change" and "withdrawing
      // consent" below set up.
      await expectConsentRequired(() =>
        request(server)
          .patch(`/${PREFIX}/onboarding`)
          .set('Cookie', account.cookie)
          .send({ data: { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' }, step: 'goal' })
      );
      await expectConsentRequired(() =>
        request(server)
          .patch(`/${PREFIX}/onboarding`)
          .set('Cookie', account.cookie)
          .send({ data: { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 }, step: 'body-activity' })
      );
      await expectConsentRequired(() =>
        request(server)
          .patch(`/${PREFIX}/onboarding`)
          .set('Cookie', account.cookie)
          .send({ data: { allergies: [], customAllergens: [], dietaryPatterns: [], intolerances: [] }, step: 'allergies' })
      );
      await expectConsentRequired(() =>
        request(server)
          .patch(`/${PREFIX}/profile/goal`)
          .set('Cookie', account.cookie)
          .send({ paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' })
      );
      await expectConsentRequired(() => request(server).patch(`/${PREFIX}/profile`).set('Cookie', account.cookie).send({ heightCm: 168 }));
      await expectConsentRequired(() =>
        request(server)
          .put(`/${PREFIX}/safety/restrictions`)
          .set('Cookie', account.cookie)
          .send({ allergies: [], customAllergens: [], intolerances: [] })
      );

      // `about-you` carries no health data and is not one of the gated steps.
      const onboarding = await onboardingView(account);

      expect(onboarding.completedSteps).toEqual(['about-you']);
      expect(onboarding.profileConsentRequired).toBe(true);

      const profile = await profileView(account);

      expect(profile.goal).toBeNull();
      expect(profile.profile?.heightCm ?? null).toBeNull();
      expect(profile.allergies).toEqual([]);
      expect(profile.customAllergens).toEqual([]);
      expect(profile.intolerances).toEqual([]);

      expect(await goalCount(account.id)).toBe(0);
      expect(await jobCount(account.id)).toBe(0);
    }, 60_000);

    it('GET /profile/consent names the current version and answers false; PUT refuses any other version', async () => {
      const before = await consentView(account);

      expect(before).toMatchObject({ currentVersion: PROFILE_CONSENT_VERSION, grantedAt: null, isCurrent: false });

      const stale: Response = await request(httpServer(app))
        .put(`/${PREFIX}/profile/consent`)
        .set('Cookie', account.cookie)
        .send({ version: '0.0.1' })
        .expect(422);

      expect((stale.body as { code: string }).code).toBe('INVALID_INPUT');
      expect(await consentView(account)).toMatchObject({ isCurrent: false });

      const given: Response = await request(httpServer(app))
        .put(`/${PREFIX}/profile/consent`)
        .set('Cookie', account.cookie)
        .send({ version: PROFILE_CONSENT_VERSION })
        .expect(200);

      expect(given.body).toMatchObject({ currentVersion: PROFILE_CONSENT_VERSION, isCurrent: true });
      expect((given.body as ProfileConsentView).grantedAt).not.toBeNull();
      expect(await consentView(account)).toMatchObject({ isCurrent: true });
    });

    it('accepts every one of them once consent is given, and a plan generates', async () => {
      await completeOnboarding(app, account);

      const server = httpServer(app);

      await request(server)
        .patch(`/${PREFIX}/profile/goal`)
        .set('Cookie', account.cookie)
        .send({ paceKgPerWeek: null, startingWeightKg: 70, targetWeightKg: 68, type: 'maintenance' })
        .expect(200);
      await request(server).patch(`/${PREFIX}/profile`).set('Cookie', account.cookie).send({ heightCm: 170 }).expect(200);
      await request(server)
        .put(`/${PREFIX}/safety/restrictions`)
        .set('Cookie', account.cookie)
        .send({ allergies: [], customAllergens: [], intolerances: [] })
        .expect(204);
      await request(server).post(`/${PREFIX}/progress/weight`).set('Cookie', account.cookie).send({ weightKg: 70 }).expect(201);

      const job = await generateAndWait(app, account, 180_000);

      expect(job.status).toBe('succeeded');
    }, 200_000);
  });

  describe('an account from before this change', () => {
    let account: Account;

    beforeAll(async () => {
      account = await register(app, `consent-legacy-${Date.now()}@example.invalid`);
      made.push(account.cookie);
      await completeOnboarding(app, account);
      await forgetConsent(account.id);
    }, 60_000);

    it('is asked for consent again, with its onboarding and its data untouched', async () => {
      const onboarding = await onboardingView(account);

      expect(onboarding.isComplete).toBe(true);
      expect(onboarding.profileConsentRequired).toBe(true);

      const profile = await profileView(account);

      expect(profile.goal).not.toBeNull();
      expect(profile.profile?.heightCm).toBe(168);
    });

    it('refuses to generate until consent is given again', async () => {
      const refused: Response = await request(httpServer(app)).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', account.cookie).expect(409);

      expect((refused.body as { code: string }).code).toBe('PROFILE_CONSENT_REQUIRED');
      expect(await jobCount(account.id)).toBe(0);

      await giveProfileConsent(app, account);

      const job = await generateAndWait(app, account, 180_000);

      expect(job.status).toBe('succeeded');
    }, 200_000);
  });

  describe('withdrawing consent', () => {
    let account: Account;
    let other: Account;

    beforeAll(async () => {
      const allergensResponse: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);
      // `crustaceans`, not `gluten`: the shared `POOL` fixture's breakfast
      // dishes are built on oats and bread, so a gluten allergy would exclude
      // them all and starve the slot. Nothing in `POOL` is a crustacean, so the
      // gate has something to enforce without touching what this account can
      // still be served.
      const allergenId = (allergensResponse.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'crustaceans')?.id;

      if (!allergenId) {
        throw new Error('No crustaceans allergen in the seeded catalogue — see ./README.md');
      }

      // One request at a time: the app is never listening between requests, so
      // supertest starts and closes the server for each one, and two in flight
      // at once close it under each other (`connect ECONNRESET`).
      account = await register(app, `consent-withdraw-${Date.now()}@example.invalid`);
      other = await register(app, `consent-withdraw-other-${Date.now()}@example.invalid`);
      made.push(account.cookie, other.cookie);

      // `omnivore`, not `vegetarian`: it still proves `user_dietary_patterns` is
      // written and deleted, without excluding the meat and fish `POOL` needs.
      await completeOnboarding(app, account, [allergenId], ['Avellanas'], false, ['omnivore']);
      await completeOnboarding(app, other);

      await request(httpServer(app)).post(`/${PREFIX}/progress/weight`).set('Cookie', account.cookie).send({ weightKg: 71.4 }).expect(201);

      const job = await generateAndWait(app, account, 180_000);

      expect(job.status).toBe('succeeded');

      await request(httpServer(app))
        .post(`/${PREFIX}/check-ins`)
        .set('Cookie', account.cookie)
        // `hunger: 'right'` on purpose — the nudge this would otherwise trigger
        // is not this test's concern, and it would move the target this test
        // checks was cleared.
        .send({ difficulty: 'ok', hunger: 'right', planId: job.planId, satisfaction: 4, weightKg: 70.9 })
        .expect(201);
    }, 240_000);

    it('deletes the data the consent covers, in one transaction, and leaves another account untouched', async () => {
      const before = await profileView(account);

      expect(before.allergies).toHaveLength(1);
      expect(before.customAllergens).toHaveLength(1);
      expect(before.dietaryPatterns).toEqual(['omnivore']);
      expect(before.goal).not.toBeNull();
      expect(before.profile?.heightCm).toBe(168);
      expect(await progressWeights(account.id)).toEqual([70.9]);
      expect(await checkInWeights(account.id)).toEqual([70.9]);

      const withdrawn: Response = await request(httpServer(app))
        .delete(`/${PREFIX}/profile/consent`)
        .set('Cookie', account.cookie)
        .retry(1)
        .expect(200);

      expect(withdrawn.body).toMatchObject({ isCurrent: false });

      // Idempotent: a second withdrawal deletes nothing more and answers the same.
      const withdrawnAgain: Response = await request(httpServer(app))
        .delete(`/${PREFIX}/profile/consent`)
        .set('Cookie', account.cookie)
        .retry(1)
        .expect(200);

      expect(withdrawnAgain.body).toMatchObject({ isCurrent: false });

      const after = await profileView(account);

      expect(after.allergies).toEqual([]);
      expect(after.customAllergens).toEqual([]);
      expect(after.intolerances).toEqual([]);
      expect(after.dietaryPatterns).toEqual([]);
      expect(after.goal).toBeNull();
      expect(after.profile?.heightCm ?? null).toBeNull();
      expect(await goalCount(account.id)).toBe(0);
      expect(await progressWeights(account.id)).toEqual([null]);
      expect(await checkInWeights(account.id)).toEqual([null]);

      const onboarding = await onboardingView(account);

      expect(onboarding.completedAt).toBeNull();
      expect(onboarding.resumeStep).toBe(2);
      expect(onboarding.missingSteps).toEqual(['goal', 'body-activity', 'allergies']);
      expect(onboarding.profileConsentRequired).toBe(true);

      // Another account's data is untouched by this one's withdrawal.
      const untouched = await profileView(other);

      expect(untouched.goal).not.toBeNull();
      expect(untouched.profile?.heightCm).toBe(168);
    }, 30_000);

    it('refuses to generate afterwards', async () => {
      // `ONBOARDING_INCOMPLETE`, not `PROFILE_CONSENT_REQUIRED`: withdrawal
      // reopened `goal`, `body-activity` and `allergies`, so `isComplete` is
      // false again and `@RequiresOnboarding()`'s guard answers before the
      // controller ever asks for consent — the same guard `access.e2e-spec.ts`
      // proves for any unfinished account. The account still holds no consent
      // underneath (`profileConsentRequired: true`, asserted above), and no new
      // job is created either way — the setup's own generation is the one there.
      const jobsBefore = await jobCount(account.id);
      const refused: Response = await request(httpServer(app))
        .post(`/${PREFIX}/meal-plans/generate`)
        .set('Cookie', account.cookie)
        .retry(1)
        .expect(409);

      expect((refused.body as { code: string }).code).toBe('ONBOARDING_INCOMPLETE');
      expect(await jobCount(account.id)).toBe(jobsBefore);
    });
  });

  describe('the minimum age', () => {
    let account: Account;

    beforeAll(async () => {
      account = await register(app, `consent-age-${Date.now()}@example.invalid`);
      made.push(account.cookie);
    });

    it('refuses a birth date under 18, in onboarding and in the profile, and stores nothing', async () => {
      const server = httpServer(app);
      const under18 = isoDateYearsAgo(17);

      const onboardingRefusal: Response = await request(server)
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', account.cookie)
        .send({ data: { birthDate: under18, country: 'ES', displayName: 'Too Young', sex: 'female' }, step: 'about-you' })
        .expect(422);

      expect((onboardingRefusal.body as { code: string }).code).toBe('UNDER_MINIMUM_AGE');

      const profileRefusal: Response = await request(server)
        .patch(`/${PREFIX}/profile`)
        .set('Cookie', account.cookie)
        .send({ birthDate: under18 })
        .expect(422);

      expect((profileRefusal.body as { code: string }).code).toBe('UNDER_MINIMUM_AGE');

      const profile = await profileView(account);

      expect(profile.profile?.birthDate ?? null).toBeNull();
    });

    it('accepts exactly 18 today', async () => {
      const exactly18 = isoDateYearsAgo(18);

      await request(httpServer(app))
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', account.cookie)
        .send({ data: { birthDate: exactly18, country: 'ES', displayName: 'Just 18', sex: 'female' }, step: 'about-you' })
        .expect(200);

      const profile = await profileView(account);

      expect(profile.profile?.birthDate).toBe(exactly18);
    });
  });
});
