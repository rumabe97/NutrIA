import { toast as sonnerToast } from 'sonner';

import type { ExternalToast } from 'sonner';

type ToastMessage = Parameters<typeof sonnerToast>[0];
type ToastFn = (message: ToastMessage, options?: ExternalToast) => number | string;

function getStableId(type: string, message: ToastMessage): string | undefined {
  if (typeof message !== 'string') {
    return undefined;
  }

  return `toast:${type}:${message}`;
}

// Sonner 2.x uses [data-sonner-toast] on <li> elements with no ID data attribute.
// We inject a derived CSS class when creating each toast so we can DOM-query it for bump.
// The DOM is the source of truth for existence: getToasts() returns stale entries
// after auto-dismiss, so the element would be gone but getToasts() still returns it.
function idToClass(id: string): string {
  return `_tid_${id.replace(/[^a-z0-9_-]/gi, '_')}`;
}

// Sonner's own transition for the <li> — must be preserved so repositioning
// (triggered when another toast appears) stays smooth during bump.
const SONNER_TRANSITION = 'transform .4s, opacity .4s, height .4s, box-shadow .2s';

// Tracks in-flight bump timers per element so rapid re-triggers cancel the
// previous chain instead of stacking multiple overlapping setTimeout sequences.
const bumpTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function bump(el: HTMLElement): void {
  // Skip the bump entirely for users who opted out of motion. Relying on the global
  // `transition-duration: 0.01ms !important` reduced-motion override would still apply
  // an imperceptible 0.01ms scale change — closer to "doing it wrong fast" than "not
  // doing it." Better to no-op.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const prev = bumpTimers.get(el);

  if (prev !== undefined) {
    clearTimeout(prev);
  }

  // Set transition first, then apply scale in the next frame.
  // Setting both synchronously risks the browser batching them and skipping the animation.
  el.style.transition = `${SONNER_TRANSITION}, scale 0.1s ease-out`;

  requestAnimationFrame(() => {
    el.style.scale = '1.04';

    // 150ms hold at peak, then settle with a smooth ease-out-quart curve.
    // Values derived from Linear's --speed-slowTransition (.35s) and their
    // cubic-bezier(.22, .72, .28, 1) timing function visible in their CSS bundle.
    const settle = setTimeout(() => {
      el.style.transition = `${SONNER_TRANSITION}, scale 0.35s cubic-bezier(.22, .72, .28, 1)`;
      el.style.scale = '';

      const cleanup = setTimeout(() => {
        el.style.transition = '';
        bumpTimers.delete(el);
      }, 350);

      bumpTimers.set(el, cleanup);
    }, 150);

    bumpTimers.set(el, settle);
  });
}

function withDedup(type: string, fn: ToastFn): ToastFn {
  return (message, options) => {
    const stableId = options?.id !== undefined ? String(options.id) : getStableId(type, message);

    if (!stableId) {
      return fn(message, options);
    }

    const toastClass = idToClass(stableId);

    const existingEl = document.querySelector<HTMLElement>(`[data-sonner-toast].${toastClass}`);

    if (existingEl) {
      bump(existingEl);

      return stableId;
    }

    return fn(message, { ...options, id: stableId, className: options?.className ? `${options.className} ${toastClass}` : toastClass });
  };
}

export const toast = Object.assign(
  (message: ToastMessage, options?: ExternalToast) =>
    withDedup('default', (innerMessage, innerOptions) => sonnerToast(innerMessage, innerOptions))(message, options),
  {
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
    error: withDedup('error', (message, options) => sonnerToast.error(message, options)),
    info: withDedup('info', (message, options) => sonnerToast.info(message, options)),
    loading: withDedup('loading', (message, options) => sonnerToast.loading(message, options)),
    message: withDedup('default', (message, options) => sonnerToast.message(message, options)),
    promise: sonnerToast.promise,
    success: withDedup('success', (message, options) => sonnerToast.success(message, options)),
    warning: withDedup('warning', (message, options) => sonnerToast.warning(message, options))
  }
);
