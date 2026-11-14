import type { Dictionary } from './dictionaries/es-ES';

/**
 * The sections of the dictionary a public page is sent — the landing, the legal pages, the
 * sign-in family and the page for an address that matches nothing.
 *
 * The whole dictionary is a quarter of a megabyte, and a page's client components get theirs
 * through the root's `LocaleProvider`, so it travels inside the HTML of every page that has
 * one. A visitor who has not signed in reads a handful of its seventy-odd sections; these are
 * the ones the public pages' client components read. The signed-in app and the console are sent
 * all of it.
 *
 * Not a list to edit by judgement: `publicSections.test.ts` reads every client component a
 * public page can reach and fails when one reads a section that is not here, or when a section
 * here is read by none. Add the name it prints.
 */
export const PUBLIC_SECTIONS = [
  'auth',
  'common',
  'errors',
  'footer',
  'passkeys',
  'picture',
  'profile',
  'security',
  'siteNav',
  'theme',
  'twoFactor',
  'units'
] as const satisfies readonly (keyof Dictionary)[];
