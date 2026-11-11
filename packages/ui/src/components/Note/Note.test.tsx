import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { Note } from './Note';

describe('Note', () => {
  it('draws its words, its title and its tone word, which is hidden from the eye but not from a reader', () => {
    const { container } = render(
      <Note title="Tus comidas serán grandes" tone="warning" toneLabel="Aviso">
        <p>Dos comidas al día.</p>
      </Note>
    );
    expect(screen.getByText('Tus comidas serán grandes')).toBeInTheDocument();
    expect(screen.getByText('Dos comidas al día.')).toBeInTheDocument();
    expect(screen.getByText('Aviso:')).toHaveClass('visually-hidden');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the tone word out of a heading title, so the heading keeps its own name', () => {
    render(<Note title="Plan en revisión" titleAs="h2" toneLabel="Aviso" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Plan en revisión' })).toBeInTheDocument();
  });

  it('can show the tone word as a visible label', () => {
    render(<Note showToneLabel={true} toneLabel="Aviso" />);
    expect(screen.getByText('Aviso')).not.toHaveClass('visually-hidden');
  });

  it('sets no role of its own and forwards the one it is given', () => {
    const { container, rerender } = render(<Note>Hecho.</Note>);
    expect(container.firstElementChild).not.toHaveAttribute('role');
    rerender(
      <Note role="alert" tone="error" toneLabel="Error">
        No se ha podido guardar.
      </Note>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Error: No se ha podido guardar.');
  });

  it('draws only phrasing content when it is a paragraph, so it can stand where a <p> stood', () => {
    const { container } = render(
      <Note as="p" layout="inline" title="Campo" tone="error">
        Escribe un número.
      </Note>
    );
    const paragraph = container.querySelector('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph?.querySelector('div, p')).toBeNull();
  });

  it('forwards id and className alongside its own classes', () => {
    const { container } = render(
      <Note className="extra" id="field-error" tone="success">
        Guardado.
      </Note>
    );
    const note = container.firstElementChild;
    expect(note).toHaveAttribute('id', 'field-error');
    expect(note).toHaveClass('note');
    expect(note).toHaveClass('success');
    expect(note).toHaveClass('extra');
  });
});
