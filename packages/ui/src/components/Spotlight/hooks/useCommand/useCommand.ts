'use client';
import { useContext } from 'react';

import { CommandContext } from '../../context';

import type { CommandContextValue } from '../../types';

export function useCommand(): CommandContextValue {
  const ctx = useContext(CommandContext);

  if (!ctx) {
    throw new Error('Spotlight sub-components must be rendered inside <Spotlight>.');
  }

  return ctx;
}
