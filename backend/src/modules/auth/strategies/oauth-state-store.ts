import * as crypto from 'crypto';
import type { Request } from 'express';

const MAX_AGE_MS = 10 * 60 * 1000;
const COOKIE_PATH = '/api/v1/auth';

/**
 * Login-CSRF defence for the Google and GitHub redirects, without a server-side session. A random value is sent to the provider as
 * `state` and kept in an httpOnly cookie in the same browser; the callback is accepted only when both match, so a link an attacker
 * prepared cannot sign a victim in to the attacker's account. One cookie per provider, so two sign-ins can run side by side.
 */
export class CookieStateStore {
  private readonly cookie: string;

  constructor(provider: 'google' | 'github') {
    this.cookie = `oauth_state_${provider}`;
  }

  store(req: Request, callback: (err: Error | null, state?: string) => void) {
    const state = crypto.randomBytes(32).toString('hex');
    req.res?.cookie(this.cookie, state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: MAX_AGE_MS, path: COOKIE_PATH });
    callback(null, state);
  }

  verify(req: Request, provided: string, callback: (err: Error | null, ok?: boolean, info?: { message: string }) => void) {
    const expected: unknown = req.cookies?.[this.cookie];
    req.res?.clearCookie(this.cookie, { path: COOKIE_PATH }); // a state is good for one callback only
    const ok =
      typeof expected === 'string' && typeof provided === 'string' && expected.length === provided.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    callback(null, ok, ok ? undefined : { message: 'Invalid OAuth state.' });
  }
}
