import { jwtDecode } from 'jwt-decode';

import type { JwtPayload } from 'jwt-decode';

interface Payload extends JwtPayload {
  role: string;
}

export function decode(accessToken: string): Payload {
  try {
    return jwtDecode<Payload>(accessToken);
  } catch {
    return { role: 'anon' };
  }
}
