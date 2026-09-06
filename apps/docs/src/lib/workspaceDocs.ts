import { join, resolve, sep } from 'path';
import { readdir, readFile } from 'fs/promises';

import type { NavTree } from 'components/Navigation';

// Repo-root docs/ — the committed project documentation (see root AGENTS.md § Documentation).
// process.cwd() is apps/docs during dev and build.
const DOCS_DIR = resolve(process.cwd(), '../../docs');

// docs/local/ is gitignored private context — never rendered, even in dev.
const EXCLUDED_DIRS = new Set(['local']);

/**
 * The /workspace section is a dev-only viewer. Production builds exclude it entirely so a
 * deployed docs app can never expose project documentation.
 */
export function workspaceDocsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

// Canonical reading order of a project's docs — extra .md files sort after, alphabetically.
const PROJECT_TAB_ORDER = ['PRD', 'PLAN', 'LOG'];

/**
 * Sidebar tree for the /workspace section: root docs first, then ONE item per project
 * (its docs render as tabs on the project page), then any other docs/ subdirectories.
 * Undefined in production.
 */
export async function buildWorkspaceNav(): Promise<NavTree | undefined> {
  if (!workspaceDocsEnabled()) {
    return undefined;
  }

  const slugs = await listDocSlugs();
  const rootItems = slugs.filter(slug => slug.length === 1).map(slug => ({ href: `/workspace/${slug[0]}`, name: slug[0] }));
  const groups = [{ items: rootItems, title: 'Workspace' }];
  const projectNames = [...new Set(slugs.filter(slug => slug[0] === 'projects' && slug.length >= 3).map(slug => slug[1]))];

  if (projectNames.length > 0) {
    groups.push({ items: projectNames.map(name => ({ href: `/workspace/projects/${name}`, name })), title: 'Projects' });
  }

  const grouped = new Map<string, string[][]>();

  for (const slug of slugs.filter(entry => entry.length > 1 && entry[0] !== 'projects')) {
    const key = slug.slice(0, -1).join(' / ');
    grouped.set(key, [...(grouped.get(key) ?? []), slug]);
  }

  for (const [title, groupSlugs] of grouped) {
    groups.push({ items: groupSlugs.map(slug => ({ href: `/workspace/${slug.join('/')}`, name: slug[slug.length - 1] })), title });
  }

  return { groups };
}

/** A project's doc names in tab order: PRD, PLAN, LOG, then any extras alphabetically. */
export async function listProjectTabs(project: string): Promise<string[]> {
  const slugs = await listDocSlugs();
  const docs = slugs.filter(slug => slug.length === 3 && slug[0] === 'projects' && slug[1] === project).map(slug => slug[2]);
  const canonical = PROJECT_TAB_ORDER.filter(tab => docs.includes(tab));
  const extras = docs.filter(doc => !PROJECT_TAB_ORDER.includes(doc)).sort();

  return [...canonical, ...extras];
}

/** Lists every renderable doc as a URL slug (path segments, `.md` stripped). */
export async function listDocSlugs(): Promise<string[][]> {
  return walk(DOCS_DIR, []);
}

/** Reads one doc by slug. Returns undefined for unknown, excluded, or path-escaping slugs. */
export async function readDoc(slug: ReadonlyArray<string>): Promise<string | undefined> {
  const target = resolve(DOCS_DIR, `${join(...slug)}.md`);
  const insideDocs = target.startsWith(`${DOCS_DIR}${sep}`);
  const excluded = EXCLUDED_DIRS.has(slug[0]);

  if (!insideDocs || excluded) {
    return undefined;
  }

  try {
    return await readFile(target, 'utf8');
  } catch {
    return undefined;
  }
}

async function walk(dir: string, prefix: ReadonlyArray<string>): Promise<string[][]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs: string[][] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
      const nested = await walk(join(dir, entry.name), [...prefix, entry.name]);
      slugs.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      slugs.push([...prefix, entry.name.replace(/\.md$/, '')]);
    }
  }

  return slugs;
}
