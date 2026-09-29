import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FLAGS } from 'core/domain/Flag';
import { UNAUDITED } from 'core/entities/Audit';

import { SettingsController } from './SettingsController';

const all = vi.fn<() => Promise<readonly { enabled: boolean; key: string }[]>>();
const set = vi.fn<(key: string, enabled: boolean, record?: (tx: unknown) => Promise<void>) => Promise<void>>();
const record = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();

vi.mock('#repositories/Settings', () => ({
  SettingsRepository: {
    all: () => all(),
    isEnabled: () => Promise.resolve(false),
    set: (key: string, enabled: boolean, r?: (tx: unknown) => Promise<void>) => set(key, enabled, r)
  }
}));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => record(entry, tx) } }));

beforeEach(() => {
  all.mockReset();
  all.mockResolvedValue([]);
  set.mockReset();
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
