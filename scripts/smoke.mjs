// Asks production the questions a person would, the minute a deploy finishes.
//
// Usage: node scripts/smoke.mjs                 WEB_URL / API_URL override the origins
//   exit 0 — every answer is right;  exit 1 — at least one is not, each named.
//
// CI proves the code; this proves the deployment: that the two hosts are up, that the web
// app still reaches the API through its proxy, that the public pages are there in both
// languages, and that the doors which must be shut still are. It is what a person does
// after a deploy and stops doing the fifth time nothing was wrong.
//
// Nothing here signs in, writes, or needs a secret. A signed-in screen is not asked for:
// without a session it redirects to sign-in, which is production working.
const WEB = (process.env.WEB_URL || 'https://nutr-ia-web-phi.vercel.app').replace(/\/$/, '');
const API = (process.env.API_URL || 'https://api-liard-kappa.vercel.app/api/v1').replace(/\/$/, '');
const TIMEOUT_MS = 20_000;

const failures = [];
let asked = 0;

async function ask(name, url, check) {
  asked += 1;

  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.text();
    const wrong = await check(response, body);

    if (wrong) failures.push(`${name} — ${wrong}  (${url})`);
  } catch (error) {
    failures.push(`${name} — no answer: ${error.message}  (${url})`);
  }
}

const is = status => response => (response.status === status ? null : `expected ${status}, got ${response.status}`);
const page = lang => (response, body) =>
  is(200)(response) || (new RegExp(`<html\\b[^>]*\\blang="${lang}"`).test(body) ? null : `the page is not marked lang="${lang}"`) || (/<h1[\s>]/.test(body) ? null : 'the page has no h1');

await Promise.all([
  // The two hosts, and the path between them.
  ask('API health', `${API}/health`, (response, body) => is(200)(response) || (JSON.parse(body).status === 'ok' ? null : `status is ${JSON.parse(body).status}`)),
  ask('the web app reaches the API through its proxy', `${WEB}/api/v1/health`, is(200)),

  // What a crawler and a new visitor see, in both languages.
  ...['/', '/acceder', '/registro', '/privacidad', '/condiciones'].map(path => ask(`public page ${path}`, `${WEB}${path}`, page('es-ES'))),
  ...['/en', '/en/acceder', '/en/registro', '/en/privacidad', '/en/condiciones'].map(path => ask(`public page ${path}`, `${WEB}${path}`, page('en-GB'))),
  ask('sitemap', `${WEB}/sitemap.xml`, (response, body) => is(200)(response) || (body.includes('/privacidad') ? null : 'the legal pages are not in it')),
  ask('robots', `${WEB}/robots.txt`, (response, body) => is(200)(response) || (/Disallow:\s*\/inicio/.test(body) ? null : 'the signed-in tree is not closed to crawlers')),

  // A public answer with a known shape.
  ask('which sign-in providers are on', `${WEB}/api/v1/settings/sign-in-providers`, (response, body) => is(200)(response) || (Array.isArray(JSON.parse(body).providers) ? null : 'no providers array')),

  // The doors that must be shut: a denial here is a 404, never a 401, a 403 or a 200.
  ...['/profile', '/users/me', '/health-data', '/meal-plans/active', '/admin/overview'].map(path => ask(`no session, ${path} is a 404`, `${API}${path}`, is(404))),
  ask('an unsigned payment webhook is a 404', `${API}/billing/webhook`, response => (response.status === 404 ? null : `expected 404, got ${response.status}`)),

  // A signed-in screen sends a stranger to sign-in rather than rendering.
  ask('a signed-in screen redirects a stranger', `${WEB}/inicio`, response => ([307, 308].includes(response.status) && (response.headers.get('location') || '').includes('/acceder') ? null : `expected a redirect to /acceder, got ${response.status}`)),

  // What the API says about itself in its headers.
  ask('API headers', `${API}/health`, response => (response.headers.get('x-content-type-options') === 'nosniff' ? null : 'no x-content-type-options: nosniff') || (response.headers.has('x-powered-by') ? 'x-powered-by is exposed' : null))
]);

if (failures.length > 0) {
  console.error(`[smoke] ${failures.length} of ${asked} answers are wrong:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[smoke] ${asked} of ${asked} answers are right — ${WEB}`);
