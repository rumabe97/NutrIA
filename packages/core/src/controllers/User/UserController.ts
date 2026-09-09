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
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    name: user.name,
    role: user.role
  };
}

// --- Controller ---------------------------------------------------------------

export const UserController = {
  /** Opens an account (0017) — what the owner does by hand today. True when the account existed. */
  async activate(email: string): Promise<boolean> {
    return UserRepository.markEmailVerified(email);
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
  }
};
