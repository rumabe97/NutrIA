// A throwaway account on the LOCAL API, for looking at the signed-in screens.
//
// Signed up through the API like anybody, then both locks opened and onboarding walked
// exactly the way apps/api/test/harness.ts does it — that file is the source of truth for
// the payloads, so when a step changes there, it changes here.
//
// Usage: node account.mjs create <cookie-file>     prints the address it made
//        node account.mjs delete <cookie-file>     deletes it through the API
//        node account.mjs link <professional-cookie-file> <client-cookie-file>
//            makes the first account a professional with an open practice, and links the
//            second to it through a real invitation, accepted with consent
//
// Every account made here is deleted before the probe ends. The cookie file is how:
// keep it in the scratchpad, never in the repository.
//
// `link` exists so a probe never writes a link, a grant or an invitation by hand: those go
// through the same core functions the API's routes call (grant, invite, accept), with their
// rules. The one write core has no function for is opening the practice, because only the
// signed Stripe webhook may do it. That is the same single statement the e2e harness uses
// (`openPractice` in apps/api/test/harness.ts). If the `professional` switch was off, `link`
// turns it on and leaves a marker beside the cookie file; `delete` of that professional
// turns it back off.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { assertNotProduction, readEnv, ROOT } from './guard.mjs';

const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';

const [action, cookieFile, clientCookieFile] = process.argv.slice(2);

if (!['create', 'delete', 'link'].includes(action) || !cookieFile || (action === 'link' && !clientCookieFile)) {
  console.error('usage: node account.mjs create|delete <cookie-file> | link <professional-cookie-file> <client-cookie-file>');
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

assertNotProduction({ strict: action === 'link' });

// `core` reads the database from the environment, the same one the local API was given —
// and only that one: the guard above checked apps/api/.env, so a DATABASE_URL already
// exported in this shell, pointing anywhere else, is refused rather than used unchecked.
for (const key of ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
  const checked = readEnv(`${ROOT}apps/api/.env`, key);

  if (process.env[key] !== undefined && process.env[key] !== checked) {
    throw new Error(`${key} in this shell differs from apps/api/.env, which is the one the guard checked — unset it`);
  }

  process.env[key] = checked;
}

const fromApi = createRequire(`${ROOT}apps/api/package.json`);
const load = specifier => import(pathToFileURL(fromApi.resolve(specifier)).href);
const switchMarker = `${cookieFile}.switch-was-off`;

if (action === 'delete') {
  try {
    await call('DELETE', '/users/me', undefined, readFileSync(cookieFile, 'utf8'));
    console.log('[probe] account deleted');
  } finally {
    // Restored even when the delete failed. Two probes at once share one switch: the first
    // to finish turns it off under the second — run one professional probe at a time.
    if (existsSync(switchMarker)) {
      const { SettingsController } = await load('core/controllers/Settings');

      await SettingsController.setFlag('professional', false);
      rmSync(switchMarker);
      console.log('[probe] the professional switch is off again, as it was');
    }
  }

  process.exit(0);
}

if (action === 'link') {
  const { SettingsController } = await load('core/controllers/Settings');
  const { ProfessionalController } = await load('core/controllers/Professional');
  const { CareController } = await load('core/controllers/Care');
  const { CARE_CONSENT_VERSION } = await load('core/entities/Care');
  const { database } = await load('database');
  const me = async file => (await call('GET', '/users/me', undefined, readFileSync(file, 'utf8'))).json();
  const pro = await me(cookieFile);
  const client = await me(clientCookieFile);

  for (const who of [pro, client]) {
    if (!who.email?.endsWith('@probe.invalid')) {
      throw new Error('link only joins two accounts this script made (@probe.invalid)');
    }
  }

  if (!(await SettingsController.flags()).professional) {
    await SettingsController.setFlag('professional', true);
    writeFileSync(switchMarker, '');
    console.log('[probe] the professional switch was off: on until this professional is deleted');
  }

  // The owner's grant, as POST /admin/accounts/:id/professional makes it. The probe has no
  // owner session, so the professional is named as its own granter.
  await ProfessionalController.grant(pro.id, { collegiateNumber: 'PROBE-001' }, pro.id);

  const opened = await database().$client`
    update professionals set practice_open = true, included_clients = 30 where user_id = ${pro.id} returning user_id`;

  if (opened.length !== 1) {
    throw new Error('the practice did not open');
  }

  const { token } = await CareController.invite({ email: pro.email, id: pro.id }, { email: client.email });

  await CareController.accept(
    { email: client.email, emailVerified: true, id: client.id },
    token,
    { consentVersion: CARE_CONSENT_VERSION, sharesHealth: true }
  );
  console.log(`[probe] linked: ${client.email} is ${pro.email}'s client (practice open, 30 included, health shared)`);
  process.exit(0);
}

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
