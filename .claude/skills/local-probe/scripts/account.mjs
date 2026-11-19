// A throwaway account on the LOCAL API, for looking at the signed-in screens.
//
// Signed up through the API like anybody, then both locks opened and onboarding walked
// exactly the way apps/api/test/harness.ts does it — that file is the source of truth for
// the payloads, so when a step changes there, it changes here.
//
// Usage: node account.mjs create <cookie-file> [--admin] [--two-factor]
//            prints the address it made; --admin also makes it an admin, for the console,
//            and --two-factor turns on the second factor the console demands of one
//        node account.mjs delete <cookie-file>     deletes it through the API
//        node account.mjs forget <address>
//            the last resort for an account whose cookie file is gone: deletes the row
//            itself, and only for an @probe.invalid address on the local database
//        node account.mjs link <professional-cookie-file> <client-cookie-file>
//            makes the first account a professional with an open practice, and links the
//            second to it through a real invitation, accepted with consent
//        node account.mjs compromise <cookie-file>
//            marks its password as found breached, so the API answers 409
//            PASSWORD_CHANGE_REQUIRED and the web sends it to /cambiar-contrasena (011 phase 2)
//        node account.mjs age <cookie-file>
//            makes its sessions two days old, past Better Auth's freshAge, so list-sessions
//            refuses them (SESSION_NOT_FRESH)
//        node account.mjs premium <cookie-file>
//            puts it on the premium tier, for the screens whose numbers differ by tier —
//            an allowance a free account is told is premium, like asking us to write a
//            dish (`0011` § 4 a)
//
// Every account made here is deleted before the probe ends. The cookie file is how:
// keep it in the scratchpad, never in the repository — and **delete the accounts before
// you clear that directory, not after**. `delete` is `DELETE /users/me` with that cookie
// and there is no other door in the product: the password is the constant below, but an
// account made `--two-factor` cannot sign in again without its TOTP secret, and this
// product does not enable Better Auth's admin plugin, so nothing can remove a user on its
// behalf. `forget` exists because one was stranded that way on 2026-11-04 and every e2e
// run on the machine then failed its global teardown, which counts `%.invalid` accounts.
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
// `premium` is the two calls the e2e suites make for the same reason (`events-premium`):
// `UserController.setTier` and the global `premium` switch, which the tier reads together.
// It leaves a marker beside the cookie file when the switch was off, and `delete` turns it
// back off — as `link` does with the professional one. The tier itself goes with the account.
//
// `compromise` and `age` write one column on rows that belong only to the account the cookie
// signs in (@probe.invalid, checked through GET /users/me): `user.password_compromised_at`,
// which Better Auth's sign-in sets on an HIBP hit that a local run never makes, and
// `session.created_at`, which only time moves. A change of password clears the first; the
// account's deletion takes both.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { assertNotProduction, isLocalPg, readEnv, ROOT } from './guard.mjs';

const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';

const args = process.argv.slice(2);
const admin = args.includes('--admin');
const twoFactor = args.includes('--two-factor');
const unbadged = args.includes('--unbadged');
const inviteOnly = args.includes('--invite-only');
const FLAGS = ['--admin', '--two-factor', '--unbadged', '--invite-only'];
const [action, cookieFile, clientCookieFile] = args.filter(arg => !FLAGS.includes(arg));
/** What `owner-act` can do to a probe practitioner: the owner's acts of project 025, and the badge's steps. */
const OWNER_ACTS = [
  'suspend',
  'close',
  'close-due',
  'close-carry',
  'lift',
  'hide-profile',
  'see-profile',
  'badge-apply',
  'badge-code',
  'badge-earn',
  'badge-refuse',
  'badge-due',
  'badge-lapse'
];

if (
  !['create', 'delete', 'forget', 'link', 'lose-badge', 'owner-act', 'compromise', 'age', 'premium'].includes(action) ||
  !cookieFile ||
  (action === 'link' && !clientCookieFile) ||
  (action === 'owner-act' && !OWNER_ACTS.includes(clientCookieFile)) ||
  ((admin || twoFactor) && action !== 'create') ||
  ((unbadged || inviteOnly) && action !== 'link')
) {
  console.error(
    'usage: node account.mjs create <cookie-file> [--admin] [--two-factor] | delete <cookie-file> | forget <address> | link <professional-cookie-file> <client-cookie-file> [--unbadged] [--invite-only] | lose-badge <professional-cookie-file> | owner-act <professional-cookie-file> <' + OWNER_ACTS.join('|') + '> | compromise <cookie-file> | age <cookie-file> | premium <cookie-file>'
  );
  process.exit(2);
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** The six digits a TOTP app would show for this URI now — the harness's own, so the two cannot drift. */
function totpCode(totpURI) {
  const secret = new URL(totpURI).searchParams.get('secret');

  if (!secret) {
    throw new Error('no secret in the TOTP URI');
  }

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);

    if (index < 0) {
      throw new Error(`not base32: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));

  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;

  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
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

assertNotProduction({ strict: ['link', 'lose-badge', 'owner-act', 'compromise', 'age', 'premium'].includes(action) || admin || twoFactor });

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
const premiumMarker = `${cookieFile}.premium-was-off`;

if (action === 'forget') {
  // **The one write here that does not go through a route, and the only one.**
  // `delete` is the way; this is for the account `delete` can no longer reach, whose
  // cookie file is gone. It builds no state — it removes a throwaway account the product
  // itself has no door to — and it is bounded three ways: the production guard above, a
  // local database, and an address no mailbox can ever resolve to (RFC 2606) that only
  // this script makes.
  //
  // Deleting the row is what `DELETE /users/me` comes to in the data: every one of the 48
  // foreign keys that reference `user` cascades, and the 7 that do not are `set null` on
  // purpose — the rows the product keeps without a person, like a dietitian's name in a
  // client's access log.
  const address = cookieFile;

  if (!address.endsWith('@probe.invalid')) {
    console.error('[probe] forget only removes an account this script made (@probe.invalid)');
    process.exit(2);
  }

  const { closeDatabase, database } = await load('database');
  const sql = database().$client;

  try {
    const gone = await sql`delete from "user" where email = ${address} returning email`;

    console.log(gone.length > 0 ? `[probe] forgot ${address}` : `[probe] no such account: ${address}`);
  } finally {
    await closeDatabase();
  }

  process.exit(0);
}

if (action === 'delete') {
  try {
    await call('DELETE', '/users/me', undefined, readFileSync(cookieFile, 'utf8'));
    console.log('[probe] account deleted');
  } finally {
    // Restored even when the delete failed. Two probes at once share one switch: the first
    // to finish turns it off under the second — run one professional probe at a time.
    for (const [marker, flag] of [
      [switchMarker, 'professional'],
      [premiumMarker, 'premium']
    ]) {
      if (existsSync(marker)) {
        const { SettingsController } = await load('core/controllers/Settings');
        const { UNAUDITED } = await load('core/entities/Audit');

        await SettingsController.setFlag(flag, false, UNAUDITED);
        rmSync(marker);
        console.log(`[probe] the ${flag} switch is off again, as it was`);
      }
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

if (action === 'premium') {
  const { SettingsController } = await load('core/controllers/Settings');
  const { UserController: Users } = await load('core/controllers/User');
  const { UNAUDITED } = await load('core/entities/Audit');
  const who = await (await call('GET', '/users/me', undefined, readFileSync(cookieFile, 'utf8'))).json();

  if (!who.email?.endsWith('@probe.invalid')) {
    throw new Error('premium only moves an account this script made (@probe.invalid)');
  }

  // Both, because the tier reads both: a premium row with the switch off is a free account
  // (`events-premium.e2e-spec.ts`).
  await Users.setTier(who.id, 'premium', UNAUDITED);

  if (!(await SettingsController.flags()).premium) {
    await SettingsController.setFlag('premium', true, UNAUDITED);
    writeFileSync(premiumMarker, '');
    console.log('[probe] the premium switch was off: on until this account is deleted');
  }

  console.log(`[probe] ${who.email} is on premium`);
  process.exit(0);
}

if (action === 'link') {
  const { SettingsController } = await load('core/controllers/Settings');
  const { UNAUDITED } = await load('core/entities/Audit');
  const { ProfessionalController } = await load('core/controllers/Professional');
  const { CareController } = await load('core/controllers/Care');
  const { CARE_CONSENT_VERSION } = await load('core/entities/Care');
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

  // The account opens its own practice, as `POST /care/practice` does (project 025 phase 6):
  // free, ten seats, nothing set by anybody but the account. `create` gave it a confirmed
  // address, an activation and a birth date, which is all the route asks for.
  await ProfessionalController.open(pro.id, {});

  // The agreement at the current version, through the route a professional uses: without it
  // no client route opens and every invitation is a 404.
  const { PROFESSIONAL_AGREEMENT_VERSION } = await load('core/entities/Professional');

  await call('POST', '/care/practice/agreement', { version: PROFESSIONAL_AGREEMENT_VERSION }, readFileSync(cookieFile, 'utf8'));

  if (!unbadged) {
    // The badge, by the four steps the routes take: the practitioner applies, the owner
    // issues a code, the practitioner enters it, the owner confirms. The probe has no owner
    // session, so the practitioner is named as its own checker.
    const { ProfessionalBadgeController } = await load('core/controllers/Professional');

    // A practitioner linked before already holds it: a second client needs no second badge.
    if ((await ProfessionalBadgeController.state(pro.id)).state !== 'badged') {
      await ProfessionalBadgeController.apply(pro.id, { number: 'PROBE-001', register: 'Registro del probe' });

      const { code } = await ProfessionalBadgeController.issueCode(pro.id, pro.id, { channel: 'phone' });

      await ProfessionalBadgeController.enterCode(pro.id, { code });
      await ProfessionalBadgeController.confirm(pro.id, pro.id);
    }
  }

  const { token } = await CareController.invite({ email: pro.email, id: pro.id }, { email: client.email });

  if (inviteOnly) {
    // The invitation is left open for the browser to answer: /invitacion/<token>, signed in
    // as the client. The token is the probe's own and dies with either account.
    console.log(`[probe] invited: ${client.email} by ${pro.email}${unbadged ? ' (no badge)' : ''}`);
    console.log(`[probe] invitation path: /invitacion/${token}`);
    process.exit(0);
  }

  // Through the same function the route calls, so the rules decide: an un-badged practitioner
  // gets a `plan` link with the health line off, and a client with a condition or a
  // medication on record is refused (`0111` § 8) — which this reports instead of forcing.
  try {
    await CareController.accept(
      { email: client.email, emailVerified: true, id: client.id },
      token,
      { consentScope: unbadged ? 'plan' : 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: !unbadged }
    );
  } catch (error) {
    if (error?.name !== 'CareIllnessRuleError' && error?.constructor?.name !== 'CareIllnessRuleError') {
      throw error;
    }

    console.error(`[probe] refused by the illness rule: ${client.email} has a condition or a medication on record and ${pro.email} has no badge`);
    console.error(`[probe] the invitation stays open: /invitacion/${token}`);
    process.exit(1);
  }
  console.log(
    `[probe] linked: ${client.email} is ${pro.email}'s client (a free practice, ten seats, ${unbadged ? 'no badge: plan only' : 'badged, health shared'})`
  );
  process.exit(0);
}

if (action === 'owner-act') {
  // The owner's acts on a probe practitioner, and the badge's steps one at a time — each by the
  // core function its route calls, the practitioner named as their own owner (the probe has
  // no owner session). For the states a screen must draw and `link` alone cannot build: a
  // suspension, an announced close, a close whose day has come, a hidden profile, a code
  // waiting to be typed, a badge refused, a badge earned after an un-badged link (the
  // re-consent card). Mails are queued by the API's services, not by core: none is sent here.
  if (!isLocalPg()) {
    throw new Error('owner-act writes an owner’s act: local Postgres only (NUTRIA_LOCAL_PG=1)');
  }

  const { ProfessionalBadgeController, ProfessionalController, ProfessionalProfileController } = await load('core/controllers/Professional');
  const pro = await (await call('GET', '/users/me', undefined, readFileSync(cookieFile, 'utf8'))).json();

  if (!pro.email?.endsWith('@probe.invalid')) {
    throw new Error('owner-act only touches an account this script made (@probe.invalid)');
  }

  const act = clientCookieFile;
  const statement = { clause: 9, facts: 'El perfil anunciaba algo que el acuerdo no permite.', source: 'own_review' };
  const application = { number: 'PROBE-001', register: 'Registro del probe' };

  if (act === 'suspend') {
    await ProfessionalController.suspend(pro.id, pro.id, statement);
  } else if (act === 'close' || act === 'close-due' || act === 'close-carry') {
    try {
      await ProfessionalController.close(pro.id, pro.id, statement);
    } catch (error) {
      // A close already stands (the route answers the same 404): `close-due` then only moves its day.
      if (act === 'close' || error?.name !== 'NotFoundError') {
        throw error;
      }
    }

    if (act === 'close-due' || act === 'close-carry') {
      // No route takes a clock: the close's day moved into the past, as the e2e harness does
      // (`moveCloseDue`). The practice is then shut before the daily sweep has carried it out.
      const { database } = await load('database');

      await database().$client`
        update practice_restrictions set effective_at = now() - interval '1 second' where user_id = ${pro.id} and kind = 'closing'`;
    }
    if (act === 'close-carry') {
      // The daily sweep's part, once: the close carried out — links ended, the badge withdrawn,
      // the practice gone, the restriction left. It carries out every close due on this database.
      const run = await ProfessionalController.closeDue();

      console.log(`[probe] close sweep: ${run.closed.length} closed, ${run.failed.length} failed`);
    }
  } else if (act === 'lift') {
    await ProfessionalController.lift(pro.id, pro.id, {});
  } else if (act === 'hide-profile') {
    await ProfessionalProfileController.hide(pro.id, pro.id, {
      afterNotice: false,
      facts: 'Anunciaba resultados que nadie puede prometer.',
      reasons: ['promises']
    });
  } else if (act === 'see-profile') {
    await ProfessionalProfileController.markSeen(pro.id, pro.id);
  } else if (act === 'badge-apply') {
    await ProfessionalBadgeController.apply(pro.id, application);
  } else if (act === 'badge-code') {
    // The code is printed for the practitioner's screen to type: it exists nowhere else.
    const { code } = await ProfessionalBadgeController.issueCode(pro.id, pro.id, { channel: 'phone' });

    console.log(`[probe] badge code: ${code}`);
  } else if (act === 'badge-earn') {
    await ProfessionalBadgeController.apply(pro.id, application);

    const { code } = await ProfessionalBadgeController.issueCode(pro.id, pro.id, { channel: 'phone' });

    await ProfessionalBadgeController.enterCode(pro.id, { code });
    await ProfessionalBadgeController.confirm(pro.id, pro.id);
  } else if (act === 'badge-due' || act === 'badge-lapse') {
    // No route takes a clock: the standing pass moved back on the table, as the e2e suites do
    // — due yesterday (the yearly re-check waiting, the badge still standing in its thirty
    // days), or due thirty-one days ago, then the badge's own sweep, which writes the lapse.
    const { database } = await load('database');
    const days = act === 'badge-due' ? 1 : 31;

    await database().$client`
      update professional_badge_checks
      set checked_at = now() - make_interval(days => ${days + 366}), created_at = now() - make_interval(days => ${days + 366})
      where user_id = ${pro.id} and kind = 'applied'`;

    const moved = await database().$client`
      update professional_badge_checks
      set checked_at = now() - make_interval(days => ${days + 365}), created_at = now() - make_interval(days => ${days + 365}),
          due_at = now() - make_interval(days => ${days})
      where id = (select id from professional_badge_checks where user_id = ${pro.id} and kind = 'pass' order by checked_at desc limit 1)
      returning id`;

    if (moved.length !== 1) {
      throw new Error('no standing badge to age: run badge-earn or link first');
    }

    if (act === 'badge-lapse') {
      await ProfessionalBadgeController.sweep();
    }
  } else if (act === 'badge-refuse') {
    await ProfessionalBadgeController.remove(pro.id, pro.id, { kind: 'fail', reason: 'not_on_register', source: 'own_check' });
  }

  console.log(`[probe] ${act}: done for ${pro.email}`);
  process.exit(0);
}

if (action === 'lose-badge') {
  // The owner withdraws the probe practitioner's badge, then the illness rule's daily sweep
  // runs once (`0111` § 8) — the two core functions the admin route and the cron call. A
  // linked client with a condition or a medication on record loses the link (`badge_lost`);
  // any other link narrows to `plan`. The sweep is the real one: it ends every link on this
  // local database that the rule ends, not the probe's alone. No mail is sent from here.
  if (!isLocalPg()) {
    // The sweep is global: on any shared database it would end or narrow other people's links.
    throw new Error('lose-badge runs the whole badge-loss sweep: local Postgres only (NUTRIA_LOCAL_PG=1)');
  }

  const { ProfessionalBadgeController } = await load('core/controllers/Professional');
  const { CareController } = await load('core/controllers/Care');
  const pro = await (await call('GET', '/users/me', undefined, readFileSync(cookieFile, 'utf8'))).json();

  if (!pro.email?.endsWith('@probe.invalid')) {
    throw new Error('lose-badge only touches an account this script made (@probe.invalid)');
  }

  await ProfessionalBadgeController.remove(pro.id, pro.id, {
    facts: 'Retirado por el probe local.',
    kind: 'withdrawn',
    reason: 'other',
    source: 'own_check'
  });

  const swept = await CareController.sweepBadgeLoss();

  console.log(`[probe] ${pro.email} has no badge now; the sweep ended ${swept.ended.length} link(s) and narrowed ${swept.narrowed}`);
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

if (twoFactor) {
  // The console refuses an admin without it (`0074`): it shows data from every
  // account, and a password alone does not open that. So every console screen
  // is unreachable to a probe until this runs — the same two calls a person
  // makes in Seguridad, never a row written by hand.
  const started = await call('POST', '/auth/two-factor/enable', { password: PASSWORD }, cookie);
  const { totpURI } = await started.json();
  const confirmed = await call('POST', '/auth/two-factor/verify-totp', { code: totpCode(totpURI) }, cookie);
  // Confirming rotates the session and closes the account's others, so the
  // cookie written at sign-up is dead from here: the file has to carry the new one.
  const rotated = confirmed.headers.getSetCookie().join('; ');

  writeFileSync(cookieFile, rotated);
  console.log(`[probe] ${email} has a second factor; its cookie file now holds the session that confirmed it`);
}

console.log(`[probe] account ready: ${email}`);
process.exit(0);
