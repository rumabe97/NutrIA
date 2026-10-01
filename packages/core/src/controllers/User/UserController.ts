import { accountQuerySchema } from 'core/entities/AdminQuery';
import { AuditRepository } from '#repositories/Audit';
import { NotFoundError } from 'core/entities/Error';
import { UNAUDITED } from 'core/entities/Audit';
import { UserRepository } from '#repositories/User';

import type { ActivationAudit, PasswordChangedVia, SessionsRevokedScope } from 'core/entities/Audit';
import type { AccountQuery } from 'core/entities/AdminQuery';
import type { AccountRow, RecordActivationAudit, RecordTierAudit } from '#repositories/User';
import type { User, UserTier } from 'core/entities/User';

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
  /**
   * The account can sign in with a password — a `credential` account exists
   * (PLAN 011 phase 2). False for somebody who only ever arrived through
   * Google: they have no password to change, and their security is their
   * provider's.
   */
  hasPassword: boolean;
  image: string | null;
  name: string;
  /**
   * A sign-in found the password in the breach corpus and it has not been
   * changed since (PLAN 011 phase 2). While true, every route but `/users/me`
   * and `/auth/*` answers 409 `PASSWORD_CHANGE_REQUIRED`; the web app sends
   * the person to the forced-change screen.
   */
  passwordChangeRequired: boolean;
  /**
   * Whether this account is a professional *today*: the `professional` switch
   * on and the owner's grant standing — `ProfessionalController.hasAccess`,
   * read on every request. Display only, so the web app can show the way in;
   * every professional route asks the guard again and never reads this. Always
   * present, false for everyone else.
   */
  professional: boolean;
  role: 'admin' | 'user';
  /**
   * What the account may spend, as its row has it — *not* what it may spend
   * today. The `premium` switch can be off, in which case the allowances are
   * free ones regardless. `PlanController.allowances` is the only answer that
   * has taken the switch into account; this is the column.
   */
  tier: 'free' | 'premium';
}

/**
 * The account as its row has it. `professional` is another domain's answer, so
 * the API adds it (`ProfessionalController.hasAccess`) rather than this
 * controller calling that one.
 */
export type StoredUserView = Omit<UserView, 'professional'>;

function presentUser(user: User, hasPassword: boolean): StoredUserView {
  return {
    id: user.id,
    activated: user.activatedAt !== null,
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    emailVerified: user.emailVerified,
    hasPassword,
    image: user.image,
    name: user.name,
    passwordChangeRequired: user.passwordCompromisedAt !== null,
    role: user.role,
    tier: user.tier
  };
}

// --- Controller ---------------------------------------------------------------

/**
 * One account on the admin table (`GET /admin/accounts`): the two locks, when
 * it arrived, what it is, and its milestones. No profile, no answers, no plan,
 * no health value, no allergy — only dates and counts about the account
 * (`0028`, `0068`). Its keys are exactly these eleven; a twelfth is a decision.
 */
export type AccountView = {
  id: string;
  activated: boolean;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  /** The latest product event recorded for the account (ISO), or null when there is none. */
  lastActiveAt: string | null;
  /** The day onboarding was finished, `YYYY-MM-DD`, or null while it is not. */
  onboardedAt: string | null;
  /** How many plans the account has, in any state. A count; no plan is read. */
  plans: number;
  /** The owner's grant stands (`0059`) — whatever the `professional` switch says. */
  professional: boolean;
  role: 'admin' | 'user';
  tier: 'free' | 'premium';
};

/**
 * Copied field by field, so a column added to the repository's query cannot
 * reach the owner's screen without somebody deciding it should.
 */
function presentAccount(row: AccountRow): AccountView {
  return {
    id: row.id,
    activated: row.activatedAt !== null,
    createdAt: row.createdAt.toISOString(),
    email: row.email,
    emailVerified: row.emailVerified,
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    onboardedAt: row.onboardedAt,
    plans: row.plans,
    professional: row.professional,
    role: row.role,
    tier: row.tier
  };
}

/** One page of a table and what it was asked with. A screen needs the total to draw the pager. */
export type Paged<T> = { readonly offset: number; readonly rows: readonly T[]; readonly size: number; readonly total: number };

export const UserController = {
  /**
   * One page of accounts as the query asks — newest first when it asks
   * nothing — each saying which of its two locks are open and its milestones.
   * `total` counts every account the filters match, not only this page.
   */
  async accounts(query: AccountQuery = accountQuerySchema.parse({})): Promise<Paged<AccountView>> {
    const { rows, total } = await UserRepository.findAll(query);

    return { offset: query.offset, rows: rows.map(presentAccount), size: query.size, total };
  },

  /**
   * Opens an account (`0017`, `0030`) — the owner's decision, by id from the
   * admin screen and by email from the runbook. Returns the address opened, or
   * null when there was no such account.
   *
   * `audit` names who did it and how (`0071`): the session's user for the
   * console, `null` for the mail link and for the automatic activation on
   * email confirmation — a discriminated union, so a caller cannot pair
   * `console` with a null actor. Written in the same transaction as the
   * activation itself, only when one actually happened, and named by the
   * id the update's own `RETURNING` found — so an activation by email still
   * names its subject. Required: a route always has a session or a signed
   * link, so it always has a real audit to give; a suite or a probe that
   * activates an account to set a scenario up rather than to exercise the
   * product passes `UNAUDITED` instead of inventing one.
   */
  async activate(
    match: { readonly id?: string; readonly email?: string },
    audit: ActivationAudit | typeof UNAUDITED
  ): Promise<{ readonly email: string } | null> {
    const record: RecordActivationAudit | undefined =
      audit === UNAUDITED
        ? undefined
        : async (tx, subjectUserId) => {
            await AuditRepository.record(
              { action: 'account.activated', actorId: audit.actorId, entity: 'user', metadata: { via: audit.via }, subjectUserId },
              tx
            );
          };

    return UserRepository.activate(match, record);
  },

  /**
   * The owner vouching for an address (see the repository): the runbook's
   * statement, and how the suites stand in for a click nobody makes there.
   * No HTTP route calls it — the product's path is the verification link.
   */
  async confirmAddress(email: string): Promise<boolean> {
    return UserRepository.confirmAddress(email);
  },

  /**
   * The daily sweep (`/cron/sweep-verifications`): every expired verification
   * row is deleted, now that Better Auth no longer prunes them on each lookup.
   * Answers how many went.
   */
  async forgetExpiredVerifications(now: Date = new Date()): Promise<number> {
    return UserRepository.forgetExpiredVerifications(now);
  },

  /**
   * `id` must come from the verified session. There is deliberately no
   * "get any user" method: a caller that could pass an arbitrary id would be one
   * missing authorisation check away from reading another account.
   */
  async getUser(input: { id: string }): Promise<StoredUserView> {
    const [user, hasPassword] = await Promise.all([UserRepository.findById(input.id), UserRepository.hasPassword(input.id)]);

    if (!user) {
      throw new NotFoundError(`User "${input.id}" not found`);
    }

    return presentUser(user, hasPassword);
  },

  /** The runbook's role statement (see the repository). No route reaches it. */
  async grantAdmin(email: string): Promise<boolean> {
    return UserRepository.grantAdmin(email);
  },

  /**
   * A sign-in found the password in the breach corpus (PLAN 011 phase 2): the
   * account is marked, once — a mark already set keeps its first instant.
   * `userId` is the account Better Auth just signed in, never a body's. Only a
   * timestamp is stored: nothing of the password.
   */
  async markPasswordCompromised(userId: string, at: Date = new Date()): Promise<boolean> {
    return UserRepository.markPasswordCompromised(userId, at);
  },

  /**
   * The account's password changed (PLAN 011 phase 2) — from a session
   * (`change`) or a reset link (`reset`). The breach mark goes and one
   * `auth.password_changed` row is written, in one transaction. The person is
   * both actor and subject: nobody else can change it.
   */
  async passwordChanged(userId: string, via: PasswordChangedVia): Promise<void> {
    await UserRepository.passwordChanged(userId, async tx => {
      await AuditRepository.record(
        { action: 'auth.password_changed', actorId: userId, entity: 'user', metadata: { via }, subjectUserId: userId },
        tx
      );
    });
  },

  /**
   * The person closed sessions of their own (PLAN 011 phase 2). Better Auth
   * has already deleted them, scoped to the session's user; this is the row
   * that says so — which ones in a closed word, never which token, device or
   * address.
   */
  async sessionsRevoked(userId: string, scope: SessionsRevokedScope): Promise<void> {
    await AuditRepository.record({ action: 'auth.sessions_revoked', actorId: userId, entity: 'session', metadata: { scope }, subjectUserId: userId });
  },

  /**
   * Moves an account between tiers (`0042`).
   *
   * Deliberately not gated on the `premium` switch. The switch decides whether
   * the tier is *worth* anything today, and granting one while it is off is how
   * the owner sets up whoever should have it before turning it on. Reading the
   * switch here would make the two settings depend on the order they are used
   * in, which is the kind of rule nobody remembers a week later.
   *
   * `actorId` is the session's user (`0071`): the console is the only route
   * that moves a tier. Required: a suite or a probe that moves a tier
   * directly to set a scenario up rather than to exercise the console passes
   * `UNAUDITED` instead of inventing an actor. `from` is read inside the same
   * transaction as the move, and the row is skipped when it equals `to` —
   * moving an account to the tier it already holds changes nothing.
   */
  async setTier(id: string, tier: UserTier, actorId: string | typeof UNAUDITED): Promise<{ readonly email: string } | null> {
    const record: RecordTierAudit | undefined =
      actorId === UNAUDITED
        ? undefined
        : async (tx, from) => {
            await AuditRepository.record(
              { action: 'account.tier_changed', actorId, entity: 'user', metadata: { from, to: tier }, subjectUserId: id },
              tx
            );
          };

    return UserRepository.setTier(id, tier, record);
  }
};
