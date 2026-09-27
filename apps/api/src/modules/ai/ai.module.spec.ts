import { describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';

import { AiModule } from './ai.module.js';
import { DishPictureService } from './services/index.js';
import { ENV } from '../../config/index.js';
import { PictureStore } from './clients/PictureStore.js';
import { StubPictureStore } from './clients/StubPictureClients.js';
import { picturesStubbed } from './ai.config.js';
import { validateEnv } from '../../config/Env.validation.js';

const DEVELOPMENT = {
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db'
};

const PRODUCTION = {
  ...DEVELOPMENT,
  ALLOWED_ORIGINS: 'https://nutria.example',
  APP_URL: 'https://nutria.example',
  BETTER_AUTH_URL: 'https://nutria.example',
  NODE_ENV: 'production'
};

async function pictures(raw: Record<string, string>): Promise<{ readonly service: DishPictureService; readonly store: PictureStore }> {
  const moduleRef = await Test.createTestingModule({ imports: [AiModule] })
    .overrideProvider(ENV)
    .useValue(validateEnv(raw))
    .compile();

  return { service: moduleRef.get(DishPictureService), store: moduleRef.get(PictureStore) };
}

/*
 * 0066, invariant review of phase 3: `stub` is also what an unset
 * `AI_PROVIDER` means. In production the stubs would store their 8×8 test
 * picture as every opened dish's picture, for everyone and for good.
 */
describe('which pictures the module draws with', () => {
  it('uses the stubs with AI_PROVIDER=stub outside production, and they can draw', async () => {
    const { service, store } = await pictures({ ...DEVELOPMENT, AI_PROVIDER: 'stub' });

    expect(picturesStubbed(validateEnv({ ...DEVELOPMENT, AI_PROVIDER: 'stub' }))).toBe(true);
    expect(store).toBeInstanceOf(StubPictureStore);
    expect(service.isAvailable).toBe(true);
  });

  it('never uses them in production, where a stub provider draws nothing at all', async () => {
    const { service, store } = await pictures({ ...PRODUCTION, AI_PROVIDER: 'stub' });

    expect(picturesStubbed(validateEnv({ ...PRODUCTION, AI_PROVIDER: 'stub' }))).toBe(false);
    expect(store).not.toBeInstanceOf(StubPictureStore);
    expect(service.isAvailable).toBe(false);
  });

  it('draws nothing in production with an unset provider either, even holding a Blob token', async () => {
    const { service } = await pictures({ ...PRODUCTION, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_production_token_value' });

    expect(service.isAvailable).toBe(false);
  });
});
