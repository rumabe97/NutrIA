import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseOperationError } from 'core/entities/Error';
import { makeUser } from '#test/fixtures';
import { UserRepository } from './UserRepository';

// Mock `database()` so repo tests stay fast and don't hit a real database.
// Pattern: build a chainable stub for the methods this repo touches (select/from/where/limit
// / insert/values/returning), and assert at the leaf of the chain.
//
// Trade-off acknowledged: this verifies our error-wrapping + schema-parse logic, not the
// actual SQL. For SQL-level confidence add integration tests against a real Postgres
// (Testcontainers, pg-in-memory). For the template's reference test, mocks are enough —
// they exercise the code path we own.
vi.mock('database', () => ({ database: vi.fn() }));

const { database } = await import('database');
const databaseMock = vi.mocked(database);

function buildSelectChain(row: unknown) {
  const limit = vi.fn().mockResolvedValue(row === undefined ? [] : [row]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { admin: { select } };
}

function buildInsertChain(row: unknown) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return { admin: { insert } };
}

describe('UserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns the parsed user when the row exists', async () => {
      const user = makeUser();
      databaseMock.mockResolvedValueOnce(buildSelectChain(user) as never);

      const result = await UserRepository.findById(user.id);

      expect(result).toEqual(user);
    });

    it('returns undefined when the row is missing', async () => {
      databaseMock.mockResolvedValueOnce(buildSelectChain(undefined) as never);

      const result = await UserRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');

      expect(result).toBeUndefined();
    });

    it('wraps a schema-parse failure as DatabaseOperationError (catches DB drift early)', async () => {
      // Bad row — missing `email`. userSchema.parse() throws ZodError, repo wraps it.
      const badRow = { ...makeUser(), email: undefined };
      databaseMock.mockResolvedValueOnce(buildSelectChain(badRow) as never);

      await expect(UserRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479')).rejects.toThrow(DatabaseOperationError);
    });
  });

  describe('create', () => {
    it('inserts and returns the parsed user', async () => {
      const created = makeUser({ email: 'new@example.com', name: 'New User' });
      databaseMock.mockResolvedValueOnce(buildInsertChain(created) as never);

      const result = await UserRepository.create({ email: created.email, name: created.name });

      expect(result).toEqual(created);
    });
  });
});
