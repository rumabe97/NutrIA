import { createHash, randomBytes } from 'node:crypto';

import { CareRepository } from '#repositories/Care';
import { ProfessionalRepository } from '#repositories/Professional';
import { SettingsRepository } from '#repositories/Settings';
import { FLAGS } from 'core/domain/Flag';
import {
  CARE_CONSENT_VERSION,
  CARE_HEALTH_SHARED,
  CARE_INVITATION_TTL_DAYS,
  CARE_SHARED,
  CARE_TOKEN_PATTERN,
  careLinkIdSchema
} from 'core/entities/Care';
import { CareLinkExistsError, InputParseError, NotFoundError } from 'core/entities/Error';

import type { LinkWithProfessional, OpenInvitation } from '#repositories/Care';
import type { AcceptInvitation, CareHealthShared, CareInvitation, CareLinkStatus, CareShared, InviteClient } from 'core/entities/Care';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

// --- Presenters ---------------------------------------------------------------

/**
 * The session's account, as the care routes need it: who, at which address,
 * and whether that address is confirmed. Always the session's — an address in
 * a body or a path is one the caller chose.
 */
export interface CareSession {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

/**
 * What the professional is told after inviting: the address, as it was stored,
 * and until when the invitation works. The same shape, with nothing in it that
 * depends on whether the address has an account — because nothing behind it
 * asked.
 */
export interface CareInvitationView {
  email: string;
  expiresAt: string;
}

/**
 * What the invited client reads before answering (`0059`): who invites, the
 * consent version they would be agreeing to, what is shared, and the separate
 * health line they may add. Keys, not sentences — the screen owns the words.
 */
export interface CareInvitationDetailView {
  consentVersion: string;
  expiresAt: string;
  /** Offered as its own yes or no; shared only if the client says yes to it. */
  healthShares: readonly CareHealthShared[];
  professionalName: string;
  shares: readonly CareShared[];
}

/**
 * The client's own link: whose it is, where it stands, what it shares and
 * since when. `shares` lists everything the professional may see under it,
 * the health items included only when the client said yes to that line.
 */
export interface CareLinkView {
  id: string;
  consentVersion: string;
  professionalName: string;
  shares: readonly (CareHealthShared | CareShared)[];
  sharesHealth: boolean;
  since: string;
  status: CareLinkStatus;
}

function presentInvitation(row: CareInvitation): CareInvitationView {
  return { email: row.email, expiresAt: row.expiresAt.toISOString() };
}

function presentInvitationDetail(row: OpenInvitation): CareInvitationDetailView {
  return {
    consentVersion: CARE_CONSENT_VERSION,
    expiresAt: row.expiresAt.toISOString(),
    healthShares: CARE_HEALTH_SHARED,
    professionalName: row.professionalName,
    shares: CARE_SHARED
  };
}

function presentLink({ link, professionalName }: LinkWithProfessional): CareLinkView {
  return {
    id: link.id,
    consentVersion: link.consentVersion,
    professionalName,
    shares: link.sharesHealth ? [...CARE_SHARED, ...CARE_HEALTH_SHARED] : CARE_SHARED,
    sharesHealth: link.sharesHealth,
    since: link.consentedAt.toISOString(),
    status: link.status
  };
}

// --- Helpers ------------------------------------------------------------------

/** An address as the invitations table stores it, so a session's and an invitation's compare. */
function normalised(email: string): string {
  return email.trim().toLowerCase();
}

/** Only the hash is ever stored or compared; the token lives in one mail. */
function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Whether the `professional` switch is on — failing off (`FLAGS.professional`). */
async function switchedOn(): Promise<boolean> {
  return SettingsRepository.isEnabled(FLAGS.professional.key, FLAGS.professional.fallback);
}

/**
 * Invitations sit behind the `professional` switch: off, they do not exist — a
 * 404, like every other denial. The API's `ProfessionalSwitchGuard` asks first, before a body or
 * a path is parsed; this is the second line, for any caller that is not a route.
 *
 * A link the client already has is **not** behind it (PRD 004, criterion 4):
 * seeing it and ending it are the client's whatever the switch says.
 */
async function assertOpen(): Promise<void> {
  if (!(await switchedOn())) {
    throw new NotFoundError('Not found');
  }
}

/**
 * The account an invitation may be read or answered by: a confirmed address,
 * because anybody can register an address they do not hold, and a token that
 * is one of ours in shape. Anything else is the same 404 as a token that
 * matches nothing.
 */
function answerer(session: CareSession, token: string): { readonly email: string; readonly tokenHash: string } {
  if (!session.emailVerified || !CARE_TOKEN_PATTERN.test(token)) {
    throw new NotFoundError('Invitation not found');
  }

  return { email: normalised(session.email), tokenHash: hashOf(token) };
}

/**
 * Whether this account may act as a professional today — the switch is on and
 * the grant stands: the question `ProfessionalGuard` asks through
 * `ProfessionalController.hasAccess`, asked here for the one route both sides
 * share.
 */
async function isProfessional(userId: string): Promise<boolean> {
  return (await switchedOn()) && (await ProfessionalRepository.find(userId)) !== null;
}

// --- Controller ---------------------------------------------------------------

/**
 * The link between a professional and a client (`0059`): the invitation, the
 * client's consent, and ending it.
 *
 * Every method takes the session's account and nothing else as "who": the
 * professional's id for an invitation, the client's id **and address** for
 * answering one — the address is how an invitation is addressed, so it is the
 * ownership boundary there as `userId` is everywhere else. A link id or a
 * token names *which* thing; neither ever says whose.
 *
 * `now` is a parameter so a test can move the clock; every route passes none.
 */
export const CareController = {
  /**
   * The client accepts, knowing the list (`GET` first) and at its current
   * version: the link is made, the invitation deleted, in one transaction.
   *
   * A client with a link already gets a `CareLinkExistsError` naming it —
   * 409, and the invitation stays open, so ending that link and coming back
   * works. Every other reason there is nothing to accept is the same 404.
   */
  async accept(session: CareSession, token: string, answer: AcceptInvitation, now: Date = new Date()): Promise<CareLinkView> {
    await assertOpen();
    const { email, tokenHash } = answerer(session, token);
    const outcome = await CareRepository.accept(session.id, email, tokenHash, answer, now);

    if (outcome.kind === 'gone') {
      throw new NotFoundError('Invitation not found');
    }

    if (outcome.kind === 'exists') {
      throw new CareLinkExistsError({
        professionalName: outcome.professionalName,
        since: outcome.link.consentedAt.toISOString(),
        status: outcome.link.status === 'paused' ? 'paused' : 'active'
      });
    }

    return presentLink(outcome);
  },

  /** The client says no. The invitation is deleted; nothing is shared and no link exists. */
  async decline(session: CareSession, token: string, now: Date = new Date()): Promise<void> {
    await assertOpen();
    const { email, tokenHash } = answerer(session, token);

    if (!(await CareRepository.decline(session.id, email, tokenHash, now))) {
      throw new NotFoundError('Invitation not found');
    }
  },

  /**
   * Ends a link, from either side, in one action (PRD 004, criterion 4).
   *
   * The client first, whatever the switch says — consent is revocable, and a
   * client must be able to take theirs back even while the workspace is off: a
   * link whose `clientId` is the session's. Otherwise the professional, and
   * only while this account is one (the switch is on and the grant stands): a
   * link whose `professionalId` is the session's. Anything else — a
   * stranger's link, an ended one, an id that is nobody's, something that is
   * not an id at all — is the same 404. What ending does to access is Phase
   * 3's: every professional read resolves the link as `active`, so it closes
   * on the next request.
   */
  async end(session: CareSession, linkId: string, now: Date = new Date()): Promise<void> {
    if (!careLinkIdSchema.safeParse(linkId).success) {
      throw new NotFoundError('Link not found');
    }

    if (await CareRepository.end(session.id, 'client', linkId, now)) {
      return;
    }

    if ((await isProfessional(session.id)) && (await CareRepository.end(session.id, 'professional', linkId, now))) {
      return;
    }

    throw new NotFoundError('Link not found');
  },

  /**
   * An account is being deleted: every invitation addressed to it goes too
   * (PRD 004, criterion 14). Called from Better Auth's `beforeDelete` with the
   * deleted account's own address, and not behind the switch — deletion must
   * leave nothing whether or not the workspace is on.
   */
  async forgetAddress(email: string): Promise<void> {
    await CareRepository.forgetAddress(normalised(email));
  },

  /**
   * What an invited client reads before answering — only for the account the
   * invitation was sent to, while it is live (unanswered, not replaced) and
   * unexpired, and while its sender is still a professional. One 404 for every
   * other case.
   */
  async invitation(session: CareSession, token: string, now: Date = new Date()): Promise<CareInvitationDetailView> {
    await assertOpen();
    const { email, tokenHash } = answerer(session, token);
    const row = await CareRepository.openInvitation(session.id, email, tokenHash, now);

    if (!row) {
      throw new NotFoundError('Invitation not found');
    }

    return presentInvitationDetail(row);
  },

  /**
   * A professional invites an address (`0059`). Behind `ProfessionalGuard`:
   * the caller is a professional by the time this runs.
   *
   * Returns the token beside the view **for the mail and nothing else** — the
   * route answers the view alone. Nothing here reads whether the address has
   * an account, so the work, the answer and its timing are the same either
   * way; the mail goes out in the background for the same reason.
   *
   * The professional's own address is refused: a link to oneself is not a
   * link, and the answer reveals nothing the caller does not know.
   */
  async invite(
    professional: Pick<CareSession, 'email' | 'id'>,
    input: InviteClient,
    now: Date = new Date()
  ): Promise<{ readonly invitation: CareInvitationView; readonly token: string }> {
    const email = normalised(input.email);

    if (email === normalised(professional.email)) {
      throw new InputParseError('You cannot invite your own address', { email: ['own_address'] });
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + CARE_INVITATION_TTL_DAYS * DAY_MS);
    const row = await CareRepository.invite(professional.id, email, hashOf(token), expiresAt, now);

    return { invitation: presentInvitation(row), token };
  },

  /**
   * The client's own link, if any — `active` or `paused` — or null. Not behind
   * the switch: a client sees what they consented to whatever it says.
   */
  async myLink(session: Pick<CareSession, 'id'>): Promise<CareLinkView | null> {
    const row = await CareRepository.clientLink(session.id);

    return row ? presentLink(row) : null;
  }
};
