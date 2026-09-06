'use client';
import { usePathname } from 'next/navigation';

import styles from './Navigation.module.css';

import { NavLink } from './components/NavLink';
import { Section } from './components/Section';
import { Divider } from 'components/Divider';

import type { ReactElement } from 'react';

interface NavItem {
  href: string;
  name: string;
}

interface NavSectionGroup {
  items: ReadonlyArray<NavItem>;
  title: string;
}

export interface NavTree {
  groups: ReadonlyArray<NavSectionGroup>;
}

interface NavigationProps {
  /** Dev-only tree for the /workspace docs section, built from the filesystem by the layout (see lib/workspaceDocs.ts). */
  workspaceNav?: NavTree;
}

const UI_NAV: NavTree = {
  groups: [
    { items: [{ href: '/ui', name: 'Overview' }], title: 'Basics' },
    {
      items: [
        { href: '/ui/components/container', name: 'Container' },
        { href: '/ui/components/flex', name: 'Flex' },
        { href: '/ui/components/grid', name: 'Grid' },
        { href: '/ui/components/hstack', name: 'HStack' },
        { href: '/ui/components/section', name: 'Section' },
        { href: '/ui/components/vstack', name: 'VStack' }
      ],
      title: 'Layout'
    },
    {
      items: [
        { href: '/ui/components/code', name: 'Code' },
        { href: '/ui/components/heading', name: 'Heading' },
        { href: '/ui/components/text', name: 'Text' }
      ],
      title: 'Typography'
    },
    {
      items: [
        { href: '/ui/components/accordion', name: 'Accordion' },
        { href: '/ui/components/aspect-ratio', name: 'Aspect Ratio' },
        { href: '/ui/components/avatar', name: 'Avatar' },
        { href: '/ui/components/button', name: 'Button' },
        { href: '/ui/components/carousel', name: 'Carousel' },
        { href: '/ui/components/checkbox', name: 'Checkbox' },
        { href: '/ui/components/collapsible', name: 'Collapsible' },
        { href: '/ui/components/context-menu', name: 'Context Menu' },
        { href: '/ui/components/dialog', name: 'Dialog' },
        { href: '/ui/components/divider', name: 'Divider' },
        { href: '/ui/components/drawer', name: 'Drawer' },
        { href: '/ui/components/dropdown', name: 'Dropdown' },
        { href: '/ui/components/image', name: 'Image' },
        { href: '/ui/components/input', name: 'Input' },
        { href: '/ui/components/label', name: 'Label' },
        { href: '/ui/components/link', name: 'Link' },
        { href: '/ui/components/marble-effect', name: 'Marble Effect' },
        { href: '/ui/components/radio-group', name: 'Radio Group' },
        { href: '/ui/components/roving-focus-group', name: 'Roving Focus Group' },
        { href: '/ui/components/select', name: 'Select' },
        { href: '/ui/components/sidebar', name: 'Sidebar' },
        { href: '/ui/components/skeleton', name: 'Skeleton' },
        { href: '/ui/components/slider', name: 'Slider' },
        { href: '/ui/components/spacer', name: 'Spacer' },
        { href: '/ui/components/spinner', name: 'Spinner' },
        { href: '/ui/components/spotlight', name: 'Spotlight' },
        { href: '/ui/components/switch', name: 'Switch' },
        { href: '/ui/components/tabs', name: 'Tabs' },
        { href: '/ui/components/toast', name: 'Toast' }
      ],
      title: 'Components'
    }
  ]
};

const TESTS_NAV: NavTree = {
  groups: [
    { items: [{ href: '/tests', name: 'Introduction' }], title: 'Overview' },
    {
      items: [
        { href: '/tests/unit', name: 'Unit testing' },
        { href: '/tests/e2e', name: 'End-to-end testing' }
      ],
      title: 'Types'
    }
  ]
};

function getNavTreeForPath(pathname: string, workspaceNav?: NavTree): NavTree | null {
  if (pathname === '/ui' || pathname.startsWith('/ui/')) {
    return UI_NAV;
  }

  if (pathname === '/tests' || pathname.startsWith('/tests/')) {
    return TESTS_NAV;
  }

  if (pathname === '/workspace' || pathname.startsWith('/workspace/')) {
    return workspaceNav ?? null;
  }

  return null;
}

export function Navigation({ workspaceNav }: NavigationProps): ReactElement | null {
  const pathname = usePathname();
  const tree = getNavTreeForPath(pathname, workspaceNav);

  if (!tree) {
    return null;
  }

  return (
    <nav className={`${styles.navigation} dotted dotted-right`}>
      {tree.groups.map((group, index) => (
        <div key={group.title}>
          {index > 0 ? <Divider /> : null}
          <div className={styles.content}>
            <Section title={group.title}>
              <ul className={styles.list}>
                {group.items.map(({ href, name }) => (
                  <NavLink href={href} key={href} name={name} />
                ))}
              </ul>
            </Section>
          </div>
        </div>
      ))}
      <div className={styles.footer} />
    </nav>
  );
}
