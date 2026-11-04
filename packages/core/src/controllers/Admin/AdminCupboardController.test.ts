import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cupboardGapQuerySchema } from 'core/entities/AdminQuery';

import { AdminCupboardController, UNRESOLVED_THRESHOLD } from './AdminCupboardController';

const repository = vi.hoisted(() => ({ uncooked: vi.fn(), unresolved: vi.fn() }));

vi.mock('#repositories/Admin', () => ({ AdminCupboardRepository: repository, UNRESOLVED_WORD_THRESHOLD: 2 }));

const PAGE = cupboardGapQuerySchema.parse({ offset: 5, size: 10 });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminCupboardController', () => {
  it('pages the unresolved words with their total, and lets through only the word and the count', async () => {
    repository.unresolved.mockResolvedValue({ rows: [{ accounts: 3, userId: 'leaked', word: 'tofu ahumado' }], total: 11 });

    await expect(AdminCupboardController.unresolved(PAGE)).resolves.toEqual({
      offset: 5,
      rows: [{ accounts: 3, word: 'tofu ahumado' }],
      size: 10,
      total: 11
    });
  });

  it('pages the uncooked ingredients, and nothing else a row might carry', async () => {
    repository.uncooked.mockResolvedValue({
      rows: [
        { accounts: 2, category: 'produce', label: 'leaked', name: 'Calabaza', slug: 'calabaza' },
        { accounts: 0, category: 'other', name: 'Sal', slug: 'sal' }
      ],
      total: 513
    });

    await expect(AdminCupboardController.uncooked(PAGE)).resolves.toEqual({
      offset: 5,
      rows: [
        { accounts: 2, category: 'produce', name: 'Calabaza', slug: 'calabaza' },
        { accounts: 0, category: 'other', name: 'Sal', slug: 'sal' }
      ],
      size: 10,
      total: 513
    });
  });

  it('says the threshold is two accounts', () => {
    expect(UNRESOLVED_THRESHOLD).toBe(2);
  });
});

describe('cupboardGapQuerySchema', () => {
  it('takes a page and nothing else', () => {
    expect(cupboardGapQuerySchema.parse({})).toEqual({ offset: 0, size: 25 });
    expect(cupboardGapQuerySchema.parse({ offset: '10', size: '100' })).toEqual({ offset: 10, size: 100 });
    expect(cupboardGapQuerySchema.safeParse({ size: 101 }).success).toBe(false);
    expect(cupboardGapQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('refuses a parameter it does not know — no free string, and no way to ask for a lower threshold', () => {
    expect(cupboardGapQuerySchema.safeParse({ q: 'tofu' }).success).toBe(false);
    expect(cupboardGapQuerySchema.safeParse({ min: 1 }).success).toBe(false);
    expect(cupboardGapQuerySchema.safeParse({ threshold: 1 }).success).toBe(false);
  });
});
