import { describe, expect, it } from 'vitest';

import { badgeActs } from './badgeActs';

import type { BadgeRecordView } from 'core/controllers/Professional';

const application = { appliedAt: '2026-11-18T10:00:00.000Z', number: 'CV1', register: 'CV' };
const badge = {
  channel: null,
  checkedAt: '2025-11-18T10:00:00.000Z',
  dueAt: '2026-11-18T10:00:00.000Z',
  lapsesAt: '2026-12-18T10:00:00.000Z',
  number: 'CV1',
  register: 'CV'
};

function code(entered: boolean) {
  return { channel: 'post' as const, entered, expiresAt: '2026-12-18T10:00:00.000Z', live: true };
}

function record(partial: Partial<Pick<BadgeRecordView, 'application' | 'badge' | 'code' | 'state'>>) {
  return { application: null, badge: null, code: null, state: 'none' as const, ...partial };
}

describe('badgeActs', () => {
  it('lets an application be refused, and given only once the code was entered', () => {
    expect(badgeActs(record({ application, state: 'applied' }))).toEqual({
      canConfirm: false,
      canSendCode: true,
      mode: 'application',
      removal: 'fail'
    });
    expect(badgeActs(record({ application, code: code(false), state: 'code_sent' })).canConfirm).toBe(false);
    expect(badgeActs(record({ application, code: code(true), state: 'code_sent' })).canConfirm).toBe(true);
  });

  it('lets a standing badge be withdrawn, and renewed only when due', () => {
    expect(badgeActs(record({ badge, state: 'badged' }))).toEqual({ canConfirm: false, canSendCode: false, mode: 'standing', removal: 'withdrawn' });
    expect(badgeActs(record({ badge, state: 'due' }))).toEqual({ canConfirm: true, canSendCode: true, mode: 'standing', removal: 'withdrawn' });
  });

  it('offers nothing when there is neither', () => {
    for (const state of ['none', 'lapsed', 'refused', 'withdrawn'] as const) {
      expect(badgeActs(record({ state }))).toEqual({ canConfirm: false, canSendCode: false, mode: 'nothing', removal: null });
    }
  });
});
