import { and, asc, count, eq, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { careInvitations, careLinks } from 'database/schema/care';
import { practiceRestrictions, professionals } from 'database/schema/professional';
import { profiles } from 'database/schema/profile';
import { user } from 'database/schema/auth';

import { contains, ordered } from '#repositories/Search';
import { PracticeRestrictionRepository } from './PracticeRestrictionRepository';
import { ProfessionalBadgeRepository } from './ProfessionalBadgeRepository';
import { DatabaseOperationError } from 'core/entities/Error';
import { professionalSchema } from 'core/entities/Professional';

import type { Professional } from 'core/entities/Professional';
import type { ProfessionalQuery } from 'core/entities/AdminQuery';
import type { RecordAudit } from '#repositories/Audit';
import type { SQL } from 'drizzle-orm';

/**
 * One professional on the owner's list: the account and its grant, and nothing
 * about anybody else (`0028`). The address is joined in because the owner
 * grants by account and must be able to tell which one they granted.
 */
export type ProfessionalListRow = {
  readonly collegiateNumber: string | null;
  readonly email: string;
  /** Null for an account with no practice, listed for a restriction that still stands against it. */
  readonly grantedAt: Date | null;
  readonly includedClients: number;
  readonly links: LinkCountRow;
  readonly practiceOpen: boolean;
  readonly userId: string;
};

/** How many of one professional's links are in each status: counts, never a client. */
export type LinkCountRow = { readonly active: number; readonly ended: number; readonly paused: number };

/** Links of one status, counted over the joined rows; a professional with none counts zero. */
function linksIn(status: 'active' | 'ended' | 'paused') {
  return sql<number>`count(${careLinks.id}) filter (where ${careLinks.status} = ${status})`.mapWith(Number);
}

/** The list's `WHERE`: the professional's address contains the search, bound and escaped. Exported for its spec. */
export function professionalFilters(query: Pick<ProfessionalQuery, 'q'>): SQL | undefined {
  return query.q === undefined ? undefined : contains(user.email, query.q);
}

/**
 * The list's order: the chosen column in the chosen direction, then the id so
 * ties always fall the same way. `links` is the active links, then every link.
 * Exported for its spec.
 */
export function professionalOrder(query: Pick<ProfessionalQuery, 'dir' | 'sort'>): readonly SQL[] {
  const tail = asc(professionals.id);

  switch (query.sort) {
    case 'email':
      return [ordered(user.email, query.dir), tail];
    case 'links':
      return [ordered(linksIn('active'), query.dir), ordered(count(careLinks.id), query.dir), tail];
    case 'grantedAt':
      return [ordered(professionals.grantedAt, query.dir), tail];
  }
}

export const ProfessionalRepository = {
  /**
   * The professional accepts their agreement at `version` (`docs/legal/textos/01`).
   *
   * A guarded `UPDATE` by the session's id that writes only when the stored
   * version is another one (or none), so a second click does not move the
   * moment the acceptance can be shown to have happened; when it writes
   * nothing, the row is read as it stands. No row at all, no grant, and `null`.
   * Plain column comparisons, no raw SQL: every parameter is typed by the
   * column it meets.
   */
  async acceptAgreement(userId: string, version: string, now: Date): Promise<Professional | null> {
    try {
      const db = database();
      const [updated] = await db
        .update(professionals)
        .set({ agreementAcceptedAt: now, agreementVersion: version, updatedAt: now })
        .where(and(eq(professionals.userId, userId), or(isNull(professionals.agreementVersion), ne(professionals.agreementVersion, version))))
        .returning();

      if (updated) {
        return professionalSchema.parse(updated);
      }

      const [row] = await db.select().from(professionals).where(eq(professionals.userId, userId)).limit(1);

      return row ? professionalSchema.parse(row) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **The close of a practice, on its day** (PRD 025 scope 16; the 004 revoke,
   * reshaped by phase 6), in one transaction, in this order:
   *
   * 1. **Every open link of the practitioner ends** (`endLinks`, handed down by
   *    the controller: `CareRepository.endLinksOf`), recorded as the
   *    practitioner's side ending it — so to each client it is exactly a link
   *    their practitioner ended, and they are free to accept somebody else (one
   *    open link per client). The agreement's § 11: the practitioner «loses
   *    access to their clients». A lift after a close reopens an empty practice.
   * 2. **A badge that stands is withdrawn** (PLAN phase 6 step 0): the badge
   *    record hangs off the account, not off this row, so without the
   *    `withdrawn` an old `pass` would survive into a practice opened again after
   *    the owner lifts the close. `withdrawal` is that row's checker and reason;
   *    `whenWithdrawn` runs right after it — the profile's requeue. There is no
   *    link left to narrow.
   * 3. The `professionals` row is deleted, and the unanswered invitations with
   *    it — nobody can answer them any more, and each holds an address somebody
   *    typed.
   *
   * Under the practitioner's badge lock, the first lock taken on the account, as
   * every writer of the badge and of the practitioner's rows takes it, then the
   * `professionals` row. **The close is read again under that lock**
   * (invariant review of phase 6, P1-3): `closingId` must still be the close
   * that stands (`PracticeRestrictionRepository.standing`, on this transaction)
   * and its day must have come — the owner's lift takes the same lock, so a
   * close lifted after the sweep listed it is never carried out. False when
   * there is nothing to carry out: nothing is written.
   */
  async close(
    userId: string,
    closingId: string,
    now: Date,
    withdrawal: { readonly checkedBy: string | null; readonly reason: string },
    hooks: {
      readonly endLinks: (tx: Parameters<RecordAudit>[0]) => Promise<unknown>;
      /** The close's audit row (`professional.closed`), in this transaction, once it is carried out. */
      readonly record?: RecordAudit;
      readonly whenWithdrawn?: (tx: Parameters<RecordAudit>[0]) => Promise<unknown>;
    }
  ): Promise<boolean> {
    try {
      return await database().transaction(async tx => {
        await ProfessionalBadgeRepository.lock(tx, userId);

        const [practice] = await tx.select({ id: professionals.id }).from(professionals).where(eq(professionals.userId, userId)).for('update');

        const { closing } = await PracticeRestrictionRepository.standing(userId, tx);

        if (!practice || closing?.id !== closingId || closing.effectiveAt.getTime() > now.getTime()) {
          return false;
        }

        await hooks.endLinks(tx);

        if ((await ProfessionalBadgeRepository.withdrawHeld(tx, userId, withdrawal.checkedBy, withdrawal.reason, now)) && hooks.whenWithdrawn) {
          await hooks.whenWithdrawn(tx);
        }

        await tx.delete(professionals).where(eq(professionals.userId, userId));
        await tx.delete(careInvitations).where(eq(careInvitations.professionalId, userId));

        if (hooks.record) {
          await hooks.record(tx);
        }

        return true;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The professional's own row, by the session's id.
   *
   * `userId` is the ownership boundary as everywhere else — here it is also
   * the question: is this account a professional at all. No row, `null`.
   */
  async find(userId: string): Promise<Professional | null> {
    try {
      const [row] = await database().select().from(professionals).where(eq(professionals.userId, userId)).limit(1);

      return row ? professionalSchema.parse(row) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One professional's links, counted per status — for the grant's answer,
   * which is a row of the owner's list. Only the status column is read.
   */
  async linkCounts(professionalId: string): Promise<LinkCountRow> {
    try {
      const [row] = await database()
        .select({ active: linksIn('active'), ended: linksIn('ended'), paused: linksIn('paused') })
        .from(careLinks)
        .where(eq(careLinks.professionalId, professionalId));

      return row ?? { active: 0, ended: 0, paused: 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every professional the query matches, sorted as it asks — most recently
   * granted first when it asks nothing — with their links counted per status.
   *
   * Reads for the owner's own screen and nothing about a client (`0028`): the
   * links are joined only to be counted, and no column of theirs but the status
   * is read — not a client's id, not a name, not an address. Unpaged: there are
   * few. Mode: one grouped query.
   */
  async list(query: ProfessionalQuery): Promise<readonly ProfessionalListRow[]> {
    try {
      const rows = await database()
        .select({
          active: linksIn('active'),
          collegiateNumber: professionals.collegiateNumber,
          email: user.email,
          ended: linksIn('ended'),
          grantedAt: professionals.grantedAt,
          includedClients: professionals.includedClients,
          paused: linksIn('paused'),
          practiceOpen: professionals.practiceOpen,
          userId: professionals.userId
        })
        .from(professionals)
        .innerJoin(user, eq(user.id, professionals.userId))
        .leftJoin(careLinks, eq(careLinks.professionalId, professionals.userId))
        .where(professionalFilters(query))
        .groupBy(professionals.id, user.id)
        .orderBy(...professionalOrder(query));

      return rows.map(({ active, ended, paused, ...row }) => ({ ...row, links: { active, ended, paused } }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every account with a `practice_restrictions` row and **no** practice — a
   * practice closed on its day, kept on the owner's list so the close can be
   * lifted (invariant review of phase 6, P2-5) — matched by the same address
   * search, with its links counted per status. Whether something still stands
   * is the controller's to ask, by the one definition. The account and counts
   * only, never a client. Ordered by address.
   */
  async listWithoutPractice(query: Pick<ProfessionalQuery, 'q'>): Promise<readonly ProfessionalListRow[]> {
    try {
      const db = database();
      const restricted = db.select({ userId: practiceRestrictions.userId }).from(practiceRestrictions);
      const practising = db.select({ userId: professionals.userId }).from(professionals);
      const rows = await db
        .select({ active: linksIn('active'), email: user.email, ended: linksIn('ended'), paused: linksIn('paused'), userId: user.id })
        .from(user)
        .leftJoin(careLinks, eq(careLinks.professionalId, user.id))
        .where(and(inArray(user.id, restricted), notInArray(user.id, practising), professionalFilters(query)))
        .groupBy(user.id)
        .orderBy(asc(user.email));

      return rows.map(({ active, email, ended, paused, userId }) => ({
        collegiateNumber: null,
        email,
        grantedAt: null,
        includedClients: 0,
        links: { active, ended, paused },
        practiceOpen: false,
        userId
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **An account opens its own practice** (PRD 025 scope 1, criterion 1): the
   * `professionals` row, written from the session's account and from nothing in
   * a body but `birthDate` — which is written to the account's profile only when
   * none is on record, and only with the row (the caller has checked it is 18 or
   * more, `assertOldEnough`). `practiceOpen` and `includedClients` keep their
   * defaults, which pay for nothing; `collegiateNumber` and `grantedBy` stay
   * null: nobody granted this. No badge: that is the owner's check alone.
   *
   * `barred` is asked inside the transaction, after the practitioner's badge
   * lock — the lock the owner's suspend and close take before they read
   * whether a practice exists — so a restriction written at the same moment is
   * either seen here or sees this row. `barred` → nothing written.
   *
   * An account that already practises (`exists`) writes nothing either, the
   * birth date included: two clicks open one practice. `locale` is the
   * request's language, kept only on a profile this creates — an account that
   * never onboarded has none, and its mails would otherwise be in Spanish.
   */
  async open(
    userId: string,
    birth: { readonly birthDate: string | null; readonly locale: string | null },
    now: Date,
    barred: (tx: Parameters<RecordAudit>[0]) => Promise<boolean>
  ): Promise<'barred' | 'exists' | 'opened'> {
    const { birthDate, locale } = birth;

    try {
      return await database().transaction(async tx => {
        await ProfessionalBadgeRepository.lock(tx, userId);

        if (await barred(tx)) {
          return 'barred';
        }

        const [opened] = await tx
          .insert(professionals)
          .values({ grantedAt: now, userId })
          .onConflictDoNothing({ target: professionals.userId })
          .returning({ id: professionals.id });

        if (!opened) {
          return 'exists';
        }

        if (birthDate !== null) {
          // On record from here on (`practice.openBirthDateHint`: «Se guarda en tu cuenta»), and never over one already there.
          await tx
            .insert(profiles)
            .values({ birthDate, userId, ...(locale === null ? {} : { locale }) })
            .onConflictDoUpdate({ set: { birthDate, updatedAt: now }, setWhere: isNull(profiles.birthDate), target: profiles.userId });
        }

        return 'opened';
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on professionals: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
