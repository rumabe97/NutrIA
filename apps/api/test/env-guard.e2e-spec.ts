import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from '@jest/globals';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { validateEnv } from '../src/config/Env.validation.js';
import { BLANKED_ENV } from './env-guard.js';

const dir = mkdtempSync(join(tmpdir(), 'nutria-env-guard-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('the run cannot reach mail, push or a paid model', () => {
  it('has every guarded variable blank and the stub provider, before any suite starts', () => {
    for (const key of BLANKED_ENV) {
      expect([key, process.env[key]]).toEqual([key, '']);
    }
    expect(process.env.AI_PROVIDER).toBe('stub');
  });

  it('validates to an environment with no mailer, no push and no provider key', () => {
    // Only what the contract demands and the .env would supply; every guarded key stays as the guard left it.
    const env = validateEnv({
      APP_URL: 'http://localhost:3000',
      BETTER_AUTH_URL: 'http://localhost:3001',
      BETTER_AUTH_SECRET: 'x'.repeat(48),
      ...process.env,
    });
    expect(env.AI_PROVIDER).toBe('stub');
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'OWNER_EMAIL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'OPENROUTER_API_KEY', 'GOOGLE_API_KEY'] as const) {
      expect([key, env[key] || undefined]).toEqual([key, undefined]);
    }
  });

  it('keeps a .env file that sets them from winning (dotenv does not override the process)', async () => {
    const file = join(dir, '.env');
    writeFileSync(file, 'SMTP_HOST=smtp.example.invalid\nOWNER_EMAIL=owner@example.invalid\nVAPID_PRIVATE_KEY=leak\nAI_PROVIDER=openrouter\n');
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: file, ignoreEnvVars: false })],
    }).compile();
    const config = module.get(ConfigService);
    expect(config.get('SMTP_HOST')).toBe('');
    expect(config.get('OWNER_EMAIL')).toBe('');
    expect(config.get('VAPID_PRIVATE_KEY')).toBe('');
    expect(config.get('AI_PROVIDER')).toBe('stub');
    await module.close();
  });
});
