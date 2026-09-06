import { ConflictError, NotFoundError } from 'core/entities/Error';
import { UserRepository } from '#repositories/User';
import type { CreateUser, User } from 'core/entities/User';

/**
 * UserController
 *
 * Structure followed by every controller in this package:
 *
 *  1. Presenters   — pure functions that shape domain data for consumers.
 *                    Serialise dates, rename fields, strip internals.
 *                    No I/O, no side effects. Always at the top of the file.
 *
 *  2. Controller   — static object of typed methods.
 *                    Each method: business rule → repository call → present.
 *
 * Input is typed — controllers receive proper TypeScript types, not raw unknown.
 * Input validation (Zod, form parsing, etc.) belongs at the app boundary:
 * the server action, the CLI command, or the API route handler.
 *
 * Error handling:
 *   - Repositories wrap I/O in try/catch and throw domain errors (DatabaseOperationError).
 *   - Controllers throw intentionally for business rule violations (NotFoundError, ConflictError).
 *   - Controllers do NOT catch — errors bubble to the app boundary.
 *   - App boundaries catch domain errors and translate to user-facing messages.
 *
 * NEVER call another controller from inside a method.
 * If you need data from another domain, import that domain's repository directly.
 */

// --- Presenters ---------------------------------------------------------------

export interface UserView {
  id: string;
  createdAt: string; // dates are always serialised to ISO 8601 at this boundary
  email: string;
  name: string;
}

function presentUser(user: User): UserView {
  return { id: user.id, createdAt: user.createdAt.toISOString(), email: user.email, name: user.name };
}

// --- Controller ---------------------------------------------------------------

export const UserController = {
  async createUser(input: CreateUser): Promise<UserView> {
    const existing = await UserRepository.findByEmail(input.email);

    if (existing) {
      throw new ConflictError(`Email "${input.email}" is already taken`);
    }

    const user = await UserRepository.create(input);

    return presentUser(user);
  },

  async getUser(input: Pick<User, 'id'>): Promise<UserView> {
    const user = await UserRepository.findById(input.id);

    if (!user) {
      throw new NotFoundError(`User "${input.id}" not found`);
    }

    return presentUser(user);
  }
};
