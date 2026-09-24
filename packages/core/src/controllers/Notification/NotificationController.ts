import { NotificationRepository } from '#repositories/Notification';

import type { PushTarget, Recipient } from '#repositories/Notification';
import type { PushSubscriptionInput } from 'core/entities/Notification';

export type { PushTarget, Recipient };

export type NotificationSettingsView = { readonly checkInEmail: boolean };

export const NotificationController = {
  /** Who is due a check-in reminder today, in a bounded batch. */
  async checkInDue(today: string, limit: number): Promise<readonly Recipient[]> {
    return NotificationRepository.findCheckInDue(today, limit);
  },

  /** A subscription its push service reported gone (404 or 410). */
  async dropPushSubscription(endpoint: string): Promise<void> {
    await NotificationRepository.dropPushSubscription(endpoint);
  },

  /** The browsers one person subscribed — for the owner's test from `/admin` (`0054`). */
  async pushTargets(userId: string): Promise<readonly PushTarget[]> {
    return NotificationRepository.findPushTargets(userId);
  },

  async recordCheckInReminder(userId: string, title: string, body: string, channel: 'email' | 'push'): Promise<void> {
    await NotificationRepository.recordSent(userId, { body, channel, title, type: 'checkin_due' });
  },

  /** The proof that a professional was told their client checked in (`0059`, PRD 004 criterion 10). */
  async recordCheckinSubmitted(professionalId: string, title: string, body: string, channel: 'email' | 'push'): Promise<void> {
    await NotificationRepository.recordSent(professionalId, { body, channel, title, type: 'checkin_submitted' });
  },

  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await NotificationRepository.removePushSubscription(userId, endpoint);
  },

  /** This browser, for this person, from now on (`0054`). */
  async savePushSubscription(userId: string, subscription: PushSubscriptionInput): Promise<void> {
    await NotificationRepository.savePushSubscription(userId, {
      auth: subscription.keys.auth,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh
    });
  },

  async setCheckInEmail(userId: string, enabled: boolean): Promise<NotificationSettingsView> {
    await NotificationRepository.setPreference(userId, 'checkin_due', 'email', enabled);

    return { checkInEmail: enabled };
  },

  async settings(userId: string): Promise<NotificationSettingsView> {
    return { checkInEmail: await NotificationRepository.findPreference(userId, 'checkin_due', 'email') };
  }
};
