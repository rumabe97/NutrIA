import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InputParseError } from 'core/entities/Error';
import { KitchenController } from 'core/controllers/Kitchen';
import { DEFAULT_KITCHEN, MAX_PREFERRED_APPLIANCES } from 'core/entities/Kitchen';
import { makeKitchenStance } from '#test/fixtures';

import type { Appliance, KitchenStance } from 'core/entities/Kitchen';

const findByUser = vi.fn<(userId: string) => Promise<readonly KitchenStance[]>>();
const remove = vi.fn<(userId: string, appliance: Appliance) => Promise<boolean>>();
const setStance =
  vi.fn<
    (userId: string, stance: KitchenStance, allow: (others: readonly KitchenStance[]) => Promise<void> | void) => Promise<readonly KitchenStance[]>
  >();

// Wrapped in arrows rather than passed directly: `vi.mock`'s factory is
// hoisted above these declarations, so naming them eagerly is a TDZ error.
vi.mock('#repositories/Kitchen', () => ({
  KitchenRepository: {
    findByUser: (userId: string) => findByUser(userId),
    remove: (userId: string, appliance: Appliance) => remove(userId, appliance),
    setStance: (userId: string, stance: KitchenStance, allow: (others: readonly KitchenStance[]) => Promise<void> | void) =>
      setStance(userId, stance, allow)
  }
}));

const USER = 'usr-1';

/** What the repository would have written: the stances it was given, as they now stand. */
function writes(standing: readonly KitchenStance[] = []): void {
  setStance.mockImplementation(async (_userId, stance, allow) => {
    await allow(standing.filter(row => row.appliance !== stance.appliance));

    return [...standing.filter(row => row.appliance !== stance.appliance), stance];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  findByUser.mockResolvedValue([]);
  remove.mockResolvedValue(true);
  writes();
});

describe('KitchenController.read', () => {
  it('reads silence as a normal kitchen, and says nobody described it', async () => {
    await expect(KitchenController.read(USER)).resolves.toEqual({
      appliances: DEFAULT_KITCHEN,
      described: false,
      maxPreferred: MAX_PREFERRED_APPLIANCES
    });
    expect(findByUser).toHaveBeenCalledWith(USER);
  });

  it('folds what somebody said onto the default and says they did', async () => {
    findByUser.mockResolvedValue([makeKitchenStance(), { appliance: 'air_fryer', stance: 'prefers' }]);

    const view = await KitchenController.read(USER);

    expect(view.appliances.oven).toBe('missing');
    expect(view.appliances.air_fryer).toBe('prefers');
    expect(view.appliances.stovetop).toBe('has');
    // What the screen's empty state turns on: three choices already made is not
    // what a person who never opened it should see (`0102`).
    expect(view.described).toBe(true);
  });

  it('says the bound on preferences, so a screen can say it before it is hit', async () => {
    await expect(KitchenController.read(USER)).resolves.toMatchObject({ maxPreferred: 3 });
  });
});

describe('KitchenController.setStance', () => {
  it('writes the stance and answers the kitchen it leaves behind', async () => {
    const view = await KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' });

    expect(setStance).toHaveBeenCalledWith(USER, { appliance: 'air_fryer', stance: 'prefers' }, expect.any(Function));
    expect(view.appliances.air_fryer).toBe('prefers');
    expect(view.described).toBe(true);
    // No second read: the write answers with the rows it left.
    expect(findByUser).not.toHaveBeenCalled();
  });

  it('allows the third preference', async () => {
    writes([
      { appliance: 'oven', stance: 'prefers' },
      { appliance: 'grill', stance: 'prefers' }
    ]);

    await expect(KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' })).resolves.toMatchObject({ described: true });
  });

  it('refuses the fourth, as 422 with the field named', async () => {
    writes([
      { appliance: 'oven', stance: 'prefers' },
      { appliance: 'grill', stance: 'prefers' },
      { appliance: 'steamer', stance: 'prefers' }
    ]);

    const refused = KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' });

    // `InputParseError` and not a quota error: nothing here is counted per
    // month, there is no tier to upgrade to and no hour at which it frees up.
    await expect(refused).rejects.toBeInstanceOf(InputParseError);
    await expect(refused).rejects.toMatchObject({ fieldErrors: { appliance: [expect.stringContaining('3')] } });
  });

  it('lets somebody re-state a preference they already have, however many they have', async () => {
    writes([
      { appliance: 'oven', stance: 'prefers' },
      { appliance: 'grill', stance: 'prefers' },
      { appliance: 'air_fryer', stance: 'prefers' }
    ]);

    // The appliance being written is left out of the count, so this is the
    // third preference again rather than a fourth.
    await expect(KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' })).resolves.toMatchObject({ described: true });
  });

  it('never refuses "I do not have one", however many appliances are preferred', async () => {
    writes([
      { appliance: 'oven', stance: 'prefers' },
      { appliance: 'grill', stance: 'prefers' },
      { appliance: 'steamer', stance: 'prefers' }
    ]);

    // "No tengo" is never capped: nobody is charged for the appliances they do
    // not own (`0102`).
    const refused = await KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'missing' });
    const owned = await KitchenController.setStance(USER, { appliance: 'microwave', stance: 'has' });

    expect(refused.appliances.air_fryer).toBe('missing');
    expect(owned.appliances.microwave).toBe('has');
  });

  it('checks the bound inside the write rather than before it', async () => {
    await KitchenController.setStance(USER, { appliance: 'air_fryer', stance: 'prefers' });

    // The count is read in the same transaction that writes. Read first and
    // written after, two requests fired together both pass a bound of three —
    // the race a security scan found in `EventController.add` on 2026-09-22.
    expect(setStance.mock.calls[0]?.[2]).toBeTypeOf('function');
    expect(findByUser).not.toHaveBeenCalled();
  });
});

describe('KitchenController.clearStance', () => {
  it('puts the appliance back to what the default says and answers the kitchen', async () => {
    findByUser.mockResolvedValue([]);

    await expect(KitchenController.clearStance(USER, 'oven')).resolves.toEqual({
      appliances: DEFAULT_KITCHEN,
      described: false,
      maxPreferred: MAX_PREFERRED_APPLIANCES
    });
    expect(remove).toHaveBeenCalledWith(USER, 'oven');
  });

  it('answers the same for an appliance nobody ever spoke about', async () => {
    remove.mockResolvedValue(false);

    // Idempotent on purpose, unlike `FixedMealController.remove`: an appliance
    // key is not somebody's id, so there is nothing to deny and nothing a 404
    // would protect — and a "back to normal" tap that could 404 is worse for no
    // gain. Asserted as "it tried and answered", not only as the view it
    // returned, which a swallowed failure would also produce.
    const view = await KitchenController.clearStance(USER, 'rice_cooker');

    expect(remove).toHaveBeenCalledWith(USER, 'rice_cooker');
    expect(view.described).toBe(false);
    expect(view.appliances.rice_cooker).toBe('missing');
  });

  it('leaves everything else said about the kitchen alone', async () => {
    remove.mockResolvedValue(true);
    findByUser.mockResolvedValue([{ appliance: 'air_fryer', stance: 'prefers' }]);

    const view = await KitchenController.clearStance(USER, 'oven');

    expect(view.appliances.air_fryer).toBe('prefers');
    expect(view.appliances.oven).toBe('has');
  });
});

describe('KitchenController.applyChanges', () => {
  it('answers the kitchen the batch leaves behind', async () => {
    findByUser.mockResolvedValue([{ appliance: 'oven', stance: 'missing' }]);

    const view = await KitchenController.applyChanges(USER, [{ appliance: 'oven', stance: 'missing' }]);

    expect(view.appliances.oven).toBe('missing');
    expect(view.described).toBe(true);
  });

  /**
   * The reason this lives on the kitchen's own controller and not beside the
   * onboarding step that first sent a list: somebody swapping their preference
   * from the oven to the air fryer sends both changes in one body, and written
   * in the order they arrived the new one would meet the old one still standing
   * and be refused as a fourth. Everything that is not `prefers` goes first.
   */
  it('writes what comes off `prefers` before what goes on to it', async () => {
    await KitchenController.applyChanges(USER, [
      { appliance: 'air_fryer', stance: 'prefers' },
      { appliance: 'oven', stance: 'has' },
      { appliance: 'grill', stance: null }
    ]);

    expect(setStance.mock.calls.map(call => call[1].appliance)).toEqual(['oven', 'air_fryer']);
    expect(remove).toHaveBeenCalledWith(USER, 'grill');
  });

  it('takes a stance back with null rather than writing one', async () => {
    await KitchenController.applyChanges(USER, [{ appliance: 'oven', stance: null }]);

    expect(remove).toHaveBeenCalledWith(USER, 'oven');
    expect(setStance).not.toHaveBeenCalled();
  });

  it('leaves what it already wrote when a later change is refused', async () => {
    const refusal = new InputParseError('too many', { appliance: ['too many'] });

    setStance.mockImplementation(async (_userId, stance) => {
      if (stance.stance === 'prefers') {
        throw refusal;
      }

      return [stance];
    });

    await expect(
      KitchenController.applyChanges(USER, [
        { appliance: 'oven', stance: 'has' },
        { appliance: 'air_fryer', stance: 'prefers' }
      ])
    ).rejects.toBe(refusal);

    // The oven was written before the refusal and stays — the same state
    // somebody reaches by pressing the appliances one at a time.
    expect(setStance.mock.calls.map(call => call[1].appliance)).toEqual(['oven', 'air_fryer']);
  });
});
