import { isValidElement } from 'react';

import styles from './CodeBlock.module.css';

import { CopyButton } from 'components/Preview/components/CopyButton';

import { highlight } from 'lib/highlight';

import type { HTMLAttributes } from 'react';

export async function CodeBlock({ children }: HTMLAttributes<HTMLPreElement>) {
  let code = '';
  let lang = 'tsx';

  if (isValidElement<{ children?: string; className?: string }>(children)) {
    code = children.props.children?.trim() ?? '';
    const match = children.props.className?.match(/language-(\w+)/);

    if (match) {
      lang = match[1];
    }
  }

  const { code: formatted, html } = await highlight(code, lang);

  return (
    <div className={styles.root}>
      <CopyButton className={styles.copy} code={formatted} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
