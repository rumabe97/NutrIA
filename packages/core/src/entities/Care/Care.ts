import { z } from 'zod';

/**
 * Bumped whenever what a link shares changes — the lists below, or the words
 * the client reads before agreeing to them (`0059`).
 *
 * The version is code and the wording is the web app's dictionary (project
 * 004, Phase 8), as `HEALTH_CONSENT_VERSION` is: a stored version that no
 * longer matches this one is consent to a notice the client never read, and
 * accepting with an older one is refused at the door.
 *
 * `2.0.0` (`docs/legal/textos/05` § B): the list names what the professional
 * may *do* — set targets, generate and change plans, review them first — and
 * the health line can be switched on and off later without ending the link. A
 * link accepted at `1.0.0` stays a link, shown with `consentIsCurrent: false`;
 * none may be a real one when the `professional` switch goes on.
 */
export const CARE_CONSENT_VERSION = '2.0.0';

/**
 * What a link lets the professional see and do, in the order the client reads
 * it. Keys, not sentences: the screen owns the words, in both languages.
 *
 * - `profile` — the answers the targets are computed from (age, sex, height,
 *   weight, activity, goal) and where onboarding stands;
 * - `targets` — the daily targets, and setting them (`0059`, Phase 4);
 * - `mealPlans` — the plans, their history, and reviewing a new one before the
 *   client sees it (`0060`);
 * - `progress` — meals eaten and skipped, and the weight line;
 * - `checkIns` — each fortnight's check-in.
 */
export const CARE_SHARED = ['profile', 'targets', 'mealPlans', 'progress', 'checkIns'] as const;

export type CareShared = (typeof CARE_SHARED)[number];

/**
 * The separate line (PRD 004, criterion 12): shared only when the client ticks
 * it, and otherwise absent from everything the professional is shown.
 */
export const CARE_HEALTH_SHARED = ['conditions', 'medications', 'supplements'] as const;

export type CareHealthShared = (typeof CARE_HEALTH_SHARED)[number];

/** How long an invitation stays open (`0059`). */
export const CARE_INVITATION_TTL_DAYS = 14;

/**
 * An invitation's token as it travels: 32 random bytes, base64url, no padding.
 * Anything else is not one of ours, and is answered as every unknown token is.
 */
export const CARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The professional's invitation: an address, and nothing else. Trimmed and
 * lowercased before it is checked or stored, because it is compared with a
 * session's address and `Ana@` and `ana@` are one inbox.
 */
export const inviteClientSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) });

export type InviteClient = z.infer<typeof inviteClientSchema>;

/**
 * The client's answer. The version must be the current one — an older string
 * is agreement to a list that is not the one being shared — and the health
 * line is its own yes or no, never implied by the rest.
 */
export const acceptInvitationSchema = z.object({ consentVersion: z.literal(CARE_CONSENT_VERSION), sharesHealth: z.boolean() });

export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;

/**
 * The professional turns review before publishing on or off for one link
 * (`0060`). The one thing on a link a professional may change: what it shares
 * is the client's consent, never theirs to edit.
 */
export const setClientReviewSchema = z.object({ reviewBeforePublish: z.boolean() });

export type SetClientReview = z.infer<typeof setClientReviewSchema>;

/**
 * The client starts or stops sharing the health line on their own link, without
 * ending it (`docs/legal/analisis.md` P0-1; RGPD art. 7.3): as easy to take
 * back as it was to give.
 */
export const setLinkHealthSchema = z.object({ sharesHealth: z.boolean() });

export type SetLinkHealth = z.infer<typeof setLinkHealthSchema>;

/**
 * A link's id as a path carries it. Anything else names no link and is
 * answered as every unknown link is — a 404, never a 400 that would tell a
 * caller the route is there.
 */
export const careLinkIdSchema = z.uuid();

export const CARE_LINK_STATUSES = ['active', 'paused', 'ended'] as const;

export type CareLinkStatus = (typeof CARE_LINK_STATUSES)[number];

export const CARE_LINK_ENDED_BY = ['professional', 'client', 'lapse', 'account'] as const;

export type CareLinkEndedBy = (typeof CARE_LINK_ENDED_BY)[number];

/** A link as `care_links` holds it. */
export const careLinkSchema = z.object({
  id: z.uuid(),
  clientId: z.string().min(1),
  consentedAt: z.date(),
  consentVersion: z.string().min(1),
  createdAt: z.date(),
  endedAt: z.date().nullable(),
  endedBy: z.enum(CARE_LINK_ENDED_BY).nullable(),
  professionalId: z.string().min(1),
  reviewBeforePublish: z.boolean(),
  sharesHealth: z.boolean(),
  status: z.enum(CARE_LINK_STATUSES),
  updatedAt: z.date()
});

export type CareLink = z.infer<typeof careLinkSchema>;

/**
 * What kind of a client's data a professional reached (`0059`), as the
 * client's trail names it:
 *
 * - `list` — their entry in the professional's list: a stage worked out from their data,
 *   written only by `CareRepository.roster`;
 * - `overview` — the client page: the plans, progress and the targets, read together;
 * - `plan` — a plan on its own;
 * - `progress` — progress on its own;
 * - `targets` — the daily targets (setting them is Phase 4's `write`);
 * - `health` — conditions, medications and supplements, under the separate line;
 * - `review` — a plan waiting for the professional before the client sees it (`0060`).
 */
export const CARE_ACCESS_KINDS = ['list', 'overview', 'plan', 'progress', 'targets', 'health', 'review'] as const;

export type CareAccessKind = (typeof CARE_ACCESS_KINDS)[number];

/**
 * `read` and `write` are a professional's; `granted` and `withdrawn`, only on a
 * `health` row, are the client's own — they started or stopped sharing the
 * health line under that link.
 */
export const CARE_ACCESS_ACTIONS = ['read', 'write', 'granted', 'withdrawn'] as const;

export type CareAccessAction = (typeof CARE_ACCESS_ACTIONS)[number];

/** What a professional's access through `withClient` can be. */
export type CareProfessionalAction = Extract<CareAccessAction, 'read' | 'write'>;

/**
 * One row of the client's trail as `care_access_log` holds it. `userId` is the
 * client's; `professionalId` is null once that professional's account is gone,
 * and `professionalName` is the name they had when they looked. `linkId` is the
 * link it happened under — null on an older row no single link fits, or once
 * the link went with an account.
 */
export const careAccessEntrySchema = z.object({
  id: z.uuid(),
  action: z.enum(CARE_ACCESS_ACTIONS),
  createdAt: z.date(),
  kind: z.enum(CARE_ACCESS_KINDS),
  linkId: z.uuid().nullable(),
  professionalId: z.string().min(1).nullable(),
  professionalName: z.string(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type CareAccessEntry = z.infer<typeof careAccessEntrySchema>;

/**
 * An invitation as `care_invitations` holds it. The token is not here: only
 * its hash is ever stored, and only the mail ever carries the token. Nor is
 * any "answered" state: a row exists only while the invitation is live, and
 * answering or replacing it deletes it.
 */
export const careInvitationSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
  email: z.string().min(1),
  expiresAt: z.date(),
  professionalId: z.string().min(1),
  tokenHash: z.string().length(64),
  updatedAt: z.date()
});

export type CareInvitation = z.infer<typeof careInvitationSchema>;
