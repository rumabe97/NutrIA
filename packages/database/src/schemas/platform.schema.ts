import { boolean, index, jsonb, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';

import { notificationChannel, notificationType } from './_enums';
import { user } from './auth.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

/**
 * What somebody wrote to the owner (`0037`).
 *
 * Their words, addressed to a person, which is what makes this different from
 * every other row here: the admin screen is allowed to read it because it was
 * written to be read. `handled_at` is what makes it an inbox rather than a
 * growing wall — a message that has been dealt with stops asking for attention.
 */
export const feedback = userOwned('feedback', {
  handledAt: timestamp({ withTimezone: true }),
  kind: text().notNull().default('other'),
  message: text().notNull()
});

export const notifications = userOwned('notifications', {
  body: text(),
  channel: notificationChannel().notNull().default('in_app'),
  readAt: timestamp({ withTimezone: true }),
  sentAt: timestamp({ withTimezone: true }),
  title: text().notNull(),
  type: notificationType().notNull()
});

/** Opt-out lives per (user, type, channel) so "do not spam" is enforceable. */
export const notificationPreferences = userOwned('notification_preferences', {
  channel: notificationChannel().notNull(),
  enabled: boolean().notNull().default(true),
  quietHoursEnd: time(),
  quietHoursStart: time(),
  type: notificationType().notNull()
});

/**
 * Security-relevant actions only. `actorId` is `set null` on delete so the trail
 * survives account deletion without keeping the deleted user's identity.
 * Never write request bodies here — they carry health data.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    action: text().notNull(),
    actorId: text().references(() => user.id, { onDelete: 'set null' }),
    entity: text().notNull(),
    entityId: text(),
    ipHash: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    ...timestamps
  },
  table => [index('audit_logs_actor_idx').on(table.actorId), index('audit_logs_action_idx').on(table.action)]
);

/** Product events. Properties must stay non-identifying — see § Privacy. */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    event: text().notNull(),
    properties: jsonb().$type<Record<string, unknown>>(),
    userId: text().references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  table => [index('analytics_events_event_idx').on(table.event), index('analytics_events_user_idx').on(table.userId)]
);

/**
 * Settings the owner changes while the service runs, one row per switch.
 *
 * A table rather than an environment variable because a variable needs a
 * redeploy, and "stop letting people in" is the kind of decision somebody makes
 * on a phone while something is going wrong. Deliberately tiny: a key, a
 * boolean, and when it was last changed. Anything needing more shape than that
 * is a feature, not a setting.
 */
export const appSettings = pgTable('app_settings', {
  enabled: boolean().notNull(),
  key: text().primaryKey(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
});
