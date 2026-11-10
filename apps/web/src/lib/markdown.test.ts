import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from './markdown';

describe('parseInline', () => {
  it('reads bold, italic and code, and leaves the rest as text', () => {
    expect(parseInline('Prueba **bulgur** o *quinoa*, `200 g`.')).toEqual([
      { kind: 'text', text: 'Prueba ' },
      { children: [{ kind: 'text', text: 'bulgur' }], kind: 'strong' },
      { kind: 'text', text: ' o ' },
      { children: [{ kind: 'text', text: 'quinoa' }], kind: 'em' },
      { kind: 'text', text: ', ' },
      { kind: 'code', text: '200 g' },
      { kind: 'text', text: '.' }
    ]);
  });

  it('keeps a marker still open as its characters, the way an answer looks mid-sentence', () => {
    expect(parseInline('- **Bul')).toEqual([{ kind: 'text', text: '- **Bul' }]);
  });

  it('never turns markup into anything but text', () => {
    expect(parseInline('<script>alert(1)</script> [x](javascript:1)')).toEqual([
      { kind: 'text', text: '<script>alert(1)</script> [x](javascript:1)' }
    ]);
  });
});

describe('parseMarkdown', () => {
  it('splits paragraphs, lists and headings the way the assistant writes them', () => {
    const blocks = parseMarkdown(
      'Alternativas:\n\n- **Bulgur:** parecido.\n- **Quinoa:** 15 minutos.\n\n### Receta\n1. Lava.\n2. Cuece.\n\nSi quieres, más.'
    );

    expect(blocks.map(block => block.kind)).toEqual(['paragraph', 'list', 'heading', 'list', 'paragraph']);
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: false });
    expect(blocks[3]).toMatchObject({ kind: 'list', ordered: true });
    expect(blocks[1]).toMatchObject({ items: [expect.anything(), expect.anything()] });
  });

  it('keeps a soft line break inside a paragraph', () => {
    expect(parseMarkdown('Una línea\notra línea')).toEqual([{ inlines: [{ kind: 'text', text: 'Una línea\notra línea' }], kind: 'paragraph' }]);
  });
});
