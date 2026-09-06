import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SonnerMock = ReturnType<typeof vi.fn<(message: unknown, options?: { id?: number | string; className?: string }) => number | string>>;

const mocks = vi.hoisted(() => {
  const make = () => vi.fn<(message: unknown, options?: { id?: number | string; className?: string }) => number | string>(() => 'sonner-id');

  return {
    custom: vi.fn(),
    dismiss: vi.fn(),
    error: make(),
    info: make(),
    loading: make(),
    message: make(),
    promise: vi.fn(),
    sonnerToast: make(),
    success: make(),
    warning: make()
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(mocks.sonnerToast, {
    custom: mocks.custom,
    dismiss: mocks.dismiss,
    error: mocks.error,
    info: mocks.info,
    loading: mocks.loading,
    message: mocks.message,
    promise: mocks.promise,
    success: mocks.success,
    warning: mocks.warning
  })
}));

const sonnerToast = mocks.sonnerToast as SonnerMock;
const success = mocks.success as SonnerMock;
const error = mocks.error as SonnerMock;
const warning = mocks.warning;
const info = mocks.info as SonnerMock;
const loading = mocks.loading;
const message = mocks.message;
const promise = mocks.promise;
const dismiss = mocks.dismiss;
const custom = mocks.custom;

import { toast } from './toast';

function mountFakeSonnerToast(className: string) {
  const li = document.createElement('li');
  li.setAttribute('data-sonner-toast', '');
  li.classList.add(...className.split(' '));
  document.body.appendChild(li);

  return li;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(performance.now());

    return 0;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  sonnerToast.mockClear();
  success.mockClear();
  error.mockClear();
  warning.mockClear();
  info.mockClear();
  loading.mockClear();
  message.mockClear();
});

describe('toast (dedup wrapper)', () => {
  describe('first call — no existing toast', () => {
    it('invokes the underlying sonner method', () => {
      toast('Saved');
      expect(sonnerToast).toHaveBeenCalledTimes(1);
    });

    it('passes a stable id derived from type + message', () => {
      toast.success('Saved');
      expect(success).toHaveBeenCalledWith('Saved', expect.objectContaining({ id: 'toast:success:Saved' }));
    });

    it('passes a tid class derived from the stable id', () => {
      toast.success('Saved');
      expect(success.mock.lastCall?.[1]).toEqual(expect.objectContaining({ className: '_tid_toast_success_Saved' }));
    });

    it('merges a user-supplied className with the tid class', () => {
      toast.error('Boom', { className: 'my-toast' });
      expect(error.mock.lastCall?.[1]).toEqual(expect.objectContaining({ className: 'my-toast _tid_toast_error_Boom' }));
    });

    it('honours an explicit options.id over the derived stable id', () => {
      toast.info('Hello', { id: 'custom-id' });
      expect(info).toHaveBeenCalledWith('Hello', expect.objectContaining({ id: 'custom-id' }));
    });
  });

  describe('repeat call — existing toast in the DOM', () => {
    it('does NOT invoke sonner again and returns the stable id', () => {
      mountFakeSonnerToast('_tid_toast_success_Saved');
      const id = toast.success('Saved');
      expect(success).not.toHaveBeenCalled();
      expect(id).toBe('toast:success:Saved');
    });

    it('bumps the existing element by setting transition + scale', () => {
      const el = mountFakeSonnerToast('_tid_toast_default_Hello');
      toast('Hello');
      expect(el.style.transition).toContain('scale 0.1s ease-out');
      expect(el.style.scale).toBe('1.04');
    });

    it('settles the bump after the hold timeout', () => {
      const el = mountFakeSonnerToast('_tid_toast_default_Hello');
      toast('Hello');
      vi.advanceTimersByTime(150);
      expect(el.style.scale).toBe('');
      expect(el.style.transition).toContain('cubic-bezier(.22, .72, .28, 1)');
    });

    it('clears the inline transition after the settle window', () => {
      const el = mountFakeSonnerToast('_tid_toast_default_Hello');
      toast('Hello');
      vi.advanceTimersByTime(150 + 350);
      expect(el.style.transition).toBe('');
    });

    it('cancels an in-flight bump when re-triggered', () => {
      const el = mountFakeSonnerToast('_tid_toast_default_Hello');
      toast('Hello');
      vi.advanceTimersByTime(50);
      toast('Hello');
      vi.advanceTimersByTime(150);
      expect(el.style.scale).toBe('');
    });

    it('skips the bump entirely when prefers-reduced-motion is set', () => {
      // Override matchMedia to report reduced-motion for this test only.
      vi.stubGlobal('matchMedia', (query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn()
      }));

      const el = mountFakeSonnerToast('_tid_toast_default_Hello');
      toast('Hello');
      // No transition, no scale change — the element is untouched.
      expect(el.style.transition).toBe('');
      expect(el.style.scale).toBe('');
    });
  });

  describe('non-string messages', () => {
    it('skips dedup when message is not a string (no stable id derivable)', () => {
      toast(123 as unknown as string);
      expect(sonnerToast).toHaveBeenCalledTimes(1);
      expect(sonnerToast.mock.lastCall?.[1]).toBeUndefined();
    });
  });

  describe('passthrough surface', () => {
    it('exposes promise / dismiss / custom from sonner unchanged', () => {
      expect(toast.promise).toBe(promise);
      expect(toast.dismiss).toBe(dismiss);
      expect(toast.custom).toBe(custom);
    });
  });
});
