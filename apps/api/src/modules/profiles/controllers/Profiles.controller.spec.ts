import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { KitchenController } from 'core/controllers/Kitchen';
import { ProfileConsentController, ProfileController } from 'core/controllers/Profile';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { InputParseError, ProfileConsentRequiredError, UnderMinimumAgeError } from 'core/entities/Error';
import { SafetyController } from 'core/controllers/Safety';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { ProfilesController } from './Profiles.controller.js';
import { ProfilesService } from '../services/index.js';
import { SafetyController as SafetyRoutes } from '../../safety/controllers/index.js';
import { SafetyService } from '../../safety/services/index.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import type { Server } from 'node:http';

/**
 * The same pipeline-level cover as the onboarding controller, for the same reason:
 * these routes carried the identical handler-level `@UsePipes` defect, where the
 * body schema was also applied to `@CurrentUser()` and rejected every valid
 * request. Only a request through the real pipeline sees it.
 */
describe('body validation is scoped to the body', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController, SafetyRoutes],
      providers: [ProfilesService, SafetyService]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: 'usr-1', activated: true, email: 'a@b.co', emailVerified: true, name: 'A', role: 'user' };
      next();
    });
    app.use(express.json());
    await app.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * The language switch sends exactly this and nothing else.
   *
   * The UI language comes from a cookie and the *data* language from
   * `profiles.locale`, so a `locale` that is validated away leaves a user reading
   * an English interface full of Spanish ingredient names — which is what was
   * reported, and what this asserts cannot happen silently.
   */
  it('gives the profile consent with the current version, for the session’s account', async () => {
    const give = jest
      .spyOn(ProfileConsentController, 'give')
      .mockResolvedValue({ currentVersion: PROFILE_CONSENT_VERSION, grantedAt: 'x', isCurrent: true });

    const response: Response = await request(app.getHttpServer() as Server)
      .put('/profile/consent')
      .send({ userId: 'usr-2', version: PROFILE_CONSENT_VERSION });

    expect(response.status).toBe(200);
    expect(give).toHaveBeenCalledWith('usr-1', PROFILE_CONSENT_VERSION);
  });

  it('refuses a consent to any other version: it is consent to a different notice', async () => {
    const give = jest.spyOn(ProfileConsentController, 'give');

    const response: Response = await request(app.getHttpServer() as Server)
      .put('/profile/consent')
      .send({ version: '0.9.0' });

    expect(response.status).toBe(422);
    expect(give).not.toHaveBeenCalled();
  });

  it('withdraws the consent of the session’s account', async () => {
    const withdraw = jest
      .spyOn(ProfileConsentController, 'withdraw')
      .mockResolvedValue({ currentVersion: PROFILE_CONSENT_VERSION, grantedAt: null, isCurrent: false });

    const response: Response = await request(app.getHttpServer() as Server).delete('/profile/consent');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isCurrent: false });
    expect(withdraw).toHaveBeenCalledWith('usr-1');
  });

  it('answers a goal without consent with 409 and its own code', async () => {
    jest.spyOn(ProfileController, 'updateGoal').mockRejectedValue(new ProfileConsentRequiredError());

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/goal')
      .send({ type: 'maintenance' });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'PROFILE_CONSENT_REQUIRED' });
  });

  it('answers a birth date under 18 with 422 and its own code', async () => {
    jest.spyOn(ProfileController, 'updateProfile').mockRejectedValue(new UnderMinimumAgeError());

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ birthDate: '2015-01-01' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'UNDER_MINIMUM_AGE' });
  });

  it('carries a lone locale through to the controller', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ locale: 'en-GB' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { locale: 'en-GB' });
  });

  it('refuses a locale it does not ship rather than storing it', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ locale: 'x' });

    expect(response.status).toBe(422);
  });

  it('accepts a valid profile update', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ displayName: 'Ada', heightCm: 168 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada', heightCm: 168 });
  });

  it('accepts a valid goal update', async () => {
    const update = jest.spyOn(ProfileController, 'updateGoal').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/goal')
      .send({ startingWeightKg: 72, type: 'maintenance' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { startingWeightKg: 72, type: 'maintenance' });
  });

  it('accepts a valid preferences update', async () => {
    const update = jest.spyOn(ProfileController, 'updatePreferences').mockResolvedValue({} as never);

    jest.spyOn(KitchenController, 'read').mockResolvedValue({ appliances: {}, described: false, maxPreferred: 3 } as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/preferences')
      .send({ cookingTimeMinutes: 30 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { cookingTimeMinutes: 30 });
  });

  it('accepts a targets override and passes only the fields that were sent', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ kcal: 2400 });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { kcal: 2400 });
  });

  it('accepts nulls, which are how a user clears an override rather than changing it', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ carbsG: null, fatG: null, kcal: null, proteinG: null });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith('usr-1', { carbsG: null, fatG: null, kcal: null, proteinG: null });
  });

  it('rejects a non-numeric target without reaching the controller', async () => {
    const update = jest.spyOn(ProfileController, 'updateTargets').mockResolvedValue({} as never);

    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile/targets')
      .send({ kcal: 'muchas' });

    expect(response.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts a valid restrictions replacement', async () => {
    const set = jest.spyOn(SafetyController, 'setRestrictions').mockResolvedValue(undefined);

    const response: Response = await request(app.getHttpServer() as Server)
      .put('/safety/restrictions')
      .send({ allergies: [], intolerances: [] });

    expect(response.status).toBe(204);
    // `customAllergens` defaults to an empty list rather than arriving undefined:
    // the replace-all semantics depend on the field always being present, or an
    // older client omitting it would leave stale free-text entries in place.
    expect(set).toHaveBeenCalledWith('usr-1', { allergies: [], customAllergens: [], intolerances: [] });
  });

  it('still rejects an out-of-range height', async () => {
    const response: Response = await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ heightCm: 3 });

    expect(response.status).toBe(422);
    expect((response.body as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty('heightCm');
  });

  it('still strips a userId smuggled into the body', async () => {
    const update = jest.spyOn(ProfileController, 'updateProfile').mockResolvedValue({} as never);

    await request(app.getHttpServer() as Server)
      .patch('/profile')
      .send({ displayName: 'Ada', userId: 'usr-somebody-else' });

    expect(update).toHaveBeenCalledWith('usr-1', { displayName: 'Ada' });
  });

  describe('the kitchen', () => {
    const VIEW = {
      appliances: { air_fryer: 'prefers', blender: 'has', grill: 'missing', microwave: 'has', oven: 'has' },
      described: true,
      maxPreferred: 3
    };

    it('answers the kitchen, defaulted, beside the rest of the profile', async () => {
      jest.spyOn(ProfileController, 'getFullProfile').mockResolvedValue({ profile: null } as never);
      const read = jest.spyOn(KitchenController, 'read').mockResolvedValue({ ...VIEW, described: false } as never);

      const response: Response = await request(app.getHttpServer() as Server).get('/profile');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ kitchen: { described: false, maxPreferred: 3 } });
      expect(read).toHaveBeenCalledWith('usr-1');
    });

    it('writes the kitchen for the session’s account, taking off `prefers` before putting any on', async () => {
      const order: string[] = [];

      jest.spyOn(KitchenController, 'setStance').mockImplementation(async (_userId, { appliance, stance }) => {
        order.push(`${appliance}:${stance}`);

        return VIEW as never;
      });
      jest.spyOn(KitchenController, 'clearStance').mockImplementation(async (_userId, appliance) => {
        order.push(`${appliance}:cleared`);

        return VIEW as never;
      });
      jest.spyOn(KitchenController, 'read').mockResolvedValue(VIEW as never);
      const update = jest.spyOn(ProfileController, 'updatePreferences').mockResolvedValue({ cookingTimeMinutes: 30 } as never);

      const response: Response = await request(app.getHttpServer() as Server)
        .patch('/profile/preferences')
        .send({
          cookingTimeMinutes: 30,
          kitchen: [
            { appliance: 'air_fryer', stance: 'prefers' },
            { appliance: 'oven', stance: 'has' },
            { appliance: 'grill', stance: null }
          ],
          userId: 'usr-2'
        });

      expect(response.status).toBe(200);
      expect(order).toEqual(['oven:has', 'grill:cleared', 'air_fryer:prefers']);
      expect(response.body).toMatchObject({ cookingTimeMinutes: 30, kitchen: { described: true } });
      // The kitchen is not a preference column: it must not reach the preferences write.
      expect(update).toHaveBeenCalledWith('usr-1', { cookingTimeMinutes: 30 });
    });

    it('refuses an appliance the catalogue does not hold, naming the field, and writes nothing', async () => {
      const setStance = jest.spyOn(KitchenController, 'setStance');
      const update = jest.spyOn(ProfileController, 'updatePreferences');

      const response: Response = await request(app.getHttpServer() as Server)
        .patch('/profile/preferences')
        .send({ kitchen: [{ appliance: 'toaster', stance: 'has' }] });

      expect(response.status).toBe(422);
      expect(Object.keys((response.body as { fieldErrors: Record<string, string[]> }).fieldErrors).join()).toContain('kitchen');
      expect(setStance).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    /**
     * The route does not count. The bound is the controller's, checked inside the
     * repository's lock, and what the route owes is to let its refusal through as
     * the 422 it already is.
     */
    it('lets the controller’s refusal of a fourth `prefers` through as 422, field named, other preferences untouched', async () => {
      jest
        .spyOn(KitchenController, 'setStance')
        .mockRejectedValue(new InputParseError('At most 3 appliances may be preferred', { appliance: ['At most 3 appliances may be preferred'] }));
      const update = jest.spyOn(ProfileController, 'updatePreferences');

      const response: Response = await request(app.getHttpServer() as Server)
        .patch('/profile/preferences')
        .send({ cookingTimeMinutes: 30, kitchen: [{ appliance: 'grill', stance: 'prefers' }] });

      expect(response.status).toBe(422);
      expect((response.body as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty('appliance');
      expect(update).not.toHaveBeenCalled();
    });
  });
});
