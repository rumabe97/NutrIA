import { Fragment } from 'react';
import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import userEvent from '@testing-library/user-event';

import { Input } from './index';

describe('Input', () => {
  describe('label association', () => {
    it('renders the label text', () => {
      render(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('links label to input via htmlFor and id (useId-generated)', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
      expect(input.id).toBeTruthy();
    });

    it('clicking the label focuses the input', async () => {
      const user = userEvent.setup();
      render(<Input label="Email" />);
      const label = screen.getByText('Email');
      await user.click(label);
      expect(screen.getByLabelText('Email')).toHaveFocus();
    });
  });

  describe('hint', () => {
    it('renders the hint text when provided', () => {
      render(<Input hint="We never share your email" label="Email" />);
      expect(screen.getByText('We never share your email')).toBeInTheDocument();
    });

    it('wires aria-describedby to the hint id', () => {
      render(<Input hint="We never share your email" label="Email" />);
      const input = screen.getByLabelText('Email');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const hint = screen.getByText('We never share your email');
      expect(describedBy).toContain(hint.id);
    });

    it('omits aria-describedby when no hint and no error are passed', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('error', () => {
    it('renders the error text and sets aria-invalid', () => {
      render(<Input error="Invalid email" label="Email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('wires aria-describedby to the error id', () => {
      render(<Input error="Invalid email" label="Email" />);
      const input = screen.getByLabelText('Email');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const error = screen.getByText('Invalid email');
      expect(describedBy).toContain(error.id);
    });

    it('hides the hint when error is also passed', () => {
      render(<Input error="Invalid email" hint="We never share your email" label="Email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
      expect(screen.queryByText('We never share your email')).not.toBeInTheDocument();
    });

    it('describes the field by the error alone when the hint is hidden, never by an id that is not on the page', () => {
      render(<Input error="Invalid email" hint="We never share your email" label="Email" />);
      const describedBy = screen.getByLabelText('Email').getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(' ')).toEqual([screen.getByText('Invalid email').id]);
    });

    it('announces the error via aria-live="polite" (so it reads without re-focusing the field)', () => {
      render(<Input error="Invalid email" label="Email" />);
      expect(screen.getByText('Invalid email')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('describedBy', () => {
    it('adds outside descriptions after the hint and the error, never in place of them', () => {
      render(<Input describedBy="meter" error="Too short" label="Password" />);
      const describedBy = screen.getByLabelText('Password').getAttribute('aria-describedby')?.split(' ');

      expect(describedBy).toEqual([screen.getByText('Too short').id, 'meter']);
    });

    it('describes the field with the outside ids alone when there is no hint and no error', () => {
      render(<Input describedBy="meter note" label="Password" />);
      expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'meter note');
    });
  });

  describe('id stability', () => {
    it('generates unique ids per instance so two Inputs on the same page do not collide', () => {
      render(
        <Fragment>
          <Input label="Email" />
          <Input label="Username" />
        </Fragment>
      );
      const email = screen.getByLabelText('Email');
      const username = screen.getByLabelText('Username');
      expect(email.id).toBeTruthy();
      expect(username.id).toBeTruthy();
      expect(email.id).not.toBe(username.id);
    });
  });

  describe('forwarded HTML attributes', () => {
    it('forwards standard input attributes (type, name, value, disabled, required, placeholder)', () => {
      render(
        <Input
          defaultValue="hello@example.com"
          disabled={true}
          label="Email"
          name="email"
          placeholder="you@example.com"
          required={true}
          type="email"
        />
      );
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('name', 'email');
      expect(input).toHaveAttribute('placeholder', 'you@example.com');
      expect(input).toBeDisabled();
      expect(input).toBeRequired();
      expect(input).toHaveValue('hello@example.com');
    });

    it('responds to onChange', async () => {
      const user = userEvent.setup();
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      await user.type(input, 'a@b.co');
      expect(input).toHaveValue('a@b.co');
    });

    it('merges a custom className with the root class', () => {
      render(<Input className="extra" data-testid="input-root-wrapper" label="Email" />);
      // The className lands on the wrapping <div>, not the <input> itself.
      const wrapper = screen.getByText('Email').closest('div');
      expect(wrapper).toHaveClass('root');
      expect(wrapper).toHaveClass('extra');
    });
  });
});
