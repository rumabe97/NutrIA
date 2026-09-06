import styles from './CodeView.module.css';

import { TabsContent } from 'ui/components/Tabs';

export interface CodeViewProps {
  html: string;
}

export function CodeView({ html }: CodeViewProps) {
  return (
    <TabsContent className={styles.code} value="code">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </TabsContent>
  );
}
