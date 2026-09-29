import type { Dictionary } from 'i18n/dictionaries/es-ES';

type AdminNavWords = Dictionary['adminNav'];

/** One page of the console: its address and the dictionary key of its name. */
export interface AdminNavPage {
  readonly href: `/admin${string}`;
  readonly label: keyof AdminNavWords['pages'];
}

/** One of the console's six groups, named over its list from two pages up. */
export interface AdminNavSection {
  readonly group: keyof AdminNavWords['groups'];
  readonly pages: readonly AdminNavPage[];
}

/**
 * The console's six groups, in the order the owner reads them (`0068`):
 * Resumen, Personas, Producto, Generación, Catálogo, Ajustes.
 *
 * A new page joins the group it belongs to and nothing else moves. The
 * navigation draws a group of one page as that page's link alone (no
 * "RESUMEN" over "Resumen"), and a named list from two pages up.
 */
export const ADMIN_SECTIONS: readonly AdminNavSection[] = [
  { group: 'summary', pages: [{ href: '/admin', label: 'summary' }] },
  {
    group: 'people',
    pages: [
      { href: '/admin/cuentas', label: 'accounts' },
      { href: '/admin/profesionales', label: 'professionals' },
      { href: '/admin/consentimientos', label: 'consents' },
      { href: '/admin/personas/retencion', label: 'retention' },
      { href: '/admin/buzon', label: 'inbox' }
    ]
  },
  {
    group: 'product',
    pages: [
      { href: '/admin/producto', label: 'product' },
      { href: '/admin/producto/planes', label: 'plans' },
      { href: '/admin/producto/planes/calidad', label: 'planQuality' },
      { href: '/admin/notificaciones', label: 'notifications' }
    ]
  },
  {
    group: 'generation',
    pages: [
      { href: '/admin/generacion', label: 'log' },
      { href: '/admin/generacion/ia', label: 'ai' }
    ]
  },
  {
    group: 'catalogue',
    pages: [
      { href: '/admin/catalogo', label: 'recipes' },
      { href: '/admin/catalogo/calidad', label: 'quality' },
      { href: '/admin/catalogo/ingredientes', label: 'ingredients' },
      { href: '/admin/catalogo/imagenes', label: 'pictures' }
    ]
  },
  {
    group: 'settings',
    pages: [
      { href: '/admin/ajustes', label: 'settings' },
      { href: '/admin/ajustes/registro', label: 'auditLog' },
      { href: '/admin/ajustes/sistema', label: 'system' }
    ]
  }
];
