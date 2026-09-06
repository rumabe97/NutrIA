'use client';
import { useContext } from 'react';

import { StoreContext } from '../../context';

import type { Store } from '../../types';

export function useStore(): Store {
  const ctx = useContext(StoreContext);

  if (!ctx) {
    throw new Error('Spotlight sub-components must be rendered inside <Spotlight>.');
  }

  return ctx;
}
