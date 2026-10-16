import type { FullProfileView } from 'core/controllers/Profile';
import type { KitchenView } from 'core/controllers/Kitchen';

/**
 * `GET /profile` as the API actually answers it: the full profile, and the
 * kitchen beside it (`0102`).
 *
 * The API composes the same two views (`FullProfileDto`), and this is the one
 * place this app says so, rather than each page widening the type on its own —
 * or, worse, keeping a hand-written copy of either half. Both sides are
 * imported from `core/controllers/*`, so a field added to either arrives here
 * with it.
 */
export type ProfileWithKitchen = FullProfileView & { readonly kitchen: KitchenView };
