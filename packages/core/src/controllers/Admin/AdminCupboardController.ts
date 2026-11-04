import { AdminCupboardRepository, UNRESOLVED_WORD_THRESHOLD } from '#repositories/Admin';

import type { CupboardGapQuery } from 'core/entities/AdminQuery';
import type { Paged } from 'core/controllers/User';

/**
 * The most a word the catalogue could not answer is ever shown *under*: `UNRESOLVED_WORD_THRESHOLD` accounts. Exported
 * so the console can say "held by two or more" without writing the number twice.
 */
export const UNRESOLVED_THRESHOLD = UNRESOLVED_WORD_THRESHOLD;

/**
 * A word people typed that the catalogue has no ingredient for, in its normalised form, and how many accounts are
 * holding it. Shown only where `accounts >= UNRESOLVED_THRESHOLD`; the threshold is in the query (`P2-6`, `0028`).
 *
 * **A snapshot of what is held now, never a history of what was ever typed**: a cupboard is deleted by the generation
 * that spends it, and a plan keeps slugs and amounts but no word anybody typed. An empty list is therefore not a bug,
 * and it is the expected state while the picker (phase 3b) is the only way in: from the screen every entry resolves.
 * No account, no row id and no label as typed is part of it.
 */
export type CupboardUnresolvedWordView = { readonly accounts: number; readonly word: string };

/**
 * A catalogue ingredient no recipe uses, and how many accounts hold it in a cupboard right now, **floored**: below
 * `UNRESOLVED_THRESHOLD` accounts it is 0, so 0 reads "fewer than two", never "none" (`docs/legal/pantry.md` P2-10).
 * The row is shown whatever the count, being reference data `/admin/catalogue/ingredients` already lists whole; the
 * count is what the floor protects. Same snapshot caveat as `CupboardUnresolvedWordView`.
 */
export type CupboardUncookedIngredientView = {
  readonly accounts: number;
  readonly category: string;
  /** Its Spanish name (the slug where the catalogue has none). */
  readonly name: string;
  readonly slug: string;
};

/** `GET /admin/catalogue/cupboard/unresolved`. */
export type AdminCupboardUnresolvedView = Paged<CupboardUnresolvedWordView>;

/** `GET /admin/catalogue/cupboard/uncooked`. */
export type AdminCupboardUncookedView = Paged<CupboardUncookedIngredientView>;

/**
 * What the library could not cook for a cupboard (project 022, phase 5): two aggregate reads, as counts of accounts and
 * never which accounts. Nothing here is scoped to a person, because nothing here names one (`0028`).
 */
export const AdminCupboardController = {
  /** Catalogue ingredients in no recipe, most held first. */
  async uncooked(query: CupboardGapQuery): Promise<AdminCupboardUncookedView> {
    const { rows, total } = await AdminCupboardRepository.uncooked(query);

    return {
      offset: query.offset,
      rows: rows.map(row => ({ accounts: row.accounts, category: row.category, name: row.name, slug: row.slug })),
      size: query.size,
      total
    };
  },

  /** Words the catalogue could not answer, held by `UNRESOLVED_THRESHOLD` accounts or more. */
  async unresolved(query: CupboardGapQuery): Promise<AdminCupboardUnresolvedView> {
    const { rows, total } = await AdminCupboardRepository.unresolved(query);

    return { offset: query.offset, rows: rows.map(row => ({ accounts: row.accounts, word: row.word })), size: query.size, total };
  }
};
