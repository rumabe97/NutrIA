import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { professionalProfiles, professionals } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';
import { professionalProfileSchema, PROFILE_TEXT_FIELDS } from 'core/entities/Professional';

import { ProfessionalBadgeRepository } from './ProfessionalBadgeRepository';

import type { ProfessionalProfile, ProfileTextField, SaveProfessionalProfile } from 'core/entities/Professional';

type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/** A field the words refused, and why — what the controller turns into the 422 the profile form shows inline. */
export interface ProfileWordRefusal {
  readonly field: ProfileTextField;
  readonly list: 'badge_only' | 'never' | 'result';
  readonly word: string;
}

/** What saving came to: the profile as stored, a word refused (nothing written), or no practice to own one. */
export type ProfileSave =
  | { readonly kind: 'none' }
  | { readonly kind: 'refused'; readonly refusal: ProfileWordRefusal }
  | { readonly kind: 'saved'; readonly profile: ProfessionalProfile };

/** One profile on the owner's queue: the profile, and the account it belongs to — never a client. */
export interface QueuedProfile {
  readonly email: string;
  readonly name: string;
  readonly profile: ProfessionalProfile;
}

/** A profile the owner just hid, and whether it had been marked seen before (`textos/06` § X, legal F6). */
export interface HiddenProfile {
  readonly hadBeenSeen: boolean;
  readonly profile: ProfessionalProfile;
}

/** Whether `next` changes a free-text field of `stored`: what returns a profile to the owner's queue (PRD 025 criterion 18). */
function changesText(stored: ProfessionalProfile, next: SaveProfessionalProfile): boolean {
  return PROFILE_TEXT_FIELDS.some(field => (stored[field] ?? null) !== (next[field] ?? null));
}

/**
 * What a practitioner says about their practice (`professional_profiles`, PRD
 * 025 scope 4): seen by its author and the owner's console, nowhere else — no
 * client, no list, no model (criterion 16). Every per-account method is by the
 * account's id: the session's for the author, the one the owner named in the
 * console.
 */
export const ProfessionalProfileRepository = {
  /** The account's profile, or null. */
  async find(userId: string): Promise<ProfessionalProfile | null> {
    try {
      const [row] = await database().select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);

      return row ? professionalProfileSchema.parse(row) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner hides a profile, with the statement it carries (`hidden_reason`,
   * required by the table). **Refusing and hiding are this one act** (legal F6):
   * it also takes the profile off the queue, because the owner has looked.
   * Immediate. Null when the account has no profile. `record` writes the
   * owner's audit row in this transaction (ADR `0071`).
   */
  async hide(userId: string, reason: string, now: Date, record?: (tx: Tx) => Promise<unknown>): Promise<HiddenProfile | null> {
    try {
      return await database().transaction(async tx => {
        const [before] = await tx
          .select({ seenAt: professionalProfiles.seenAt })
          .from(professionalProfiles)
          .where(eq(professionalProfiles.userId, userId))
          .for('update');

        if (!before) {
          return null;
        }

        const [row] = await tx
          .update(professionalProfiles)
          .set({ hiddenAt: now, hiddenReason: reason, queuedAt: null, updatedAt: now })
          .where(eq(professionalProfiles.userId, userId))
          .returning();

        if (record) {
          await record(tx);
        }

        return { hadBeenSeen: before.seenAt !== null, profile: professionalProfileSchema.parse(row) };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner has looked and found nothing to hide: seen, off the queue — and,
   * for a hidden profile its author edited since, no longer hidden (`textos/06`
   * § X: «si ya no tiene lo que te decimos, dejará de estar oculto»). Only a
   * profile on the queue: null otherwise, and nothing is written. `record`
   * writes the owner's audit row in the same transaction (ADR `0071`).
   */
  async markSeen(userId: string, ownerId: string, now: Date, record?: (tx: Tx) => Promise<unknown>): Promise<ProfessionalProfile | null> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx
          .update(professionalProfiles)
          .set({ hiddenAt: null, hiddenReason: null, queuedAt: null, seenAt: now, seenBy: ownerId, updatedAt: now })
          .where(and(eq(professionalProfiles.userId, userId), isNotNull(professionalProfiles.queuedAt)))
          .returning();

        if (!row) {
          return null;
        }

        if (record) {
          await record(tx);
        }

        return professionalProfileSchema.parse(row);
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner's first-look queue (PRD 025 criterion 18): every profile created
   * or edited since the owner last looked, oldest first, with the account's
   * address and name. Nothing about any client is read. Unpaged: there are few.
   */
  async queue(): Promise<readonly QueuedProfile[]> {
    try {
      const rows = await database()
        .select({ email: user.email, name: user.name, profile: professionalProfiles })
        .from(professionalProfiles)
        .innerJoin(user, eq(user.id, professionalProfiles.userId))
        .where(isNotNull(professionalProfiles.queuedAt))
        .orderBy(asc(professionalProfiles.queuedAt), asc(professionalProfiles.id));

      return rows.map(row => ({ email: row.email, name: row.name, profile: professionalProfileSchema.parse(row.profile) }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **A badge gone** (`0111` § 7): the profile returns to the owner's queue when
   * `carries` finds a badge-only word in it — those fields stop rendering until
   * edited — inside the caller's transaction: the owner's withdrawal, the
   * sweep's lapse, the close of a practice. A profile already queued keeps its
   * date. True when it was queued by this call.
   */
  async requeueIf(tx: Tx, userId: string, now: Date, carries: (profile: ProfessionalProfile) => boolean): Promise<boolean> {
    try {
      const [row] = await tx.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).for('update');

      if (!row || !carries(professionalProfileSchema.parse(row))) {
        return false;
      }

      const queued = await tx
        .update(professionalProfiles)
        .set({ queuedAt: now, updatedAt: now })
        .where(and(eq(professionalProfiles.userId, userId), isNull(professionalProfiles.queuedAt)))
        .returning({ id: professionalProfiles.id });

      return queued.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The author saves their whole profile (`PUT /care/practice/profile`).
   *
   * Under the practitioner's badge lock (`ProfessionalBadgeRepository.lock`,
   * the first lock on that account), so the badge `judge` is handed — read here,
   * on this transaction — is the one that stands when the row is written: a
   * withdrawal either commits before (and this save is judged without the badge)
   * or after (and its requeue finds what this saved). `judge` is the words'
   * verdict on every free-text field (`protectedWordIn`); a refusal writes
   * nothing.
   *
   * A profile is the practice's: no `professionals` row, `none`. A create, or a
   * change to a free-text field, puts it on the owner's queue (`queued_at`, PRD
   * 025 criterion 18); a change to the price or the hours alone does not. The
   * queue gates nothing.
   */
  async save(userId: string, input: SaveProfessionalProfile, now: Date, judge: (badged: boolean) => ProfileWordRefusal | null): Promise<ProfileSave> {
    try {
      return await database().transaction(async (tx): Promise<ProfileSave> => {
        await ProfessionalBadgeRepository.lock(tx, userId);

        const [practice] = await tx.select({ id: professionals.id }).from(professionals).where(eq(professionals.userId, userId)).for('share');

        if (!practice) {
          return { kind: 'none' };
        }

        const refusal = judge((await ProfessionalBadgeRepository.badgeOf(userId, now, tx)) !== null);

        if (refusal) {
          return { kind: 'refused', refusal };
        }

        const [stored] = await tx.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).for('update');
        const current = stored ? professionalProfileSchema.parse(stored) : null;
        const values = {
          displayName: input.displayName,
          hours: input.hours,
          priceCents: input.priceCents,
          priceUnit: input.priceUnit,
          studies: input.studies
        };
        const queuedAt = current === null || changesText(current, input) ? now : current.queuedAt;

        const [row] = current
          ? await tx
              .update(professionalProfiles)
              .set({ ...values, queuedAt, updatedAt: now })
              .where(eq(professionalProfiles.userId, userId))
              .returning()
          : await tx
              .insert(professionalProfiles)
              .values({ ...values, queuedAt, userId })
              .returning();

        return { kind: 'saved', profile: professionalProfileSchema.parse(row) };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on professional_profiles: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
