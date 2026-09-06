import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { Link } from 'ui/components/Link';

import { listDocSlugs, workspaceDocsEnabled } from 'lib/workspaceDocs';

export default async function Page() {
  if (!workspaceDocsEnabled()) {
    notFound();
  }

  const slugs = await listDocSlugs();

  // Root-level docs first, then folders grouped by their top-level directory. Projects
  // collapse to one link each — their docs render as tabs on the project page.
  const groups = new Map<string, { href: string; label: string }[]>();

  for (const slug of slugs) {
    const key = slug.length === 1 ? '' : slug[0];
    const entry =
      key === 'projects'
        ? { href: `/workspace/projects/${slug[1]}`, label: slug[1] }
        : { href: `/workspace/${slug.join('/')}`, label: key ? slug.slice(1).join(' / ') : slug.join(' / ') };
    const existing = groups.get(key) ?? [];

    if (!existing.some(item => item.href === entry.href)) {
      groups.set(key, [...existing, entry]);
    }
  }

  return (
    <main className={styles.main}>
      <h1>Workspace docs</h1>
      <p className={styles.note}>
        Product definition, architecture, roadmap, decisions, and projects — a dev-only viewer for the repo&apos;s <code>docs/</code> folder.
        Production builds exclude this section. <code>docs/local/</code> is never rendered.
      </p>
      {[...groups.entries()].map(([group, items]) => (
        <section key={group || 'root'}>
          {group ? <h2>{group}</h2> : null}
          <ul className={styles.list}>
            {items.map(item => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
