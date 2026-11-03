import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { cookedWith, pantryCatalogueMatches, pantryKey, platesAsBought, resolvePantryLabel } from 'core/domain/Pantry';
import { PantryRepository } from '#repositories/Pantry';
import { ProfileRepository } from '#repositories/Profile';
import { SafetyRepository } from '#repositories/Safety';

import type { AddPantryItem, PantryItem } from 'core/entities/Pantry';
import type { PantryHolding } from 'core/domain/ShoppingList';
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
  /**
   * Whether the library plates this entry's food (project 022 phase 3a).
   *
   * **A different fact from `slug: null`, and PRD 12 counts the two apart**: a
   * null slug is *"the catalogue has no such food"*, this is *"it has it and no
   * dish cooks it"* — the first is an ingredient to add, the second a dish to
   * write, and `/admin` answers them differently. Always false for an entry with
   * no slug, which has no food to ask about.
   *
   * **It is a sentence and never a restriction**: nothing removes the entry,
   * nothing is shown as refused, and this reaches no `SafetyProfile`, no pool
   * and no pick (PRD 022, criterion 8). The screen says *«todavía no cocinamos
   * nada con esto»* and the entry **stays**.
   *
   * Read through `platesAsBought`'s dual mapping, so a cupboard of *«arroz»* —
   * `arroz-largo-crudo`, which no plate carries — is told the truth about the
   * 28 plates that cook it as `arroz-blanco-cocido`. **A food the library only
   * ever serves beside a plate counts too** (`domain/Pantry`'s `cookedWith`):
   * bread, oil, salt and a yoghurt are served every week and listed by almost
   * no recipe.
   */
  readonly cookedWith: boolean;
  readonly grams: number | null;
  readonly label: string;
  /** Null for an entry the catalogue has no answer for. Kept, never dropped, never guessed. */
  readonly slug: string | null;
  readonly unit: MeasurementUnit | null;
}

/**
 * One food the picker may offer, which is one food an add will land on.
 *
 * **No id and no amount.** The id is the catalogue's own key and the body of
 * `POST /pantry` deliberately takes neither it nor a slug (`AddPantryItem.dto`):
 * a screen sends back the `name` it was given, the resolver answers it in code,
 * and what the entry *is* is never decided by something a request carried.
 */
export interface PantryCatalogueFoodView {
  readonly cookedWith: boolean;
  readonly name: string;
  readonly slug: string;
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

/**
 * How many foods a picker is handed at once.
 *
 * Fifty rather than everything: nine hundred rows is not a list anybody reads,
 * and a picker's answer is a shortlist to choose from, not the catalogue. It
 * bounds the response for a typed word and for no word alike, so there is one
 * size of answer and not two.
 */
export const PANTRY_CATALOGUE_PAGE = 50;

// --- Presenters ---------------------------------------------------------------

function presentEntry(item: PantryItem, slugs: ReadonlyMap<string, string>, plated: ReadonlyMap<string, number>): PantryEntryView {
  const slug = item.ingredientId === null ? null : (slugs.get(item.ingredientId) ?? null);

  return { id: item.id, cookedWith: slug !== null && cookedWith(slug, plated), grams: item.grams, label: item.label, slug, unit: item.unit };
}

function presentPantry(items: readonly PantryItem[], slugs: ReadonlyMap<string, string>, plated: ReadonlyMap<string, number>): PantryView {
  return { items: items.map(item => presentEntry(item, slugs, plated)), maxItems: MAX_PANTRY_ITEMS };
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

    return presentPantry(items, slugsOf(catalogue), await platedFor(items));
  },

  /**
   * What the picker offers for a word somebody is typing, at most
   * `PANTRY_CATALOGUE_PAGE` foods; the most-cooked-with foods of the catalogue
   * with no word at all.
   *
   * **This exists so that what a picker offers is what an add resolves to.** The
   * rows come out of `resolvePantryLabel`'s own index — every catalogue name in
   * every locale, plus the slug, plus the curated synonyms and the coarse words
   * through the resolver itself — so a word the picker answered can never be a
   * word the resolver then misses, which would be an entry covering no shopping
   * row and nothing on the screen to say why. A unit spec pins the round trip.
   *
   * **The whole catalogue is offered, not only what the library cooks with**: a
   * cupboard holds what it holds, and a food nothing is cooked with comes back
   * with `cookedWith: false`, which is the honest answer and the one `/admin`
   * aggregates into the library's to-do list (PRD 022, criterion 12). Ordering
   * it by plates first is how the useful rows come up without any row being
   * withheld — **by plates alone**, so a food the library only serves as a side
   * is answered honestly (`cookedWith: true`) and still sorts last, because
   * plates are what say how much of the library a food reaches.
   *
   * **The answer is the same for everybody**, and it is never narrowed by
   * anything on the `SafetyProfile`: a picker that quietly left out somebody's
   * declared allergens would be performing the inference criterion 8 forbids,
   * in the catalogue instead of the scheduler, and it would tell them the
   * catalogue is missing a food we have. Do not add a filter here.
   *
   * Not user-scoped in its data — it is the shared catalogue — and the session's
   * id is taken all the same, for the language to show a name in and because a
   * route of this product does not read anything without one. The word arrives
   * in a **body** and not a query string, which is the route's own doc comment's
   * reasoning (`0100`, and `/privacidad` on what logs keep); `''` and `null` are
   * the same ask, because that is what a picker sends before anybody has typed.
   */
  async catalogue(userId: string, query: string | null, locale: string | null = null): Promise<readonly PantryCatalogueFoodView[]> {
    // The web app sends the tag it is rendering in, so the profile is read only
    // for a caller that sent none — `ProfileController.restrictions`' own
    // cascade, and the same one `PlanController` resolves a plan's language with.
    const resolved = locale ?? (await ProfileRepository.findByUserId(userId))?.locale ?? FALLBACK_LOCALE;
    const [named, matchable, plates] = await Promise.all([
      PantryRepository.listCatalogue(resolved),
      SafetyRepository.listMatchableIngredients(),
      RecipeRepository.platesByIngredient()
    ]);
    const plated = platesAsBought(plates);
    const wanted = query === null ? null : pantryCatalogueMatches(query, matchable);

    return named
      .filter(food => wanted === null || wanted.has(food.id))
      .map(food => ({ cookedWith: cookedWith(food.slug, plated), name: food.name, slug: food.slug }))
      .sort(byPlatesThenName(plated, resolved))
      .slice(0, PANTRY_CATALOGUE_PAGE);
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

  /**
   * The cupboard as a generation spends it (project 022 phase 2): one holding
   * per resolved catalogue row, with the amount where somebody gave one, and a
   * count of the words the catalogue had no answer for.
   *
   * **A method here rather than a read of the repository**, because nothing
   * outside this module should have to know that `ingredientId` is a column.
   * `PantryEntryView` deliberately carries the slug and not the id — the slug
   * is the only part of an entry that may leave the product — while the
   * shopping list's rows are keyed by the id, so both come back from the one
   * place that already holds the catalogue read.
   *
   * **The label never comes back**, in any form, so nothing the generation does
   * with a cupboard can put somebody's word in a prompt, a log or an error
   * (PRD 022, criterion 7). `unresolved` is a number for the same reason: the
   * plan records *that* three words went unanswered and never *which*.
   *
   * An unresolved entry is left out of `holdings` and not dropped from the
   * cupboard: there is no list row for a word the catalogue cannot answer, and
   * guessing one is the thing this feature may not do.
   *
   * **It reads and it changes nothing.** The draft is cleared by `clear`, once
   * the generation has succeeded, and never as a side effect of being read — a
   * generation that fails leaves what somebody typed where they left it.
   */
  async forGeneration(userId: string): Promise<{ readonly holdings: readonly PantryHolding[]; readonly unresolved: number }> {
    const items = await PantryRepository.findByUser(userId);
    const slugs = await slugsFor(items);
    const holdings = items.flatMap(item => {
      if (item.ingredientId === null) {
        return [];
      }

      const slug = slugs.get(item.ingredientId);

      // The catalogue row went away between the entry being written and this
      // read: the column cascades, but a read already in flight can still hold
      // the id. No slug, no row to seed.
      return slug === undefined ? [] : [{ grams: item.grams, ingredientId: item.ingredientId, slug }];
    });

    return { holdings, unresolved: items.filter(item => item.ingredientId === null).length };
  },

  /** What this account says is in the house, in the order it was said. One read tells a screen everything. */
  async read(userId: string): Promise<PantryView> {
    const items = await PantryRepository.findByUser(userId);
    const [slugs, plated] = await Promise.all([slugsFor(items), platedFor(items)]);

    return presentPantry(items, slugs, plated);
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

/**
 * Most-cooked-with first, then the name, collated in the reader's own language —
 * the shopping list's own ordering rule, for the same reason: a list of food read
 * by a person is sorted the way their language sorts.
 *
 * The slug breaks the last tie, so two foods sharing a name come back in the same
 * order on every request and a picker does not reshuffle under somebody's hands.
 */
function byPlatesThenName(plated: ReadonlyMap<string, number>, locale: string): (a: PantryCatalogueFoodView, b: PantryCatalogueFoodView) => number {
  const collator = new Intl.Collator(locale);

  return (a, b) => (plated.get(b.slug) ?? 0) - (plated.get(a.slug) ?? 0) || collator.compare(a.name, b.name) || a.slug.localeCompare(b.slug);
}

/** The catalogue read, skipped entirely for a cupboard with nothing resolved in it. */
async function slugsFor(items: readonly PantryItem[]): Promise<ReadonlyMap<string, string>> {
  if (!items.some(item => item.ingredientId !== null)) {
    return new Map();
  }

  return slugsOf(await SafetyRepository.listMatchableIngredients());
}

/**
 * What the library cooks, as a cupboard names it — skipped for a cupboard with
 * nothing resolved in it, exactly as the catalogue read above is.
 *
 * **One read per answer, never one per entry.** `platesByIngredient` returns the
 * whole map for that reason, and `platesAsBought` folds the dry/cooked mapping
 * into it once.
 */
async function platedFor(items: readonly PantryItem[]): Promise<ReadonlyMap<string, number>> {
  if (!items.some(item => item.ingredientId !== null)) {
    return new Map();
  }

  return platesAsBought(await RecipeRepository.platesByIngredient());
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
