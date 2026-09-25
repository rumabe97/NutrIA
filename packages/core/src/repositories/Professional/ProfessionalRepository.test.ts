import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { makeProfessional } from '#test/fixtures';

import { ProfessionalRepository } from './ProfessionalRepository';

import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect({ casing: 'snake_case' });

/** What the guarded `UPDATE … RETURNING` answers, what the read after it answers, and what each was given. */
let updated: Record<string, unknown>[] = [];
let stored: Record<string, unknown>[] = [];
let set: Record<string, unknown> | undefined;
let updateWhere: SQL | undefined;
let reads = 0;

vi.mock('database', () => ({
  database: () => ({
    select: () => {
      reads += 1;
      const chain = { from: () => chain, limit: () => Promise.resolve(stored), where: () => chain };

      return chain;
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        set = values;

        return {
          where: (where: SQL) => {
            updateWhere = where;

            return { returning: () => Promise.resolve(updated) };
          }
        };
      }
    })
  })
}));

const NOW = new Date('2026-09-25T09:00:00.000Z');

/*
 * The agreement's acceptance (`docs/legal/textos/01`). It once wrote a raw `CASE`
 * carrying a JavaScript `Date`, which postgres.js cannot send untyped, and every
 * acceptance answered 500 against a real database while these mocks said
 * nothing. What is pinned now is the shape that works: plain values, and the
 * guard that keeps the first date, in the `WHERE`.
 */
describe('ProfessionalRepository.acceptAgreement', () => {
  beforeEach(() => {
    updated = [];
    stored = [];
    set = undefined;
    updateWhere = undefined;
    reads = 0;
  });

  it('writes plain values — never SQL — and only over another version or none', async () => {
    updated = [makeProfessional({ agreementAcceptedAt: NOW, agreementVersion: '1.0.0' })];

    await expect(ProfessionalRepository.acceptAgreement('usr-pro', '1.0.0', NOW)).resolves.toMatchObject({ agreementVersion: '1.0.0' });

    expect(set).toEqual({ agreementAcceptedAt: NOW, agreementVersion: '1.0.0', updatedAt: NOW });
    const { params, sql } = dialect.sqlToQuery(updateWhere as SQL);

    expect(sql).toBe(
      '("professionals"."user_id" = $1 and ("professionals"."agreement_version" is null or "professionals"."agreement_version" <> $2))'
    );
    expect(params).toEqual(['usr-pro', '1.0.0']);
    expect(reads).toBe(0);
  });

  it('reads the row as it stands when it already holds this version, keeping its date', async () => {
    const earlier = new Date('2026-09-20T09:00:00.000Z');

    stored = [makeProfessional({ agreementAcceptedAt: earlier, agreementVersion: '1.0.0' })];

    await expect(ProfessionalRepository.acceptAgreement('usr-pro', '1.0.0', NOW)).resolves.toMatchObject({ agreementAcceptedAt: earlier });
    expect(reads).toBe(1);
  });

  it('answers null for an account that is not a professional', async () => {
    await expect(ProfessionalRepository.acceptAgreement('usr-nobody', '1.0.0', NOW)).resolves.toBeNull();
  });
});
