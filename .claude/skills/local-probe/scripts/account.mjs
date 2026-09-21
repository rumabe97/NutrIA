// A throwaway account on the LOCAL API, for looking at the signed-in screens.
//
// Signed up through the API like anybody, then both locks opened and onboarding walked
// exactly the way apps/api/test/harness.ts does it — that file is the source of truth for
// the payloads, so when a step changes there, it changes here.
//
// Usage: node account.mjs create <cookie-file>     prints the address it made
//        node account.mjs delete <cookie-file>     deletes it through the API
//
// Every account made here is deleted before the probe ends. The cookie file is how:
// keep it in the scratchpad, never in the repository.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

import { assertNotProduction, readEnv, ROOT } from './guard.mjs';

const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';

const [action, cookieFile] = process.argv.slice(2);

if (!['create', 'delete'].includes(action) || !cookieFile) {
  console.error('usage: node account.mjs create|delete <cookie-file>');
  process.exit(2);
}

async function call(method, path, body, cookie) {
  const response = await fetch(`${API}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', Origin: WEB, ...(cookie ? { Cookie: cookie } : {}) },
    method
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  return response;
}

if (action === 'delete') {
  await call('DELETE', '/users/me', undefined, readFileSync(cookieFile, 'utf8'));
  console.log('[probe] account deleted');
  process.exit(0);
}

assertNotProduction();

// `core` reads the database from the environment, the same one the local API was given.
for (const key of ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
  process.env[key] ??= readEnv(`${ROOT}apps/api/.env`, key);
}

const fromApi = createRequire(`${ROOT}apps/api/package.json`);
const load = specifier => import(pathToFileURL(fromApi.resolve(specifier)).href);
const { UserController } = await load('core/controllers/User');
const { shapeFor } = await load('core/domain/MealShape');

const email = `probe-${Date.now()}@probe.invalid`;

await call('POST', '/auth/sign-up/email', { email, name: 'Probe', password: PASSWORD });

if (!(await UserController.confirmAddress(email)) || !(await UserController.activate({ email }))) {
  throw new Error('could not open the two locks for the new account');
}

const signIn = await call('POST', '/auth/sign-in/email', { email, password: PASSWORD });
const cookie = signIn.headers
  .getSetCookie()
  .map(line => line.split(';')[0])
  .join('; ');

// Written before onboarding: if a step below fails, the account can still be deleted.
writeFileSync(cookieFile, cookie);

const patch = (step, data) => call('PATCH', '/onboarding', { data, step }, cookie);

await patch('about-you', { birthDate: '1994-03-11', country: 'ES', displayName: 'Probe', sex: 'female' });
await patch('goal', { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' });
await patch('body-activity', { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 });
await patch('how-you-eat', { mealShape: shapeFor(3, false) });
await patch('food-preferences', { cuisines: ['Mediterránea'], preferences: [] });
await patch('allergies', { allergies: [], customAllergens: [], dietaryPatterns: [], intolerances: [] });
await patch('lifestyle', { trainingDaysPerWeek: 3 });
await patch('cooking', { budget: 'medium', cookingFrequency: 'often', cookingTimeMinutes: 30 });
await call('POST', '/onboarding/complete', {}, cookie);

console.log(`[probe] account ready: ${email}`);
process.exit(0);
