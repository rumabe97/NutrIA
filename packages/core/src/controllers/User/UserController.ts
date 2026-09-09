import { NotFoundError } from 'core/entities/Error';
import { UserRepository } from '#repositories/User';
import type { User } from 'core/entities/User';

/**
 * Structure every controller here follows:
 *
 *  1. Presenters — pure functions shaping domain data for consumers. Serialise
 *     dates, drop internals. No I/O. Always at the top of the file.
 *  2. Controller — a static object of typed methods: business rule → repository
 *     call → present.
 *
 * Input arrives already typed; parsing raw payloads belongs at the app boundary
 * (the NestJS DTO). Controllers throw domain errors and never catch — the API's
 * exception filter translates them into responses.
 *
 * Never call another controller from a method. Reach for the other domain's
 * repository instead.
 *
 * Naming note: a "controller" here is an application service. The HTTP layer's
 * controllers live in `apps/api` and call into these.
 */

// --- Presenters ---------------------------------------------------------------

export interface UserView {
  id: string;
  /** The owner opened this account. What every gate in the product asks (`0030`). */
  activated: boolean;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  name: string;
  role: 'admin' | 'user';
}

function presentUser(user: User): UserView {
  return {
    id: user.id,
    activated: user.activatedAt !== null,
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    name: user.name,
    role: user.role
  };
}

// --- Controller ---------------------------------------------------------------

/** One account the owner has not opened yet (`0030`). No profile, no answers — only what a decision needs. */
export type WaitingView = { id: string; createdAt: string; email: string; emailVerified: boolean; };

export const UserController = {
  /**
   * Opens an account (`0017`, `0030`) — the owner's decision, by id from the
   * admin screen and by email from the runbook. Returns the address opened, or
   * null when there was no such account.
   */
  async activate(match: { readonly id?: string; readonly email?: string; }): Promise<{ readonly email: string } | null> {
    return UserRepository.activate(match);
  },

  /**
   * `id` must come from the verified session. There is deliberately no
   * "get any user" method: a caller that could pass an arbitrary id would be one
   * missing authorisation check away from reading another account.
   */
  async getUser(input: { id: string }): Promise<UserView> {
    const user = await UserRepository.findById(input.id);

    if (!user) {throw new NotFoundError(`User "${input.id}" not found`);}

    return presentUser(user);
  },

  /** Accounts still waiting to be opened, oldest first. */
  async waiting(limit = 50): Promise<readonly WaitingView[]> {
    return (await UserRepository.findWaiting(limit)).map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }
};
