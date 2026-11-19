import type {
  BadgeCodeIssuedView,
  BadgeQueueView,
  BadgeRecordView,
  PracticeRestrictionAnswerView,
  ProfessionalAccountView,
  ProfileQueueView,
  QueuedProfileView
} from 'core/controllers/Professional';

/**
 * Every practitioner, most recently opened first, each as the owner sees them:
 * the account, the checked number, the date the practice opened, their links
 * counted per status, and what stands against them — never a client's identity
 * (`0028`).
 */
export type ProfessionalsDto = readonly ProfessionalAccountView[];

/**
 * One practitioner's badge record as the console reads it (project 025): the
 * application with the declared register and number, the badge that stands,
 * the code out, and every check. Never a client, never a contact a code went to.
 */
export type BadgeRecordDto = BadgeRecordView;

/** The owner's badge list: applications waiting, and badges due for their yearly re-check. */
export type BadgeQueueDto = BadgeQueueView;

/** A code just issued: the code itself only for a letter or a call, once; by e-mail, whether the mail left. */
export type BadgeCodeIssuedDto = BadgeCodeIssuedView;

/** The first-look queue (PRD 025 criterion 18): profiles created or edited since the owner last looked. Practitioners only. */
export type ProfileQueueDto = ProfileQueueView;

/** One profile after the owner's look: seen, or hidden with the statement. */
export type QueuedProfileDto = QueuedProfileView;

/** What stands against a practice after the owner suspended, closed or lifted: the account and the restriction. */
export type PracticeRestrictionAnswerDto = PracticeRestrictionAnswerView;
