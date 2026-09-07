import Link from 'next/link';

import styles from './SiteFooter.module.css';

import { Text } from 'ui/components/Text';

const COLUMNS = [
  { links: [{ href: '#como-funciona', label: 'Cómo funciona' }, { href: '#personalizacion', label: 'Personalización' }, { href: '#preguntas', label: 'Preguntas' }], title: 'Producto' },
  { links: [{ href: '/registro', label: 'Crear cuenta' }, { href: '/acceder', label: 'Acceder' }], title: 'Cuenta' },
  { links: [{ href: '/privacidad', label: 'Privacidad' }, { href: '/terminos', label: 'Términos' }], title: 'Legal' }
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div>
            <Text size="lg" weight="semibold">
              NutrIA
            </Text>
            <Text size="sm" tone="secondary">
              Nutrición que se adapta a ti.
            </Text>
          </div>

          <div className={styles.columns}>
            {COLUMNS.map(column => (
              <div key={column.title}>
                <Text as="span" className={styles.columnTitle} size="sm" weight="medium">
                  {column.title}
                </Text>
                <ul className={styles.list}>
                  {column.links.map(link => (
                    <li key={link.href}>
                      <Link className={styles.link} href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          {/* Stated plainly and permanently, not buried in a modal: this is a
              planning tool, and it does not replace clinical advice. */}
          <Text className={styles.disclaimer} size="xs" tone="tertiary">
            NutrIA elabora planes de alimentación generales. No sustituye el consejo de un médico ni de un dietista-nutricionista colegiado. Consulta a un
            profesional si tienes una condición médica, estás embarazada o tomas medicación.
          </Text>
          <Text size="xs" tone="tertiary">
            © {new Date().getFullYear()} NutrIA
          </Text>
        </div>
      </div>
    </footer>
  );
}
