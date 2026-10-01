import { AuditRepository } from '#repositories/Audit';
import { NotFoundError, TwoFactorRemovalRefusedError } from 'core/entities/Error';
import { TWO_FACTOR_REMOVAL_DELAY_MS } from 'core/entities/TwoFactor';
import { TwoFactorRepository } from '#repositories/TwoFactor';

// --- Presenters ---------------------------------------------------------------

/** `POST /admin/accounts/:id/two-factor/removal`'s answer: when the cron may remove the factor, ISO. Nothing else of the account. */
export type TwoFactorRemovalView = { readonly dueAt: string };

/** What a request leaves the API: the view for the response, and the address the mail goes to — which never reaches the response. */
export type TwoFactorRemovalRequested = TwoFactorRemovalView & { readonly email: string };

/** One account whose factor the cron removed, for its mail: the id (to pick the mail's language) and the address. */
export type TwoFactorRemoved = { readonly email: string; readonly userId: string };

// --- Controller ---------------------------------------------------------------

/**
 * The owner's way back for somebody who lost the phone and the backup codes
 * (PLAN 011 phase 4), and the replay guard on authenticator codes.
 *
 * Audit rows follow phase 2's rule: the account only in `actorId` /
 * `subjectUserId`, no `entityId`, no `ipHash`, the closed metadata and
 * nothing else. The owner is the actor of a request and of a cancel from the
 * console; the account is its own actor when its code cancels; the cron's
 * removal has no actor.
 */
export const TwoFactorController = {
  /**
   * A correct code from the account cancels its pending removal (PLAN 011
   * phase 4): whoever can enter one has not lost the factor. `userId` is the
   * account the code just proved. Answers the address for the "cancelled"
   * mail, or null when nothing was pending — the common case, and silent.
   */
  async cancelRemovalByAccount(userId: string, now: Date = new Date()): Promise<{ readonly email: string } | null> {
    return TwoFactorRepository.cancel(userId, now, async tx => {
      await AuditRepository.record(
        { action: 'auth.2fa_removal_cancelled', actorId: userId, entity: 'user', metadata: { by: 'account' }, subjectUserId: userId },
        tx
      );
    });
  },

  /**
   * The owner cancels a pending removal from the console. Nothing pending —
   * or no such account — is the same `NotFoundError` every other denial is.
   */
  async cancelRemovalByOwner(userId: string, actorId: string, now: Date = new Date()): Promise<{ readonly email: string }> {
    const cancelled = await TwoFactorRepository.cancel(userId, now, async tx => {
      await AuditRepository.record(
        { action: 'auth.2fa_removal_cancelled', actorId, entity: 'user', metadata: { by: 'owner' }, subjectUserId: userId },
        tx
      );
    });

    if (!cancelled) {
      throw new NotFoundError('No pending two-factor removal');
    }

    return cancelled;
  },

  /**
   * Claims the TOTP step a correct code belongs to, so the same code — or one
   * from an earlier step — is never accepted again for the account. Answers
   * false for a replay.
   */
  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    return TwoFactorRepository.claimTotpStep(userId, step);
  },

  /** The accounts whose removal is due now, for the daily cron. */
  async dueRemovals(now: Date = new Date()): Promise<readonly string[]> {
    return TwoFactorRepository.due(now);
  },

  /**
   * Removes one account's factor if its removal is still due — re-checked
   * inside the removal's own transaction — and writes
   * `auth.2fa_removed_by_owner` with no actor. Null when nothing was removed:
   * cancelled meanwhile, already removed, or the account had turned it off
   * itself.
   */
  async removeDue(userId: string, now: Date = new Date()): Promise<TwoFactorRemoved | null> {
    const removed = await TwoFactorRepository.remove(userId, now, async tx => {
      await AuditRepository.record({ action: 'auth.2fa_removed_by_owner', actorId: null, entity: 'user', metadata: {}, subjectUserId: userId }, tx);
    });

    return removed ? { email: removed.email, userId } : null;
  },

  /**
   * The owner asks for the account's second factor to be removed 48 hours
   * from now (`TWO_FACTOR_REMOVAL_DELAY_MS`). `userId` comes from an admin
   * route's path, behind `AdminGuard`; `actorId` from the owner's session.
   * Removes nothing: the daily cron does, once `dueAt` has passed.
   */
  async requestRemoval(userId: string, actorId: string, now: Date = new Date()): Promise<TwoFactorRemovalRequested> {
    const dueAt = new Date(now.getTime() + TWO_FACTOR_REMOVAL_DELAY_MS);
    const result = await TwoFactorRepository.request(userId, actorId, now, dueAt, async tx => {
      await AuditRepository.record({ action: 'auth.2fa_removal_requested', actorId, entity: 'user', metadata: {}, subjectUserId: userId }, tx);
    });

    switch (result.kind) {
      case 'missing':
        throw new NotFoundError(`User "${userId}" not found`);
      case 'not_enabled':
      case 'pending':
        throw new TwoFactorRemovalRefusedError(result.kind);
      case 'requested':
        return { dueAt: result.dueAt.toISOString(), email: result.email };
    }
  }
};
