import { AuditRepository } from '#repositories/Audit';
import { ProfessionalBadgeRepository, ProfessionalProfileRepository } from '#repositories/Professional';
import { protectedWordIn } from 'core/domain/ProtectedWords';
import { InputParseError, NotFoundError } from 'core/entities/Error';
import { PROFILE_HIDE_REASONS, PROFILE_TEXT_FIELDS } from 'core/entities/Professional';
import { UserRepository } from '#repositories/User';

import type { ProfileWordRefusal, QueuedProfile } from '#repositories/Professional';
import type { ProtectedWordList } from 'core/domain/ProtectedWords';
import type {
  HideProfessionalProfile,
  PriceUnit,
  ProfessionalHours,
  ProfessionalProfile,
  ProfileHideReason,
  ProfileTextField,
  SaveProfessionalProfile
} from 'core/entities/Professional';

/** The same bytes as every other refusal (`ProfessionalController`). */
const NOT_FOUND = 'Not Found';

// --- Presenters ---------------------------------------------------------------

/** A word in a free-text field that may not be shown now, and why (`protectedWordIn`, `0111` § 7). */
export interface ProfileWordView {
  field: ProfileTextField;
  list: ProtectedWordList;
  word: string;
}

/**
 * The owner's statement for hiding a profile, as the practitioner and the
 * console read it back (`textos/06` § X): when, the closed reasons, the word
 * quoted, the owner's facts, and whether it followed a notice.
 */
export interface ProfileHiddenView {
  afterNotice: boolean;
  at: string;
  facts: string | null;
  reasons: ProfileHideReason[];
  word: string | null;
}

/**
 * A practitioner's profile as its author reads it (`GET /care/practice/profile`,
 * PRD 025 scope 4). Seen by its author and the owner's console only.
 *
 * `review` is the owner's first look: `queued` until the owner has seen the
 * latest text, `seen` after — never «approved» (`textos/01` § 5). `hidden` is
 * the owner's statement while the profile is hidden; an edit puts it back on the
 * queue, and it stays hidden until the owner looks again.
 *
 * `withheld` lists every free-text field that carries a word the account may
 * not show **now** — a badge-only word after the badge went — so those fields
 * stop rendering until edited (`0111` § 7). Empty while everything may be shown.
 */
export interface ProfessionalProfileView {
  displayName: string;
  hidden: ProfileHiddenView | null;
  hours: ProfessionalHours | null;
  priceCents: number | null;
  priceUnit: PriceUnit | null;
  review: 'queued' | 'seen';
  studies: string | null;
  updatedAt: string;
  withheld: ProfileWordView[];
}

/** One profile on the owner's queue: the account, its profile, and the badge as it stands — never a client. */
export interface QueuedProfileView extends ProfessionalProfileView {
  badged: boolean;
  email: string;
  name: string;
  queuedAt: string | null;
  seenAt: string | null;
  userId: string;
}

/** The owner's first-look queue (PRD 025 criterion 18). */
export interface ProfileQueueView {
  profiles: QueuedProfileView[];
}

/** A profile just hidden, with what its statement of reasons says and where it goes (`textos/06` § X). */
export interface ProfileHiding {
  readonly hadBeenSeen: boolean;
  readonly profile: QueuedProfileView;
  readonly statement: ProfileHiddenView;
  readonly to: string;
  readonly userId: string;
}

/** The words of every free-text field of `profile`, judged with the badge as it stands (`badged`). */
function wordsOf(profile: Pick<ProfessionalProfile, ProfileTextField>, badged: boolean): ProfileWordView[] {
  return PROFILE_TEXT_FIELDS.flatMap(field => {
    const text = profile[field];
    const hit = text === null ? null : protectedWordIn(text, badged);

    return hit ? [{ field, list: hit.list, word: hit.word }] : [];
  });
}

/**
 * Whether a profile carries a word only the badge allows: what returns it to
 * the owner's queue when a badge goes (`0111` § 7). Judged as if un-badged —
 * that is the moment it is asked — and only the badge-only list counts: a word
 * nobody may use was never saved.
 */
export function carriesBadgeWord(profile: Pick<ProfessionalProfile, ProfileTextField>): boolean {
  return wordsOf(profile, false).some(word => word.list === 'badge_only');
}

/** The statement as `hidden_reason` keeps it: JSON, so it can be read back on both pages. */
function storedHiding(input: HideProfessionalProfile): string {
  return JSON.stringify({ afterNotice: input.afterNotice, facts: input.facts ?? null, reasons: input.reasons, word: input.word ?? null });
}

function readHiding(profile: ProfessionalProfile): ProfileHiddenView | null {
  if (profile.hiddenAt === null) {
    return null;
  }

  const at = profile.hiddenAt.toISOString();

  try {
    const parsed = JSON.parse(profile.hiddenReason ?? '') as Partial<Record<keyof ProfileHiddenView, unknown>>;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((reason): reason is ProfileHideReason => PROFILE_HIDE_REASONS.includes(reason))
      : [];

    return {
      afterNotice: parsed.afterNotice === true,
      at,
      facts: typeof parsed.facts === 'string' ? parsed.facts : null,
      reasons,
      word: typeof parsed.word === 'string' ? parsed.word : null
    };
  } catch {
    // A reason written by hand, not by this code: shown as the owner's facts.
    return { afterNotice: false, at, facts: profile.hiddenReason, reasons: [], word: null };
  }
}

/** Field by field: never `seenBy`, which is the owner's id. */
function presentProfile(profile: ProfessionalProfile, badged: boolean): ProfessionalProfileView {
  return {
    displayName: profile.displayName,
    hidden: readHiding(profile),
    hours: profile.hours,
    priceCents: profile.priceCents,
    priceUnit: profile.priceUnit,
    review: profile.queuedAt === null ? 'seen' : 'queued',
    studies: profile.studies,
    updatedAt: profile.updatedAt.toISOString(),
    withheld: wordsOf(profile, badged)
  };
}

function presentQueued(row: QueuedProfile, badged: boolean): QueuedProfileView {
  return {
    ...presentProfile(row.profile, badged),
    badged,
    email: row.email,
    name: row.name,
    queuedAt: row.profile.queuedAt?.toISOString() ?? null,
    seenAt: row.profile.seenAt?.toISOString() ?? null,
    userId: row.profile.userId
  };
}

/** The first refused word of a profile about to be saved, or null: every free-text field, with the badge as context. */
function refusalOf(input: SaveProfessionalProfile, badged: boolean): ProfileWordRefusal | null {
  return wordsOf(input, badged)[0] ?? null;
}

/** The owner's view of one account's profile now; a 404 when there is none. */
async function ownerView(userId: string, now: Date): Promise<QueuedProfileView> {
  const [account, profile, badge] = await Promise.all([
    UserRepository.findById(userId),
    ProfessionalProfileRepository.find(userId),
    ProfessionalBadgeRepository.badgeOf(userId, now)
  ]);

  if (!account || !profile) {
    throw new NotFoundError(NOT_FOUND);
  }

  return presentQueued({ email: account.email, name: account.name, profile }, badge !== null);
}

// --- Controller ---------------------------------------------------------------

/**
 * The practitioner's profile (PRD 025 scope 4) and the owner's first look at it
 * (criterion 18). The profile is shown to its author and to the console and to
 * nobody else; no model reads it (criterion 16). Every per-account method takes
 * the account's id from its caller — the session's for the author, the one the
 * owner named for the console — and no body ever names one.
 */
export const ProfessionalProfileController = {
  /**
   * The owner hides a profile, with its statement of reasons (`textos/06` § X):
   * refusing and hiding are **one act** (legal F6), immediate, and it takes the
   * profile off the queue. Whether the profile had been marked seen is answered
   * beside it. A 404 for an account with no profile. Who hid it is the audit
   * row's (`professional.profile_hidden`, in the same transaction): the table
   * keeps no column for it.
   */
  async hide(userId: string, ownerId: string, input: HideProfessionalProfile, now: Date = new Date()): Promise<ProfileHiding> {
    const account = await UserRepository.findById(userId);
    const hidden = account
      ? await ProfessionalProfileRepository.hide(userId, storedHiding(input), now, async tx => {
          await AuditRepository.record(
            {
              action: 'professional.profile_hidden',
              actorId: ownerId,
              entity: 'professional',
              metadata: { afterNotice: input.afterNotice, reasons: input.reasons },
              subjectUserId: userId
            },
            tx
          );
        })
      : null;

    if (!account || !hidden) {
      throw new NotFoundError(NOT_FOUND);
    }

    const badged = (await ProfessionalBadgeRepository.badgeOf(userId, now)) !== null;
    const statement = readHiding(hidden.profile);

    return {
      hadBeenSeen: hidden.hadBeenSeen,
      profile: presentQueued({ email: account.email, name: account.name, profile: hidden.profile }, badged),
      statement: statement ?? {
        afterNotice: input.afterNotice,
        at: now.toISOString(),
        facts: input.facts ?? null,
        reasons: input.reasons,
        word: input.word ?? null
      },
      to: account.email,
      userId
    };
  },

  /**
   * The owner has looked: seen, off the queue, and no longer hidden if it was —
   * the author edited it since. Never presented as an approval. A 404 for a
   * profile not on the queue; nothing is written.
   */
  async markSeen(userId: string, ownerId: string, now: Date = new Date()): Promise<QueuedProfileView> {
    const seen = await ProfessionalProfileRepository.markSeen(userId, ownerId, now, async tx => {
      await AuditRepository.record(
        { action: 'professional.profile_seen', actorId: ownerId, entity: 'professional', metadata: {}, subjectUserId: userId },
        tx
      );
    });

    if (!seen) {
      throw new NotFoundError(NOT_FOUND);
    }

    return ownerView(userId, now);
  },

  /** The author's own profile, or null before they have written one. */
  async mine(userId: string, now: Date = new Date()): Promise<ProfessionalProfileView | null> {
    const profile = await ProfessionalProfileRepository.find(userId);

    return profile ? presentProfile(profile, (await ProfessionalBadgeRepository.badgeOf(userId, now)) !== null) : null;
  },

  /** The owner's queue: every profile created or edited since the owner's last look, oldest first. Practitioners only. */
  async queue(now: Date = new Date()): Promise<ProfileQueueView> {
    const rows = await ProfessionalProfileRepository.queue();
    const badges = await ProfessionalBadgeRepository.badgesOf(
      rows.map(row => row.profile.userId),
      now
    );

    return { profiles: rows.map(row => presentQueued(row, badges.has(row.profile.userId))) };
  },

  /**
   * The author saves their profile. **The words** (PRD 025 scope 5, criterion
   * 6): every free-text field goes through `protectedWordIn` with the badge read
   * under the practitioner's badge lock as it is written
   * (`ProfessionalProfileRepository.save`); the first word refused is a 422
   * naming the field, the list and the word — `fieldErrors: { [field]:
   * ['<list>:<word>'] }`, with `list` one of `badge_only`, `never`, `result` —
   * and nothing is written. A create or a change to a free-text field puts the
   * profile on the owner's queue; the queue gates nothing.
   *
   * A 404 when the account has no practice: a profile is the practice's.
   */
  async save(userId: string, input: SaveProfessionalProfile, now: Date = new Date()): Promise<ProfessionalProfileView> {
    const outcome = await ProfessionalProfileRepository.save(userId, input, now, badged => refusalOf(input, badged));

    if (outcome.kind === 'none') {
      throw new NotFoundError(NOT_FOUND);
    }

    if (outcome.kind === 'refused') {
      const { field, list, word } = outcome.refusal;

      throw new InputParseError('A word the profile may not carry', { [field]: [`${list}:${word}`] });
    }

    return presentProfile(outcome.profile, (await ProfessionalBadgeRepository.badgeOf(userId, now)) !== null);
  }
};
