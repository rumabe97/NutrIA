import type { CareInvitationDetailView, CareInvitationView, CareLinkView } from 'core/controllers/Care';

/**
 * What the professional is told after inviting: the address and until when.
 * Identical in shape whether or not the address has an account (`0059`).
 */
export type CareInvitationDto = CareInvitationView;

/** What the invited client reads before answering: who, the version, what is shared. */
export type CareInvitationDetailDto = CareInvitationDetailView;

/** The client's own link. */
export type CareLinkDto = CareLinkView;
