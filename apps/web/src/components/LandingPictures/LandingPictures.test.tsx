import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { LandingPictures } from './LandingPictures';

const CAPTION = 'Imágenes generadas por IA a partir de la receta de cada plato.';

function picture(n: number) {
  return { path: `https://blob.example/dish-${n}.jpg`, recipeId: `recipe-${n}` };
}

/** `docs/legal/2026-11-11-redesign.md` § 2.8, the conditions a prerendered hero must meet. */
describe('LandingPictures', () => {
  it('draws nothing at all without a picture, caption included', () => {
    expect(renderToStaticMarkup(<LandingPictures caption={CAPTION} pictures={[]} />)).toBe('');
  });

  it('marks every tile in the markup itself, names it for a screen reader and says the caption beside them (N1, N5, N6, W1)', () => {
    const markup = renderToStaticMarkup(<LandingPictures caption={CAPTION} pictures={[picture(1), picture(2), picture(3)]} />);

    expect(markup.match(/<img /g)).toHaveLength(3);
    expect(markup.match(/>IA</g)).toHaveLength(3);
    expect(markup.match(/Imagen generada por IA/g)).toHaveLength(3);
    expect(markup.match(/alt=""/g)).toHaveLength(3);
    expect(markup).toContain(`<figcaption`);
    expect(markup).toContain(CAPTION);
    expect(markup).toContain('data-ai-generated="true"');
  });

  it('serves each file untouched, the first at once and the others when near, never more than three (B1, B2)', () => {
    const markup = renderToStaticMarkup(<LandingPictures caption={CAPTION} pictures={[picture(1), picture(2), picture(3), picture(4)]} />);

    expect(markup.match(/<img /g)).toHaveLength(3);
    expect(markup).not.toContain('dish-4.jpg');
    expect(markup).not.toContain('srcset');
    expect(markup).not.toContain('_next/image');
    expect(markup.match(/loading="eager"/g)).toHaveLength(1);
    expect(markup.match(/loading="lazy"/g)).toHaveLength(2);
    expect(markup).toMatch(/<img[^>]*src="https:\/\/blob\.example\/dish-1\.jpg"/);
    expect(markup).toMatch(/<img[^>]*width="960"[^>]*height="720"|<img[^>]*height="720"[^>]*width="960"/);
  });
});
