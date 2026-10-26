import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_PANTRY_ITEMS } from 'core/entities/Pantry';
import { makePantryItem } from '#test/fixtures';
import { PantryController } from 'core/controllers/Pantry';

import type { MatchableIngredient } from 'core/domain/Safety';
import type { PantryItem } from 'core/entities/Pantry';
import type { ResolvedPantryEntry } from '#repositories/Pantry';

const add =
  vi.fn<
    (userId: string, entry: ResolvedPantryEntry, allow: (others: readonly PantryItem[]) => Promise<void> | void) => Promise<readonly PantryItem[]>
  >();
const clear = vi.fn<(userId: string) => Promise<void>>();
const findByUser = vi.fn<(userId: string) => Promise<readonly PantryItem[]>>();
const remove = vi.fn<(userId: string, id: string) => Promise<boolean>>();
const listMatchableIngredients = vi.fn<() => Promise<readonly MatchableIngredient[]>>();

// Wrapped in arrows rather than passed directly: `vi.mock`'s factory is hoisted
// above these declarations, so naming them eagerly is a TDZ error.
vi.mock('#repositories/Pantry', () => ({
  PantryRepository: {
    add: (userId: string, entry: ResolvedPantryEntry, allow: (others: readonly PantryItem[]) => Promise<void> | void) => add(userId, entry, allow),
    clear: (userId: string) => clear(userId),
    findByUser: (userId: string) => findByUser(userId),
    remove: (userId: string, id: string) => remove(userId, id)
  }
}));

vi.mock('#repositories/Safety', () => ({ SafetyRepository: { listMatchableIngredients: () => listMatchableIngredients() } }));

const USER = 'usr-1';
const RICE: MatchableIngredient = { id: 'ing-rice', name: 'Arroz largo', slug: 'arroz-largo-crudo' };
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
      items: [{ id: RESOLVED.id, grams: null, label: 'arroz', slug: 'arroz-largo-crudo', unit: null }],
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
