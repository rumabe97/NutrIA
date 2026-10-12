import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allowancesFor } from 'core/domain/Allowance';
import { FLAGS } from 'core/domain/Flag';
import { InputParseError } from 'core/entities/Error';
import { UNAUDITED } from 'core/entities/Audit';

import { SettingsController } from './SettingsController';

const all = vi.fn<() => Promise<readonly { enabled: boolean; key: string }[]>>();
const allowances = vi.fn<() => Promise<readonly { name: string; tier: string; value: number }[]>>();
const setAllowance = vi.fn<(tier: string, key: string, value: number, shipped: number, record?: (tx: unknown) => Promise<void>) => Promise<void>>();
const set = vi.fn<(key: string, enabled: boolean, record?: (tx: unknown) => Promise<void>) => Promise<void>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();

vi.mock('#repositories/Settings', () => ({
  SettingsRepository: {
    all: () => all(),
    allowances: () => allowances(),
    isEnabled: () => Promise.resolve(false),
    set: (key: string, enabled: boolean, r?: (tx: unknown) => Promise<void>) => set(key, enabled, r),
    setAllowance: (tier: string, key: string, value: number, shipped: number, r?: (tx: unknown) => Promise<void>) =>
      setAllowance(tier, key, value, shipped, r)
  }
}));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => record(entry, tx) } }));

beforeEach(() => {
  all.mockReset();
  all.mockResolvedValue([]);
  allowances.mockReset();
  allowances.mockResolvedValue([]);
  set.mockReset();
  setAllowance.mockReset();
  record.mockReset();
});

/* `setFlag` (`0071`): the key written to the table names the trail's `entityId` — a switch is not a person. */
describe('SettingsController.setFlag', () => {
  it('records the session as the actor, with the enabled value and the flag’s own key', async () => {
    set.mockImplementation(async (_key, _enabled, r) => {
      await r?.(undefined);
    });

    await SettingsController.setFlag('checkInReminders', true, 'usr-owner');

    expect(record).toHaveBeenCalledWith(
      {
        action: 'setting.changed',
        actorId: 'usr-owner',
        entity: 'setting',
        entityId: FLAGS.checkInReminders.key,
        metadata: { enabled: true, key: FLAGS.checkInReminders.key }
      },
      undefined
    );
  });

  it('throws the switch with no audit at all when the suites move it with UNAUDITED', async () => {
    await SettingsController.setFlag('checkInReminders', false, UNAUDITED);

    expect(set).toHaveBeenCalledWith(FLAGS.checkInReminders.key, false, undefined);
    expect(record).not.toHaveBeenCalled();
  });
});

/**
 * `setAllowance` (`0097`). The bounds are the registry's, so the answer is the
 * same one the resolution reads — and a number outside them is refused with the
 * ceiling's reason rather than quietly clamped.
 */
describe('SettingsController.setAllowance', () => {
  it('refuses a number past the ceiling, and writes nothing', async () => {
    await expect(SettingsController.setAllowance({ name: 'eventsPerPlan', tier: 'premium', value: 9 }, 'owner-1')).rejects.toThrow(InputParseError);
    expect(setAllowance).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('refuses free above premium, naming both numbers so the reader knows which to move first', async () => {
    await expect(SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'free', value: 25 }, 'owner-1')).rejects.toThrow(InputParseError);
    expect(setAllowance).not.toHaveBeenCalled();
  });

  it('refuses premium below free', async () => {
    allowances.mockResolvedValue([{ name: 'mealSwapsPerPlan', tier: 'free', value: 8 }]);

    await expect(SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'premium', value: 6 }, 'owner-1')).rejects.toThrow(
      InputParseError
    );
    expect(setAllowance).not.toHaveBeenCalled();
  });

  it('passes the shipped number to the repository, which is what decides whether the row is kept', async () => {
    await SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'premium', value: 10 }, 'owner-1');

    expect(setAllowance).toHaveBeenCalledWith('premium', 'mealSwapsPerPlan', 10, allowancesFor('premium').mealSwapsPerPlan, expect.any(Function));
  });

  it('records the session as the actor, with the number before and after, and says when it was put back', async () => {
    await SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'premium', value: 10 }, 'owner-1');
    await (setAllowance.mock.calls[0]?.[4] as (tx: unknown) => Promise<void>)({});

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'setting.allowance_changed',
        actorId: 'owner-1',
        entityId: 'allowance:premium:mealSwapsPerPlan',
        metadata: { from: 20, name: 'mealSwapsPerPlan', tier: 'premium', unset: false, value: 10 }
      }),
      {}
    );
  });

  it('marks the trail when the limit is put back to what the code ships', async () => {
    allowances.mockResolvedValue([{ name: 'mealSwapsPerPlan', tier: 'premium', value: 10 }]);

    await SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'premium', value: 20 }, 'owner-1');
    await (setAllowance.mock.calls[0]?.[4] as (tx: unknown) => Promise<void>)({});

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { from: 10, name: 'mealSwapsPerPlan', tier: 'premium', unset: true, value: 20 } }),
      {}
    );
  });

  it('writes no trail at all for an unaudited caller', async () => {
    await SettingsController.setAllowance({ name: 'mealSwapsPerPlan', tier: 'premium', value: 10 }, UNAUDITED);

    expect(setAllowance).toHaveBeenCalledWith('premium', 'mealSwapsPerPlan', 10, 20, undefined);
    expect(record).not.toHaveBeenCalled();
  });
});
