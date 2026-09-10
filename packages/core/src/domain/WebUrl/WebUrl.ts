/**
 * Where a link the API sends lands on the web app.
 *
 * The web app serves Spanish at the root and every other language behind a
 * segment of its own — `/plan` is Spanish, `/en/plan` is English — so an
 * absolute link is no longer `APP_URL` plus a path: the same path is a
 * different page in each language. A mail written in English whose button
 * opens the Spanish site is what this exists to make impossible, and it is
 * only avoidable in one place, so every caller builds its links here.
 */

/** The languages the web app publishes. Spanish is the root; the rest carry their segment. */
const SEGMENT = { 'en-GB': 'en', 'es-ES': '' } as const;

export type WebLocale = keyof typeof SEGMENT;

/**
 * Spanish, by product decision — and what an unknown locale resolves to. A
 * recipient whose language nobody recorded gets the product's own language,
 * never a guess and never a link into a page that is not there.
 */
export const DEFAULT_WEB_LOCALE: WebLocale = 'es-ES';

/** The segments a path may already carry, so nothing can be prefixed twice. */
const SEGMENTS: readonly string[] = Object.values(SEGMENT).filter(segment => segment !== '');

function isWebLocale(value: string | null | undefined): value is WebLocale {
  return typeof value === 'string' && Object.hasOwn(SEGMENT, value);
}

function namesALanguage(pathname: string): boolean {
  const [first] = pathname.split('/').filter(Boolean);

  return first !== undefined && SEGMENTS.includes(first);
}

/**
 * The path as this language serves it.
 *
 * Idempotent: a path that already names a language is left exactly as it is,
 * because whoever wrote it has already said which page they meant, and
 * `/en/en/plan` is a 404 rather than a language.
 */
function localePath(pathname: string, locale: WebLocale): string {
  const segment = SEGMENT[locale];

  if (segment === '' || namesALanguage(pathname)) {return pathname;}

  return pathname === '/' ? `/${segment}` : `/${segment}${pathname}`;
}

/**
 * An absolute link into the web app, in the reader's language.
 *
 * `appUrl` is the origin the web app answers on (`APP_URL`); `path` is a path
 * on it, and only its path, query and hash are honoured. An absolute — or
 * protocol-relative — `path` would otherwise choose the origin of a link the
 * product mails out, and that is not a caller's decision to make.
 */
export function webUrl(appUrl: string, path: string, locale: string | null | undefined = null): string {
  const { origin } = new URL(appUrl);
  const target = new URL(path, origin);
  const pathname = localePath(target.pathname, isWebLocale(locale) ? locale : DEFAULT_WEB_LOCALE);

  return new URL(`${pathname}${target.search}${target.hash}`, origin).toString();
}
