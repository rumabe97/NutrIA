import type { NotificationChannel } from 'core/controllers/Notification';

/**
 * The channels a notice reached somebody on — the mail, if it was accepted,
 * and the phones, if any took it — or null when it reached them on none, and
 * so was not sent (`0071`).
 *
 * Both when both: one used to be kept (`mailed ? 'email' : 'push'`) and the
 * phone was lost from the count of what went out by which channel.
 */
export function channelsReached(mailed: boolean, phones: number): [NotificationChannel, ...NotificationChannel[]] | null {
  if (mailed) {
    return phones > 0 ? ['email', 'push'] : ['email'];
  }

  return phones > 0 ? ['push'] : null;
}
