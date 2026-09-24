import type {
  CareAccessPageView,
  CareClientOverviewView,
  CareClientsView,
  CareInvitationDetailView,
  CareInvitationView,
  CareLinkView
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
