import { InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { pantryKey, resolvePantryLabel } from 'core/domain/Pantry';
import { PantryRepository } from '#repositories/Pantry';
import { SafetyRepository } from '#repositories/Safety';

import type { AddPantryItem, PantryItem } from 'core/entities/Pantry';
import type { MeasurementUnit } from 'core/entities/Plan';

/**
 * One thing in the cupboard, as a screen reads it.
 *
 * `label` is the person's own word and goes back to the person and nowhere
 * else. `slug` is what it resolved to and is the **only** part of an entry that
 * may ever leave the product (PRD 022, criterion 7): it is a name from our own
 * lists, which is what `/privacidad` already promises a model is sent, so
 * nothing here needs a second exception to `0100`'s one.
 *
 * **A null `slug` is the per-entry honesty the PRD asks for**, and it is one
 * field rather than two because a second flag saying the same thing is a second
 * thing to keep true: an entry nothing in the catalogue answers comes back with
 * no slug, is shown as not recognised, and **stays in the list** — never
 * aggregated away into *"12 ingredientes guardados"* over nine that matched and
 * three that did not.
 */
export interface PantryEntryView {
  readonly id: string;
  readonly grams: number | null;
  readonly label: string;
  /** Null for an entry the catalogue has no answer for. Kept, never dropped, never guessed. */
  readonly slug: string | null;
  readonly unit: MeasurementUnit | null;
}

/**
 * The cupboard as a screen reads it, with the bound on it, so the screen can
 * say the limit **before** it is hit rather than discovering it in a refusal —
 * `KitchenView.maxPreferred`'s reason, and the same number on both tiers.
 */
export interface PantryView {
  readonly items: readonly PantryEntryView[];
  readonly maxItems: number;
}

// --- Presenters ---------------------------------------------------------------

function presentEntry(item: PantryItem, slugs: ReadonlyMap<string, string>): PantryEntryView {
  return {
    id: item.id,
    grams: item.grams,
    label: item.label,
    slug: item.ingredientId === null ? null : (slugs.get(item.ingredientId) ?? null),
    unit: item.unit
  };
}

function presentPantry(items: readonly PantryItem[], slugs: ReadonlyMap<string, string>): PantryView {
  return { items: items.map(item => presentEntry(item, slugs)), maxItems: MAX_PANTRY_ITEMS };
}

// --- Controller ---------------------------------------------------------------

/**
 * A draft of what is already in the house, and the only thing that reads or
 * writes it.
 *
 * **Nothing here is a restriction.** The cupboard never reaches a
 * `SafetyProfile`, is never read as an intolerance, a dislike, a diet or a
 * condition, and never removes a dish (PRD 022, criterion 8). What it does is
 * shorten a fortnight's shopping list (phase 2); it changes no pick (the
 * owner's decision of 2026-10-23).
 *
 * **And it outlives nothing.** The draft is spent by the generation that reads
 * it and cleared with it, and `pantry_items.user_id` cascades, so deleting the
 * account deletes the cupboard — the cascade `ARCHITECTURE.md` calls the
 * privacy control rather than a convenience.
 */
export const PantryController = {
  /**
   * Adds one thing, or re-states how much of a thing is already named.
   *
   * **The bound is checked here and nowhere else.** At most `MAX_PANTRY_ITEMS`
   * entries — the same on both tiers, a technical ceiling and not a price — and
   * the check happens inside the repository's lock, against rows read in the
   * same transaction that writes, because "count the entries, then write one"
   * is the read-then-compare that lets two requests both pass a limit of sixty
   * (`AGENTS.md` § repositories; the same race a security scan found in
   * `EventController.add` on 2026-09-22).
   *
   * The entry being written is left out of the count by the repository, so
   * saying again that there is rice in the cupboard is never the sixty-first
   * thing.
   *
   * `InputParseError` and not a quota error, exactly as
   * `KitchenController.setStance`: nothing here is spent or counted per month,
   * there is no tier to upgrade to and no time at which it frees up — the
   * request simply says one thing too many, which is 422 with the field named
   * (`AllExceptions.filter`). **The message names the field and never the
   * word**: the label is the person's and does not belong in an error.
   */
  async add(userId: string, entry: AddPantryItem): Promise<PantryView> {
    const key = pantryKey(entry.label);

    // A word that normalises to nothing — an emoji, a row of punctuation — is
    // refused here rather than stored. `normaliseForMatching` strips it to the
    // empty string, which is the key the unresolved index holds and the key the
    // repository matches an entry on, so a second such entry would **replace**
    // the first silently. `resolveCustomAllergens` drops an empty key for the
    // same reason; a cupboard has somewhere to say so, and says it.
    if (key === '') {
      throw new InputParseError('A cupboard word needs a letter or a number', { label: ['A cupboard word needs a letter or a number'] });
    }

    const catalogue = await SafetyRepository.listMatchableIngredients();
    const ingredientId = resolvePantryLabel(entry.label, catalogue);

    const items = await PantryRepository.add(
      userId,
      { grams: entry.grams, ingredientId, label: entry.label, normalisedLabel: key, unit: entry.unit },
      others => {
        if (others.length >= MAX_PANTRY_ITEMS) {
          throw new InputParseError(`At most ${MAX_PANTRY_ITEMS} things may be in the cupboard`, {
            label: [`At most ${MAX_PANTRY_ITEMS} things may be in the cupboard`]
          });
        }
      }
    );

    return presentPantry(items, slugsOf(catalogue));
  },

  /**
   * Empties the cupboard.
   *
   * Idempotent, for the reason the repository gives: the state the caller asked
   * for is the state they get whether or not there was anything there, and this
   * is also what a finished generation calls once it has spent the draft.
   */
  async clear(userId: string): Promise<PantryView> {
    await PantryRepository.clear(userId);

    return { items: [], maxItems: MAX_PANTRY_ITEMS };
  },

  /** What this account says is in the house, in the order it was said. One read tells a screen everything. */
  async read(userId: string): Promise<PantryView> {
    const items = await PantryRepository.findByUser(userId);

    return presentPantry(items, await slugsFor(items));
  },

  /**
   * Removes one entry.
   *
   * **A denial is a 404**, the same answer an id that does not exist gets: an
   * entry's id is somebody's, and a distinct status would let an id confirm
   * that another account's cupboard holds it (`0019`). This is where it differs
   * from `KitchenController.clearStance`, which is idempotent because an
   * appliance key is a catalogue key every account shares and no answer about
   * it reveals anything.
   */
  async remove(userId: string, id: string): Promise<PantryView> {
    const removed = await PantryRepository.remove(userId, id);

    if (!removed) {
      throw new NotFoundError('Pantry item not found');
    }

    return PantryController.read(userId);
  }
};

/** The catalogue read, skipped entirely for a cupboard with nothing resolved in it. */
async function slugsFor(items: readonly PantryItem[]): Promise<ReadonlyMap<string, string>> {
  if (!items.some(item => item.ingredientId !== null)) {
    return new Map();
  }

  return slugsOf(await SafetyRepository.listMatchableIngredients());
}

/**
 * Id → slug, over the projection the matcher already needed.
 *
 * `listMatchableIngredients` returns one row per name per locale, so an id
 * arrives several times with the same slug; the map keeps the last and they are
 * all equal. Reusing it rather than adding a second catalogue query is the
 * precedent `ProfileController` set when it asked the same repository whether a
 * dislike was enforceable — it is a read of the catalogue, not a read of
 * anybody's safety profile, and nothing here assembles one.
 */
function slugsOf(catalogue: readonly { readonly id: string; readonly slug: string }[]): ReadonlyMap<string, string> {
  return new Map(catalogue.map(row => [row.id, row.slug]));
}
