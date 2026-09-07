import 'ui/styles/colors';
import 'ui/styles/variables';
import 'ui/styles/base';
import 'ui/styles/classnames';

import 'styles/globals.css';
import 'styles/variables.css';

import { font } from 'ui/fonts';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  description: 'Planes de nutrición personalizados, construidos alrededor de tus objetivos, tus preferencias y tu vida.',
  title: 'NutrIA — Nutrición que se adapta a ti'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className={font.variable}>{children}</body>
    </html>
  );
}
