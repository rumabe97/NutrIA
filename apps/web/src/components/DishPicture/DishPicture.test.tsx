import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { DishPicture } from './DishPicture';

const PICTURE = 'https://blob.example/dish.jpg';

/** The glyph's drawing, which differs per moment of the day. */
function glyph(markup: string): string | undefined {
  return markup.match(/<svg[^>]*>.*?<\/svg>/)?.[0];
}

describe('DishPicture without a picture: the designed state', () => {
  it('draws a glyph, hidden from assistive technology, and no «IA» mark', () => {
    const markup = renderToStaticMarkup(<DishPicture slot="dinner" variant="thumb" />);

    expect(glyph(markup)).toContain('aria-hidden="true"');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('IA');
    expect(markup).not.toContain('Imagen generada por IA');
  });

  it('is never an empty frame: every slot draws a glyph, and the moments of the day differ', () => {
    const drawings = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper', 'unknown'].map(slot =>
      glyph(renderToStaticMarkup(<DishPicture slot={slot} variant="card" />))
    );

    expect(drawings.every(Boolean)).toBe(true);
    // breakfast, a snack, lunch, dinner: four drawings; the second snack and supper share theirs.
    expect(new Set(drawings).size).toBe(4);
    expect(drawings[1]).toBe(drawings[3]);
    expect(drawings[4]).toBe(drawings[5]);
    // A slot nobody mapped is a midday plate.
    expect(drawings[6]).toBe(drawings[2]);
  });
});

describe('DishPicture with a picture', () => {
  it('is the original file in a plain <img>, sized so nothing shifts, lazy in a list', () => {
    const markup = renderToStaticMarkup(<DishPicture path={PICTURE} slot="lunch" variant="thumb" />);

    expect(markup).toContain(`src="${PICTURE}"`);
    expect(markup).toContain('width="960"');
    expect(markup).toContain('height="720"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toContain('srcSet');
    expect(markup).not.toContain('/_next/image');
  });

  it('carries the «IA» mark, named in full where the picture itself is decorative', () => {
    const markup = renderToStaticMarkup(<DishPicture path={PICTURE} variant="thumb" />);

    expect(markup).toContain('<span aria-hidden="true">IA</span>');
    expect(markup).toContain('<span class="visually-hidden">Imagen generada por IA</span>');
  });

  it('leaves the name to the alt where the picture is named, and is eager above the fold', () => {
    const markup = renderToStaticMarkup(<DishPicture alt="Imagen de Bowl generada por IA" path={PICTURE} priority={true} variant="hero" />);

    expect(markup).toContain('alt="Imagen de Bowl generada por IA"');
    expect(markup).toContain('loading="eager"');
    expect(markup).not.toContain('visually-hidden');
  });

  it('carries its View Transition name only where it is given one', () => {
    expect(renderToStaticMarkup(<DishPicture path={PICTURE} transitionName="dish-42" variant="hero" />)).toContain('view-transition-name:dish-42');
    expect(renderToStaticMarkup(<DishPicture path={PICTURE} variant="thumb" />)).not.toContain('view-transition-name');
  });
});
