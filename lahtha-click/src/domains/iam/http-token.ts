// Shared helpers for reading/writing the session token over HTTP.

import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'lc_session';

/** Extract the session token from the Authorization bearer or the session cookie. */
export function bearerToken(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.header('cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() === SESSION_COOKIE) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, maxAgeMs: number, secure: boolean): void {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
