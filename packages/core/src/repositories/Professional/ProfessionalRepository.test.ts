import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { makeProfessional } from '#test/fixtures';

import { professionalFilters, professionalOrder, ProfessionalRepository } from './ProfessionalRepository';
import { professionalQuerySchema } from 'core/entities/AdminQuery';

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

/* The owner's list (`0068`): searched by address, sorted from an allow-list. */
describe('professionalFilters and professionalOrder', () => {
  const query = (raw: Record<string, string> = {}) => professionalQuerySchema.parse(raw);
  const sqlOf = (order: readonly SQL[]) => order.map(term => dialect.sqlToQuery(term).sql);

  it('searches the professional’s address literally, bound as a parameter, and nothing when blank', () => {
    const { params, sql } = dialect.sqlToQuery(professionalFilters(query({ q: 'Ana%' })) as SQL);

    expect(sql).toBe('"user"."email" ilike $1');
    expect(params).toEqual(['%Ana\\%%']);
    expect(professionalFilters(query({ q: '' }))).toBeUndefined();
  });

  it('is the most recently granted first when nothing is asked', () => {
    expect(sqlOf(professionalOrder(query()))).toEqual(['"professionals"."granted_at" desc nulls last', '"professionals"."id" asc']);
  });

  it('sorts by address either way', () => {
    expect(sqlOf(professionalOrder(query({ dir: 'asc', sort: 'email' })))).toEqual(['"user"."email" asc nulls last', '"professionals"."id" asc']);
  });

  it('sorts by active links, then every link — counts, never a client', () => {
    expect(sqlOf(professionalOrder(query({ sort: 'links' })))).toEqual([
      'count("care_links"."id") filter (where "care_links"."status" = $1) desc nulls last',
      'count("care_links"."id") desc nulls last',
      '"professionals"."id" asc'
    ]);
  });
});
