import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { CookieStateStore } from './oauth-state-store';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'dummy-github-client-id',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'dummy-github-secret',
      callbackURL: configService.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:5000/api/v1/auth/github/callback',
      ),
      scope: ['user:email'],
      // Ask for every address with its primary/verified flags (by default only the primary one is kept, without the flag).
      allRawEmails: true,
      store: new CookieStateStore('github'),
    } as unknown as ConstructorParameters<typeof Strategy>[0]); // `store` is supported by passport-oauth2 but missing from the typings
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const { id, emails, displayName, username, photos } = profile;
    // GitHub lets anyone attach an unverified address to their account: only the primary, verified one may identify a Veyro account.
    const verified = (emails as Array<{ value: string; primary?: boolean; verified?: boolean }> | undefined)?.find((e) => e.primary && e.verified)?.value;
    if (!verified) {
      throw new UnauthorizedException({ code: 'OAUTH_EMAIL_NOT_VERIFIED', message: 'GitHub did not return a verified primary email address.' });
    }

    return {
      provider: 'github',
      providerId: id,
      email: verified.toLowerCase(),
      name: displayName || username || 'GitHub User',
      avatarUrl: photos?.[0]?.value || null,
    };
  }
}
