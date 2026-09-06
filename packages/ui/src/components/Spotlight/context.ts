'use client';
import { createContext } from 'react';

import type { CommandContextValue, GroupContextValue, Store } from './types';

export const CommandContext = createContext<CommandContextValue | null>(null);

export const StoreContext = createContext<Store | null>(null);

export const GroupContext = createContext<GroupContextValue | null>(null);
