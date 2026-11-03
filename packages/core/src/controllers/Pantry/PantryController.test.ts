import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { makePantryItem } from '#test/fixtures';
import { PANTRY_CATALOGUE_PAGE, PantryController } from 'core/controllers/Pantry';

import type { MatchableIngredient } from 'core/domain/Safety';
import type { PantryCatalogueFood, ResolvedPantryEntry } from '#repositories/Pantry';
import type { PantryItem } from 'core/entities/Pantry';

const add =
  vi.fn<
    (userId: string, entry: ResolvedPantryEntry, allow: (others: readonly PantryItem[]) => Promise<void> | void) => Promise<readonly PantryItem[]>
  >();
const clear = vi.fn<(userId: string) => Promise<void>>();
const findByUser = vi.fn<(userId: string) => Promise<readonly PantryItem[]>>();
const remove = vi.fn<(userId: string, id: string) => Promise<boolean>>();
const listMatchableIngredients = vi.fn<() => Promise<readonly MatchableIngredient[]>>();
const listCatalogue = vi.fn<(locale: string) => Promise<readonly PantryCatalogueFood[]>>();
const platesByIngredient = vi.fn<() => Promise<ReadonlyMap<string, number>>>();
const findByUserId = vi.fn<(userId: string) => Promise<{ readonly locale: string } | undefined>>();

// Wrapped in arrows rather than passed directly: `vi.mock`'s factory is hoisted
// above these declarations, so naming them eagerly is a TDZ error.
vi.mock('#repositories/Pantry', () => ({
  PantryRepository: {
    add: (userId: string, entry: ResolvedPantryEntry, allow: (others: readonly PantryItem[]) => Promise<void> | void) => add(userId, entry, allow),
    clear: (userId: string) => clear(userId),
    findByUser: (userId: string) => findByUser(userId),
    listCatalogue: (locale: string) => listCatalogue(locale),
    remove: (userId: string, id: string) => remove(userId, id)
  }
}));

vi.mock('#repositories/Recipe', () => ({ FALLBACK_LOCALE: 'es-ES', RecipeRepository: { platesByIngredient: () => platesByIngredient() } }));

vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findByUserId: (userId: string) => findByUserId(userId) } }));

vi.mock('#repositories/Safety', () => ({ SafetyRepository: { listMatchableIngredients: () => listMatchableIngredients() } }));

const USER = 'usr-1';
const RICE: MatchableIngredient = { id: 'ing-rice', name: 'Arroz largo', slug: 'arroz-largo-crudo' };
const SOBRASADA: MatchableIngredient = { id: 'ing-sobrasada', name: 'Sobrasada', slug: 'sobrasada' };
/** A food of the accompaniment catalogue: served beside a plate every week, listed by almost no recipe. */
const BREAD: MatchableIngredient = { id: 'ing-bread', name: 'Pan integral', slug: 'pan-integral' };
/**
 * The library as the plate counts see it: the rice is cooked under a **different
 * slug** from the one a cupboard resolves to, which is the whole of what
 * `platesAsBought` exists for, and the sobrasada is a catalogue row no dish
 * cooks.
 */
const PLATES: ReadonlyMap<string, number> = new Map([
  ['arroz-blanco-cocido', 28],
  ['cebolla', 5]
]);
const RESOLVED = makePantryItem({ ingredientId: RICE.id, label: 'arroz' });
const UNRESOLVED = makePantryItem({ id: 'd4e5f607-1829-4c0d-9e1f-2a3b4c5d6e7f', ingredientId: null, label: 'sobrasada' });

/** What the repository would have written: the entry, through the bound it was handed. */
function writes(standing: readonly PantryItem[] = [], written: readonly PantryItem[] = standing): void {
  add.mockImplementation(async (_userId, _entry, allow) => {
    await allow(standing);

    return written;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listMatchableIngredients.mockResolvedValue([RICE]);
  listCatalogue.mockResolvedValue([]);
  platesByIngredient.mockResolvedValue(PLATES);
  findByUserId.mockResolvedValue({ locale: 'es-ES' });
  findByUser.mockResolvedValue([]);
  remove.mockResolvedValue(true);
  clear.mockResolvedValue();
  writes();
});

describe('PantryController.read', () => {
  it('answers an empty cupboard and the bound, so a screen can say the limit before it is hit', async () => {
    await expect(PantryController.read(USER)).resolves.toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });
    expect(findByUser).toHaveBeenCalledWith(USER);
  });

  it('gives a resolved entry its catalogue slug, which is the only part of it that may ever leave', async () => {
    findByUser.mockResolvedValue([RESOLVED]);

    await expect(PantryController.read(USER)).resolves.toEqual({
      items: [{ id: RESOLVED.id, cookedWith: true, grams: null, label: 'arroz', slug: 'arroz-largo-crudo', unit: null }],
      maxItems: MAX_PANTRY_ITEMS
    });
  });

  it('keeps an entry nothing answers, with the word, and says so with a null slug', async () => {
    findByUser.mockResolvedValue([UNRESOLVED]);

    const view = await PantryController.read(USER);

    // Kept, not dropped: tomorrow the catalogue may answer it, and in aggregate
    // these words are the library's own to-do list (PRD 022, criterion 12).
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ label: 'sobrasada', slug: null });
  });

  it('does not read the catalogue at all for a cupboard with nothing resolved in it', async () => {
    findByUser.mockResolvedValue([UNRESOLVED]);

    await PantryController.read(USER);

    expect(listMatchableIngredients).not.toHaveBeenCalled();
    expect(platesByIngredient).not.toHaveBeenCalled();
  });

  it('says the library cooks nothing with an entry it cooks nothing with, and keeps the entry', async () => {
    listMatchableIngredients.mockResolvedValue([RICE, SOBRASADA]);
    findByUser.mockResolvedValue([makePantryItem({ ingredientId: SOBRASADA.id, label: 'sobrasada' })]);

    const view = await PantryController.read(USER);

    // `cookedWith: false` with a slug is a different fact from `slug: null`, and
    // PRD 12 counts them apart: this is a dish to write, not a food to add.
    expect(view.items[0]).toMatchObject({ cookedWith: false, slug: 'sobrasada' });
    expect(view.items).toHaveLength(1);
  });

  it('is told the truth about the rice we cook most, which no plate carries by the name a cupboard uses', async () => {
    findByUser.mockResolvedValue([RESOLVED]);

    const view = await PantryController.read(USER);

    // The cupboard's «arroz» is `arroz-largo-crudo`; the 28 plates cook
    // `arroz-blanco-cocido`. Asking only about the resolved slug would have said
    // «todavía no cocinamos nada con esto».
    expect(view.items[0]).toMatchObject({ cookedWith: true, slug: 'arroz-largo-crudo' });
  });

  it('asks what the library cooks once, not once per entry', async () => {
    findByUser.mockResolvedValue([RESOLVED, makePantryItem({ id: 'c3d4e5f6-0718-4293-8a4b-5c6d7e8f9a0b', ingredientId: RICE.id })]);

    await PantryController.read(USER);

    expect(platesByIngredient).toHaveBeenCalledTimes(1);
  });

  it('does not tell somebody we do nothing with their bread, which we serve beside a plate every week', async () => {
    listMatchableIngredients.mockResolvedValue([RICE, BREAD]);
    findByUser.mockResolvedValue([makePantryItem({ ingredientId: BREAD.id, label: 'pan' })]);

    // No recipe lists it; the accompaniment catalogue does. The plate count is
    // still zero, which is the ordering's business and not this field's.
    expect((await PantryController.read(USER)).items[0]).toMatchObject({ cookedWith: true, slug: 'pan-integral' });
  });

  it('an entry with no slug has no food to ask about, and is never cooked with', async () => {
    findByUser.mockResolvedValue([RESOLVED, UNRESOLVED]);

    const view = await PantryController.read(USER);

    expect(view.items[1]).toMatchObject({ cookedWith: false, slug: null });
  });
});

describe('PantryController.add', () => {
  it('resolves the word in code and hands the repository the id, the label and the normalised key', async () => {
    await PantryController.add(USER, { grams: 500, label: 'Arroz largo', unit: 'g' });

    expect(add).toHaveBeenCalledWith(
      USER,
      { grams: 500, ingredientId: 'ing-rice', label: 'Arroz largo', normalisedLabel: 'arroz largo', unit: 'g' },
      expect.any(Function)
    );
  });

  it('stores a coarse word as the ordinary catalogue row without asking which one it is', async () => {
    await PantryController.add(USER, { grams: null, label: 'arroz', unit: null });

    expect(add.mock.calls[0]?.[1]).toMatchObject({ ingredientId: 'ing-rice', label: 'arroz' });
  });

  it('keeps an unresolved word with a null id rather than refusing it', async () => {
    await PantryController.add(USER, { grams: null, label: 'sobrasada', unit: null });

    expect(add.mock.calls[0]?.[1]).toMatchObject({ ingredientId: null, label: 'sobrasada', normalisedLabel: 'sobrasada' });
  });

  it('refuses a word that normalises to nothing, rather than letting it stand in for every other one', async () => {
    // `normaliseForMatching('🍅')` is the empty string, and the empty string is
    // the key the unresolved index holds and the key the repository matches an
    // entry on — so a second emoji would have **replaced** the first silently.
    // `resolveCustomAllergens` drops an empty key; a cupboard has a field to
    // name in a refusal, and names it.
    const refused = PantryController.add(USER, { grams: null, label: '🍅', unit: null });

    await expect(refused).rejects.toBeInstanceOf(InputParseError);
    await expect(refused).rejects.toMatchObject({ fieldErrors: { label: ['A cupboard word needs a letter or a number'] } });
    expect(add).not.toHaveBeenCalled();
  });

  it('refuses the sixty-first thing as a 422 naming the field, and never names the word', async () => {
    writes(Array.from({ length: MAX_PANTRY_ITEMS }, (_, index) => makePantryItem({ id: `id-${index}` })));

    const refused = PantryController.add(USER, { grams: null, label: 'una cosa secreta', unit: null });

    // `InputParseError` and not a quota error: nothing here is counted per
    // month and there is no tier to upgrade to (`KitchenController.setStance`).
    await expect(refused).rejects.toBeInstanceOf(InputParseError);
    await expect(refused).rejects.toMatchObject({ fieldErrors: { label: [`At most ${MAX_PANTRY_ITEMS} things may be in the cupboard`] } });
    await expect(refused).rejects.toSatisfy((error: Error) => !error.message.includes('una cosa secreta'));
  });

  it('is the same bound whoever asks — there is no tier in the question', async () => {
    // The number lives in `core/entities/Pantry` and reaches no allowance row;
    // a tier-varying cupboard would be selling plan quality (`marketing`).
    expect(MAX_PANTRY_ITEMS).toBe(60);
  });

  it('lets the sixtieth in, so the bound is the limit and not one below it', async () => {
    writes(Array.from({ length: MAX_PANTRY_ITEMS - 1 }, (_, index) => makePantryItem({ id: `id-${index}` })));

    await expect(PantryController.add(USER, { grams: null, label: 'arroz', unit: null })).resolves.toBeDefined();
  });
});

describe('PantryController.remove', () => {
  it('answers the cupboard without it', async () => {
    findByUser.mockResolvedValue([]);

    await expect(PantryController.remove(USER, RESOLVED.id)).resolves.toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });
    expect(remove).toHaveBeenCalledWith(USER, RESOLVED.id);
  });

  it('answers a 404 for an id this account does not own, exactly as for one that does not exist', async () => {
    // The repository cannot tell the two apart on purpose: its `WHERE` holds
    // both the id and the account, so an id can never confirm that somebody
    // else's cupboard holds it (`0019`).
    remove.mockResolvedValue(false);

    await expect(PantryController.remove(USER, RESOLVED.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PantryController.clear', () => {
  it('empties it and answers the empty cupboard without re-reading it', async () => {
    await expect(PantryController.clear(USER)).resolves.toEqual({ items: [], maxItems: MAX_PANTRY_ITEMS });
    expect(clear).toHaveBeenCalledWith(USER);
    expect(findByUser).not.toHaveBeenCalled();
  });
});

describe('PantryController.forGeneration', () => {
  it('gives the generation the catalogue id a list row is keyed by, and the amount beside it', async () => {
    findByUser.mockResolvedValue([makePantryItem({ grams: 500, ingredientId: RICE.id, label: 'Arroz largo', unit: 'g' })]);

    await expect(PantryController.forGeneration(USER)).resolves.toEqual({
      holdings: [{ grams: 500, ingredientId: 'ing-rice', slug: 'arroz-largo-crudo' }],
      unresolved: 0
    });
  });

  it('never hands back the person’s own word, in any form', async () => {
    findByUser.mockResolvedValue([RESOLVED, UNRESOLVED]);

    const spent = await PantryController.forGeneration(USER);

    expect(JSON.stringify(spent)).not.toContain('arroz,');
    expect(JSON.stringify(spent)).not.toContain('sobrasada');
  });

  it('counts the words the catalogue could not answer and seeds no row for them', async () => {
    findByUser.mockResolvedValue([RESOLVED, UNRESOLVED]);

    await expect(PantryController.forGeneration(USER)).resolves.toEqual({
      holdings: [{ grams: null, ingredientId: 'ing-rice', slug: 'arroz-largo-crudo' }],
      unresolved: 1
    });
  });

  it('skips the catalogue read entirely when nothing in the cupboard resolved', async () => {
    findByUser.mockResolvedValue([UNRESOLVED]);

    await expect(PantryController.forGeneration(USER)).resolves.toEqual({ holdings: [], unresolved: 1 });
    expect(listMatchableIngredients).not.toHaveBeenCalled();
  });

  it('leaves out an id the catalogue no longer holds — there is no row to seed for it', async () => {
    findByUser.mockResolvedValue([RESOLVED, makePantryItem({ id: 'b1c2d3e4-5f60-4718-8293-a4b5c6d7e8f9', ingredientId: 'ing-gone', label: 'atún' })]);

    await expect(PantryController.forGeneration(USER)).resolves.toEqual({
      holdings: [{ grams: null, ingredientId: 'ing-rice', slug: 'arroz-largo-crudo' }],
      unresolved: 0
    });
  });

  it('changes nothing: the cupboard is cleared by the generation that succeeded, never by being read', async () => {
    findByUser.mockResolvedValue([RESOLVED]);

    await PantryController.forGeneration(USER);

    expect(clear).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('PantryController.catalogue', () => {
  /**
   * The matchable rows and the named rows of one catalogue, which is the pair the
   * route has to keep in step: `listMatchableIngredients` is one row per name per
   * locale, `listCatalogue` one row per food.
   */
  const MATCHABLE: readonly MatchableIngredient[] = [
    RICE,
    { id: RICE.id, name: 'Long grain rice', slug: RICE.slug },
    { id: 'ing-onion', name: 'Cebolla', slug: 'cebolla' },
    SOBRASADA
  ];
  const NAMED: readonly PantryCatalogueFood[] = [
    { id: RICE.id, name: 'Arroz largo', slug: RICE.slug },
    { id: 'ing-onion', name: 'Cebolla', slug: 'cebolla' },
    { id: SOBRASADA.id, name: 'Sobrasada', slug: SOBRASADA.slug }
  ];
  const WITH_BREAD: readonly PantryCatalogueFood[] = [...NAMED, { id: BREAD.id, name: 'Pan integral', slug: BREAD.slug }];

  beforeEach(() => {
    listMatchableIngredients.mockResolvedValue(MATCHABLE);
    listCatalogue.mockResolvedValue(NAMED);
  });

  it('offers a word the resolver then answers — the one failure this route exists to prevent', async () => {
    const [offered] = await PantryController.catalogue(USER, 'arro', 'es-ES');

    expect(offered).toBeDefined();

    // The round trip: what the picker offered, added, comes back as the slug the
    // picker said it would be.
    await PantryController.add(USER, { grams: null, label: offered?.name ?? '', unit: null });

    const resolvedTo = add.mock.calls[0]?.[1].ingredientId;

    expect(NAMED.find(food => food.id === resolvedTo)?.slug).toBe(offered?.slug);
  });

  it('answers a coarse word with the row an add would land on, which is no substring of its name', async () => {
    // «arroz» is in `COARSE_LABELS`, not in any name of this fixture bar the
    // rice's own — the resolver's answer is added to the matches for exactly this.
    const slugs = (await PantryController.catalogue(USER, 'arroz', 'es-ES')).map(food => food.slug);

    expect(slugs).toContain(RICE.slug);
  });

  it('matches a name in the other locale, because the index it uses holds every locale', async () => {
    const slugs = (await PantryController.catalogue(USER, 'long grain', 'en-GB')).map(food => food.slug);

    expect(slugs).toEqual([RICE.slug]);
  });

  it('offers the whole catalogue, a food nothing is cooked with included, and says which is which', async () => {
    const offered = await PantryController.catalogue(USER, null, 'es-ES');

    expect(offered).toEqual([
      { cookedWith: true, name: 'Arroz largo', slug: 'arroz-largo-crudo' },
      { cookedWith: true, name: 'Cebolla', slug: 'cebolla' },
      // Kept and offered: a cupboard holds what it holds, and this is the honest
      // answer `/admin` aggregates into the library's to-do list (PRD 12).
      { cookedWith: false, name: 'Sobrasada', slug: 'sobrasada' }
    ]);
  });

  it('puts the most-cooked-with food first and then sorts by name, in the reader’s own language', async () => {
    // 28 plates of rice through the dry/cooked mapping, 5 of onion, none of
    // sobrasada — and the two names that tie are collated, not compared by code unit.
    expect((await PantryController.catalogue(USER, null, 'es-ES')).map(food => food.slug)).toEqual(['arroz-largo-crudo', 'cebolla', 'sobrasada']);
  });

  it('says we do something with a food we only serve as a side, and still sorts it after the cooked ones', async () => {
    listMatchableIngredients.mockResolvedValue([...MATCHABLE, BREAD]);
    listCatalogue.mockResolvedValue(WITH_BREAD);

    const offered = await PantryController.catalogue(USER, null, 'es-ES');

    expect(offered.find(food => food.slug === BREAD.slug)).toEqual({ cookedWith: true, name: 'Pan integral', slug: BREAD.slug });
    // Zero plates, so it sorts with the uncooked-with rows and by name among
    // them: the floor is on the answer, never on the order.
    expect(offered.map(food => food.slug)).toEqual(['arroz-largo-crudo', 'cebolla', 'pan-integral', 'sobrasada']);
  });

  it('hands back at most fifty foods, for a word and for no word alike', async () => {
    listCatalogue.mockResolvedValue(
      Array.from({ length: 120 }, (_, index) => ({ id: `ing-${index}`, name: `Comida ${index}`, slug: `comida-${index}` }))
    );
    listMatchableIngredients.mockResolvedValue(
      Array.from({ length: 120 }, (_, index) => ({ id: `ing-${index}`, name: `Comida ${index}`, slug: `comida-${index}` }))
    );

    await expect(PantryController.catalogue(USER, null, 'es-ES')).resolves.toHaveLength(PANTRY_CATALOGUE_PAGE);
    await expect(PantryController.catalogue(USER, 'comida', 'es-ES')).resolves.toHaveLength(PANTRY_CATALOGUE_PAGE);
  });

  it('answers nothing for a word the catalogue has no answer for, rather than guessing one', async () => {
    await expect(PantryController.catalogue(USER, 'queso', 'es-ES')).resolves.toEqual([]);
  });

  it('offers the top of the catalogue for the empty word a picker sends before anybody types', async () => {
    // The route's body defaults `q` to the empty string, so this is the real
    // first request of every picker — the same answer as no word at all.
    await expect(PantryController.catalogue(USER, '', 'es-ES')).resolves.toEqual(await PantryController.catalogue(USER, null, 'es-ES'));
  });

  it('offers everything for a word that normalises to nothing, as a picker with an emoji in it should', async () => {
    await expect(PantryController.catalogue(USER, '🍅', 'es-ES')).resolves.toHaveLength(NAMED.length);
  });

  it('asks the library what it cooks once per answer', async () => {
    await PantryController.catalogue(USER, 'arroz', 'es-ES');

    expect(platesByIngredient).toHaveBeenCalledTimes(1);
  });

  it('reads the profile’s language only for a caller that sent none', async () => {
    await PantryController.catalogue(USER, null, 'en-GB');

    expect(findByUserId).not.toHaveBeenCalled();
    expect(listCatalogue).toHaveBeenCalledWith('en-GB');

    findByUserId.mockResolvedValue({ locale: 'en-GB' });
    await PantryController.catalogue(USER, null, null);

    expect(findByUserId).toHaveBeenCalledWith(USER);
    expect(listCatalogue).toHaveBeenLastCalledWith('en-GB');
  });

  it('falls back to Spanish for an account with no profile and no header', async () => {
    findByUserId.mockResolvedValue(undefined);

    await PantryController.catalogue(USER, null, null);

    expect(listCatalogue).toHaveBeenCalledWith('es-ES');
  });

  it('changes nothing: offering a food writes nothing to anybody’s cupboard', async () => {
    await PantryController.catalogue(USER, 'arroz', 'es-ES');

    expect(add).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
