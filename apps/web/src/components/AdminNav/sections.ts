import type { Dictionary } from 'i18n/dictionaries/es-ES';

type AdminNavWords = Dictionary['adminNav'];

/** One page of the console: its address and the dictionary key of its name. */
export interface AdminNavPage {
  readonly href: `/admin${string}`;
  readonly label: keyof AdminNavWords['pages'];
}

/** One of the console's six groups, headed by its name — or, with no name, the transition page. */
export interface AdminNavSection {
  readonly group: keyof AdminNavWords['groups'] | null;
  readonly pages: readonly AdminNavPage[];
}

/**
 * The console's six groups, in the order the owner reads them (`0068`):
 * Resumen, Personas, Producto, Generación, Catálogo, Ajustes.
 *
 * Only pages that exist are listed. A group with no page yet is still named
 * here, so each phase adds its page to the group it belongs to and nothing
 * else moves; the navigation draws no heading over an empty list.
 *
 * Resumen is not listed while `/admin` only redirects to the transition page:
 * a link called "Resumen" that lands on "Anterior" would say where somebody is
 * wrongly, and `aria-current` could mark neither. Phase 4 adds it.
 */
export const ADMIN_SECTIONS: readonly AdminNavSection[] = [
  { group: 'summary', pages: [] },
  { group: 'people', pages: [] },
  { group: 'product', pages: [] },
  { group: 'generation', pages: [] },
  { group: 'catalogue', pages: [] },
  { group: 'settings', pages: [{ href: '/admin/ajustes', label: 'settings' }] },
  // Today's page, moved whole while the console is built. Last and under no
  // group, because it holds a piece of each until every phase has taken its
  // own away; phase 8 deletes the page and this entry.
  { group: null, pages: [{ href: '/admin/anterior', label: 'legacy' }] }
];
