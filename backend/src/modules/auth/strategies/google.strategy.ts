import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { CookieStateStore } from './oauth-state-store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy-google-client-id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy-google-secret',
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:5000/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
      store: new CookieStateStore('google'),
    } as unknown as ConstructorParameters<typeof Strategy>[0]); // `store` is supported by passport-oauth2 but missing from the typings
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const { id, emails, displayName, photos } = profile;
    // Only an address Google itself says is verified may identify a Veyro account.
    const verified = emails?.find((e) => e.verified)?.value;
    if (!verified) {
      throw new UnauthorizedException({ code: 'OAUTH_EMAIL_NOT_VERIFIED', message: 'Google did not return a verified email address.' });
    }
    return {
      provider: 'google',
      providerId: id,
      email: verified.toLowerCase(),
      name: displayName || 'Google User',
      avatarUrl: photos?.[0]?.value || null,
    };
  }
}
