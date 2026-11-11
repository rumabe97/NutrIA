import { act, render, screen } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from 'ui/utils/themeScript';

import userEvent from '@testing-library/user-event';

import { ThemeSwitch } from './ThemeSwitch';

const OPTIONS = { auto: 'Automático', claro: 'Claro', contraste: 'Alto contraste', huerta: 'Huerta', oscuro: 'Oscuro', pulso: 'Pulso' };
const COLORS = { claro: '#fbf5ea', contraste: '#ffffff', huerta: '#f1f8ef', oscuro: '#2a1b26', pulso: '#140b2d' };

const root = document.documentElement;

function metas() {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(meta => meta.content);
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Tema' }));
}

beforeEach(() => {
  document.head.innerHTML =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fbf5ea"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#2a1b26">';
});

afterEach(() => {
  window.localStorage.clear();
  root.removeAttribute('data-theme');
  root.style.removeProperty('color-scheme');
  document.head.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ThemeSwitch', () => {
  it('is a button named by its label, with the trigger class composed', () => {
    render(<ThemeSwitch className="extra" label="Tema" options={OPTIONS} />);

    const button = screen.getByRole('button', { name: 'Tema' });

    expect(button).toHaveClass('trigger');
    expect(button).toHaveClass('extra');
  });

  it('opens six radio items, in order, with Automático chosen when nothing is stored', async () => {
    render(<ThemeSwitch label="Tema" options={OPTIONS} />);
    await open();

    const items = screen.getAllByRole('menuitemradio');

    expect(items.map(item => item.textContent)).toEqual(['Automático', 'Claro', 'Oscuro', 'Huerta', 'Pulso', 'Alto contraste']);
    expect(screen.getByRole('menuitemradio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Pulso' })).toHaveAttribute('aria-checked', 'false');
  });

  it('writes nothing until a person chooses', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');

    render(<ThemeSwitch label="Tema" options={OPTIONS} themeColors={COLORS} />);
    await open();

    expect(write).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('choosing a theme paints it, keeps it and gives the chrome its colour', async () => {
    render(<ThemeSwitch label="Tema" options={OPTIONS} themeColors={COLORS} />);
    await open();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Pulso' }));

    expect(root).toHaveAttribute('data-theme', 'pulso');
    expect(root.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('pulso');
    expect(metas()).toEqual(['#140b2d', '#140b2d']);

    await open();
    expect(screen.getByRole('menuitemradio', { name: 'Pulso' })).toHaveAttribute('aria-checked', 'true');
  });

  it('choosing Automático removes the stored value, the attribute and the scheme, and restores the chrome', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'huerta');
    root.setAttribute('data-theme', 'huerta');
    root.style.colorScheme = 'light';

    render(<ThemeSwitch label="Tema" options={OPTIONS} themeColors={COLORS} />);
    expect(metas()).toEqual(['#f1f8ef', '#f1f8ef']);

    await open();
    expect(screen.getByRole('menuitemradio', { name: 'Huerta' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Automático' }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root).not.toHaveAttribute('data-theme');
    expect(root.style.colorScheme).toBe('');
    expect(metas()).toEqual(['#fbf5ea', '#2a1b26']);
  });

  it('two switches on one page agree', async () => {
    render(
      <div>
        <ThemeSwitch label="Tema" options={OPTIONS} />
        <ThemeSwitch label="Theme" options={OPTIONS} />
      </div>
    );

    await open();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oscuro' }));
    await userEvent.click(screen.getByRole('button', { name: 'Theme' }));

    expect(screen.getByRole('menuitemradio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
  });

  it('follows a choice made in another tab, and repaints this one', async () => {
    render(<ThemeSwitch label="Tema" options={OPTIONS} />);

    act(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'contraste');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'contraste' }));
    });

    expect(root).toHaveAttribute('data-theme', 'contraste');
    expect(root.style.colorScheme).toBe('light');

    await open();
    expect(screen.getByRole('menuitemradio', { name: 'Alto contraste' })).toHaveAttribute('aria-checked', 'true');
  });

  it('still changes the page when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    render(<ThemeSwitch label="Tema" options={OPTIONS} />);
    await open();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Claro' }));

    expect(root).toHaveAttribute('data-theme', 'claro');

    await open();
    expect(screen.getByRole('menuitemradio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');

    vi.restoreAllMocks();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Automático' }));
  });
});
