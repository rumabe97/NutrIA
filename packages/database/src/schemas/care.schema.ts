import { boolean, check, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { careLinkEndedBy, careLinkStatus } from './_enums';
import { timestamps } from './_columns';
import { user } from './auth.schema';

/**
 * A professional's invitation to one address (`0059`).
 *
 * The token itself is never stored: only its SHA-256, so a copy of this table
 * opens nobody's link.
 *
 * **A row exists only while the invitation is live.** Accepting deletes it (in
 * the transaction that makes the link), declining deletes it, inviting the same
 * address again replaces it — one row per professional and address, the unique
 * index below — and writing an invitation clears every expired one. Deleting
 * an account deletes every invitation addressed to it (Better Auth's
 * `beforeDelete`); revoking a grant deletes that professional's; and the
 * professional's own go by the cascade when their account does. So an
 * address typed by a professional is kept no longer than the invitation needs
 * it (PRD 004, criterion 14), and "used", "declined" and "replaced" are all
 * simply "no such row".
 *
 * It belongs to the professional, whose words it is: it goes with their account.
 * The address is the invited person's, typed by the professional, and is not a
 * reference to any account — whether one exists is exactly what an invitation
 * must never say. It is stored lowercased, and the database refuses otherwise,
 * because it is compared with a session's address and the two must agree on case.
 */
export const careInvitations = pgTable(
  'care_invitations',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    professionalId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tokenHash: text().notNull(),
    ...timestamps
  },
  table => [
    unique('care_invitations_token_hash_key').on(table.tokenHash),
    // One live invitation per professional and address; it also serves the lookups by professional.
    uniqueIndex('care_invitations_one_per_address').on(table.professionalId, table.email),
    // What an account's deletion clears by (its own address).
    index('care_invitations_email_idx').on(table.email),
    check('care_invitations_email_lowercase', sql`${table.email} = lower(${table.email})`)
  ]
);

/**
 * The one way a professional reaches a client (`0059`): a consented link
 * between two accounts.
 *
 * Both sides reference `user.id` with `ON DELETE CASCADE`: the link is about
 * two people, and it goes with either account. Neither side's own data hangs
 * from it, so deleting a professional removes their links and nothing of the
 * client's.
 *
 * `consentVersion` and `consentedAt` are what the client accepted and when;
 * `sharesHealth` is the separate line for conditions, medications and
 * supplements, false unless the client ticked it. `reviewBeforePublish` is the
 * professional's switch for new plans (`0060`), on by default.
 *
 * At most one `active` or `paused` link per client — a partial unique index,
 * so two acceptances fired together cannot both land. Clinics, where a client
 * has several professionals, start by changing it.
 */
export const careLinks = pgTable(
  'care_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    consentedAt: timestamp({ withTimezone: true }).notNull(),
    consentVersion: text().notNull(),
    endedAt: timestamp({ withTimezone: true }),
    endedBy: careLinkEndedBy(),
    professionalId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reviewBeforePublish: boolean().notNull().default(true),
    sharesHealth: boolean().notNull().default(false),
    status: careLinkStatus().notNull().default('active'),
    ...timestamps
  },
  table => [
    index('care_links_client_id_idx').on(table.clientId),
    index('care_links_professional_id_idx').on(table.professionalId),
    uniqueIndex('care_links_one_open_per_client')
      .on(table.clientId)
      .where(sql`${table.status} in ('active', 'paused')`),
    check('care_links_not_self', sql`${table.professionalId} <> ${table.clientId}`)
  ]
);
