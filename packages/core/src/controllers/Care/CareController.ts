import { createHash, randomBytes } from 'node:crypto';

import { CareRepository, linkScope } from '#repositories/Care';
import { HealthController } from 'core/controllers/Health';
import { isCheckInDue, nudgedKcal } from 'core/controllers/CheckIn';
import { PlanController, planOnly, planOnlyJob, planOnlyMealDetail, planOnlySummary, withoutPantry } from 'core/controllers/Plan';
import { blocksPractice, PracticeRestrictionRepository, ProfessionalBadgeRepository, ProfessionalRepository } from '#repositories/Professional';
import { ProfileController } from 'core/controllers/Profile';
import { ProgressController } from 'core/controllers/Progress';
import { SettingsRepository } from '#repositories/Settings';
import { UserRepository } from '#repositories/User';
import { FLAGS } from 'core/domain/Flag';
import { personDayKey } from 'core/domain/Period';
import { protectedWordIn, shownName } from 'core/domain/ProtectedWords';
import {
  CARE_CONSENT_VERSION,
  CARE_HEALTH_SHARED,
  CARE_INVITATION_TTL_DAYS,
  CARE_SHARED,
  CARE_SHARED_PLAN,
  CARE_TOKEN_PATTERN,
  careLinkIdSchema
} from 'core/entities/Care';
import {
  CareIllnessRuleError,
  CareLinkExistsError,
  DatabaseOperationError,
  InputParseError,
  NotFoundError,
  PracticeFullError
} from 'core/entities/Error';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { presentRestriction } from 'core/controllers/Professional';

import type { LinkWithProfessional, OpenInvitation, RecordAccess, RosterLink } from '#repositories/Care';
import type { PracticeRestrictionView } from 'core/controllers/Professional';
import type {
  AcceptInvitation,
  CareAccessAction,
  CareAccessEntry,
  CareAccessKind,
  CareConsentScope,
  CareHealthShared,
  CareLink,
  CareLinkStatus,
  CareProfessionalAction,
  CareRuleEnding,
  CareShared,
  CareSharedPlan,
  InviteClient,
  ReconsentLink,
  SetClientReview,
  SetLinkHealth
} from 'core/entities/Care';
import type {
  JobView,
  MealDetailView,
  PlanOnlyMealDetailView,
  PlanOnlySummaryView,
  PlanOnlyView,
  PlanSummaryView,
  SharedPlanView
} from 'core/controllers/Plan';
import type { PracticeOfferView } from 'core/controllers/Billing';
import type { FortnightView, ProgressSummaryView } from 'core/controllers/Progress';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { SharedHealthView } from 'core/controllers/Health';
import type { UpdateTargetOverride } from 'core/entities/Nutrition';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
/** One page of the client's trail, newest first. */
const ACCESS_LOG_LIMIT = 100;

/**
 * What `withClient` hands its callback beside the client's id: the link
 * without either account's id, both names, and the `scope` the link opens on
 * this request (`0111` § 4) — the callback builds its answer for that scope.
 */
export interface ClientAccess {
  readonly clientName: string;
  readonly link: Omit<CareLink, 'clientId' | 'professionalId'>;
  readonly professionalName: string;
  readonly scope: CareConsentScope;
}

/**
 * The kinds a `plan` scope may reach (`0111` § 4, PRD 025 scope 7): the plans
 * the practitioner made through the link (`plan`, `review`) and the page that
 * shows them (`overview`, built plan-only). Every other kind — `progress`,
 * `targets`, `health`, and any kind added later — is refused, so a new kind is
 * closed to a `plan` scope until somebody opens it here on purpose.
 */
const PLAN_SCOPE_KINDS: ReadonlySet<CareAccessKind> = new Set<CareAccessKind>(['overview', 'plan', 'review']);

/**
 * What only `apps/api` can do for a client — start a generation, swap a meal —
 * because it alone may reach the model (`modules/ai`). Handed in by the route's
 * service and called **inside** `withClient`, with the client's id from the
 * link and the write's `record`, which the writing repository calls in its own
 * transaction (`PlanJobController.start`, `PlanRepository.swapMeal`).
 */
export type ForClient<T> = (clientId: string, record: RecordAccess) => Promise<T>;

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
 * A practitioner's badge as a client may read it (`0111` § 2, `docs/legal/textos/05`
 * § F.1): the number and the day of the owner's `pass` check, never a number the
 * practitioner typed (PLAN 025 phase 3, step 6).
 */
export interface CareBadgeLineView {
  /** When NutrIA checked the register, as an instant: the screen formats the day. */
  checkedAt: string;
  /** The collegiate number the check confirmed; null on a check that recorded none. */
  collegiateNumber: string | null;
}

/**
 * What the invited client reads before answering (`0059`): who invites, the
 * consent version they would be agreeing to, what is shared, and the separate
 * health line they may add. Keys, not sentences — the screen owns the words.
 *
 * **The list is the tier's** (`0111` § 4, PLAN 025 phase 5 step 1), picked by
 * the inviter's badge as it stands now: `scope: 'full'` — the badge — is
 * `shares` with `healthShares` beside it and `badge` set; `scope: 'plan'` — no
 * badge — is `sharesPlan`, with `shares` and `healthShares` empty, `badge` null
 * and `collegiateNumber` empty: no health line, and no number nobody checked.
 */
export interface CareInvitationDetailView {
  /** The badge line, under the badge only; null without it. */
  badge: CareBadgeLineView | null;
  /**
   * The badge's collegiate number, or `''` without the badge. Kept for today's
   * screen; `badge` is what the tiered screen reads.
   */
  collegiateNumber: string;
  consentVersion: string;
  expiresAt: string;
  /** Offered as its own yes or no; shared only if the client says yes to it. Empty without the badge. */
  healthShares: readonly CareHealthShared[];
  professionalName: string;
  /** Which list this is, so accepting can say which one the client read (`acceptInvitationSchema.consentScope`). */
  scope: CareConsentScope;
  /** The badged list; empty without the badge. */
  shares: readonly CareShared[];
  /** The plan-only list (`CARE_SHARED_PLAN`); empty with the badge. */
  sharesPlan: readonly CareSharedPlan[];
}

/**
 * The client's own link: whose it is, where it stands, what it shares and
 * since when. `shares` lists everything the professional may see under it,
 * the health items included only when the client said yes to that line.
 *
 * **What it shares is what it opens now** (`0111` § 4, PLAN 025 phase 5 step
 * 1): under a `full` scope, `shares`; under `plan` — no badge now, or consent to
 * the plan-only list — `sharesPlan`, and `shares` is empty. `sharesHealth` is the
 * client's own choice as stored, theirs to see and take back whatever the scope.
 */
export interface CareLinkView {
  id: string;
  /**
   * Whether the link was accepted at today's `CARE_CONSENT_VERSION`. False on a
   * link accepted under an older list: it stays a link, and the screen may say
   * the list has changed.
   */
  consentIsCurrent: boolean;
  /** Which list the client consented to: `full`, the badged one, or `plan`. */
  consentScope: CareConsentScope;
  consentVersion: string;
  /**
   * The practitioner's account name as it may be shown now (`shownName`), or
   * null when it carries a title the account may not use — the screen then says
   * «tu profesional» (invariant review of phase 6, round two).
   */
  professionalName: string | null;
  /**
   * Whether the practitioner holds NutrIA's badge now. False is when the health
   * screen warns before a condition or a medication is saved
   * (`health.illnessLinkWarning`, `docs/legal/textos/05` § G.1): saving one ends
   * this link (`0111` § 8).
   */
  professionalVerified: boolean;
  /**
   * Whether the badged list is on offer (`docs/legal/textos/05` § F.4): the link
   * is consented to `plan` and the badge stands now. `POST /care/links/me/consent`
   * widens it; the offer goes the moment the badge does.
   */
  reconsentOffered: boolean;
  /** What the link opens now: `full` only with the badge and the badged consent both. */
  scope: CareConsentScope;
  /** The badged list, under a `full` scope; empty under `plan`. */
  shares: readonly (CareHealthShared | CareShared)[];
  sharesHealth: boolean;
  /** The plan-only list, under a `plan` scope; empty under `full`. */
  sharesPlan: readonly CareSharedPlan[];
  since: string;
  status: CareLinkStatus;
}

/**
 * The client's latest link, when the illness rule ended it (`0111` § 8). What
 * the client's own screen needs to say so plainly (`docs/legal/textos/05` §
 * G.3), and nothing about the record itself: `reason` picks the approved
 * sentence — `badge_lost`, the practitioner lost NutrIA's badge while the client
 * had a condition or a medication on record (`care.illnessEndedBadgeBody`);
 * `declared`, the client saved one while linked to a practitioner without it
 * (`care.illnessEndedBody`).
 */
export interface CareEndedLinkView {
  endedAt: string;
  /** As `CareLinkView.professionalName`: null when the name may not be shown now. */
  professionalName: string | null;
  reason: CareRuleEnding;
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
 * A fortnight's check-in as the professional reads it, plus `suggestedKcal`
 * (PRD 004, criterion 10, owner's decision 2026-09-24): the kcal `submit`'s
 * nudge would move to, computed from the *current* targets — not stored, not
 * what a skipped nudge would have set back when it was skipped, because
 * nothing preserves that. Null on "right", and whenever the clamp leaves the
 * number where it is.
 */
export interface CareCheckInView extends NonNullable<FortnightView['checkIn']> {
  suggestedKcal: number | null;
}

/** A fortnight as the professional reads it: the client's own shape, its check-in carrying `suggestedKcal`. */
export interface CareFortnightView extends Omit<FortnightView, 'checkIn'> {
  checkIn: CareCheckInView | null;
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
  plan: SharedPlanView | null;
  plans: readonly PlanSummaryView[];
  progress: Omit<ProgressSummaryView, 'fortnights'> & { fortnights: readonly CareFortnightView[] };
  targets: ResolvedTargets | null;
}

/**
 * One client's page through a `plan` scope (`0111` § 4, PRD 025 criterion 9):
 * the plan under way and the history, **each only if made through this link**,
 * presented plan-only (`PlanOnlyView`). `progress`, `targets` and `health` are
 * **absent from the object** — not empty, not null — as `health` is on the
 * full page without the health line.
 */
export interface CareClientPlanOverviewView {
  client: CareClientLinkView;
  plan: PlanOnlyView | null;
  plans: readonly PlanOnlySummaryView[];
}

/**
 * What `GET /care/clients/:linkId` answers: the full page or the plan-only one,
 * by the link's scope on that request. Told apart by `'progress' in page`.
 */
export type CareClientPageView = CareClientOverviewView | CareClientPlanOverviewView;

/** A client's plan as their practitioner reads it: the shared plan under a `full` scope, plan-only under `plan`. */
export type CareClientPlanView = PlanOnlyView | SharedPlanView;

/** A swapped meal as the practitioner reads it: without `status` under a `plan` scope. */
export type CareClientMealView = MealDetailView | PlanOnlyMealDetailView;

/**
 * Where the professional's practice stands (`0061`): whether it is paid for,
 * how many active clients the plan includes, and how many seats are taken —
 * active links, and invitations still live, which count too. Counts only:
 * nothing here names a client, so reading it leaves no row in any trail.
 */
export interface CarePracticeStandingView {
  activeClients: number;
  /** When the version on record was accepted, or null if never. */
  agreementAcceptedAt: string | null;
  /**
   * True until the professional has accepted the current
   * `PROFESSIONAL_AGREEMENT_VERSION` (`docs/legal/textos/01`, `04`): the page
   * shows the agreement instead of the practice, and no client route or
   * practice checkout opens.
   */
  agreementRequired: boolean;
  /** The version to accept: today's `PROFESSIONAL_AGREEMENT_VERSION`. */
  agreementVersion: string;
  /** What a paid practice plan includes (`0061`); zero on a practice nobody pays for. Not the limit: `seats` is. */
  includedClients: number;
  /** Whether a practice plan is paid for. Not whether the practice works: a free one does (PRD 025 scope 2). */
  open: boolean;
  pendingInvitations: number;
  /** What the owner has standing against the practice (PRD 025 scope 16), or null. */
  restriction: PracticeRestrictionView | null;
  /**
   * **The limit**: active clients plus live invitations may not reach it — the
   * paid plan's `includedClients`, or the free practice's `practiceClients`
   * (`0111` § 6), resolved as `invite` resolves it, so the number shown is the
   * number enforced.
   */
  seats: number;
}

/**
 * The workspace's own page (`GET /care/practice`), open to a professional
 * whether or not the practice is paid for — it is where the way to pay is
 * shown. `billing` is what checkout can open with.
 */
export interface CarePracticeView extends CarePracticeStandingView {
  billing: PracticeOfferView;
  /**
   * True while the professional can sign in with a password and has not turned
   * the authenticator app on (PLAN 011 phase 6, `secondFactorMissing`): no
   * client route opens, and the page says to turn it on in "Seguridad". The
   * API adds it from the session, as it adds `billing`.
   */
  secondFactorRequired: boolean;
}

/**
 * One row of a client's own trail: who, what kind of data, read or changed, and
 * when. `granted` and `withdrawn` (only with `kind: 'health'`) are the client's
 * own act of starting or stopping sharing the health line. `linkId` is the link
 * it happened under — the client's own link ids, never an account's id — and
 * null on an older row no single link fits, or once the link went with an account.
 */
export interface CareAccessEntryView {
  id: string;
  action: CareAccessAction;
  at: string;
  kind: CareAccessKind;
  linkId: string | null;
  professionalName: string;
}

/** One page of the trail, and the cursor for the next: the last entry's id, or null on the last page. */
export interface CareAccessPageView {
  entries: readonly CareAccessEntryView[];
  next: string | null;
}

function presentAccess(row: CareAccessEntry): CareAccessEntryView {
  return {
    id: row.id,
    action: row.action,
    at: row.createdAt.toISOString(),
    kind: row.kind,
    linkId: row.linkId,
    professionalName: row.professionalName
  };
}

/**
 * A link as its professional sees it. `sharesHealth` is shown only under a
 * `full` scope (`0111` § 4): under `plan` the health line opens nothing, and a
 * `true` left from a badged time would still tell an un-badged practitioner
 * that the client shares conditions — so it reads `false`.
 */
function presentClientLink(
  link: Pick<RosterLink['link'], 'consentedAt' | 'id' | 'reviewBeforePublish' | 'sharesHealth'> & { readonly status: CareLinkStatus },
  name: string,
  scope: CareConsentScope
): CareClientLinkView {
  return {
    linkId: link.id,
    name,
    reviewBeforePublish: link.reviewBeforePublish,
    sharesHealth: scope === 'full' && link.sharesHealth,
    since: link.consentedAt.toISOString(),
    // Only open links reach a professional's view: `roster` and `activeLink` both filter on it.
    status: link.status === 'paused' ? 'paused' : 'active'
  };
}

/**
 * Where a client with an active link is, first match wins — see `CareClientStage`.
 * A check-in is due on the client's own day, in the zone their profile keeps.
 * Never `check_in_due` under a `plan` scope (`0111` § 4): a check-in is not the
 * practitioner's to know about, so that stage folds into `plan_under_way` — and
 * the repository has not carried `latestPlan` for such a row anyway.
 */
function stageOf(row: RosterLink, now: Date): CareClientStage {
  if (!row.onboarded) {
    return 'onboarding';
  }

  if (row.planPendingReview) {
    return 'plan_awaiting_review';
  }

  if (row.scope === 'full' && row.latestPlan && isCheckInDue(row.latestPlan, row.latestPlan.answered, personDayKey(now, row.latestPlan.timeZone))) {
    return 'check_in_due';
  }

  return row.planActive ? 'plan_under_way' : 'awaiting_plan';
}

function presentClient(row: RosterLink, now: Date): CareClientView {
  return { ...presentClientLink(row.link, row.clientName, row.scope), stage: row.link.status === 'active' ? stageOf(row, now) : null };
}

function presentInvitation(row: { readonly email: string; readonly expiresAt: Date }): CareInvitationView {
  return { email: row.email, expiresAt: row.expiresAt.toISOString() };
}

/**
 * The client's own progress, with `suggestedKcal` added to each check-in —
 * computed against `targets` as they stand today, never stored (PRD 004,
 * criterion 10). Only `overview` builds this: the client's own
 * `GET /progress/summary` never carries a professional's suggestion.
 */
function presentProgress(progress: ProgressSummaryView, targets: ResolvedTargets | null): CareClientOverviewView['progress'] {
  return {
    ...progress,
    fortnights: progress.fortnights.map((fortnight): CareFortnightView => ({
      ...fortnight,
      checkIn: fortnight.checkIn && {
        ...fortnight.checkIn,
        suggestedKcal: targets && fortnight.checkIn.hunger ? nudgedKcal(fortnight.checkIn.hunger, targets) : null
      }
    }))
  };
}

/**
 * The invitation as the client reads it, by the inviter's badge now (`0111` §
 * 4): the badged list, the health line and the checked number with the badge;
 * the plan-only list, no health line and no number without it.
 */
function presentInvitationDetail(row: OpenInvitation): CareInvitationDetailView {
  const common = { consentVersion: CARE_CONSENT_VERSION, expiresAt: row.expiresAt.toISOString(), professionalName: row.professionalName };

  if (!row.badge) {
    return { ...common, badge: null, collegiateNumber: '', healthShares: [], scope: 'plan', shares: [], sharesPlan: CARE_SHARED_PLAN };
  }

  return {
    ...common,
    badge: { checkedAt: row.badge.checkedAt.toISOString(), collegiateNumber: row.badge.number },
    collegiateNumber: row.badge.number ?? '',
    healthShares: CARE_HEALTH_SHARED,
    scope: 'full',
    shares: CARE_SHARED,
    sharesPlan: []
  };
}

/**
 * The client's own link, with what it opens now: `badged` is the practitioner's
 * badge read for this answer (`0111` § 4), never cached.
 */
function presentLink({ link, professionalName }: LinkWithProfessional, badged: boolean): CareLinkView {
  const scope = linkScope(link.consentScope, badged);

  return {
    id: link.id,
    consentIsCurrent: link.consentVersion === CARE_CONSENT_VERSION,
    consentScope: link.consentScope,
    consentVersion: link.consentVersion,
    // Judged at every read, with the badge read for this answer: null when it may not be shown now (round two).
    professionalName: shownName(professionalName, badged),
    professionalVerified: badged,
    reconsentOffered: link.consentScope === 'plan' && badged && link.status !== 'ended',
    scope,
    shares: scope !== 'full' ? [] : link.sharesHealth ? [...CARE_SHARED, ...CARE_HEALTH_SHARED] : CARE_SHARED,
    sharesHealth: link.sharesHealth,
    sharesPlan: scope === 'full' ? [] : CARE_SHARED_PLAN,
    since: link.consentedAt.toISOString(),
    status: link.status
  };
}

/** `presentLink`, with the practitioner's badge read now. */
async function linkView(row: LinkWithProfessional, now: Date): Promise<CareLinkView> {
  return presentLink(row, (await ProfessionalBadgeRepository.badgeOf(row.link.professionalId, now)) !== null);
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

/**
 * Whether this account may work with clients today: a professional, as
 * `isProfessional`, who has accepted the current agreement
 * (`docs/legal/textos/01`) and is neither suspended nor closed (PRD 025
 * criterion 24, `PracticeRestrictionRepository.standing`) — the question
 * `ProfessionalGuard` asks for every client route, asked again here as the
 * second line. **Whether anybody pays is not asked** (PRD 025 scope 2): a free
 * practice works, with its free seats.
 */
async function practises(userId: string, now: Date = new Date()): Promise<boolean> {
  const row = (await switchedOn()) ? await ProfessionalRepository.find(userId) : null;

  if (row?.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION) {
    return false;
  }

  return !blocksPractice(await PracticeRestrictionRepository.standing(userId), now);
}

/**
 * Whether a practitioner's account name may be shown to a client now
 * (invariant review of phase 6, P1-2 and round two): `shownName`, the one judge
 * — titles only, with the badge as it stands. The invitation and its mail, the
 * acceptance and the decline refuse under a name that fails it; the client's
 * link and its endings show null in its place.
 */
function nameShown(name: string, badged: boolean): boolean {
  return shownName(name, badged) !== null;
}

/**
 * The free practice's seats for this practitioner (`0111` § 6): the
 * `practiceClients` allowance of their own account's tier, resolved from what
 * the console stored (`0097`). Handed to `CareRepository.invite`, which asks it
 * inside the invitation's transaction, and read by the practice's page, so the
 * number a screen shows is the number enforced.
 */
async function freeSeats(professionalId: string): Promise<number> {
  return (await PlanController.limitsOf(professionalId)).practiceClients;
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
   *
   * The link records the list the client consented to — `full` only with the
   * badge standing now and no word from the client that they read the plan-only
   * one (`CareRepository.accept`). A client with a condition or a medication on
   * record, invited by a practitioner without the badge, gets a
   * `CareIllnessRuleError` — 409 `CARE_ILLNESS_RULE`, naming nothing — and the
   * invitation stays open, unanswered (`0111` § 8). Nothing reaches the
   * practitioner either way (legal F4): this method queues nothing.
   */
  async accept(session: CareSession, token: string, answer: AcceptInvitation, now: Date = new Date()): Promise<CareLinkView> {
    await assertOpen();
    const { email, tokenHash } = answerer(session, token);
    const outcome = await CareRepository.accept(session.id, email, tokenHash, answer, now, nameShown);

    if (outcome.kind === 'gone') {
      throw new NotFoundError('Invitation not found');
    }

    if (outcome.kind === 'refused') {
      throw new CareIllnessRuleError();
    }

    if (outcome.kind === 'exists') {
      // The client's existing practitioner, named as their link names them: judged with that practitioner's badge now.
      const badged = (await ProfessionalBadgeRepository.badgeOf(outcome.link.professionalId, now)) !== null;

      throw new CareLinkExistsError({
        professionalName: shownName(outcome.professionalName, badged),
        since: outcome.link.consentedAt.toISOString(),
        status: outcome.link.status === 'paused' ? 'paused' : 'active'
      });
    }

    return linkView(outcome, now);
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
   * The client's own professional, by id and address, if their link is
   * `active` (PRD 004, criterion 10) — for a caller that must tell them
   * something happened, never a client-facing screen: `myLink` is that, and
   * deliberately withholds both. Also asks the grant still stands
   * (`ProfessionalRepository.find`), not only the link's status: a link stays
   * `active` after a revoked grant closes reads through `withClient` (Phase 3),
   * and a former professional is not told about a client they can no longer
   * reach — nor is one whose practice has lapsed or who has not accepted the
   * current agreement, whom `withClient` refuses too. Not behind the switch, like `myLink`: the link itself is what
   * decides whether telling the professional still makes sense.
   *
   * **Only under a `full` scope** (`0111` § 4, PRD 025 criterion 10): that a
   * check-in happened is the client's check-ins, which a `plan` scope never
   * reaches — so a practitioner without the badge, or whose client has not
   * consented to the badged list, is told nothing. The badge is read now.
   */
  async activeProfessional(clientId: string, now: Date = new Date()): Promise<{ readonly id: string; readonly email: string } | null> {
    const link = await CareRepository.clientLink(clientId);

    if (!link || link.link.status !== 'active') {
      return null;
    }

    // Practising, as `withClient` asks it: an agreement not accepted, a suspension or a close come is not told either.
    // Whether anybody pays is not asked (PRD 025 scope 2).
    const [grant, badge, standing] = await Promise.all([
      ProfessionalRepository.find(link.link.professionalId),
      ProfessionalBadgeRepository.badgeOf(link.link.professionalId, now),
      PracticeRestrictionRepository.standing(link.link.professionalId)
    ]);

    if (grant?.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION || blocksPractice(standing, now)) {
      return null;
    }

    if (linkScope(link.link.consentScope, badge !== null) !== 'full') {
      return null;
    }

    const professional = await UserRepository.findById(link.link.professionalId);

    return professional ? { id: professional.id, email: professional.email } : null;
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
   * The switch, the practice, its agreement and any restriction are asked here
   * too, as `withClient` asks them: the guard is the first line, this the second
   * for any caller that is not a route.
   */
  async clients(professional: Pick<CareSession, 'id'>, now: Date = new Date()): Promise<CareClientsView> {
    if (!(await practises(professional.id, now))) {
      throw new NotFoundError('Client not found');
    }

    const roster = await CareRepository.roster(professional.id, now);

    return { clients: roster.links.map(row => presentClient(row, now)), invitations: roster.invitations.map(presentInvitation) };
  },

  /** The client says no. The invitation is deleted; nothing is shared and no link exists. */
  async decline(session: CareSession, token: string, now: Date = new Date()): Promise<void> {
    await assertOpen();
    const { email, tokenHash } = answerer(session, token);

    const declined = await CareRepository.decline(session.id, email, tokenHash, now);

    if (!declined) {
      throw new NotFoundError('Invitation not found');
    }

    // Invariant review of phase 6, P3: the client may decline an invitation from an inviter suspended, closed or
    // under a name that may not be shown — the invitation and its address are deleted all the same — but the answer
    // is the 404 the page and the acceptance give for that same invitation, so declining teaches nothing they did not.
    const [reachable, badge] = await Promise.all([
      CareRepository.reachable(declined.professionalId, now),
      ProfessionalBadgeRepository.badgeOf(declined.professionalId, now)
    ]);

    if (!reachable || !nameShown(declined.professionalName, badge !== null)) {
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
   * on the next request. A professional whose practice has lapsed may still
   * end a link: ending one is a way up from a full practice, and a lapse must
   * not trap a link either side wants gone.
   *
   * The targets the professional set stay, and become the client's own, in
   * the same transaction (owner's decision, 2026-09-24; `CareRepository.end`).
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
   * The client's latest link, when the illness rule ended it (`0111` § 8) — the
   * sweep (`badge_lost`) or their own declaration (`declared`) — with which, or
   * null: what their profile explains (`docs/legal/textos/05` § G.3), as the mail
   * of `textos/06` § Y promises, and even when the answer to a save was lost. The
   * session's own links and nobody else's. Not behind the switch, like `myLink`:
   * what happened to a link is the client's to read whatever it says.
   */
  async endedLink(session: Pick<CareSession, 'id'>): Promise<CareEndedLinkView | null> {
    const row = await CareRepository.lastEndedByRule(session.id);

    if (!row) {
      return null;
    }

    // Judged now, with that practitioner's badge read as `decline` reads it (round two).
    const badged = (await ProfessionalBadgeRepository.badgeOf(row.professionalId, new Date())) !== null;

    return { endedAt: row.endedAt.toISOString(), professionalName: shownName(row.professionalName, badged), reason: row.reason };
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
   * The daily sweep's part (`/cron/reminders`): every expired invitation is
   * deleted, so no address outlives its invitation by more than a day, as the invitation mail promises,
   * even when nobody invites anybody for a while. Answers how many went.
   */
  async forgetExpiredInvitations(now: Date = new Date()): Promise<number> {
    return CareRepository.forgetExpired(now);
  },

  /**
   * A professional generates a plan for their client (`0060`) — a first one,
   * or a regeneration of the plan under review, which replaces it
   * (`PlanRepository.createPlanAtomically`). Through `withClient` (`review`,
   * `write`); `start` is the API's `PlanJobRunner`, which counts it against
   * the client's allowance exactly as the client's own generation would and
   * writes the trail row with the job, so a refused one leaves neither. With
   * review on the plan waits for the professional; with it off, a client with
   * no plan gets it active at once, as their own would be.
   *
   * **Only when there is a reason** (owner's decisions, `0060` and
   * 2026-09-24): a plan is pending — a regeneration, which lands pending again
   * whatever the review toggle says (`PlanRepository.createPlanAtomically`) —
   * the client has no active plan, or its fortnight has ended, which starts the
   * next one exactly as the client's own would (`PlanController.professionalMayGenerate`).
   * A professional never replaces a fortnight under way; any other request is
   * the same 404, and writes nothing. `start` asks again under its claim.
   */
  async generatePlan(professional: Pick<CareSession, 'id'>, linkId: string, start: ForClient<JobView>): Promise<JobView> {
    return CareController.withClient(professional.id, linkId, 'review', 'write', async (clientId, access, record) => {
      if (!(await PlanController.professionalMayGenerate(clientId))) {
        throw new NotFoundError('Client not found');
      }

      // The plan it makes carries this link (`PlanRepository.createPlanAtomically`, `0111` § 5).
      const job = await start(clientId, record);

      return access.scope === 'full' ? job : planOnlyJob(job);
    });
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

    // A name that may not be shown now reads as no invitation at all (invariant review of phase 6, P1-2), as `accept` answers it.
    if (!row || !nameShown(row.professionalName, row.badge !== null)) {
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
   *
   * The practice's seats are the limit (`0061`, `0111` § 6, PRD 025 criterion
   * 7): with active links plus live invitations at the paid plan's
   * `includedClients` — or, for a practice nobody pays for, at the free
   * `practiceClients`, resolved inside the invitation's transaction — a
   * `PracticeFullError` naming the number, 409 `PRACTICE_FULL`. A practice
   * suspended, closed or without the current agreement is a 404, as the guard
   * answers it; this is the second line.
   */
  async invite(
    professional: Pick<CareSession, 'email' | 'id'>,
    input: InviteClient,
    now: Date = new Date()
  ): Promise<{ readonly invitation: CareInvitationView; readonly inviterName: string; readonly token: string }> {
    const email = normalised(input.email);

    if (email === normalised(professional.email)) {
      throw new InputParseError('You cannot invite your own address', { email: ['own_address'] });
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + CARE_INVITATION_TTL_DAYS * DAY_MS);
    const outcome = await CareRepository.invite(
      professional.id,
      email,
      hashOf(token),
      expiresAt,
      now,
      () => freeSeats(professional.id),
      (name, badged) => protectedWordIn(name, badged, 'name')
    );

    if (outcome.kind === 'closed') {
      throw new NotFoundError('Not found');
    }

    // The account's name, which the mail, the client's page, link and trail all show: judged as the profile's words are.
    if (outcome.kind === 'name_refused') {
      throw new InputParseError('A word the name may not carry', { name: [`${outcome.refusal.list}:${outcome.refusal.word}`] });
    }

    if (outcome.kind === 'full') {
      throw new PracticeFullError(outcome.includedClients);
    }

    return { invitation: presentInvitation(outcome.invitation), inviterName: outcome.inviterName, token };
  },

  /**
   * The client's own link, if any — `active` or `paused` — or null. Not behind
   * the switch: a client sees what they consented to whatever it says.
   */
  async myLink(session: Pick<CareSession, 'id'>, now: Date = new Date()): Promise<CareLinkView | null> {
    const row = await CareRepository.clientLink(session.id);

    return row ? linkView(row, now) : null;
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
   *
   * Each check-in in `progress.fortnights` carries `suggestedKcal` (PRD 004,
   * criterion 10): the kcal the portion nudge would set from today's targets,
   * whether or not it was ever applied — behind this audited read alone, never
   * in the mail or push that told the professional the check-in happened.
   *
   * Under a `plan` scope (`0111` § 4) the page is `CareClientPlanOverviewView`:
   * the plan under way and the history made through this link, plan-only, one
   * `overview` row, and no `progress`, `targets` or `health` key — none of the
   * three is even read.
   */
  async overview(professional: Pick<CareSession, 'id'>, linkId: string, locale: string | null = null): Promise<CareClientPageView> {
    return CareController.withClient(professional.id, linkId, 'overview', 'read', async (clientId, access): Promise<CareClientPageView> => {
      // A `plan` scope (`0111` § 4): only the plans made through this link, plan-only,
      // and nothing else read at all — progress, targets and health are never loaded.
      if (access.scope !== 'full') {
        const [active, history] = await Promise.all([
          PlanController.getActivePlan(clientId, locale, linkId),
          PlanController.listPlans(clientId, undefined, undefined, 'professional', linkId)
        ]);

        return {
          client: presentClientLink(access.link, access.clientName, access.scope),
          plan: planOnly(withoutPantry(active)),
          plans: history.map(planOnlySummary)
        };
      }

      const [plan, plans, progress, targets] = await Promise.all([
        // Stripped of what the client's cupboard did: four counts no care screen
        // reads, kept off this boundary by decision (`legal` P2-9, 2026-11-03).
        PlanController.getActivePlan(clientId, locale).then(withoutPantry),
        // `professional`: the tier being read is the client's, and a dietitian who
        // cannot see what their client was served cannot do this job (`0021` § *Amended*).
        PlanController.listPlans(clientId, undefined, undefined, 'professional'),
        ProgressController.summary(clientId, undefined, 'professional'),
        ProfileController.targets(clientId)
      ]);
      const page: CareClientOverviewView = {
        client: presentClientLink(access.link, access.clientName, access.scope),
        plan,
        plans,
        progress: presentProgress(progress, targets),
        targets
      };

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
   * The plan waiting for the professional's review (`0060`), or null —
   * through `withClient` (`review`, `read`), in the reader's language.
   */
  async pendingPlan(professional: Pick<CareSession, 'id'>, linkId: string, locale: string | null = null): Promise<CareClientPlanView | null> {
    return CareController.withClient(professional.id, linkId, 'review', 'read', async (clientId, access) =>
      access.scope === 'full'
        ? withoutPantry(await PlanController.getPendingPlan(clientId, locale))
        : // Only a plan made through this link (`0111` § 5), plan-only.
          planOnly(withoutPantry(await PlanController.getPendingPlan(clientId, locale, linkId)))
    );
  },

  /**
   * One of the client's generations, as their professional follows it
   * (`review`, `read`): the plan id is carried even while the plan waits for
   * review. A job of anybody else is not found.
   */
  async planJob(professional: Pick<CareSession, 'id'>, linkId: string, jobId: string): Promise<JobView> {
    if (!careLinkIdSchema.safeParse(jobId).success) {
      throw new NotFoundError('Job not found');
    }

    return CareController.withClient(professional.id, linkId, 'review', 'read', async (clientId, access) =>
      access.scope === 'full'
        ? PlanController.getJob(clientId, jobId, 'professional')
        : // A job whose plan was made through another link, or none, is not found (`0111` § 5).
          planOnlyJob(await PlanController.getJob(clientId, jobId, 'professional', { id: linkId, since: access.link.createdAt }))
    );
  },

  /**
   * Where the professional's own practice stands (`0061`) — for the workspace
   * page, which opens whether or not it is paid for, because it is where the
   * way to pay is shown. Counts only: no client is read, and no trail row is
   * written. A 404 unless the switch is on and the account has a practice.
   *
   * `seats` is the number `invite` enforces, resolved the same way (`freeSeats`,
   * `0097`): the paid plan's `includedClients`, or the free `practiceClients`.
   * `restriction` is what the owner has standing against the practice, so the
   * page can say it — a suspended practitioner still reaches this page, never a
   * client.
   */
  async practice(professional: Pick<CareSession, 'id'>, now: Date = new Date()): Promise<CarePracticeStandingView> {
    const row = (await switchedOn()) ? await ProfessionalRepository.find(professional.id) : null;

    if (!row) {
      throw new NotFoundError('Not found');
    }

    const [use, seats, standing] = await Promise.all([
      CareRepository.practiceUse(professional.id, now),
      row.practiceOpen ? Promise.resolve(row.includedClients) : freeSeats(professional.id),
      PracticeRestrictionRepository.standing(professional.id)
    ]);

    return {
      ...use,
      agreementAcceptedAt: row.agreementAcceptedAt?.toISOString() ?? null,
      agreementRequired: row.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION,
      agreementVersion: PROFESSIONAL_AGREEMENT_VERSION,
      includedClients: row.includedClients,
      open: row.practiceOpen,
      restriction: presentRestriction(standing, now),
      seats
    };
  },

  /**
   * Publishes the plan under review (`0060`): the client's active plan is
   * completed and this one becomes it, with the trail row, in one transaction
   * (`review`, `write`). Nothing pending is the same 404, and writes nothing.
   */
  async publishPlan(professional: Pick<CareSession, 'id'>, linkId: string, locale: string | null = null): Promise<CareClientPlanView> {
    return CareController.withClient(professional.id, linkId, 'review', 'write', async (clientId, access, record) => {
      // The plan carries this link from here on (`0111` § 5); a `plan` scope publishes only a plan made through it.
      const published = withoutPantry(await PlanController.publish(clientId, record, { id: linkId, only: access.scope !== 'full' }, locale));

      return access.scope === 'full' ? published : planOnly(published);
    });
  },

  /**
   * The client widens their own open link to the badged list (`0111` § 4,
   * `docs/legal/textos/05` § F.4), at the current version — only a link consented
   * to `plan`, and only while the practitioner's badge stands. Every other case —
   * no open link, one already `full`, no badge now — is the same 404, and writes
   * nothing. Behind the switch, like accepting: it is a consent given, not one
   * taken back. The health line stays off until the client turns it on
   * (`setSharesHealth`). No trail row: the trail records what a professional
   * reached and the health line's yes and no, and no action of it fits a list
   * widened.
   */
  async reconsent(session: Pick<CareSession, 'id'>, input: ReconsentLink, now: Date = new Date()): Promise<CareLinkView> {
    // The switch off is one more "nothing to widen": the same 404, byte for byte, as every other refusal here.
    const row = (await switchedOn()) ? await CareRepository.reconsent(session.id, input.consentVersion, now) : null;

    if (!row) {
      throw new NotFoundError('Link not found');
    }

    return linkView(row, now);
  },

  /**
   * Turns review before publishing on or off (`review`, `write`). Turning it
   * off publishes nothing: a plan already pending stays pending until the
   * professional publishes it or a newer plan replaces it.
   */
  async setReview(professional: Pick<CareSession, 'id'>, linkId: string, input: SetClientReview): Promise<CareClientLinkView> {
    return CareController.withClient(professional.id, linkId, 'review', 'write', async (_clientId, access, record) => {
      const link = await CareRepository.setReview(professional.id, linkId, input.reviewBeforePublish, record);

      if (!link) {
        throw new NotFoundError('Client not found');
      }

      return presentClientLink(link, access.clientName, access.scope);
    });
  },

  /**
   * The client starts or stops sharing the health line on their own link —
   * `active` or `paused` — without ending it (`docs/legal/analysis.md` P0-1;
   * RGPD art. 7.3). The session's link and nobody else's: no link is a 404.
   *
   * Not behind the switch, like `myLink` and `end`: consent stays the client's
   * to change whatever it says. Each change leaves a `health` row in the
   * client's trail — `granted` or `withdrawn` — in the same transaction;
   * asking for what already holds changes nothing and leaves none. Off closes
   * the professional's health read on the very next request, because
   * `withClient` reads the link afresh every time.
   *
   * **On is refused outside `full`** (`0111` § 4, PRD 025 criterion 11): with
   * the practitioner's badge not standing now, or the link consented to the
   * plan-only list, turning the line on is the same 404 as no link, and nothing
   * is written. Off always works.
   */
  async setSharesHealth(session: Pick<CareSession, 'id'>, input: SetLinkHealth, now: Date = new Date()): Promise<CareLinkView> {
    const row = await CareRepository.setSharesHealth(session.id, input.sharesHealth, now);

    if (!row) {
      throw new NotFoundError('Link not found');
    }

    return linkView(row, now);
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
   * A professional swaps one meal of the plan under review (`0060`) —
   * through `withClient` (`review`, `write`). `swap` is the API's
   * `MealSwapService` on the client's id: the client's safety profile, the
   * client's per-plan allowance, and only a meal of the pending plan — any
   * other meal is the same 404.
   */
  async swapPendingMeal(
    professional: Pick<CareSession, 'id'>,
    linkId: string,
    mealId: string,
    swap: ForClient<MealDetailView>
  ): Promise<CareClientMealView> {
    if (!careLinkIdSchema.safeParse(mealId).success) {
      throw new NotFoundError('Meal not found');
    }

    return CareController.withClient(professional.id, linkId, 'review', 'write', async (clientId, access, record) => {
      if (access.scope === 'full') {
        return swap(clientId, record);
      }

      // A `plan` scope swaps only in a plan made through this link (`0111` § 5): any
      // other pending plan is the same 404 as a meal that is not in one. A plan that
      // replaces it in between is stamped with the client's one open link — this one.
      if (!(await PlanController.pendingThrough(clientId, linkId))) {
        throw new NotFoundError('Meal not found');
      }

      return planOnlyMealDetail(await swap(clientId, record));
    });
  },

  /**
   * The daily part of a badge gone (`0111` §§ 4 and 8, `/cron/reminders`): every
   * open link whose practitioner's badge does not stand now ends when the client
   * has a condition or a medication on record, and narrows to the plan-only list
   * otherwise (`CareRepository.sweepBadgeLoss`). Answers, for each ending, the
   * **client's** account and address and the practitioner's name — for the
   * client's mail (`docs/legal/textos/06` § Y) and nothing else — and how many
   * narrowed. Nothing goes to the practitioner (legal F4): to them it is a link
   * the client ended; and nothing to anybody for a narrowing.
   */
  async sweepBadgeLoss(
    now: Date = new Date()
  ): Promise<{
    readonly ended: readonly { readonly clientId: string; readonly professionalName: string | null; readonly to: string | null }[];
    readonly narrowed: number;
  }> {
    const { ended, narrowed } = await CareRepository.sweepBadgeLoss(now);

    return {
      ended: await Promise.all(
        ended.map(async row => ({
          clientId: row.clientId,
          // The badge has just gone: the name is judged without it (round two), so a title it allowed is not mailed.
          professionalName: shownName(row.professionalName, false),
          to: (await UserRepository.findById(row.clientId))?.email ?? null
        }))
      ),
      narrowed
    };
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
   *    the grant still standing, the practice paid for (`0061`) and the
   *    current agreement accepted — one query, `CareRepository.activeLink`. A
   *    link that is someone else's, paused, ended, unknown or not an id is
   *    one `NotFoundError`, the 404 of every denial; nothing is written;
   * 3. the client's trail gets its row — who (the professional's id and name
   *    as it is now), `kind`, `action`, and the link it went through. A read's row goes in **before** `fn`
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
   * health **and** opens `full`.
   *
   * **The scope** (`0111` § 4): `activeLink` answers what the link opens on
   * this request — `full` only while the badge stands and the client consented
   * to the badged list, `plan` otherwise. Under `plan`, every kind outside
   * `PLAN_SCOPE_KINDS` is the same `NotFoundError`, with nothing written; `fn`
   * gets the scope and builds its answer for it.
   *
   * Nothing is cached: ending the link closes access on the very next call,
   * and so does losing the badge.
   */
  async withClient<T>(
    professionalId: string,
    linkId: string,
    // `list` is the list's own row, written by `CareRepository.roster` alone.
    kind: Exclude<CareAccessKind, 'list'>,
    action: CareProfessionalAction,
    fn: (clientId: string, access: ClientAccess, record: RecordAccess) => Promise<T>
  ): Promise<T> {
    if (!careLinkIdSchema.safeParse(linkId).success || !(await switchedOn())) {
      throw new NotFoundError('Client not found');
    }

    const access = await CareRepository.activeLink(professionalId, linkId);

    // The scope is the link's own consent and the badge, read now (`0111` § 4); the
    // health line is the link's own consent too (PRD 004, criterion 12). Both asked
    // here, not left to the caller, so no caller can read past either.
    if (
      !access ||
      (access.scope !== 'full' && !PLAN_SCOPE_KINDS.has(kind)) ||
      (kind === 'health' && (access.scope !== 'full' || !access.link.sharesHealth))
    ) {
      throw new NotFoundError('Client not found');
    }

    const { clientId, professionalId: _professional, ...link } = access.link;
    const entry = { action, kind, linkId, professionalId, professionalName: access.professionalName };
    const view: ClientAccess = { clientName: access.clientName, link, professionalName: access.professionalName, scope: access.scope };

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
