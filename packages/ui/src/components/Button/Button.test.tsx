import { render, screen } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Button } from './index';

describe('Button', () => {
  describe('rendering', () => {
    it('renders a <button> with the provided children', () => {
      render(<Button>Save</Button>);
      const btn = screen.getByRole('button', { name: 'Save' });
      expect(btn.tagName).toBe('BUTTON');
    });

    it('applies the base "button" class', () => {
      render(<Button>Save</Button>);
      expect(screen.getByRole('button')).toHaveClass('button');
    });
  });

  describe('variant + size', () => {
    it('defaults to variant="primary" and size="md"', () => {
      render(<Button>Save</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('primary');
      expect(btn).toHaveClass('md');
    });

    it.each(['primary', 'secondary'] as const)('variant="%s" applies the matching class', variant => {
      render(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole('button')).toHaveClass(variant);
    });

    it.each(['sm', 'md', 'lg'] as const)('size="%s" applies the matching class', size => {
      render(<Button size={size}>Save</Button>);
      expect(screen.getByRole('button')).toHaveClass(size);
    });
  });

  describe('behaviour', () => {
    it('fires onClick when clicked', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={onClick}>Save</Button>);

      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire onClick when disabled', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(
        <Button disabled={true} onClick={onClick}>
          Save
        </Button>
      );

      await user.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('escape hatch', () => {
    it('merges a custom className with the computed classes', () => {
      render(<Button className="extra">Save</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('button');
      expect(btn).toHaveClass('primary');
      expect(btn).toHaveClass('extra');
    });

    it('forwards standard button attributes (type, form, aria-*)', () => {
      render(
        <Button aria-pressed="true" form="signup" type="submit">
          Submit
        </Button>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('type', 'submit');
      expect(btn).toHaveAttribute('form', 'signup');
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
