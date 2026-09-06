'use client';
import { useEffect, useLayoutEffect } from 'react';

/**
 * Stable `useLayoutEffect` that downgrades to `useEffect` on the server.
 * Prevents the standard "useLayoutEffect on SSR" warning while keeping
 * pre-paint timing on the client.
 */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
