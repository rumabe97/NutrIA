/**
 * A same-origin destination out of a value the address bar handed us — safe
 * specifically where the result is resolved as a URL relative to the current
 * origin, the way `router.push` and a browser navigation both do.
 *
 * A prefix check (`startsWith('/') && !startsWith('//')`) is not enough: a
 * leading backslash (`/\evil.example`) fails neither test, yet WHATWG URL
 * parsing normalises a backslash the same as a forward slash for `http(s):`,
 * so `new URL('/\\evil.example', here).origin` is `evil.example` — a router
 * that resolves the value the same way still leaves the site. This asks the
 * same question the sink itself asks — does resolving this change the origin?
 * — against a fixed, unroutable placeholder (the reserved `.invalid` TLD, so
 * nothing an attacker registers can ever equal it), which is what makes it
 * track every WHATWG normalisation trick (backslashes, stray whitespace, a
 * scheme of its own) rather than enumerating them one string prefix at a time.
 *
 * NOT safe for `` `${origin}${ownPath(...)}` `` string concatenation: a value
 * with no leading slash (`.evil.example`) also resolves onto the placeholder
 * as a relative reference, so this returns it unchanged — concatenated onto a
 * bare origin with no separator, `nutria.app` + `.evil.example` becomes the
 * single, attacker-owned host `nutria.app.evil.example`. Concatenation wants
 * a stricter, different check: a literal leading `/` and not `//`. That is
 * `SocialSignIn.tsx`'s own local `ownPath` — deliberately not this one.
 */
const PLACEHOLDER_ORIGIN = 'http://own-path.invalid';

export function ownPath(path: string | undefined, fallback: string): string {
  if (!path) {
    return fallback;
  }

  try {
    return new URL(path, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN ? path : fallback;
  } catch {
    return fallback;
  }
}
