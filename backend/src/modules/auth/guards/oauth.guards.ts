import { CanActivate, Injectable, Logger, NotFoundException, Type } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export type OAuthProvider = 'google' | 'github';

/** 404 while a provider has no credentials, instead of sending people to the provider with a made-up client id. */
export function OAuthConfigured(provider: OAuthProvider): Type<CanActivate> {
  @Injectable()
  class OAuthConfiguredGuard implements CanActivate {
    canActivate() {
      const prefix = provider.toUpperCase();
      if (!process.env[`${prefix}_CLIENT_ID`] || !process.env[`${prefix}_CLIENT_SECRET`]) {
        throw new NotFoundException({ code: 'OAUTH_NOT_CONFIGURED', message: `Sign-in with ${provider} is not configured.` });
      }
      return true;
    }
  }
  return OAuthConfiguredGuard;
}

/**
 * Runs the provider login on the callback but never throws: a refused consent screen or a profile the strategy rejected (for
 * example an unverified email) leaves `req.user` false, and the controller sends the person back to the login page.
 */
export function OAuthCallback(provider: OAuthProvider): Type<CanActivate> {
  const logger = new Logger('OAuth');
  class OAuthCallbackGuard extends AuthGuard(provider) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleRequest(err: any, user: any, info: any) {
      if (!user) logger.warn(`${provider} sign-in refused: ${err?.response?.code ?? err?.message ?? info?.message ?? 'no profile'}`);
      return user || false;
    }
  }
  return OAuthCallbackGuard;
}
