import type { BadgeView } from 'core/controllers/Professional';
import type { JobView } from 'core/controllers/Plan';
import type {
  CareAccessPageView,
  CareClientLinkView,
  CareClientMealView,
  CareClientPageView,
  CareClientPlanView,
  CareClientsView,
  CareEndedLinkView,
  CareInvitationDetailView,
  CareInvitationView,
  CareLinkView,
  CarePracticeView
} from 'core/controllers/Care';
import type { ResolvedTargets } from 'core/domain/Nutrition';

/**
 * What the professional is told after inviting: the address and until when.
 * Identical in shape whether or not the address has an account (`0059`).
 */
export type CareInvitationDto = CareInvitationView;

/**
 * What the invited client reads before answering: who, the version, what is
 * shared — the badged list with its health line and the checked number, or the
 * plan-only list with neither, by the inviter's badge now (`0111` § 4).
 */
export type CareInvitationDetailDto = CareInvitationDetailView;

/** The client's own link: what it opens now, whether the practitioner is verified, and whether widening is on offer. */
export type CareLinkDto = CareLinkView;

/** The client's latest link, when the illness rule's daily sweep ended it (`0111` § 8): the name and the day, nothing else. */
export type CareEndedLinkDto = CareEndedLinkView;

/** The professional's list: open links with where each client is, and the invitations unanswered. */
export type CareClientsDto = CareClientsView;

/**
 * One client's page, read through their link (`0111` § 4): under a `full`
 * scope the plan, history, progress and targets, `health` only under the
 * health line; under a `plan` scope the plans made through the link and
 * nothing else — no `progress`, `targets` or `health` key at all.
 */
export type CareClientOverviewDto = CareClientPageView;

/** One page of the client's own trail. */
export type CareAccessPageDto = CareAccessPageView;

/**
 * A client's targets after their professional set them: the same resolved set
 * the client's own route answers, `setBy` naming the professional.
 */
export type CareClientTargetsDto = ResolvedTargets;

/** A link as its professional sees it, after turning review on or off (`0060`). */
export type CareClientLinkDto = CareClientLinkView;

/**
 * A client's plan as their professional reviews or publishes it: the shape
 * `GET /meal-plans/:id` answers **without** what the client's cupboard did.
 *
 * `SharedPlanView` and not `PlanView`, which is a decision and no longer an
 * alias (`legal` P2-9, 2026-11-03): the four pantry counts are harmless and no
 * care screen reads them, so they do not cross a boundary `/privacidad`
 * enumerates. Under a `plan` scope (`0111` § 4) it is `PlanOnlyView`: no
 * `strategy`, no day `targets`, no meal `status`.
 */
export type CareClientPlanDto = CareClientPlanView;

/**
 * One of the client's generations; `planId` is carried while the plan waits for
 * review. Under a `plan` scope `errorDetail` is always null.
 */
export type CareClientJobDto = JobView;

/** A meal of the plan under review after the professional swapped it; without `status` under a `plan` scope. */
export type CareClientMealDto = CareClientMealView;

/** The workspace's own page (`0061`): whether the practice is paid for, its seats, and the way to pay. */
export type CarePracticeDto = CarePracticeView;

/** The practitioner's own badge (project 025): its state and dates, the register; the number only once checked, never the code. */
export type CareBadgeDto = BadgeView;
