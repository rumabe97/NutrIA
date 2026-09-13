import { api } from './api';

/**
 * The page's half of the check-in reminder on a phone (`0054`). The worker
 * (`public/sw.js`) shows what arrives; this asks for permission, subscribes
 * this browser, and tells the API.
 */
export type PushState =
  /** They said no to notifications from this site; only the browser's settings undo it. */
  | 'blocked'
  /** An iPhone or iPad in Safari: Apple delivers only to an app added to the home screen. */
  | 'install-first'
  /** Not subscribed, and it may be. */
  | 'off'
  /** Subscribed: this browser will be told. */
  | 'on'
  /** A browser with no Web Push at all. */
  | 'unsupported';

const ROUTE = '/notifications/push';

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function onApplePhoneOrTablet(): boolean {
  // iPadOS introduces itself as a Mac; a Mac with a touch screen is an iPad.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** The VAPID public key as a subscription wants it: base64url in, bytes out. */
export function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!supported()) {
    return onApplePhoneOrTablet() ? 'install-first' : 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'blocked';
  }

  const registration = await navigator.serviceWorker.ready;

  return (await registration.pushManager.getSubscription()) ? 'on' : 'off';
}

/**
 * Asks, then subscribes, then tells the API. Only ever from a tap: Safari
 * refuses a permission prompt nobody asked for, and so should everyone.
 */
export async function turnPushOn(publicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return permission === 'denied' ? 'blocked' : 'off';
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ applicationServerKey: applicationServerKey(publicKey), userVisibleOnly: true }));
  const { endpoint, keys } = subscription.toJSON();

  try {
    await api(ROUTE, { body: { endpoint, keys }, method: 'PUT' });
  } catch (error: unknown) {
    // A browser subscribed that the API does not know about would look on and never be told.
    await subscription.unsubscribe();
    throw error;
  }

  return 'on';
}

export async function turnPushOff(): Promise<PushState> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await api(ROUTE, { body: { endpoint: subscription.endpoint }, method: 'DELETE' });
    await subscription.unsubscribe();
  }

  return 'off';
}

/**
 * This browser stops being told about this account: at sign-out, while the
 * session can still say so, and after an account is deleted, when only the
 * browser's own half is left to undo. Never throws, and never waits on a
 * worker — nothing here may stop somebody signing out.
 */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (!subscription) {
      return;
    }

    await api(ROUTE, { body: { endpoint: subscription.endpoint }, method: 'DELETE' }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Signing out goes ahead regardless.
  }
}
