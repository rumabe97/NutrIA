import type { JobView, MealDetailView, SharedPlanView } from 'core/controllers/Plan';
import type {
  CareAccessPageView,
  CareClientLinkView,
  CareClientOverviewView,
  CareClientsView,
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

/** What the invited client reads before answering: who, the version, what is shared. */
export type CareInvitationDetailDto = CareInvitationDetailView;

/** The client's own link. */
export type CareLinkDto = CareLinkView;

/** The professional's list: open links with where each client is, and the invitations unanswered. */
export type CareClientsDto = CareClientsView;

/** One client's page, read through their link; `health` only under the health line. */
export type CareClientOverviewDto = CareClientOverviewView;

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
 * enumerates.
 */
export type CareClientPlanDto = SharedPlanView;

/** One of the client's generations; `planId` is carried while the plan waits for review. */
export type CareClientJobDto = JobView;

/** A meal of the plan under review after the professional swapped it. */
export type CareClientMealDto = MealDetailView;

/** The workspace's own page (`0061`): whether the practice is paid for, its seats, and the way to pay. */
export type CarePracticeDto = CarePracticeView;
