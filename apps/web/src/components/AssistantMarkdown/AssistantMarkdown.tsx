import { Fragment } from 'react';

import styles from './AssistantMarkdown.module.css';

import { parseMarkdown } from 'lib/markdown';

import type { Inline } from 'lib/markdown';

function inlines(nodes: readonly Inline[]) {
  return nodes.map((node, index) => {
    const key = String(index);

    if (node.kind === 'text') {
      return <Fragment key={key}>{node.text}</Fragment>;
    }

    if (node.kind === 'code') {
      return <code key={key}>{node.text}</code>;
    }

    return node.kind === 'strong' ? <strong key={key}>{inlines(node.children)}</strong> : <em key={key}>{inlines(node.children)}</em>;
  });
}

/**
 * An answer's text, its Markdown drawn (`lib/markdown.ts`): built as elements,
 * never as HTML, so nothing a model writes can become markup. A heading is a
 * bold line rather than an `h3` — the page's outline is the screen's, not the
 * model's.
 */
export function AssistantMarkdown({ className, text }: { readonly className?: string; readonly text: string }) {
  return (
    // A model's words, marked as such for anything reading the page (AI Act art. 50.2).
    <div className={[styles.root, className].filter(Boolean).join(' ')} data-ai-generated="true">
      {parseMarkdown(text).map((block, index) => {
        const key = String(index);

        if (block.kind === 'list') {
          const items = block.items.map((item, itemIndex) => {
            // Positions are the identity here: an answer only ever grows at its end, and never reorders.
            const itemKey = `${key}.${String(itemIndex)}`;

            return <li key={itemKey}>{inlines(item)}</li>;
          });

          return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }

        return (
          <p className={block.kind === 'heading' ? styles.heading : undefined} key={key}>
            {inlines(block.inlines)}
          </p>
        );
      })}
    </div>
  );
}
