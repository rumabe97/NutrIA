/*
 * NutrIA's service worker (`docs/decisions/0053-the-shopping-list-survives-the-supermarket.md`).
 *
 * It does one thing: keeps the last copy of today's screen and of the shopping
 * list, so both still open in a supermarket with no signal. Every other request
 * goes to the network exactly as it would without it.
 *
 * - `/inicio`, `/plan` and `/compra`, and the page of every meal read online or
 *   on today's screen: the network first, always; the last good copy only when
 *   the network cannot be reached.
 * - `/_next/static/…`: the cache first. Next names those files by their content,
 *   so a stored one is never wrong, and a stored page is no use without them.
 * - `/` and `/en`, where the installed app opens: offline, today's screen, if a
 *   copy of it exists.
 * - Nothing else. Never the API, never another screen, never anything but a GET.
 *
 * A copy is somebody's plan and list, so it lives as long as their session and
 * no longer: dropped the moment the server answers one of these pages with a
 * redirect, and dropped by the page at sign-in, sign-out and account deletion
 * (`src/lib/offline.ts`, which names the same cache).
 *
 * Plain JavaScript served as is from `public/`: nothing bundles it, and it is
 * tested by loading this very file (`src/lib/offline.test.ts`).
 */
const PAGES = 'nutria-pages-v1';
const ASSETS = 'nutria-assets-v1';
const OFFLINE_PATHS = ['/inicio', '/plan', '/compra'];
/** A meal's own page — its recipe and method, which is what gets read in a kitchen. */
const MEAL_PREFIX = '/plan/comida/';
const MEAL_PAGE = /^\/plan\/comida\/[\w-]+$/;
const MEAL_LINK = /\/plan\/comida\/[\w-]+/g;
const START_PATHS = ['/', '/en'];
const TODAY = '/inicio';
/** A file Next names by its content — in a tag as `/_next/static/…`, in the flight data sometimes without the `/_next/`. */
const ASSET_URL = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\s\\<>]+/g;
/** How often the page may ask for fresh copies, and how often when the app is being put away. */
const REFRESH_EVERY_MS = 60_000;
const REFRESH_ON_LEAVING_MS = 5_000;

/** Bumped by every `forget`, so a copy fetched with a session that has since ended is never stored. */
let generation = 0;
let lastRefresh = -Infinity;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(activate());
});

self.addEventListener('fetch', event => {
  const response = respond(event);

  if (response) {
    event.respondWith(response);
  }
});

self.addEventListener('message', event => {
  const type = event.data && event.data.type;

  if (type === 'forget') {
    event.waitUntil(forget());
  }

  if (type === 'refresh') {
    event.waitUntil(refresh(Boolean(event.data.force)));
  }
});

async function activate() {
  const names = await caches.keys();

  await Promise.all(names.filter(name => name.startsWith('nutria-') && name !== PAGES && name !== ASSETS).map(name => caches.delete(name)));
  // So the page that installed it is served by it too, and the screens opened
  // after the landing page are stored from the first visit.
  await self.clients.claim();
}

/** The response to give, or `null` to leave the request to the browser. */
function respond(event) {
  const { request } = event;

  if (request.method !== 'GET') {
    return null;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return null;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    return fromCacheFirst(request);
  }

  if (request.mode !== 'navigate') {
    return null;
  }

  if (kept(url.pathname)) {
    return fromNetworkFirst(event, url.pathname);
  }

  if (START_PATHS.includes(url.pathname)) {
    return openingOffline(request);
  }

  return null;
}

async function fromCacheFirst(request) {
  const assets = await caches.open(ASSETS);
  const stored = await assets.match(request);

  if (stored) {
    return stored;
  }

  const response = await fetch(request);

  if (response.ok) {
    await assets.put(request, response.clone());
  }

  return response;
}

async function fromNetworkFirst(event, path) {
  const asOf = generation;
  let response;

  try {
    response = await fetch(event.request);
  } catch (error) {
    const copy = await (await caches.open(PAGES)).match(absolute(path));

    if (copy) {
      return copy;
    }

    throw error;
  }

  // Stored after the page has its response, never before: a copy is a
  // by-product of reading the page, and must not slow it down.
  const clone = response.clone();

  event.waitUntil(settle(path, clone, asOf).then(stored => (stored ? keepAssets() : undefined)));

  return response;
}

async function openingOffline(request) {
  try {
    return await fetch(request);
  } catch (error) {
    if (await (await caches.open(PAGES)).match(absolute(TODAY))) {
      return Response.redirect(absolute(TODAY), 302);
    }

    throw error;
  }
}

/**
 * What one answer from the server means for its copy: a page stores it, a
 * redirect — no session here any more — drops every copy, and a failure keeps
 * the last good one. Resolves to whether a copy was stored.
 */
async function settle(path, response, asOf) {
  if (response.type === 'opaqueredirect' || response.redirected) {
    await forget();

    return false;
  }

  if (!response.ok) {
    return false;
  }

  const html = await response.text();

  if (asOf !== generation) {
    return false;
  }

  const pages = await caches.open(PAGES);

  await pages.put(
    absolute(path),
    new Response(html, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'text/html; charset=utf-8' } })
  );

  return true;
}

/** Holds exactly the files the stored pages name, so the cache never outgrows two pages. */
async function keepAssets() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  const wanted = new Set();

  for (const key of await pages.keys()) {
    const page = await pages.match(key);

    if (page) {
      for (const url of assetsIn(await page.text())) {
        wanted.add(url);
      }
    }
  }

  const held = new Set((await assets.keys()).map(key => key.url));

  await Promise.all([...held].filter(url => !wanted.has(url)).map(url => assets.delete(url)));
  await Promise.all([...wanted].filter(url => !held.has(url)).map(url => assets.add(url).catch(() => undefined)));
}

function assetsIn(html) {
  const found = new Set();

  for (const match of html.matchAll(ASSET_URL)) {
    found.add(absolute(match[0].startsWith('/_next/') ? match[0] : `/_next/${match[0]}`));
  }

  return found;
}

/** Fetches every kept screen again, as the person who is signed in now. Called by the page; see `REFRESH_EVERY_MS`. */
async function refresh(force) {
  const now = Date.now();

  if (now - lastRefresh < (force ? REFRESH_ON_LEAVING_MS : REFRESH_EVERY_MS)) {
    return;
  }

  lastRefresh = now;

  const asOf = generation;
  const stored = await Promise.all(OFFLINE_PATHS.map(path => fetchCopy(path, asOf)));
  const meals = await keepMealPages(asOf);

  if (stored.some(Boolean) || meals) {
    await keepAssets();
  }
}

async function fetchCopy(path, asOf) {
  try {
    return await settle(path, await fetch(absolute(path), { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' }), asOf);
  } catch {
    // No network, or no answer: the last good copy stays.
    return false;
  }
}

/**
 * The pages of today's meals, fetched once each — what matters offline is the
 * recipe, and reading the page online brings the rest up to date — and the
 * pages of meals the plan no longer has, dropped. Resolves to whether anything
 * was stored.
 */
async function keepMealPages(asOf) {
  const pages = await caches.open(PAGES);
  const today = await pages.match(absolute(TODAY));

  if (!today) {
    return false;
  }

  const todayHtml = await today.text();
  const plan = await pages.match(absolute('/plan'));
  const held = (await pages.keys()).map(key => new URL(key.url).pathname).filter(path => MEAL_PAGE.test(path));

  if (plan) {
    // Every meal of the fortnight is named in one of these two, if only by id in the plan's data.
    const known = todayHtml + (await plan.text());

    await Promise.all(held.filter(path => !known.includes(path.slice(MEAL_PREFIX.length))).map(path => pages.delete(absolute(path))));
  }

  const wanted = [...new Set(todayHtml.match(MEAL_LINK) ?? [])].filter(path => !held.includes(path));
  const stored = await Promise.all(wanted.map(path => fetchCopy(path, asOf)));

  return stored.some(Boolean);
}

function kept(pathname) {
  return OFFLINE_PATHS.includes(pathname) || MEAL_PAGE.test(pathname);
}

async function forget() {
  generation += 1;
  lastRefresh = -Infinity;
  await caches.delete(PAGES);
}

function absolute(path) {
  return new URL(path, self.location.origin).href;
}
