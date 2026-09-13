import { z } from 'zod';

/**
 * The one thing a person can say about the mail this product sends: whether
 * they want it. One kind, one channel — a reminder that cannot be turned off is
 * not a reminder, it is spam, and the switch ships with the first mail rather
 * than after the complaints.
 */
export const setNotificationSettingsSchema = z.object({ checkInEmail: z.boolean() });

export type SetNotificationSettings = z.infer<typeof setNotificationSettingsSchema>;

/**
 * The push services browsers actually use (`0054`): Google's for Chrome and
 * Android, Apple's for Safari and the iPhone, Mozilla's for Firefox,
 * Microsoft's for Edge.
 *
 * A subscription is a URL the server will later POST to, and the browser —
 * which is to say anybody — supplies it. Taken on trust, it would let a caller
 * make this server send requests wherever they liked: an internal address,
 * somebody else's service. So an endpoint is accepted only on one of these.
 */
const PUSH_SERVICE_HOSTS: readonly string[] = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_SERVICE_SUFFIXES: readonly string[] = ['.notify.windows.com', '.push.apple.com'];

function onPushService(endpoint: string): boolean {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }

  return PUSH_SERVICE_HOSTS.includes(url.hostname) || PUSH_SERVICE_SUFFIXES.some(suffix => url.hostname.endsWith(suffix));
}

/** The two keys a message is encrypted to, as the browser hands them over: base64url. */
const pushKey = z
  .string()
  .max(256)
  .regex(/^[\w-]+={0,2}$/);

/** A browser asking to be told things: what `PushSubscription.toJSON()` gives, minus what is not needed. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(onPushService, 'must be a push service this product sends to'),
  keys: z.object({ auth: pushKey, p256dh: pushKey })
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** A browser that no longer wants to be told: its endpoint is all that identifies it. */
export const removePushSubscriptionSchema = z.object({ endpoint: z.url().max(2048) });

export type RemovePushSubscription = z.infer<typeof removePushSubscriptionSchema>;
