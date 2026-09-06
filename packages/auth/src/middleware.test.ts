import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase SDK boundary. Tests against thin SDK wrappers should mock the
// SDK (not re-test it) and verify our own branching logic — here, the
// authenticated-vs-unauthenticated redirect rule.
let currentUser: { id: string } | null = null;
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const createServerClient = vi.fn(() => ({ auth: { getUser } }));

vi.mock('@supabase/ssr', () => ({ createServerClient }));

// Env vars must be set BEFORE importing the SUT — `requiredPublic` throws at module load otherwise.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

const { updateSession } = await import('./middleware');

function makeRequest(pathname: string) {
  // Minimal NextRequest shape — `updateSession` only touches `cookies.{getAll,set}`,
  // `nextUrl.pathname`, and `nextUrl.clone`.
  const cookieStore = new Map<string, string>();
  const url = new URL(`https://test.example${pathname}`);

  return {
    cookies: {
      getAll: () => Array.from(cookieStore, ([name, value]) => ({ name, value })),
      set: (name: string, value: string) => cookieStore.set(name, value)
    },
    nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) })
  } as never;
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
  });

  it('redirects unauthenticated requests on protected paths to /login', async () => {
    currentUser = null;
    const response = await updateSession(makeRequest('/dashboard'));
    expect(response.headers.get('location')).toBe('https://test.example/login');
  });

  it('lets unauthenticated requests through on auth-flow paths', async () => {
    currentUser = null;
    const response = await updateSession(makeRequest('/login'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('lets authenticated requests through to any path', async () => {
    currentUser = { id: 'user-1' };
    const response = await updateSession(makeRequest('/dashboard'));
    expect(response.headers.get('location')).toBeNull();
  });
});
