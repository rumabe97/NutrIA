/**
 * The small part of Markdown an assistant's answer is allowed (project 023):
 * paragraphs, "- " and "1. " lists, headings up to level 3 drawn as bold lines,
 * **bold**, *italic* and `code`. Nothing else — no links, no images, no HTML.
 *
 * It returns a tree, never markup: the screen builds elements from it, so a
 * model that writes `<script>` gets the characters `<script>` on the screen and
 * nothing more. A marker still open — `**Bul` while the answer is being
 * written — stays as the characters it is until its other half arrives.
 */
export type Inline =
  | { readonly children: readonly Inline[]; readonly kind: 'em' }
  | { readonly children: readonly Inline[]; readonly kind: 'strong' }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'text'; readonly text: string };

export type Block =
  | { readonly inlines: readonly Inline[]; readonly kind: 'heading' }
  | { readonly inlines: readonly Inline[]; readonly kind: 'paragraph' }
  | { readonly items: readonly (readonly Inline[])[]; readonly kind: 'list'; readonly ordered: boolean };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,3}\s+(.*)$/;
const INLINE = /(\*\*[^*\n]+?\*\*|`[^`\n]+`|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/;

/** The inline marks of one line or paragraph: bold, italic and code, nested only bold-in-italic and back. */
export function parseInline(text: string): readonly Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest !== '') {
    const match = INLINE.exec(rest);

    if (!match) {
      out.push({ kind: 'text', text: rest });
      break;
    }

    if (match.index > 0) {
      out.push({ kind: 'text', text: rest.slice(0, match.index) });
    }

    const token = match[0];

    if (token.startsWith('**')) {
      out.push({ children: parseInline(token.slice(2, -2)), kind: 'strong' });
    } else if (token.startsWith('`')) {
      out.push({ kind: 'code', text: token.slice(1, -1) });
    } else {
      out.push({ children: parseInline(token.slice(1, -1)), kind: 'em' });
    }

    rest = rest.slice(match.index + token.length);
  }

  return out;
}

/** An answer as blocks: a blank line ends one; a list runs while its lines are items. */
export function parseMarkdown(source: string): readonly Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { items: Inline[][]; ordered: boolean } | null = null;

  const endParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ inlines: parseInline(paragraph.join('\n')), kind: 'paragraph' });
      paragraph = [];
    }
  };

  const endList = () => {
    if (list) {
      blocks.push({ items: list.items, kind: 'list', ordered: list.ordered });
      list = null;
    }
  };

  for (const line of source.split('\n')) {
    if (line.trim() === '') {
      endParagraph();
      endList();
      continue;
    }

    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);

    if (heading) {
      endParagraph();
      endList();
      blocks.push({ inlines: parseInline(heading[1] ?? ''), kind: 'heading' });
    } else if (bullet || numbered) {
      const ordered = numbered !== null;

      endParagraph();

      if (list && list.ordered !== ordered) {
        endList();
      }

      list ??= { items: [], ordered };
      list.items.push([...parseInline((bullet ?? numbered)?.[1] ?? '')]);
    } else {
      endList();
      paragraph.push(line);
    }
  }

  endParagraph();
  endList();

  return blocks;
}
