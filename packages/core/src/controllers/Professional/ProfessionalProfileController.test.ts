import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUser } from '#test/fixtures';
import { InputParseError, NotFoundError } from 'core/entities/Error';
import { saveProfessionalProfileSchema } from 'core/entities/Professional';

import { carriesBadgeWord, ProfessionalProfileController } from './ProfessionalProfileController';

import type { Badge, HiddenProfile, ProfileSave, ProfileWordRefusal, QueuedProfile } from '#repositories/Professional';
import type { ProfessionalProfile, SaveProfessionalProfile } from 'core/entities/Professional';
import type { User } from 'core/entities/User';

const NOW = new Date('2026-11-19T09:00:00.000Z');

const save =
  vi.fn<
    (userId: string, input: SaveProfessionalProfile, now: Date, judge: (badged: boolean) => readonly ProfileWordRefusal[]) => Promise<ProfileSave>
  >();
const find = vi.fn<(userId: string) => Promise<ProfessionalProfile | null>>();
type Hook = (tx: unknown) => Promise<unknown>;

const hide = vi.fn<(userId: string, reason: string, now: Date, record?: Hook) => Promise<HiddenProfile | null>>();
const markSeen = vi.fn<(userId: string, ownerId: string, now: Date, record?: Hook) => Promise<ProfessionalProfile | null>>();
const auditRecord = vi.fn<(entry: unknown, tx?: unknown) => Promise<void>>();
const queue = vi.fn<() => Promise<readonly QueuedProfile[]>>();
const badgeOf = vi.fn<(userId: string, now: Date) => Promise<Badge | null>>();
const badgesOf = vi.fn<(userIds: readonly string[], now: Date) => Promise<ReadonlyMap<string, Badge>>>();
const findById = vi.fn<(id: string) => Promise<User | undefined>>();

vi.mock('#repositories/Professional', () => ({
  ProfessionalBadgeRepository: {
    badgeOf: (userId: string, now: Date) => badgeOf(userId, now),
    badgesOf: (userIds: readonly string[], now: Date) => badgesOf(userIds, now)
  },
  ProfessionalProfileRepository: {
    find: (userId: string) => find(userId),
    hide: (userId: string, reason: string, now: Date, record?: Hook) => hide(userId, reason, now, record),
    markSeen: (userId: string, ownerId: string, now: Date, record?: Hook) => markSeen(userId, ownerId, now, record),
    queue: () => queue(),
    save: (userId: string, input: SaveProfessionalProfile, now: Date, judge: (badged: boolean) => readonly ProfileWordRefusal[]) =>
      save(userId, input, now, judge)
  }
}));
vi.mock('#repositories/User', () => ({ UserRepository: { findById: (id: string) => findById(id) } }));
vi.mock('#repositories/Audit', () => ({ AuditRepository: { record: (entry: unknown, tx?: unknown) => auditRecord(entry, tx) } }));

const BADGE: Badge = {
  channel: 'register_email',
  checkedAt: NOW,
  checkId: '4a3b2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d',
  dueAt: NOW,
  lapsesAt: NOW,
  number: 'MAD00123',
  register: 'Colegio de Madrid'
};

function profile(overrides: Partial<ProfessionalProfile> = {}): ProfessionalProfile {
  return {
    id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
    createdAt: NOW,
    displayName: 'Ana Pérez',
    hiddenAt: null,
    hiddenReason: null,
    hours: null,
    priceCents: 4500,
    priceUnit: 'consultation',
    queuedAt: NOW,
    seenAt: null,
    seenBy: 'usr-owner',
    studies: 'Grado en Biología',
    updatedAt: NOW,
    userId: 'usr-pro',
    ...overrides
  };
}

function body(overrides: Record<string, unknown> = {}): SaveProfessionalProfile {
  return saveProfessionalProfileSchema.parse({ displayName: 'Ana Pérez', studies: 'Grado en Biología', ...overrides });
}

beforeEach(() => {
  vi.resetAllMocks();
  badgeOf.mockResolvedValue(null);
  badgesOf.mockResolvedValue(new Map());
  findById.mockResolvedValue(makeUser({ id: 'usr-pro', email: 'pro@example.com', name: 'Ana Pérez' }));
});

/* PRD 025 scope 5, criterion 6: every free-text field, every list, server-side, with the badge as context. */
describe('ProfessionalProfileController.save — the words', () => {
  /** Runs the repository's judge with `badged`, as the repository does under the lock. */
  function judging(badged: boolean): void {
    save.mockImplementation(async (_userId, input, _now, judge) => {
      const [first, ...rest] = judge(badged);

      return first ? { kind: 'refused', refusals: [first, ...rest] } : { kind: 'saved', profile: profile({ ...input }) };
    });
  }

  it.each([
    ['displayName', { displayName: 'Ana, nutricionista' }, 'badge_only:nutricionista'],
    ['studies', { studies: 'Graduada en Nutrición Humana y Dietética' }, 'badge_only:nutricion humana y dietetica'],
    ['displayName', { displayName: 'Ana · consulta online' }, 'badge_only:consulta'],
    ['studies', { studies: 'Atiendo pacientes con diabetes' }, 'badge_only:pacientes']
  ])('refuses a badge-only word without the badge in %s, naming the field and the word, writing nothing', async (field, change, code) => {
    judging(false);

    const refusal = await ProfessionalProfileController.save('usr-pro', body(change), NOW).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InputParseError);
    expect((refusal as InputParseError).fieldErrors).toEqual({ [field]: [code] });
  });

  it('names every refused field on one save — the name and the studies — each with its first refused word', async () => {
    judging(false);

    const refusal = await ProfessionalProfileController.save(
      'usr-pro',
      body({ displayName: 'Ana Dietista', studies: 'Consulta clínica para pacientes' }),
      NOW
    ).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InputParseError);
    expect((refusal as InputParseError).fieldErrors).toEqual({ displayName: ['badge_only:dietista'], studies: ['badge_only:consulta'] });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('names a field refused on another list beside one the badge would allow', async () => {
    judging(true);

    const refusal = await ProfessionalProfileController.save('usr-pro', body({ displayName: 'Dra. Ana', studies: 'Pierde 10 kg' }), NOW).catch(
      (error: unknown) => error
    );

    expect((refusal as InputParseError).fieldErrors).toEqual({ displayName: ['never:dra'], studies: ['result:kg'] });
  });

  it('lets a badge-only word through with the badge', async () => {
    judging(true);
    badgeOf.mockResolvedValue(BADGE);

    await expect(ProfessionalProfileController.save('usr-pro', body({ displayName: 'Ana, dietista-nutricionista' }), NOW)).resolves.toMatchObject({
      displayName: 'Ana, dietista-nutricionista',
      withheld: []
    });
  });

  it.each([
    ['a title nobody may use', { displayName: 'Dra. Ana Pérez' }, 'never:dra'],
    ['a promised result', { studies: 'Pierde 10 kg en un mes' }, 'result:kg'],
    ['a promised result in words', { studies: 'Resultados garantizados' }, 'result:garantizados']
  ])('refuses %s even with the badge', async (_label, change, code) => {
    judging(true);

    const refusal = await ProfessionalProfileController.save('usr-pro', body(change), NOW).catch((error: unknown) => error);

    expect(Object.values((refusal as InputParseError).fieldErrors)).toEqual([[code]]);
  });

  it('allows the names the agreement allows beside the fixed notice', async () => {
    judging(false);

    await expect(ProfessionalProfileController.save('usr-pro', body({ displayName: 'Ana, asesora nutricional' }), NOW)).resolves.toMatchObject({
      review: 'queued'
    });
  });

  it('is a 404 for an account with no practice', async () => {
    save.mockResolvedValue({ kind: 'none' });

    await expect(ProfessionalProfileController.save('usr-plain', body(), NOW)).rejects.toThrow(NotFoundError);
  });
});

describe('ProfessionalProfileController.mine', () => {
  it('is null before a profile is written', async () => {
    find.mockResolvedValue(null);

    await expect(ProfessionalProfileController.mine('usr-pro', NOW)).resolves.toBeNull();
  });

  it('withholds the fields a badge gone no longer allows, and never carries who saw it', async () => {
    find.mockResolvedValue(profile({ displayName: 'Ana, dietista', queuedAt: null, seenAt: NOW, studies: 'Colegiada en Madrid' }));

    const view = await ProfessionalProfileController.mine('usr-pro', NOW);

    expect(view?.review).toBe('seen');
    expect(view?.withheld).toEqual([
      { field: 'displayName', list: 'badge_only', word: 'dietista' },
      { field: 'studies', list: 'badge_only', word: 'colegiada' }
    ]);
    expect(JSON.stringify(view)).not.toContain('usr-owner');
  });

  it('reads the owner’s statement back while the profile is hidden', async () => {
    find.mockResolvedValue(
      profile({
        hiddenAt: NOW,
        hiddenReason: JSON.stringify({ afterNotice: true, facts: 'Lo anuncia como curso.', reasons: ['promises'], word: null })
      })
    );

    await expect(ProfessionalProfileController.mine('usr-pro', NOW)).resolves.toMatchObject({
      hidden: { afterNotice: true, at: NOW.toISOString(), facts: 'Lo anuncia como curso.', reasons: ['promises'], word: null }
    });
  });

  it('reads the reasons back in the table’s order, whatever order a stored row has', async () => {
    find.mockResolvedValue(
      profile({
        hiddenAt: NOW,
        hiddenReason: JSON.stringify({ afterNotice: false, facts: null, reasons: ['advertising', 'promises', 'badge_word', 'invented'], word: 'x' })
      })
    );

    await expect(ProfessionalProfileController.mine('usr-pro', NOW)).resolves.toMatchObject({
      hidden: { reasons: ['badge_word', 'promises', 'advertising'] }
    });
  });

  it('shows a reason written by hand as the owner’s facts', async () => {
    find.mockResolvedValue(profile({ hiddenAt: NOW, hiddenReason: 'spam' }));

    await expect(ProfessionalProfileController.mine('usr-pro', NOW)).resolves.toMatchObject({ hidden: { facts: 'spam', reasons: [] } });
  });
});

describe('carriesBadgeWord — what returns a profile to the queue when a badge goes (0111 § 7)', () => {
  it.each([
    ['Ana, dietista-nutricionista', null, true],
    ['Ana', 'Colegiada número 123', true],
    ['Ana, asesora nutricional', 'Curso de cocina saludable', false]
  ])('%s / %s → %s', (displayName, studies, carries) => {
    expect(carriesBadgeWord({ displayName, studies })).toBe(carries);
  });
});

/* PRD 025 criterion 18: the owner's first look — seen, or hidden with a reason; practitioner data only. */
describe('the owner’s queue', () => {
  it('lists the queued profiles with the account and the badge, and nothing about a client', async () => {
    queue.mockResolvedValue([{ email: 'pro@example.com', name: 'Ana Pérez', profile: profile() }]);
    badgesOf.mockResolvedValue(new Map([['usr-pro', BADGE]]));

    const view = await ProfessionalProfileController.queue(NOW);

    expect(view.profiles).toHaveLength(1);
    expect(Object.keys(view.profiles[0] ?? {}).sort()).toEqual(
      [
        'badged',
        'displayName',
        'email',
        'hidden',
        'hours',
        'name',
        'priceCents',
        'priceUnit',
        'queuedAt',
        'review',
        'seenAt',
        'studies',
        'updatedAt',
        'userId',
        'withheld'
      ].sort()
    );
    expect(view.profiles[0]?.badged).toBe(true);
  });

  it('marks seen only a queued profile', async () => {
    markSeen.mockResolvedValueOnce(profile({ queuedAt: null, seenAt: NOW })).mockResolvedValueOnce(null);
    find.mockResolvedValue(profile({ queuedAt: null, seenAt: NOW }));

    await expect(ProfessionalProfileController.markSeen('usr-pro', 'usr-owner', NOW)).resolves.toMatchObject({ review: 'seen', userId: 'usr-pro' });
    await expect(ProfessionalProfileController.markSeen('usr-pro', 'usr-owner', NOW)).rejects.toThrow(NotFoundError);
    expect(markSeen).toHaveBeenCalledWith('usr-pro', 'usr-owner', NOW, expect.any(Function));
  });

  it('hides with one statement — refusing is the same act — and says whether it had been seen', async () => {
    hide.mockImplementation(async (_userId, reason, now) => ({
      hadBeenSeen: true,
      profile: profile({ hiddenAt: now, hiddenReason: reason, queuedAt: null, seenAt: NOW })
    }));

    const hiding = await ProfessionalProfileController.hide(
      'usr-pro',
      'usr-owner',
      { afterNotice: false, reasons: ['badge_word'], word: 'nutricionista' },
      NOW
    );

    expect(JSON.parse(hide.mock.calls[0]?.[1] ?? '')).toEqual({ afterNotice: false, facts: null, reasons: ['badge_word'], word: 'nutricionista' });
    expect(hiding).toMatchObject({
      hadBeenSeen: true,
      statement: { afterNotice: false, facts: null, reasons: ['badge_word'], word: 'nutricionista' },
      to: 'pro@example.com',
      userId: 'usr-pro'
    });
  });

  it('stores, answers and audits the reasons in the table’s order, not the owner’s click order', async () => {
    hide.mockImplementation(async (_userId, reason, now, record) => {
      await record?.({});

      return { hadBeenSeen: false, profile: profile({ hiddenAt: now, hiddenReason: reason }) };
    });

    const hiding = await ProfessionalProfileController.hide(
      'usr-pro',
      'usr-owner',
      { afterNotice: false, reasons: ['advertising', 'disease', 'badge_word'], word: 'nutricionista' },
      NOW
    );
    const order = ['badge_word', 'disease', 'advertising'];

    expect((JSON.parse(hide.mock.calls[0]?.[1] ?? '') as { reasons: string[] }).reasons).toEqual(order);
    expect(hiding.statement.reasons).toEqual(order);
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ metadata: { afterNotice: false, reasons: order } }), {});
  });

  it('is a 404 to hide an account with no profile', async () => {
    hide.mockResolvedValue(null);

    await expect(ProfessionalProfileController.hide('usr-pro', 'usr-owner', { afterNotice: false, reasons: ['promises'] }, NOW)).rejects.toThrow(
      NotFoundError
    );
  });

  /* Invariant review of phase 6, P2-1 (ADR `0071`): who looked, and who hid, in the act's own transaction — never the word or the facts. */
  it('records the owner’s look and the owner’s hiding in their own transactions', async () => {
    const TX = { name: 'the act’s transaction' };

    markSeen.mockImplementation(async (_userId, _ownerId, _now, record) => {
      await record?.(TX);

      return profile({ queuedAt: null, seenAt: NOW });
    });
    hide.mockImplementation(async (_userId, reason, now, record) => {
      await record?.(TX);

      return { hadBeenSeen: true, profile: profile({ hiddenAt: now, hiddenReason: reason }) };
    });
    find.mockResolvedValue(profile());

    await ProfessionalProfileController.markSeen('usr-pro', 'usr-owner', NOW);
    await ProfessionalProfileController.hide('usr-pro', 'usr-owner', { afterNotice: true, facts: 'Una tienda.', reasons: ['advertising'] }, NOW);

    expect(auditRecord).toHaveBeenNthCalledWith(
      1,
      { action: 'professional.profile_seen', actorId: 'usr-owner', entity: 'professional', metadata: {}, subjectUserId: 'usr-pro' },
      TX
    );
    expect(auditRecord).toHaveBeenNthCalledWith(
      2,
      {
        action: 'professional.profile_hidden',
        actorId: 'usr-owner',
        entity: 'professional',
        metadata: { afterNotice: true, reasons: ['advertising'] },
        subjectUserId: 'usr-pro'
      },
      TX
    );
    expect(JSON.stringify(auditRecord.mock.calls)).not.toContain('Una tienda');
  });
});
