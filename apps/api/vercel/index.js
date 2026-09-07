/**
 * The deployed entry point. Deliberately JavaScript, deliberately committed.
 *
 * Handed a `.ts` file, the function builder compiles it — and everything it
 * imports — with its own TypeScript pass, which resolves modules without
 * following symlinks. Under pnpm's strict store every transitive package is
 * invisible to that pass, so it printed a wall of errors on every deploy:
 * `Request` with no `headers`, `Response` with no `status`, `drizzleAdapter`
 * not exported. It emitted JavaScript regardless, which made the errors
 * cosmetic and the deployed code an artifact nothing had ever type-checked.
 *
 * This file gives it nothing to compile. `dist/` is what `nest build` produced
 * under the real type gate in `vercel-build`, which the builder runs before it
 * traces this entry — so the function ships the exact artifact the gate passed
 * and `smoke:function` exercised, not a second compilation of the same source.
 *
 * It has to be committed: the `builds[].src` glob in `vercel.json` is matched
 * against the repository *before* any build step runs. Pointing it at a path
 * under `dist/` matches nothing, emits no function, and fails no build — every
 * route answers 404 under a green log. Nothing lives here but this re-export,
 * so there is nothing to keep in sync.
 */
export { default } from '../dist/api/index.js';
