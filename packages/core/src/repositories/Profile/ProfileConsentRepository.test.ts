import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { allergies, customAllergens, intolerances } from 'database/schema/safety';
import { checkIns, progressEntries } from 'database/schema/progress';
import { goals, onboardingState, profileDataConsents, profiles, userDietaryPatterns } from 'database/schema/profile';

import { DatabaseOperationError } from 'core/entities/Error';

import { ProfileConsentRepository } from './ProfileConsentRepository';

import type { SQL } from 'drizzle-orm';

type Statement = { readonly kind: 'delete' | 'update'; readonly params: unknown[]; readonly set?: Record<string, unknown>; readonly table: unknown };

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });
const statements: Statement[] = [];
let failAt: unknown = null;

function run(kind: Statement['kind'], table: unknown, where: SQL, set?: Record<string, unknown>): Promise<void> {
  statements.push({ kind, params: dialect.sqlToQuery(where).params, set, table });

  return table === failAt ? Promise.reject(new Error('connection lost')) : Promise.resolve();
}

const tx = {
  delete: (table: unknown) => ({ where: (where: SQL) => run('delete', table, where) }),
  update: (table: unknown) => ({ set: (set: Record<string, unknown>) => ({ where: (where: SQL) => run('update', table, where, set) }) })
};

vi.mock('database', () => ({ database: () => ({ transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx) }) }));

describe('ProfileConsentRepository.withdraw', () => {
  beforeEach(() => {
    statements.length = 0;
    failAt = null;
  });

  it('deletes every datum the consent covered, and the consent, in one transaction — each scoped to the session’s account', async () => {
    await ProfileConsentRepository.withdraw('usr-1', ['goal', 'body-activity', 'allergies'], 2);

    expect(statements.filter(statement => statement.kind === 'delete').map(statement => statement.table)).toEqual([
      allergies,
      intolerances,
      customAllergens,
      userDietaryPatterns,
      goals,
      profileDataConsents
    ]);
    expect(statements.every(statement => statement.params.includes('usr-1'))).toBe(true);
    // The consent goes last: a failure half-way leaves it standing over data that is still there.
    expect(statements.at(-1)?.table).toBe(profileDataConsents);
  });

  it('clears the height, every recorded weight and body measurement, and keeps the rest of each row', async () => {
    await ProfileConsentRepository.withdraw('usr-1', ['goal'], 2);

    const updates = statements.filter(statement => statement.kind === 'update');

    expect(updates.find(statement => statement.table === profiles)?.set).toEqual({ heightCm: null });
    expect(updates.find(statement => statement.table === progressEntries)?.set).toEqual({ measurements: null, weightKg: null });
    expect(updates.find(statement => statement.table === checkIns)?.set).toEqual({ weightKg: null });
  });

  it('reopens onboarding at the step it is given, no longer complete', async () => {
    await ProfileConsentRepository.withdraw('usr-1', ['goal', 'body-activity', 'allergies'], 2);

    const set = statements.find(statement => statement.table === onboardingState)?.set;

    expect(set).toMatchObject({ completedAt: null, currentStep: 2 });
    expect(dialect.sqlToQuery(set?.['completedSteps'] as SQL).params).toEqual(['goal', 'body-activity', 'allergies']);
  });

  it('wraps a failure, so no driver message escapes', async () => {
    failAt = goals;

    await expect(ProfileConsentRepository.withdraw('usr-1', ['goal'], 2)).rejects.toBeInstanceOf(DatabaseOperationError);
  });
});
