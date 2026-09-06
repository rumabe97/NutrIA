import styles from './Preview.module.css';

import { Tabs, TabsContent, TabsList, TabsTrigger } from 'ui/components/Tabs';

import { CodeView } from './components/CodeView';
import { CopyButton } from './components/CopyButton';

import { highlight } from 'lib/highlight';

import type { ReactNode } from 'react';

interface ComponentPreviewProps {
  children: ReactNode;
  code: string;
  lang?: string;
}

export async function Preview({ children, code, lang = 'tsx' }: ComponentPreviewProps) {
  const { code: formatted, html } = await highlight(code, lang);

  return (
    <Tabs className={styles.root} defaultValue="preview">
      <div className={styles.header}>
        <TabsList className={styles.tabs}>
          <TabsTrigger className={styles.tab} value="preview">
            Preview
          </TabsTrigger>
          <TabsTrigger className={styles.tab} value="code">
            Code
          </TabsTrigger>
        </TabsList>
        <CopyButton code={formatted} />
      </div>
      <TabsContent className={styles.preview} value="preview">
        {children}
      </TabsContent>
      <CodeView html={html} />
    </Tabs>
  );
}
