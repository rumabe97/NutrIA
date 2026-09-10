# 0040 — One address per language

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

The product shipped in two languages and published one address. The locale came
from a cookie, then `Accept-Language`, then a default — so `/` served Spanish or
English depending on who asked, and the choice never appeared in the URL.

An audit made the cost explicit. A URL has one canonical form and one indexed
body, so **the English half could not be indexed at all**: forty-three kilobytes
of translated copy with no address, unable to appear in a result, accumulate a
link, or earn a visit — ever. And the Spanish half was indexed by luck rather
than design: Googlebot happens to send no `Accept-Language` and so fell through
to the default, while any crawler that does send one saw English at the same
address.

There was a second cost, invisible until measured. Reading a header to pick the
language happened in the **root layout**, which opts the entire route tree out
of static rendering — so the marketing landing page, pure static content, was
rendered on a serverless function for every crawl and every visitor.

## Decision

**Spanish stays at the root, English moves to `/en`, and each language is its
own root layout.**

```
app/(es)/…   lang="es-ES"   /, /acceder, /registro, …      unchanged addresses
app/en/…     lang="en-GB"   /en, /en/acceder, …
app/(app)/…  the signed-in tree, locale from the profile
app/_shared/ the page bodies both public trees render
```

Three root layouts rather than the usual `app/[locale]/…`: `<html lang>` can only
be set by a root layout, so the language has to be known *there*, and with a
`[locale]` segment the only way to keep Spanish unprefixed is a middleware
rewrite — which publishes a live `/es/…` duplicate of every URL and threads
`params` through every page. This way there are no rewrites, no duplicate
addresses, and the locale is a literal in the layout file, which is exactly what
makes prerendering possible.

Spanish is unprefixed because its URLs already exist and are already linked. A
migration that renamed them would trade the one asset the site has for tidiness.

**Slugs stay Spanish in both languages** — `/en/registro`, not `/en/register`.
The API prefixes a path to build the link it mails; it does not translate one.
Translated slugs would turn a helper into a path table that two repositories
have to keep in sync forever.

## What each address now declares

Structure is worth nothing if nothing reads it, so the same pass added what was
missing entirely: `robots.txt` and `sitemap.xml` (six indexable pages, each
naming its translation), a canonical and reciprocal `hreflang` on every public
page, a title and description **per route** — one shared title had `/registro`
competing with the homepage — Open Graph and Twitter cards with a generated
image per language, and `Organization`, `WebSite` and `FAQPage` structured data.

The `FAQPage` markup is generated from the same dictionary the page renders, so
it cannot drift from the visible copy. Nothing claims a rating, a price or a
site search: there are no reviews, no prices and no search, and inventing any of
them is a spam violation rather than a shortcut.

## Consequences

- **First-visit language detection is gone for public pages.** An English
  browser with no cookie now gets Spanish at `/`, and reaches English through a
  search result's `hreflang` or the visible switch. This is not a side effect to
  be fixed later — reading that header on the server is precisely what made the
  pages dynamic. It is a real product regression, traded knowingly.
- Twelve public pages moved from rendered-per-request to prerendered.
- `NEXT_PUBLIC_SITE_URL` is now load-bearing. **Unset, it falls back to
  `http://localhost:3000`**, and every production page then declares itself a
  copy of a page on localhost — worse than declaring nothing at all.
- An unprefixed address redirects to `/en/…` when the cookie says English, so a
  hardcoded `/registro` in a shared header does not drop an English reader into
  a Spanish form. A visitor who has chosen nothing — **including every crawler**
  — is never redirected, which is what keeps the Spanish addresses byte-identical
  to what they were.
- Arriving under `/en` writes the locale cookie, and the language switch still
  writes `profiles.locale`: that column decides the language of every mail and
  every link the API puts in one.
- The signed-in tree has no English twin. `/en/inicio` is a 404, nothing links
  there, and those pages are not indexable anyway — an English reader navigates
  Spanish addresses and reads English content.
