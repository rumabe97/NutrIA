import { beforeEach, describe, expect, it, vi } from 'vitest';

import { professionalProfiles } from 'database/schema/professional';

import { ProfessionalProfileRepository } from './ProfessionalProfileRepository';

import type { ProfessionalBadgeCheck, ProfessionalProfile, SaveProfessionalProfile } from 'core/entities/Professional';

/*
 * PRD 025 criterion 18 and `0111` § 7, at the repository: the save is judged
 * under the practitioner's badge lock with the badge read on its own
 * transaction, a create or a text change queues the profile, a price or hours
 * change alone does not, and a badge gone requeues only a profile that carries
 * a badge-only word. A fake that answers each awaited statement from a script.
 */

const NOW = new Date('2026-11-19T09:00:00.000Z');
const EARLIER = new Date('2026-11-01T09:00:00.000Z');

const events: string[] = [];
let script: unknown[][] = [];
const written: Record<string, unknown>[] = [];

function chain(name: string): PromiseLike<unknown> & Record<string, unknown> {
  const link: PromiseLike<unknown> & Record<string, unknown> = {
    for: () => link,
    from: () => link,
    limit: () => link,
    orderBy: () => link,
    returning: () => link,
    set: (values: Record<string, unknown>) => {
      written.push(values);

      return link;
    },
    then: (resolve, reject) => {
      events.push(name);

      return Promise.resolve(script.shift() ?? []).then(resolve, reject);
    },
    values: (values: Record<string, unknown>) => {
      written.push(values);

      return link;
    },
    where: () => link
  };

  return link;
}

const tx = {
  execute: async () => {
    events.push('lock');

    return [];
  },
  insert: (table: unknown) => chain(table === professionalProfiles ? 'insert profile' : 'insert'),
  select: () => chain('select'),
  update: (table: unknown) => chain(table === professionalProfiles ? 'update profile' : 'update')
};

vi.mock('database', () => ({ database: () => ({ transaction: <T>(fn: (db: unknown) => Promise<T>) => fn(tx), update: tx.update }) }));

function stored(overrides: Partial<ProfessionalProfile> = {}): ProfessionalProfile {
  return {
    id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
    createdAt: EARLIER,
    displayName: 'Ana Pérez',
    hiddenAt: null,
    hiddenReason: null,
    hours: null,
    priceCents: 4500,
    priceUnit: 'consultation',
    queuedAt: null,
    seenAt: EARLIER,
    seenBy: 'usr-owner',
    studies: 'Grado en Biología',
    updatedAt: EARLIER,
    userId: 'usr-pro',
    ...overrides
  };
}

function pass(): ProfessionalBadgeCheck {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    channel: 'register_email',
    checkedAt: EARLIER,
    checkedBy: 'usr-owner',
    createdAt: EARLIER,
    dueAt: new Date('2027-11-01T09:00:00.000Z'),
    kind: 'pass',
    number: 'MAD00123',
    reason: null,
    register: 'Colegio de Madrid',
    updatedAt: EARLIER,
    userId: 'usr-pro'
  };
}

const INPUT: SaveProfessionalProfile = {
  displayName: 'Ana Pérez',
  hours: null,
  priceCents: 4500,
  priceUnit: 'consultation',
  studies: 'Grado en Biología'
};

beforeEach(() => {
  events.length = 0;
  written.length = 0;
  script = [];
});

describe('ProfessionalProfileRepository.save', () => {
  it('takes the badge lock first, then judges with the badge read on its own transaction', async () => {
    // The practice, the badge's latest decisive check, the stored profile, the update's RETURNING.
    script = [[{ id: 'pro-row' }], [pass()], [stored()], [stored()]];
    const judge = vi.fn(() => null);

    await ProfessionalProfileRepository.save('usr-pro', INPUT, NOW, judge);

    expect(events[0]).toBe('lock');
    expect(judge).toHaveBeenCalledWith(true);
  });

  it('writes nothing when the words refuse', async () => {
    script = [[{ id: 'pro-row' }], []];

    await expect(
      ProfessionalProfileRepository.save('usr-pro', INPUT, NOW, () => ({ field: 'displayName', list: 'badge_only', word: 'dietista' }))
    ).resolves.toEqual({ kind: 'refused', refusal: { field: 'displayName', list: 'badge_only', word: 'dietista' } });
    expect(events).not.toContain('update profile');
    expect(events).not.toContain('insert profile');
  });

  it('is `none` without a practice: a profile is the practice’s', async () => {
    script = [[]];

    await expect(ProfessionalProfileRepository.save('usr-pro', INPUT, NOW, () => null)).resolves.toEqual({ kind: 'none' });
  });

  it('queues a new profile', async () => {
    script = [[{ id: 'pro-row' }], [], [], [stored({ queuedAt: NOW })]];

    await ProfessionalProfileRepository.save('usr-pro', INPUT, NOW, () => null);

    expect(events).toContain('insert profile');
    expect(written.at(-1)).toMatchObject({ queuedAt: NOW, userId: 'usr-pro' });
  });

  it('queues again on a change to a free-text field', async () => {
    script = [[{ id: 'pro-row' }], [], [stored()], [stored()]];

    await ProfessionalProfileRepository.save('usr-pro', { ...INPUT, studies: 'Grado en Biología y un máster' }, NOW, () => null);

    expect(written.at(-1)).toMatchObject({ queuedAt: NOW });
  });

  it('leaves the queue alone on a change to the price or the hours', async () => {
    script = [[{ id: 'pro-row' }], [], [stored()], [stored()]];

    await ProfessionalProfileRepository.save('usr-pro', { ...INPUT, priceCents: 6000, priceUnit: 'month' }, NOW, () => null);

    expect(written.at(-1)).toMatchObject({ queuedAt: null });
  });
});

describe('ProfessionalProfileRepository.requeueIf', () => {
  it('queues a profile that carries the word', async () => {
    script = [[stored()], [{ id: 'row' }]];

    await expect(ProfessionalProfileRepository.requeueIf(tx as never, 'usr-pro', NOW, () => true)).resolves.toBe(true);
    expect(written).toEqual([{ queuedAt: NOW, updatedAt: NOW }]);
  });

  it('leaves alone a profile that does not, and an account with none', async () => {
    script = [[stored()]];
    await expect(ProfessionalProfileRepository.requeueIf(tx as never, 'usr-pro', NOW, () => false)).resolves.toBe(false);

    script = [[]];
    await expect(ProfessionalProfileRepository.requeueIf(tx as never, 'usr-pro', NOW, () => true)).resolves.toBe(false);
    expect(written).toEqual([]);
  });
});

describe('ProfessionalProfileRepository.hide and markSeen', () => {
  it('hides at once with the statement, off the queue, and says whether it had been seen', async () => {
    script = [[{ seenAt: EARLIER }], [stored({ hiddenAt: NOW, hiddenReason: 'statement', queuedAt: null })]];

    await expect(ProfessionalProfileRepository.hide('usr-pro', 'statement', NOW)).resolves.toMatchObject({ hadBeenSeen: true });
    expect(written).toEqual([{ hiddenAt: NOW, hiddenReason: 'statement', queuedAt: null, updatedAt: NOW }]);
  });

  it('marks seen, clearing a hiding the author has edited past', async () => {
    script = [[stored({ seenAt: NOW })]];

    await expect(ProfessionalProfileRepository.markSeen('usr-pro', 'usr-owner', NOW)).resolves.not.toBeNull();
    expect(written).toEqual([{ hiddenAt: null, hiddenReason: null, queuedAt: null, seenAt: NOW, seenBy: 'usr-owner', updatedAt: NOW }]);
  });
});
