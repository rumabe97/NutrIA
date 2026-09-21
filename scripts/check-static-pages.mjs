// Every public page is still built once and served from the edge.
//
// Usage: node scripts/check-static-pages.mjs      (after `next build` of apps/web)
//
// A public page that reads a cookie or a header, or calls `useSearchParams` outside a
// `<Suspense>`, silently becomes a page rendered per visitor: slower for everybody, and the
// thing a search engine measures. Nothing fails when that happens — the build table shows
// `ƒ` where it showed `○`, and nobody reads the build table. So a machine does.
//
// The list is not written here: it is `INDEXABLE_PATHS` in the app, in every language the
// app serves, so a page added there is checked from the day it exists.
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const listOf = (source, name) => [...source.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`))[1].matchAll(/'([^']+)'/g)].map(match => match[1]);

const pages = listOf(read('apps/web/src/app/_shared/pages.ts'), 'INDEXABLE_PATHS');
const segments = [...read('apps/web/src/i18n/routes.ts').match(/SEGMENTS[^=]*=\s*\{([^}]*)\}/)[1].matchAll(/:\s*'([^']*)'/g)].map(match => match[1]);

let manifest;

try {
  manifest = JSON.parse(read('apps/web/.next/prerender-manifest.json'));
} catch {
  console.error('[static] no apps/web/.next/prerender-manifest.json — build the web app first');
  process.exit(2);
}

const built = new Set(Object.keys(manifest.routes));
const expected = segments.flatMap(segment => pages.map(page => (segment === '' ? page : page === '/' ? segment : `${segment}${page}`)));
const missing = expected.filter(route => !built.has(route));

if (pages.length === 0 || segments.length === 0) {
  console.error('[static] could not read the page list or the languages from the app — this check is blind, which is a failure');
  process.exit(2);
}

if (missing.length > 0) {
  console.error(`[static] no longer prerendered: ${missing.join(', ')}`);
  console.error('         Something on that page reads a cookie or a header, or calls useSearchParams outside a <Suspense> (apps/web/AGENTS.md § Adding pages).');
  process.exit(1);
}

console.log(`[static] ${expected.length} public pages, all prerendered: ${expected.join(' ')}`);
