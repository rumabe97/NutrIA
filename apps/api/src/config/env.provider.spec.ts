import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { ENV, envProvider, validateAndExposeEnv } from './env.provider.js';

import type { Env } from './Env.validation.js';

const FROM_FILE = [
  'APP_URL=http://localhost:3000',
  `BETTER_AUTH_SECRET=${'a'.repeat(32)}`,
  'BETTER_AUTH_URL=http://localhost:3001',
  'DATABASE_URL=postgresql://user:pass@host/db',
  'AI_PROVIDER=openrouter',
  'OPENROUTER_API_KEY=sk-or-test',
  'AI_PROVIDER_ONLY=deepinfra,coreweave',
  'AI_FALLBACK_MODELS=deepseek/deepseek-v4.1-flash'
];

describe('the environment read from a .env file', () => {
  const saved = { ...process.env };
  let dir = '';

  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { force: true, recursive: true });
  });

  it('reaches the ENV provider whole, lists included', async () => {
    dir = mkdtempSync(join(tmpdir(), 'nutria-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, FROM_FILE.join('\n'));
    process.env = Object.fromEntries(Object.entries(saved).filter(([key]) => !FROM_FILE.some(line => line.startsWith(`${key}=`))));

    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: file, validate: validateAndExposeEnv })],
      providers: [envProvider]
    }).compile();
    const env = module.get<Env>(ENV);

    expect(env.AI_PROVIDER_ONLY).toEqual(['deepinfra', 'coreweave']);
    expect(env.AI_FALLBACK_MODELS).toEqual(['deepseek/deepseek-v4.1-flash']);
  });

  it('leaves a variable the environment already has as it was', () => {
    process.env['AI_PROVIDER_SORT'] = 'latency';

    validateAndExposeEnv({ ...Object.fromEntries(FROM_FILE.map(line => line.split(/=(.*)/s).slice(0, 2))), AI_PROVIDER_SORT: 'throughput' });

    expect(process.env['AI_PROVIDER_SORT']).toBe('latency');
  });
});
