import Markdown from 'react-markdown';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { Link } from 'ui/components/Link';
import remarkGfm from 'remark-gfm';

import { listDocSlugs, listProjectTabs, readDoc, workspaceDocsEnabled } from 'lib/workspaceDocs';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function Page({ params }: PageProps) {
  if (!workspaceDocsEnabled()) {
    notFound();
  }

  const { slug } = await params;

  // Project pages render their docs (PRD / PLAN / LOG) as link-tabs. The bare project
  // URL opens on the first tab; each tab keeps its own shareable URL.
  const inProject = slug[0] === 'projects' && slug.length >= 2 && slug.length <= 3;

  if (!inProject) {
    const content = await readDoc(slug);

    if (content === undefined) {
      notFound();
    }

    return (
      <main className={styles.main}>
        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      </main>
    );
  }

  const project = slug[1];
  const tabs = await listProjectTabs(project);

  if (tabs.length === 0) {
    notFound();
  }

  const active = slug.length === 3 ? slug[2] : tabs[0];
  const content = await readDoc(['projects', project, active]);

  if (content === undefined) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <nav aria-label={`${project} documents`} className={styles.tabs}>
        {tabs.map(tab => (
          <Link aria-current={tab === active ? 'page' : undefined} className={styles.tab} href={`/workspace/projects/${project}/${tab}`} key={tab}>
            {tab}
          </Link>
        ))}
      </nav>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </main>
  );
}

export async function generateStaticParams() {
  if (!workspaceDocsEnabled()) {
    return [];
  }

  const slugs = await listDocSlugs();
  const projectIndexes = [...new Set(slugs.filter(slug => slug[0] === 'projects' && slug.length === 3).map(slug => slug[1]))].map(name => ({
    slug: ['projects', name]
  }));

  return [...slugs.map(slug => ({ slug })), ...projectIndexes];
}
