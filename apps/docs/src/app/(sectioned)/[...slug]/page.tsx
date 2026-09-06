import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { join } from 'path';
import { readdir } from 'fs/promises';

import type { ComponentType } from 'react';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join('/');

  // Content is always assigned: either the import succeeds, or notFound() throws (never).
  let Content!: ComponentType;

  try {
    const { default: Component } = (await import(`../../../content/${path}.mdx`)) as { default: ComponentType };
    Content = Component;
  } catch {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Content />
    </main>
  );
}

async function getMdxSlugs(dir: string, base: string): Promise<string[][]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs: string[][] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nested = await getMdxSlugs(join(dir, entry.name), `${base}/${entry.name}`);
      slugs.push(...nested);
    } else if (entry.name.endsWith('.mdx')) {
      const slug = `${base}/${entry.name.replace(/\.mdx$/, '')}`;
      slugs.push(slug.split('/').filter(Boolean));
    }
  }

  return slugs;
}

export async function generateStaticParams() {
  const contentDir = join(process.cwd(), 'src/content');
  const slugs = await getMdxSlugs(contentDir, '');

  return slugs.map(slug => ({ slug }));
}
