import styles from './page.module.css';

import { Button } from 'ui/components/Button';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>TRC&apos;s Template</h1>
      <Button>Click me</Button>
    </main>
  );
}
