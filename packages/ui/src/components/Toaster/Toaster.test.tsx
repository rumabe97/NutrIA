import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Toaster } from './Toaster';

describe('Toaster', () => {
  it('mounts a live region for screen-reader toast announcements', () => {
    // Sonner renders a `<section aria-label="Notifications …" aria-live="polite">` so
    // assistive tech announces new toasts. We just smoke-test that this region exists;
    // the dedup/bump wrapper behaviour is exercised in `toast.test.ts`.
    render(<Toaster />);
    const region = screen.getByRole('region', { name: /Notifications/i });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('accepts a position override without crashing', () => {
    expect(() => render(<Toaster position="top-left" />)).not.toThrow();
  });
});
