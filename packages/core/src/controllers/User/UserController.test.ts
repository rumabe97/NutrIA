import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from 'core/entities/Error';
import { UserRepository } from '#repositories/User';
import { makeUser } from '#test/fixtures';
import { UserController } from './UserController';

// Mock the repository so controller tests stay pure-logic — no database, no I/O.
// This is the canonical pattern for controller tests in this package: mock the
// repository methods you call, then assert on (1) the return value (presenter
// output), (2) the typed errors thrown for business-rule violations, and
// (3) which repo methods were invoked with which args.
vi.mock('#repositories/User', () => ({ UserRepository: { create: vi.fn(), findByEmail: vi.fn(), findById: vi.fn() } }));

const repo = vi.mocked(UserRepository);

describe('UserController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUser', () => {
    it('returns a UserView with the createdAt serialised to ISO 8601', async () => {
      const user = makeUser();
      repo.findById.mockResolvedValueOnce(user);

      const view = await UserController.getUser({ id: user.id });

      expect(view).toEqual({ id: user.id, createdAt: '2026-01-15T10:00:00.000Z', email: user.email, name: user.name });
      expect(repo.findById).toHaveBeenCalledWith(user.id);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      repo.findById.mockResolvedValueOnce(undefined);

      await expect(UserController.getUser({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('createUser', () => {
    it('throws ConflictError when the email is already taken', async () => {
      repo.findByEmail.mockResolvedValueOnce(makeUser({ email: 'taken@example.com' }));

      await expect(UserController.createUser({ email: 'taken@example.com', name: 'Someone Else' })).rejects.toThrow(ConflictError);
      // Bug guard: if uniqueness check fails we must NOT proceed to insert.
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the user and returns a presented view when the email is free', async () => {
      const created = makeUser({ email: 'new@example.com', name: 'New User' });
      repo.findByEmail.mockResolvedValueOnce(undefined);
      repo.create.mockResolvedValueOnce(created);

      const view = await UserController.createUser({ email: created.email, name: created.name });

      expect(repo.create).toHaveBeenCalledWith({ email: created.email, name: created.name });
      expect(view.email).toBe(created.email);
      expect(view.createdAt).toBe('2026-01-15T10:00:00.000Z');
    });
  });
});
