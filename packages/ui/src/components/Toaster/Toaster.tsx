'use client';
import { Toaster as Sonner } from 'sonner';

import type { ToasterProps as SonnerToasterProps } from 'sonner';

export interface ToasterProps extends SonnerToasterProps {}

export function Toaster({ toastOptions, ...rest }: ToasterProps) {
  return (
    <Sonner
      closeButton={true}
      duration={5000}
      expand={true}
      position="bottom-right"
      richColors={true}
      toastOptions={{
        ...toastOptions,
        style: {
          background: 'var(--background-01)',
          border: '1px solid var(--border-01)',
          color: 'var(--foreground-01)',
          fontFamily: 'inherit',
          fontSize: 'var(--font-size-02)',
          ...toastOptions?.style
        }
      }}
      {...rest}
    />
  );
}
