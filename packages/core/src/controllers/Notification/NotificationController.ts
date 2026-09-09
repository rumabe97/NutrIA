import { NotificationRepository } from '#repositories/Notification';

import type { Recipient } from '#repositories/Notification';

export type { Recipient };

export type NotificationSettingsView = { readonly checkInEmail: boolean };

export const NotificationController = {
  /** Who is due a check-in reminder today, in a bounded batch. */
  async checkInDue(today: string, limit: number): Promise<readonly Recipient[]> {
    return NotificationRepository.findCheckInDue(today, limit);
  },

  async recordCheckInReminder(userId: string, title: string, body: string): Promise<void> {
    await NotificationRepository.recordSent(userId, { body, title, type: 'checkin_due' });
  },

  async setCheckInEmail(userId: string, enabled: boolean): Promise<NotificationSettingsView> {
    await NotificationRepository.setPreference(userId, 'checkin_due', 'email', enabled);

    return { checkInEmail: enabled };
  },

  async settings(userId: string): Promise<NotificationSettingsView> {
    return { checkInEmail: await NotificationRepository.findPreference(userId, 'checkin_due', 'email') };
  }
};
