import { createHash, randomBytes } from 'node:crypto';

import { CareRepository } from '#repositories/Care';
import { HealthController } from 'core/controllers/Health';
import { isCheckInDue } from 'core/controllers/CheckIn';
import { PlanController } from 'core/controllers/Plan';
import { ProfessionalRepository } from '#repositories/Professional';
import { ProfileController } from 'core/controllers/Profile';
import { ProgressController } from 'core/controllers/Progress';
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
import { CareLinkExistsError, DatabaseOperationError, InputParseError, NotFoundError } from 'core/entities/Error';

import type { LinkWithProfessional, OpenInvitation, RecordAccess, RosterLink } from '#repositories/Care';
import type {
  AcceptInvitation,
  CareAccessAction,
  CareAccessEntry,
  CareAccessKind,
  CareHealthShared,
  CareLink,
  CareLinkStatus,
  CareShared,
  InviteClient
} from 'core/entities/Care';
import type { PlanSummaryView, PlanView } from 'core/controllers/Plan';
import type { ProgressSummaryView } from 'core/controllers/Progress';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { SharedHealthView } from 'core/controllers/Health';
import type { UpdateTargetOverride } from 'core/entities/Nutrition';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
/** One page of the client's trail, newest first. */
const ACCESS_LOG_LIMIT = 100;

/**
 * What `withClient` hands its callback beside the client's id: the link
 * without either account's id, and both names.
 */
export interface ClientAccess {
  readonly clientName: string;
  readonly link: Omit<CareLink, 'clientId' | 'professionalId'>;
  readonly professionalName: string;
}

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

/**
 * Where a linked client is, from stored state only (PRD 004, Outcome), in the
 * order a professional acts on it:
 *
 * - `onboarding` — still filling in the profile;
 * - `plan_awaiting_review` — a plan is waiting for the professional (`0060`).
 *   Part of the contract now, produced from Phase 5 on, when the
 *   `pending_review` plan status exists;
 * - `check_in_due` — the latest fortnight has ended and is unanswered;
 * - `plan_under_way` — a plan is active;
 * - `awaiting_plan` — the profile is complete and there is no plan yet.
 *
 * "Invited" is not here: an invitation has no account behind it that the
 * product may name, so it is its own list (`CareClientsView.invitations`).
 */
export type CareClientStage = 'awaiting_plan' | 'check_in_due' | 'onboarding' | 'plan_awaiting_review' | 'plan_under_way';

/**
 * A link as its professional sees it: the id every professional route takes,
 * the client's name, and what the client agreed to. Never the client's
 * account id or address.
 */
export interface CareClientLinkView {
  linkId: string;
  name: string;
  reviewBeforePublish: boolean;
  sharesHealth: boolean;
  since: string;
  status: Exclude<CareLinkStatus, 'ended'>;
}

/** One client on the professional's list. */
export interface CareClientView extends CareClientLinkView {
  /** Null while the link is paused: access is closed, so where the client is is not read. */
  stage: CareClientStage | null;
}

/**
 * The professional's list: clients with an open link (active or paused), by
 * name, and the invitations still waiting for an answer — the "invited" ones,
 * known only by the address the professional typed.
 */
export interface CareClientsView {
  clients: readonly CareClientView[];
  invitations: readonly CareInvitationView[];
}

/**
 * One client's page (PRD 004, criterion 9), read through `withClient`: the
 * plan under way and the plan history, progress (adherence per fortnight, the
 * weight line, every check-in) and the targets in effect.
 *
 * `health` is **absent from the object** — not empty, not null — unless the
 * client said yes to the separate line (criterion 12); when present it was
 * read through its own `withClient` call and left its own row in the trail.
 */
export interface CareClientOverviewView {
  client: CareClientLinkView;
  health?: SharedHealthView;
  plan: PlanView | null;
  plans: readonly PlanSummaryView[];
  progress: ProgressSummaryView;
  targets: ResolvedTargets | null;
}

/** One row of a client's own trail: who, what kind of data, read or changed, and when. */
export interface CareAccessEntryView {
  id: string;
  action: CareAccessAction;
  at: string;
  kind: CareAccessKind;
  professionalName: string;
}

/** One page of the trail, and the cursor for the next: the last entry's id, or null on the last page. */
export interface CareAccessPageView {
  entries: readonly CareAccessEntryView[];
  next: string | null;
}

function presentAccess(row: CareAccessEntry): CareAccessEntryView {
  return { id: row.id, action: row.action, at: row.createdAt.toISOString(), kind: row.kind, professionalName: row.professionalName };
}

function presentClientLink(
  link: Pick<RosterLink['link'], 'consentedAt' | 'id' | 'reviewBeforePublish' | 'sharesHealth'> & { readonly status: CareLinkStatus },
  name: string
): CareClientLinkView {
  return {
    linkId: link.id,
    name,
    reviewBeforePublish: link.reviewBeforePublish,
    sharesHealth: link.sharesHealth,
    since: link.consentedAt.toISOString(),
    // Only open links reach a professional's view: `roster` and `activeLink` both filter on it.
    status: link.status === 'paused' ? 'paused' : 'active'
  };
}

/** Where a client with an active link is, first match wins — see `CareClientStage`. */
function stageOf(row: RosterLink, today: string): CareClientStage {
  if (!row.onboarded) {
    return 'onboarding';
  }

  if (row.planPendingReview) {
    return 'plan_awaiting_review';
  }

  if (row.latestPlan && isCheckInDue(row.latestPlan, row.latestPlan.answered, today)) {
    return 'check_in_due';
  }

  return row.planActive ? 'plan_under_way' : 'awaiting_plan';
}

function presentClient(row: RosterLink, today: string): CareClientView {
  return { ...presentClientLink(row.link, row.clientName), stage: row.link.status === 'active' ? stageOf(row, today) : null };
}

function presentInvitation(row: { readonly email: string; readonly expiresAt: Date }): CareInvitationView {
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

  /**
   * The client's own trail (PRD 004, criterion 6): every time a professional
   * reached their data, newest first, `ACCESS_LOG_LIMIT` at a time — `next` is
   * the `before` of the following page, null on the last — so every row stays
   * visible however long the trail grows. The session's own rows and nobody
   * else's; a `before` that is not one of them is an empty page.
   *
   * Not behind the switch, like `myLink`: what was read about somebody is
   * theirs to see whatever the switch says. With the switch off and nothing
   * ever read, it is an empty list — the same answer every account gets.
   */
  async accessLog(session: Pick<CareSession, 'id'>, beforeId: string | null = null): Promise<CareAccessPageView> {
    if (beforeId !== null && !careLinkIdSchema.safeParse(beforeId).success) {
      throw new InputParseError('Invalid cursor', { before: ['invalid'] });
    }

    const rows = await CareRepository.accessLog(session.id, ACCESS_LOG_LIMIT + 1, beforeId);
    const entries = rows.slice(0, ACCESS_LOG_LIMIT).map(presentAccess);

    return { entries, next: rows.length > ACCESS_LOG_LIMIT ? (entries.at(-1)?.id ?? null) : null };
  },

  /**
   * The professional's list: each client with an open link, by name, with
   * where they are, and the invitations still unanswered. Behind
   * `ProfessionalGuard`.
   *
   * A stage is worked out from the client's data (onboarding, plans,
   * check-ins), so the list is a read and leaves its row (PRD 004, criterion
   * 6): **one `list` row in the trail of every client with an active link**,
   * written before the stages are read and in the same snapshot
   * (`CareRepository.roster`), so no stage is shown without its row. A paused
   * link shows its name and no stage, and writes nothing. No client id comes
   * out of it; the link id each row carries is the only way on, and every way
   * on is `withClient`.
   *
   * The switch and the grant are asked here too, as `withClient` asks them:
   * the guard is the first line, this the second for any caller that is not a
   * route.
   */
  async clients(professional: Pick<CareSession, 'id'>, now: Date = new Date()): Promise<CareClientsView> {
    if (!(await isProfessional(professional.id))) {
      throw new NotFoundError('Client not found');
    }

    const roster = await CareRepository.roster(professional.id, now);
    const today = now.toISOString().slice(0, 10);

    return { clients: roster.links.map(row => presentClient(row, today)), invitations: roster.invitations.map(presentInvitation) };
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
  },

  /**
   * One client's page, for their professional (PRD 004, criterion 9) —
   * through `withClient`, like every professional read of a client.
   *
   * **The trail gets exactly one row per kind read**: one `overview` row, and,
   * only when the link shares health, one `health` row — two for that page,
   * never more, never fewer. The health read is its own `withClient` call, so
   * it re-checks the link: a client who ended it between the two reads gets no
   * `health` row, and the page no `health` key.
   *
   * `locale` is the reader's, so the dishes are named in the professional's
   * language.
   */
  async overview(professional: Pick<CareSession, 'id'>, linkId: string, locale: string | null = null): Promise<CareClientOverviewView> {
    return CareController.withClient(professional.id, linkId, 'overview', 'read', async (clientId, access) => {
      const [plan, plans, progress, targets] = await Promise.all([
        PlanController.getActivePlan(clientId, locale),
        PlanController.listPlans(clientId),
        ProgressController.summary(clientId),
        ProfileController.targets(clientId)
      ]);
      const page: CareClientOverviewView = { client: presentClientLink(access.link, access.clientName), plan, plans, progress, targets };

      if (!access.link.sharesHealth) {
        return page;
      }

      try {
        return { ...page, health: await CareController.withClient(professional.id, linkId, 'health', 'read', HealthController.shared) };
      } catch (error: unknown) {
        if (error instanceof NotFoundError) {
          return page;
        }

        throw error;
      }
    });
  },

  /**
   * A professional sets a client's targets (PRD 004, criterion 7) — through
   * `withClient` (`targets`, `write`), so a link that is not theirs and active
   * is the same 404 with nothing written, and the client's trail gets its row
   * in the same transaction as the change — a refused target leaves none.
   *
   * It is the client's own `ProfileController.updateTargets` with the
   * professional as the setter: the same `targetViolations`, the same
   * `InputParseError` with the same sentences, and the answer is the same
   * `ResolvedTargets`, whose `setBy` now names the professional. The client's
   * screens say whose target it is from that; a client who changes it
   * afterwards makes it theirs again.
   */
  async setTargets(professional: Pick<CareSession, 'id'>, linkId: string, patch: UpdateTargetOverride): Promise<ResolvedTargets> {
    return CareController.withClient(professional.id, linkId, 'targets', 'write', (clientId, _access, record) =>
      ProfileController.updateTargets(clientId, patch, { professionalId: professional.id, record })
    );
  },

  /**
   * **The only function in the codebase that turns a professional's session
   * into another account's id** (`0059`). Every read or write a professional
   * makes on a client's data goes through here, and nothing else may resolve a
   * link for them.
   *
   * In order:
   *
   * 1. the link id must be an id at all, and the `professional` switch on —
   *    the guard asked too, this is the second line for any caller that is not
   *    a route;
   * 2. the link is resolved by `(id, professionalId, status = 'active')` with
   *    the grant still standing — one query, `CareRepository.activeLink`. A
   *    link that is someone else's, paused, ended, unknown or not an id is
   *    one `NotFoundError`, the 404 of every denial; nothing is written;
   * 3. the client's trail gets its row — who (the professional's id and name
   *    as it is now), `kind`, `action`. A read's row goes in **before** `fn`
   *    runs, so there is no read without its row; a failure to write it fails
   *    the call. A write's row goes in with the change: `fn` gets `record`
   *    and must hand it to the repository that writes, which calls it inside
   *    the write's transaction — a refused or failed write leaves no row, and
   *    a write that returns without having recorded is an error;
   * 4. `fn` gets the client's id, from the link row and never from the
   *    request, and the link without either account's id (`ClientAccess`), so
   *    a view built from it cannot carry one.
   *
   * A `health` read is refused like any other denial unless the link shares
   * health.
   *
   * Nothing is cached: ending the link closes access on the very next call.
   */
  async withClient<T>(
    professionalId: string,
    linkId: string,
    // `list` is the list's own row, written by `CareRepository.roster` alone.
    kind: Exclude<CareAccessKind, 'list'>,
    action: CareAccessAction,
    fn: (clientId: string, access: ClientAccess, record: RecordAccess) => Promise<T>
  ): Promise<T> {
    if (!careLinkIdSchema.safeParse(linkId).success || !(await switchedOn())) {
      throw new NotFoundError('Client not found');
    }

    const access = await CareRepository.activeLink(professionalId, linkId);

    // The health line is the link's own consent (PRD 004, criterion 12): asked
    // here, not left to the caller, so no caller can read health without it.
    if (!access || (kind === 'health' && !access.link.sharesHealth)) {
      throw new NotFoundError('Client not found');
    }

    const { clientId, professionalId: _professional, ...link } = access.link;
    const entry = { action, kind, professionalId, professionalName: access.professionalName };
    const view = { clientName: access.clientName, link, professionalName: access.professionalName };

    if (action === 'read') {
      await CareRepository.logAccess(clientId, entry);

      return fn(clientId, view, async () => {
        throw new DatabaseOperationError('care: a read has its row already');
      });
    }

    let recorded = false;
    const result = await fn(clientId, view, async tx => {
      await CareRepository.logAccess(clientId, entry, tx);
      recorded = true;
    });

    if (!recorded) {
      throw new DatabaseOperationError('care: a write through withClient left no row in the trail');
    }

    return result;
  }
};
