// A throwaway account on the LOCAL API, for looking at the signed-in screens.
//
// Signed up through the API like anybody, then both locks opened and onboarding walked
// exactly the way apps/api/test/harness.ts does it — that file is the source of truth for
// the payloads, so when a step changes there, it changes here.
//
// Usage: node account.mjs create <cookie-file> [--admin]
//            prints the address it made; --admin also makes it an admin, for the console
//        node account.mjs delete <cookie-file>     deletes it through the API
//        node account.mjs link <professional-cookie-file> <client-cookie-file>
//            makes the first account a professional with an open practice, and links the
//            second to it through a real invitation, accepted with consent
//        node account.mjs compromise <cookie-file>
//            marks its password as found breached, so the API answers 409
//            PASSWORD_CHANGE_REQUIRED and the web sends it to /cambiar-contrasena (011 phase 2)
//        node account.mjs age <cookie-file>
//            makes its sessions two days old, past Better Auth's freshAge, so list-sessions
//            refuses them (SESSION_NOT_FRESH)
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
//
// `--admin` goes through the runbook's own statement (`UserController.grantAdmin`), never
// through SQL, and only for the address this run just made (@probe.invalid). Deleting the
// account deletes the role with it.
//
// `compromise` and `age` write one column on rows that belong only to the account the cookie
// signs in (@probe.invalid, checked through GET /users/me): `user.password_compromised_at`,
// which Better Auth's sign-in sets on an HIBP hit that a local run never makes, and
// `session.created_at`, which only time moves. A change of password clears the first; the
// account's deletion takes both.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { assertNotProduction, isLocalPg, readEnv, ROOT } from './guard.mjs';

const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';

const args = process.argv.slice(2);
const admin = args.includes('--admin');
const [action, cookieFile, clientCookieFile] = args.filter(arg => arg !== '--admin');

if (
  !['create', 'delete', 'link', 'compromise', 'age'].includes(action) ||
  !cookieFile ||
  (action === 'link' && !clientCookieFile) ||
  (admin && action !== 'create')
) {
  console.error('usage: node account.mjs create <cookie-file> [--admin] | delete <cookie-file> | link <professional-cookie-file> <client-cookie-file> | compromise <cookie-file> | age <cookie-file>');
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

assertNotProduction({ strict: action === 'link' || action === 'compromise' || action === 'age' || admin });

// `core` reads the database from the environment, the same one the local API was given —
// and only that one: the guard above checked apps/api/.env, so a DATABASE_URL already
// exported in this shell, pointing anywhere else, is refused rather than used unchecked.
// Under NUTRIA_LOCAL_PG=1 `core` connects to the local Postgres whatever these say.
for (const key of isLocalPg() ? [] : ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
  const checked = readEnv(`${ROOT}apps/api/.env`, key);

  if (process.env[key] !== undefined && process.env[key] !== checked) {
    throw new Error(`${key} in this shell differs from apps/api/.env, which is the one the guard checked — unset it`);
  }

  if (checked !== undefined) process.env[key] = checked;
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
      const { UNAUDITED } = await load('core/entities/Audit');

      await SettingsController.setFlag('professional', false, UNAUDITED);
      rmSync(switchMarker);
      console.log('[probe] the professional switch is off again, as it was');
    }
  }

  process.exit(0);
}

if (action === 'compromise' || action === 'age') {
  const { database } = await load('database');
  const who = await (await call('GET', '/users/me', undefined, readFileSync(cookieFile, 'utf8'))).json();

  if (!who.email?.endsWith('@probe.invalid')) {
    throw new Error(`${action} only touches an account this script made (@probe.invalid)`);
  }

  const changed =
    action === 'compromise'
      ? await database().$client`update "user" set password_compromised_at = now() where id = ${who.id} returning id`
      : await database().$client`update session set created_at = now() - interval '2 days' where user_id = ${who.id} returning id`;

  if (changed.length === 0) {
    throw new Error(`${action} changed nothing`);
  }

  console.log(
    action === 'compromise'
      ? `[probe] ${who.email}'s password is marked breached until it is changed`
      : `[probe] ${who.email}'s ${changed.length} session(s) are two days old`
  );
  process.exit(0);
}

if (action === 'link') {
  const { SettingsController } = await load('core/controllers/Settings');
  const { UNAUDITED } = await load('core/entities/Audit');
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
    await SettingsController.setFlag('professional', true, UNAUDITED);
    writeFileSync(switchMarker, '');
    console.log('[probe] the professional switch was off: on until this professional is deleted');
  }

  // The owner's grant, as POST /admin/accounts/:id/professional makes it. The probe has no
  // owner session, so the professional is named as its own granter.
  await ProfessionalController.grant(pro.id, { collegiateNumber: 'PROBE-001' }, pro.id, UNAUDITED);

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
const { UNAUDITED: UNAUDITED_ACTIVATION } = await load('core/entities/Audit');
const { shapeFor } = await load('core/domain/MealShape');

const email = `probe-${Date.now()}@probe.invalid`;

await call('POST', '/auth/sign-up/email', { email, name: 'Probe', password: PASSWORD });

if (!(await UserController.confirmAddress(email)) || !(await UserController.activate({ email }, UNAUDITED_ACTIVATION))) {
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
// The explicit profile consent comes before any step that holds health data (Legal A, #104),
// exactly as the e2e harness's `giveProfileConsent` gives it.
const { PROFILE_CONSENT_VERSION } = await load('core/entities/Profile');

await call('PUT', '/profile/consent', { version: PROFILE_CONSENT_VERSION }, cookie);
await patch('goal', { paceKgPerWeek: null, startingWeightKg: 72, targetWeightKg: 70, type: 'maintenance' });
await patch('body-activity', { activityLevel: 'moderate', currentWeightKg: 72, heightCm: 168 });
await patch('how-you-eat', { mealShape: shapeFor(3, false) });
await patch('food-preferences', { cuisines: ['Mediterránea'], preferences: [] });
await patch('allergies', { allergies: [], customAllergens: [], dietaryPatterns: [], intolerances: [] });
await patch('cooking', { cookingTimeMinutes: 30 });
await call('POST', '/onboarding/complete', {}, cookie);

if (admin) {
  if (!email.endsWith('@probe.invalid') || !(await UserController.grantAdmin(email))) {
    throw new Error('could not make the new account an admin');
  }

  console.log(`[probe] ${email} is an admin until it is deleted`);
}

console.log(`[probe] account ready: ${email}`);
process.exit(0);
